import { Router, type Request } from 'express'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { requireAuth } from '../../middleware/auth'
import {
  SessionError,
  openSession,
  settleSession,
  cancelSession,
  getLiveTabForTable,
  getSessionById,
  buildPosFloor,
} from '../../lib/sessions'

// ─── /api/cms/sessions ──────────────────────────────────────────────────────────
// POS counter billing: open a table's running tab, read its live total, and settle it
// with a single payment method (cash/upi/card). Live floor + KDS updates ride the
// existing reservation/order SSE buses (emitted inside lib/sessions). Franchise owners
// are pinned to their assigned outlet, matching cms/orders.ts and cms/reservations.ts.

const router = Router()

router.use(requireAuth)

/** Effective outlet filter with the standard franchise scoping. */
function scopedOutletId(req: Request): string | undefined {
  if (req.staff!.role === 'franchise_owner') {
    return req.staff!.assignedOutletId ?? undefined
  }
  return (req.query.outletId as string) || undefined
}

/** Guard: a franchise owner may only touch sessions in their assigned outlet. */
async function assertOutletAccess(req: Request, outletId: string): Promise<boolean> {
  if (req.staff!.role === 'franchise_owner') {
    return outletId === req.staff!.assignedOutletId
  }
  return true
}

// ─── GET /cms/sessions/floor ──────────────────────────────────────────────────────
// The POS floor: every table with reservation state + its live billing tab overlaid.
router.get('/floor', async (req, res, next) => {
  try {
    const outletId = scopedOutletId(req)
    if (!outletId) { res.status(400).json({ error: 'outletId is required' }); return }
    const floor = await buildPosFloor(outletId)
    res.json(floor)
  } catch (err) {
    next(err)
  }
})

// ─── GET /cms/sessions ────────────────────────────────────────────────────────────
// The live running tab for a table (?tableId=) — null when the table is free.
router.get('/', async (req, res, next) => {
  try {
    const outletId = scopedOutletId(req)
    if (!outletId) { res.status(400).json({ error: 'outletId is required' }); return }
    const tableId = req.query.tableId as string | undefined
    if (!tableId) { res.status(400).json({ error: 'tableId is required' }); return }
    const tab = await getLiveTabForTable(outletId, tableId)
    res.json(tab)
  } catch (err) {
    next(err)
  }
})

// ─── POST /cms/sessions ─────────────────────────────────────────────────────────
// Open a running tab for a table (walk-in, or seat a booking).
const OpenSchema = z.object({
  outletId:      z.string().uuid().optional(),
  tableId:       z.string().uuid(),
  reservationId: z.string().uuid().optional(),
  partySize:     z.number().int().min(1).max(50).optional(),
})

router.post('/', async (req, res, next) => {
  try {
    const body = OpenSchema.parse(req.body)
    const outletId =
      req.staff!.role === 'franchise_owner' ? req.staff!.assignedOutletId ?? undefined : body.outletId
    if (!outletId) { res.status(400).json({ error: 'outletId is required' }); return }

    const session = await openSession({
      outletId,
      tableId:       body.tableId,
      reservationId: body.reservationId ?? null,
      partySize:     body.partySize ?? null,
      openedById:    req.staff!.id,
    })
    res.status(201).json(session)
  } catch (err) {
    if (err instanceof SessionError) { res.status(err.status).json({ error: err.message }); return }
    next(err)
  }
})

// ─── GET /cms/sessions/:id ────────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const session = await getSessionById(req.params.id)
    if (!session) { res.status(404).json({ error: 'Session not found' }); return }
    if (!(await assertOutletAccess(req, session.outletId))) {
      res.status(403).json({ error: 'Not permitted for this outlet' }); return
    }
    res.json(session)
  } catch (err) {
    next(err)
  }
})

// ─── POST /cms/sessions/:id/settle ────────────────────────────────────────────────
const SettleSchema = z.object({ paymentMethod: z.enum(['cash', 'upi', 'card']) })

router.post('/:id/settle', async (req, res, next) => {
  try {
    const { paymentMethod } = SettleSchema.parse(req.body)

    const existing = await prisma.tableSession.findUnique({
      where: { id: req.params.id },
      select: { outletId: true },
    })
    if (!existing) { res.status(404).json({ error: 'Session not found' }); return }
    if (!(await assertOutletAccess(req, existing.outletId))) {
      res.status(403).json({ error: 'Not permitted for this outlet' }); return
    }

    const settled = await settleSession(req.params.id, paymentMethod, req.staff!.id)
    res.json(settled)
  } catch (err) {
    if (err instanceof SessionError) { res.status(err.status).json({ error: err.message }); return }
    next(err)
  }
})

// ─── POST /cms/sessions/:id/cancel ────────────────────────────────────────────────
router.post('/:id/cancel', async (req, res, next) => {
  try {
    const existing = await prisma.tableSession.findUnique({
      where: { id: req.params.id },
      select: { outletId: true },
    })
    if (!existing) { res.status(404).json({ error: 'Session not found' }); return }
    if (!(await assertOutletAccess(req, existing.outletId))) {
      res.status(403).json({ error: 'Not permitted for this outlet' }); return
    }

    const cancelled = await cancelSession(req.params.id, req.staff!.id)
    res.json(cancelled)
  } catch (err) {
    if (err instanceof SessionError) { res.status(err.status).json({ error: err.message }); return }
    next(err)
  }
})

export default router
