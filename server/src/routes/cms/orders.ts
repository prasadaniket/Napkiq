import { Router, type Request } from 'express'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { requireAuth, resolveStaffFromToken } from '../../middleware/auth'
import { paginate } from '../../lib/paginate'
import { emitOrderEvent, onOrderEvent } from '../../lib/orderEvents'
import { createOrderWithItems, OrderValidationError } from '../../lib/orders'

const router = Router()

const ORDER_STATUSES = ['new', 'preparing', 'ready', 'served', 'cancelled'] as const
type OrderStatus = (typeof ORDER_STATUSES)[number]
const ACTIVE_STATUSES: OrderStatus[] = ['new', 'preparing', 'ready']

// ─── GET /cms/orders/stream ───────────────────────────────────────────────────
// Live KDS feed via Server-Sent Events. Registered BEFORE `requireAuth` because
// EventSource cannot send an Authorization header (and CMS ↔ API are cross-domain,
// so cookies don't ride along either) — so it authenticates via a `?token=` query
// param, validated with the same Supabase + Staff lookup as requireAuth.
router.get('/stream', async (req, res, next) => {
  try {
    const token = (req.query.token as string) || ''
    if (!token) {
      res.status(401).json({ error: 'Missing token' })
      return
    }

    const staff = await resolveStaffFromToken(token)
    if (!staff) {
      res.status(401).json({ error: 'Invalid or expired token' })
      return
    }

    // A stream targets exactly one outlet. franchise_owner is pinned to their outlet;
    // admin/owner must name one via ?outletId.
    let outletId: string | undefined
    if (staff.role === 'franchise_owner') {
      outletId = staff.assignedOutletId ?? undefined
    } else if (req.query.outletId) {
      outletId = req.query.outletId as string
    }
    if (!outletId) {
      res.status(400).json({ error: 'outletId is required' })
      return
    }

    res.writeHead(200, {
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache, no-transform',
      Connection:          'keep-alive',
      'X-Accel-Buffering': 'no', // disable proxy buffering (nginx/Render)
    })
    res.write(': connected\n\n')

    const unsubscribe = onOrderEvent(outletId, (event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`)
    })

    // Heartbeat keeps intermediaries from closing an idle connection.
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

// Everything below requires a Bearer token.
router.use(requireAuth)

/** Resolve the effective outlet filter using the standard franchise scoping. */
function scopedOutletId(req: Request): string | undefined {
  if (req.staff!.role === 'franchise_owner') {
    return req.staff!.assignedOutletId ?? undefined
  }
  return (req.query.outletId as string) || undefined
}

// ─── GET /cms/orders ──────────────────────────────────────────────────────────
// The KDS board. Defaults to active statuses (new/preparing/ready); pass
// ?status=served|cancelled|all for history views. No pagination — a board is small.
router.get('/', async (req, res, next) => {
  try {
    const outletId = scopedOutletId(req)

    const where: any = {}
    if (outletId) where.outletId = outletId

    const statusParam = req.query.status as string | undefined
    if (statusParam && statusParam !== 'all') {
      if (!ORDER_STATUSES.includes(statusParam as OrderStatus)) {
        res.status(400).json({ error: 'Invalid status' })
        return
      }
      where.status = statusParam
    } else if (!statusParam) {
      where.status = { in: ACTIVE_STATUSES }
    }

    const orders = await prisma.order.findMany({
      where,
      include: { items: true },
      orderBy: { createdAt: 'asc' },
    })

    res.json(orders)
  } catch (err) {
    next(err)
  }
})

// ─── POST /cms/orders ─────────────────────────────────────────────────────────
// Staff manual order entry (POS-style). Feeds the same board + log as customer orders.
const CreateStaffOrderSchema = z.object({
  outletId:    z.string().uuid().optional(),
  serviceType: z.enum(['table', 'self']).default('table'),
  boardNumber: z.string().max(10).optional(),
  note:        z.string().max(500).optional(),
  items: z
    .array(
      z.object({
        menuItemId: z.string().uuid(),
        quantity:   z.number().int().min(1).max(99),
        note:       z.string().max(200).optional(),
      })
    )
    .min(1),
})

router.post('/', async (req, res, next) => {
  try {
    const body = CreateStaffOrderSchema.parse(req.body)

    // franchise_owner is pinned to their outlet; admin/owner must specify one.
    const outletId =
      req.staff!.role === 'franchise_owner'
        ? req.staff!.assignedOutletId ?? undefined
        : body.outletId
    if (!outletId) {
      res.status(400).json({ error: 'outletId is required' })
      return
    }

    const order = await createOrderWithItems({
      outletId,
      createdById: req.staff!.id,
      source:      'staff',
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

// ─── PATCH /cms/orders/:id/status ─────────────────────────────────────────────
const UpdateStatusSchema = z.object({ status: z.enum(ORDER_STATUSES) })

router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = UpdateStatusSchema.parse(req.body)

    const existing = await prisma.order.findUnique({
      where: { id: req.params.id },
      select: { id: true, outletId: true },
    })
    if (!existing) {
      res.status(404).json({ error: 'Order not found' })
      return
    }

    // franchise_owner may only touch their own outlet's orders.
    if (
      req.staff!.role === 'franchise_owner' &&
      existing.outletId !== req.staff!.assignedOutletId
    ) {
      res.status(403).json({ error: 'Not permitted for this outlet' })
      return
    }

    const data: any = { status }
    if (status === 'served') {
      data.closedAt = new Date()
    } else if (status === 'cancelled') {
      data.cancelledBy = 'staff'
      data.closedAt = new Date()
    }

    const order = await prisma.order.update({
      where: { id: existing.id },
      data,
      include: { items: true },
    })

    emitOrderEvent(order.outletId, { type: 'status', order })
    res.json(order)
  } catch (err) {
    next(err)
  }
})

// ─── GET /cms/orders/history ──────────────────────────────────────────────────
// Paginated order log with date/status/outlet filters (the reporting surface;
// distinct from the active-only board at GET /). Franchise-scoped like visits.ts.
router.get('/history', async (req, res, next) => {
  try {
    const page = Math.max(0, parseInt(req.query.page as string) || 0)
    const size = Math.min(100, Math.max(1, parseInt(req.query.size as string) || 20))
    const outletId = scopedOutletId(req)

    const where: any = {}
    if (outletId) where.outletId = outletId

    const statusParam = req.query.status as string | undefined
    if (statusParam && statusParam !== 'all') {
      if (!ORDER_STATUSES.includes(statusParam as OrderStatus)) {
        res.status(400).json({ error: 'Invalid status' })
        return
      }
      where.status = statusParam
    }

    if (req.query.dateFrom || req.query.dateTo) {
      where.createdAt = {}
      if (req.query.dateFrom) where.createdAt.gte = new Date(req.query.dateFrom as string)
      if (req.query.dateTo)   where.createdAt.lte = new Date(req.query.dateTo as string)
    }

    // Quick lookup by the daily token number (e.g. staff searching "120").
    const num = parseInt(req.query.number as string)
    if (!isNaN(num)) where.dailyNumber = num

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: { items: true, outlet: { select: { name: true, code: true } } },
        orderBy: { createdAt: 'desc' },
        skip: page * size,
        take: size,
      }),
      prisma.order.count({ where }),
    ])

    res.json(paginate(orders, total, page, size))
  } catch (err) {
    next(err)
  }
})

// ─── GET /cms/orders/summary ──────────────────────────────────────────────────
// Sales report for a date range (defaults to today). Served/cancelled counts
// (cancelled split by who cancelled), active count, items sold, revenue, top items.
router.get('/summary', async (req, res, next) => {
  try {
    const outletId = scopedOutletId(req)

    // Default window: local start-of-today → now.
    const from = req.query.dateFrom
      ? new Date(req.query.dateFrom as string)
      : new Date(new Date().setHours(0, 0, 0, 0))
    const to = req.query.dateTo ? new Date(req.query.dateTo as string) : new Date()

    const outletWhere: any = {}
    if (outletId) outletWhere.outletId = outletId

    // Served/cancelled are counted by closedAt (when they reached terminal state);
    // active is a live count (created within window, still open).
    const closedWhere = { ...outletWhere, closedAt: { gte: from, lte: to } }

    const [servedCount, cancelledStaff, cancelledCustomer, activeCount, servedOrders] =
      await Promise.all([
        prisma.order.count({ where: { ...closedWhere, status: 'served' } }),
        prisma.order.count({ where: { ...closedWhere, status: 'cancelled', cancelledBy: 'staff' } }),
        prisma.order.count({ where: { ...closedWhere, status: 'cancelled', cancelledBy: 'customer' } }),
        prisma.order.count({ where: { ...outletWhere, status: { in: ACTIVE_STATUSES } } }),
        prisma.order.findMany({
          where: { ...closedWhere, status: 'served' },
          select: { items: { select: { nameSnapshot: true, quantity: true, priceSnapshot: true } } },
        }),
      ])

    let itemsSold = 0
    let revenue = 0
    const topMap = new Map<string, number>()
    for (const o of servedOrders) {
      for (const it of o.items) {
        itemsSold += it.quantity
        if (it.priceSnapshot != null) revenue += Number(it.priceSnapshot) * it.quantity
        topMap.set(it.nameSnapshot, (topMap.get(it.nameSnapshot) ?? 0) + it.quantity)
      }
    }
    const topItems = [...topMap.entries()]
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5)

    res.json({
      from,
      to,
      servedCount,
      cancelledByStaff:    cancelledStaff,
      cancelledByCustomer: cancelledCustomer,
      cancelledCount:      cancelledStaff + cancelledCustomer,
      activeCount,
      itemsSold,
      revenue,
      topItems,
    })
  } catch (err) {
    next(err)
  }
})

export default router
