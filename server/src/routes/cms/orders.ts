import { Router, type Request } from 'express'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { requireAuth, resolveStaffFromToken } from '../../middleware/auth'
import { paginate } from '../../lib/paginate'
import { emitOrderEvent, onOrderEvent } from '../../lib/orderEvents'
import { emitCrmEvent } from '../../lib/crmEvents'
import { createOrderWithItems, OrderValidationError } from '../../lib/orders'

const router = Router()

const ORDER_STATUSES = ['new', 'preparing', 'ready', 'served', 'cancelled'] as const
type OrderStatus = (typeof ORDER_STATUSES)[number]
const ACTIVE_STATUSES: OrderStatus[] = ['new', 'preparing', 'ready']

const ITEM_STATUSES = ['pending', 'ready', 'served'] as const
type ItemStatus = (typeof ITEM_STATUSES)[number]
// Item-level toggles are only meaningful once the order is being made — never on a
// brand-new (unstarted) or terminal (served/cancelled) order.
const ITEM_TOGGLEABLE_STATUSES: OrderStatus[] = ['preparing', 'ready']

/**
 * Derive an order's status from its lines' collective progress. Every line served →
 * the order is served; every line ready-or-served → the order is ready; otherwise it
 * is still preparing. Only called for started orders, so it never returns `new`.
 */
