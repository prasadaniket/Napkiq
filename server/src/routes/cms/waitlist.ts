import { Router, type Request } from 'express'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { requireAuth } from '../../middleware/auth'
import { emitReservationEvent } from '../../lib/reservationEvents'

// ─── Walk-in queue / waitlist ────────────────────────────────────────────────────
// Guests without a reservation who join the queue at the door. Staff quote a wait
// time and seat them (optionally onto a table) when one frees. Franchise-scoped.

const router = Router()
router.use(requireAuth)

const STATUSES = ['waiting', 'seated', 'left', 'no_show'] as const
type Status = (typeof STATUSES)[number]

function scopedOutletId(req: Request): string | undefined {
  if (req.staff!.role === 'franchise_owner') return req.staff!.assignedOutletId ?? undefined
  return (req.query.outletId as string) || (req.body?.outletId as string) || undefined
}
function assertOutletAllowed(req: Request, outletId: string): boolean {
  if (req.staff!.role === 'franchise_owner') return outletId === req.staff!.assignedOutletId
  return true
}

// ─── GET /cms/waitlist ──────────────────────────────────────────────────────────
// Current queue (waiting) by default; ?status=all|seated|left|no_show for history.
router.get('/', async (req, res, next) => {
  try {
    const outletId = scopedOutletId(req)
    if (!outletId) { res.status(400).json({ error: 'outletId is required' }); return }

    const where: any = { outletId }
    const statusParam = req.query.status as string | undefined
    if (statusParam && statusParam !== 'all') {
      if (!STATUSES.includes(statusParam as Status)) { res.status(400).json({ error: 'Invalid status' }); return }
      where.status = statusParam
    } else if (!statusParam) {
      where.status = 'waiting'
    }

    const entries = await prisma.waitlistEntry.findMany({ where, orderBy: { createdAt: 'asc' } })
    res.json(entries)
  } catch (err) {
    next(err)
  }
})

// ─── POST /cms/waitlist ─────────────────────────────────────────────────────────
const CreateSchema = z.object({
  outletId:      z.string().uuid().optional(),
  guestName:     z.string().min(1).max(120),
  guestPhone:    z.string().min(6).max(15),
  partySize:     z.number().int().min(1).max(50),
  quotedMinutes: z.number().int().min(0).max(600).optional(),
  note:          z.string().max(300).optional(),
})

router.post('/', async (req, res, next) => {
  try {
    const body = CreateSchema.parse(req.body)
    const outletId =
      req.staff!.role === 'franchise_owner' ? req.staff!.assignedOutletId ?? undefined : body.outletId
    if (!outletId) { res.status(400).json({ error: 'outletId is required' }); return }

    const entry = await prisma.waitlistEntry.create({
      data: {
        outletId,
        guestName: body.guestName,
        guestPhone: body.guestPhone,
        partySize: body.partySize,
        quotedMinutes: body.quotedMinutes ?? null,
        note: body.note ?? null,
        createdById: req.staff!.id,
      },
    })
    emitReservationEvent(outletId, { type: 'waitlist' })
    res.status(201).json(entry)
  } catch (err) {
    next(err)
  }
})

// ─── PATCH /cms/waitlist/:id ────────────────────────────────────────────────────
// Update status (seat / mark left / no-show) or the quoted wait.
const UpdateSchema = z.object({
  status:        z.enum(STATUSES).optional(),
  quotedMinutes: z.number().int().min(0).max(600).nullable().optional(),
  tableId:       z.string().uuid().nullable().optional(),
})

router.patch('/:id', async (req, res, next) => {
  try {
    const body = UpdateSchema.parse(req.body)
    const existing = await prisma.waitlistEntry.findUnique({
      where: { id: req.params.id },
      select: { id: true, outletId: true },
    })
    if (!existing) { res.status(404).json({ error: 'Entry not found' }); return }
    if (!assertOutletAllowed(req, existing.outletId)) {
      res.status(403).json({ error: 'Not permitted for this outlet' }); return
    }

    const data: any = { ...body }
    if (body.status === 'seated') data.seatedAt = new Date()

    const entry = await prisma.waitlistEntry.update({ where: { id: existing.id }, data })
    emitReservationEvent(existing.outletId, { type: 'waitlist' })
    res.json(entry)
  } catch (err) {
    next(err)
  }
})

export default router
