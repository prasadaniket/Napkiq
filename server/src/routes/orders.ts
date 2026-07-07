import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { writeLimiter, readLimiter } from '../middleware/rateLimit'
import { createOrderWithItems, OrderValidationError } from '../lib/orders'
import { emitOrderEvent, onOrderEvent } from '../lib/orderEvents'

const router = Router()

const CreateOrderSchema = z
  .object({
    outletId:    z.string().uuid().optional(),
    outletCode:  z.string().min(1).optional(),
    deviceId:    z.string().min(1).optional(),
    serviceType: z.enum(['table', 'self']).default('table'),
    boardNumber: z.string().max(10).optional(),
    note:        z.string().max(500).optional(),
    items: z
      .array(
        z.object({
          menuItemId:   z.string().uuid(),
          quantity:     z.number().int().min(1).max(99),
          variantLabel: z.string().max(60).optional(),
          note:         z.string().max(200).optional(),
        })
      )
      .min(1),
  })
  .refine((d) => d.outletId || d.outletCode, {
    message: 'outletId or outletCode is required',
  })

// ─── POST /orders ─────────────────────────────────────────────────────────────
// Public — a customer placing an order from the menu cart. Prices are snapshotted
// server-side; the customer is linked by deviceId when known.
router.post('/', writeLimiter, async (req, res, next) => {
  try {
    const body = CreateOrderSchema.parse(req.body)

    // Resolve the outlet by id or by slug/code (mirrors GET /menu/outlet/:code).
    const outlet = body.outletId
      ? await prisma.outlet.findUnique({ where: { id: body.outletId }, select: { id: true } })
      : await prisma.outlet.findFirst({
          where: {
            OR: [
              { slug: body.outletCode!.toLowerCase() },
              { code: body.outletCode!.toUpperCase() },
            ],
          },
          select: { id: true },
        })
    if (!outlet) {
      res.status(400).json({ error: 'Unknown outlet' })
      return
    }

    // Link to a known customer by device fingerprint, if any.
    let customerId: string | null = null
    if (body.deviceId) {
      const customer = await prisma.customer.findUnique({
        where: { deviceId: body.deviceId },
        select: { id: true },
      })
      customerId = customer?.id ?? null
    }

    const order = await createOrderWithItems({
      outletId:    outlet.id,
      customerId,
      deviceId:    body.deviceId ?? null,
      source:      'customer',
      serviceType: body.serviceType,
      boardNumber: body.boardNumber,
      note:        body.note,
      items:       body.items,
    })

    res.status(201).json(order)
  } catch (err) {
    if (err instanceof OrderValidationError) {
      res.status(err.status).json({ error: err.message })
      return
    }
    next(err)
  }
})

// ─── GET /orders/by-device/:deviceId ──────────────────────────────────────────
// A customer's own order history for this device (newest first). Public — the
// device fingerprint is an unguessable local id, mirroring /customers/by-device.
router.get('/by-device/:deviceId', readLimiter, async (req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      where: { deviceId: req.params.deviceId as string },
      include: { items: true, outlet: { select: { name: true, code: true, slug: true } } },
      orderBy: { createdAt: 'desc' },
      take: 25,
    })
    res.json(orders)
  } catch (err) {
    next(err)
  }
})

// ─── GET /orders/:id ──────────────────────────────────────────────────────────
// Fetch a single order by its opaque UUID (used by the customer tracking page).
// SECURITY (accepted): the order UUID is intentionally a capability token — a random
// v4 UUID is unguessable, so holding the link is authorization (same model as a
// password-reset link). No device-ownership check by design; the enumerable surface
// (by-device history) is throttled and keyed on a random device token instead.
router.get('/:id', async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { items: true, outlet: { select: { name: true, code: true, slug: true } } },
    })
    if (!order) {
      res.status(404).json({ error: 'Order not found' })
      return
    }
    res.json(order)
  } catch (err) {
    next(err)
  }
})

// ─── GET /orders/:id/stream ───────────────────────────────────────────────────
// Public per-order live status feed (SSE). Reuses the outlet-scoped broker and
// filters events down to this one order. Keyed by the opaque order UUID — no auth.
router.get('/:id/stream', async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      select: { id: true, outletId: true },
    })
    if (!order) {
      res.status(404).json({ error: 'Order not found' })
      return
    }

    res.writeHead(200, {
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache, no-transform',
      Connection:          'keep-alive',
      'X-Accel-Buffering': 'no',
    })
    res.write(': connected\n\n')

    const unsubscribe = onOrderEvent(order.outletId, (event) => {
      const o = event.order as { id?: string } | undefined
      if (o?.id === order.id) res.write(`data: ${JSON.stringify(event)}\n\n`)
    })
    const heartbeat = setInterval(() => res.write(': ping\n\n'), 25_000)

    req.on('close', () => {
      clearInterval(heartbeat)
      unsubscribe()
      res.end()
    })
  } catch (err) {
    next(err)
  }
})

// ─── PATCH /orders/:id/cancel ─────────────────────────────────────────────────
// Customer self-cancel — only while the kitchen hasn't started (status = new) and
// only for the device that placed the order. Records cancelledBy = customer.
const CancelSchema = z.object({ deviceId: z.string().min(1) })

router.patch('/:id/cancel', writeLimiter, async (req, res, next) => {
  try {
    const { deviceId } = CancelSchema.parse(req.body)
    const id = req.params.id as string

    const existing = await prisma.order.findUnique({
      where: { id },
      select: { id: true, status: true, deviceId: true },
    })
    if (!existing) {
      res.status(404).json({ error: 'Order not found' })
      return
    }
    if (!existing.deviceId || existing.deviceId !== deviceId) {
      res.status(403).json({ error: 'Not permitted' })
      return
    }
    if (existing.status !== 'new') {
      res.status(409).json({ error: 'This order can no longer be cancelled' })
      return
    }

    const order = await prisma.order.update({
      where: { id: existing.id },
      data: { status: 'cancelled', cancelledBy: 'customer', closedAt: new Date() },
      include: { items: true },
    })

    emitOrderEvent(order.outletId, { type: 'status', order })
    res.json(order)
  } catch (err) {
    next(err)
  }
})

export default router