function deriveOrderStatus(items: { itemStatus: ItemStatus }[]): 'preparing' | 'ready' | 'served' {
  if (items.length > 0 && items.every((i) => i.itemStatus === 'served')) return 'served'
  if (items.length > 0 && items.every((i) => i.itemStatus === 'ready' || i.itemStatus === 'served')) return 'ready'
  return 'preparing'
}

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
  tableId:     z.string().uuid().optional(), // real dine-in table (POS floor)
  sessionId:   z.string().uuid().optional(), // running tab this round belongs to
  note:        z.string().max(500).optional(),
  items: z
    .array(
      z.object({
        menuItemId:   z.string().uuid(),
        quantity:     z.number().int().min(1).max(99),
        variantLabel: z.string().max(60).optional(), // required for variant-priced items
        note:         z.string().max(200).optional(),
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

    // When attaching a round to a running tab, the tab must exist, be open, and belong
    // to this outlet (and table, if one was named). This keeps the bill total honest.
    if (body.sessionId) {
      const session = await prisma.tableSession.findUnique({
        where: { id: body.sessionId },
        select: { outletId: true, tableId: true, status: true },
      })
      if (!session || session.outletId !== outletId) {
        res.status(404).json({ error: 'Table tab not found for this outlet' })
        return
      }
      if (session.status !== 'open') {
        res.status(409).json({ error: 'This tab is no longer open' })
        return
      }
      if (body.tableId && body.tableId !== session.tableId) {
        res.status(400).json({ error: 'Table does not match this tab' })
        return
      }
    }

    const order = await createOrderWithItems({
      outletId,
      createdById: req.staff!.id,
      source:      'staff',
      serviceType: body.serviceType,
      boardNumber: body.boardNumber,
      tableId:     body.tableId ?? null,
      sessionId:   body.sessionId ?? null,
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

    // The whole-order button doubles as a "mark all remaining" shortcut so the card
    // and its lines never disagree: readying the order plates every still-pending line;
    // serving it sends out everything.
    if (status === 'ready') {
      await prisma.orderItem.updateMany({
        where: { orderId: existing.id, itemStatus: 'pending' },
        data: { itemStatus: 'ready' },
      })
    } else if (status === 'served') {
      await prisma.orderItem.updateMany({
        where: { orderId: existing.id, itemStatus: { not: 'served' } },
        data: { itemStatus: 'served' },
      })
    }

    const order = await prisma.order.update({
      where: { id: existing.id },
      data,
      include: { items: true },
    })

    emitOrderEvent(order.outletId, { type: 'status', order })
    // A served order realises revenue → the customer's CLV/order count changed, so
    // nudge the live Customers CRM feed to refresh.
    if (status === 'served' && order.customerId) {
      emitCrmEvent({ type: 'customer', outletId: order.outletId })
    }
    res.json(order)
  } catch (err) {
    next(err)
  }
})

// ─── PATCH /cms/orders/:orderId/items/:itemId/status ──────────────────────────
// Advance a single line's kitchen progress (pending → ready → served, or back). The
// order's own status is then re-derived from all its lines: once every line is ready
// the card auto-moves to the Ready column; once every line is served it closes. This
// is the per-item counterpart to the whole-order /status button.
const UpdateItemStatusSchema = z.object({ itemStatus: z.enum(ITEM_STATUSES) })

router.patch('/:orderId/items/:itemId/status', async (req, res, next) => {
  try {
    const { itemStatus } = UpdateItemStatusSchema.parse(req.body)

    const order = await prisma.order.findUnique({
      where: { id: req.params.orderId },
      select: {
        id: true,
        outletId: true,
        status: true,
        customerId: true,
        items: { select: { id: true, itemStatus: true } },
      },
    })
    if (!order) { res.status(404).json({ error: 'Order not found' }); return }

    if (req.staff!.role === 'franchise_owner' && order.outletId !== req.staff!.assignedOutletId) {
      res.status(403).json({ error: 'Not permitted for this outlet' })
      return
    }
    if (!ITEM_TOGGLEABLE_STATUSES.includes(order.status)) {
      res.status(409).json({ error: 'Order is not in preparation' })
      return
    }
    const target = order.items.find((it) => it.id === req.params.itemId)
    if (!target) { res.status(404).json({ error: 'Item not found on this order' }); return }

    // Apply the line change, then recompute the collective state.
    await prisma.orderItem.update({ where: { id: target.id }, data: { itemStatus } })
    const nextItems = order.items.map((it) =>
      it.id === target.id ? { ...it, itemStatus } : it
    )
    const derived = deriveOrderStatus(nextItems as { itemStatus: ItemStatus }[])
    const statusChanged = derived !== order.status

    let updated
    if (statusChanged) {
      const data: any = { status: derived }
      if (derived === 'served') data.closedAt = new Date()
      updated = await prisma.order.update({ where: { id: order.id }, data, include: { items: true } })
    } else {
      // No column move — just return the fresh line states.
      updated = await prisma.order.findUnique({ where: { id: order.id }, include: { items: true } })
    }

    emitOrderEvent(order.outletId, { type: 'status', order: updated })
    // Auto-close to served realises revenue, same as the whole-order path.
    if (statusChanged && derived === 'served' && order.customerId) {
      emitCrmEvent({ type: 'customer', outletId: order.outletId })
    }
    res.json(updated)
  } catch (err) {
    next(err)
  }
})

// ─── DELETE /cms/orders/:orderId/items/:itemId ────────────────────────────────
// Remove a single line from an order (guest cancelled a dish). Allowed only while the
// order is still active AND not yet plated — new/preparing (the "not prepared" guard);
// a `ready` or `served` dish has already been made, so it can't just vanish from the
// bill here. Removing the order's last line cancels the whole order. The bill total is
// derived from the remaining items, so it re-computes automatically.
const REMOVABLE_STATUSES: OrderStatus[] = ['new', 'preparing']

router.delete('/:orderId/items/:itemId', async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.orderId },
      select: { id: true, outletId: true, status: true, items: { select: { id: true } } },
    })
    if (!order) { res.status(404).json({ error: 'Order not found' }); return }

    if (req.staff!.role === 'franchise_owner' && order.outletId !== req.staff!.assignedOutletId) {
      res.status(403).json({ error: 'Not permitted for this outlet' })
      return
    }
    if (!REMOVABLE_STATUSES.includes(order.status)) {
      res.status(409).json({ error: 'This item is already prepared and cannot be removed' })
      return
    }
    if (!order.items.some((it) => it.id === req.params.itemId)) {
      res.status(404).json({ error: 'Item not found on this order' })
      return
    }

    await prisma.orderItem.delete({ where: { id: req.params.itemId } })

    // Last line gone → cancel the whole order so it leaves the board and the bill.
    if (order.items.length === 1) {
      const cancelled = await prisma.order.update({
        where: { id: order.id },
        data: { status: 'cancelled', cancelledBy: 'staff', closedAt: new Date() },
        include: { items: true },
      })
      emitOrderEvent(cancelled.outletId, { type: 'status', order: cancelled })
      res.json({ order: cancelled, orderCancelled: true })
      return
    }

    const updated = await prisma.order.findUnique({ where: { id: order.id }, include: { items: true } })
    emitOrderEvent(order.outletId, { type: 'status', order: updated })
    res.json({ order: updated, orderCancelled: false })
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

    // Settled tabs in the window, grouped by how they were paid — the owner's
    // end-of-day cash/UPI/card reconciliation.
    const paymentWhere: any = { status: 'settled', settledAt: { gte: from, lte: to } }
    if (outletId) paymentWhere.outletId = outletId

    const [servedCount, cancelledStaff, cancelledCustomer, activeCount, servedOrders, paymentGroups] =
      await Promise.all([
        prisma.order.count({ where: { ...closedWhere, status: 'served' } }),
        prisma.order.count({ where: { ...closedWhere, status: 'cancelled', cancelledBy: 'staff' } }),
        prisma.order.count({ where: { ...closedWhere, status: 'cancelled', cancelledBy: 'customer' } }),
        prisma.order.count({ where: { ...outletWhere, status: { in: ACTIVE_STATUSES } } }),
        prisma.order.findMany({
          where: { ...closedWhere, status: 'served' },
          select: { items: { select: { nameSnapshot: true, quantity: true, priceSnapshot: true } } },
        }),
        prisma.tableSession.groupBy({
          by: ['paymentMethod'],
          where: paymentWhere,
          _sum: { paidAmount: true },
          _count: { _all: true },
        }),
      ])

    // Normalise into a fixed { cash, upi, card } shape (0 when a method wasn't used).
    const payments = { cash: 0, upi: 0, card: 0 } as Record<'cash' | 'upi' | 'card', number>
    const paymentCounts = { cash: 0, upi: 0, card: 0 } as Record<'cash' | 'upi' | 'card', number>
    let settledTabs = 0
    for (const g of paymentGroups) {
      if (!g.paymentMethod) continue
      const m = g.paymentMethod as 'cash' | 'upi' | 'card'
      payments[m] = Number(g._sum.paidAmount ?? 0)
      paymentCounts[m] = g._count._all
      settledTabs += g._count._all
    }

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
      payments,        // { cash, upi, card } — settled tab amounts by method
      paymentCounts,   // { cash, upi, card } — settled tab counts by method
      settledTabs,     // total tabs settled in the window
    })
  } catch (err) {
    next(err)
  }
})

export default router
