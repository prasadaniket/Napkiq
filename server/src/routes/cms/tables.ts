import { Router, type Request } from 'express'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { requireAuth } from '../../middleware/auth'
import { emitReservationEvent } from '../../lib/reservationEvents'

const router = Router()
router.use(requireAuth)

const ZONES = ['ac', 'non_ac', 'outdoor'] as const
const SHAPES = ['square', 'round', 'rect'] as const

/** Effective outlet filter with the standard franchise scoping. */
function scopedOutletId(req: Request): string | undefined {
  if (req.staff!.role === 'franchise_owner') {
    return req.staff!.assignedOutletId ?? undefined
  }
  return (req.query.outletId as string) || (req.body?.outletId as string) || undefined
}

/** Ensure the caller may act on this outlet (franchise pinned to their own). */
function assertOutletAllowed(req: Request, outletId: string): boolean {
  if (req.staff!.role === 'franchise_owner') {
    return outletId === req.staff!.assignedOutletId
  }
  return true
}

// ─── GET /cms/tables ───────────────────────────────────────────────────────────
// All tables for an outlet (includes inactive so staff can re-enable them).
router.get('/', async (req, res, next) => {
  try {
    const outletId = scopedOutletId(req)
    if (!outletId) { res.status(400).json({ error: 'outletId is required' }); return }

    const tables = await prisma.restaurantTable.findMany({
      where: { outletId },
      orderBy: [{ zone: 'asc' }, { name: 'asc' }],
    })
    res.json(tables)
  } catch (err) {
    next(err)
  }
})

// ─── POST /cms/tables ──────────────────────────────────────────────────────────
const CreateSchema = z.object({
  outletId: z.string().uuid().optional(),
  name:     z.string().min(1).max(40),
  capacity: z.number().int().min(1).max(50),
  zone:     z.enum(ZONES).default('non_ac'),
  isActive: z.boolean().optional(),
})

router.post('/', async (req, res, next) => {
  try {
    const body = CreateSchema.parse(req.body)
    const outletId =
      req.staff!.role === 'franchise_owner' ? req.staff!.assignedOutletId ?? undefined : body.outletId
    if (!outletId) { res.status(400).json({ error: 'outletId is required' }); return }

    const table = await prisma.restaurantTable.create({
      data: {
        outletId,
        name: body.name,
        capacity: body.capacity,
        zone: body.zone,
        isActive: body.isActive ?? true,
      },
    })
    emitReservationEvent(outletId, { type: 'table' })
    res.status(201).json(table)
  } catch (err) {
    next(err)
  }
})

// ─── POST /cms/tables/bulk ─────────────────────────────────────────────────────
// Create many tables at once. Names auto-generated as `${prefix}${n}`, continuing
// after the highest existing number for that prefix so nothing collides.
const BulkSchema = z.object({
  outletId:   z.string().uuid().optional(),
  namePrefix: z.string().min(1).max(10),
  capacity:   z.number().int().min(1).max(50),
  zone:       z.enum(ZONES).default('non_ac'),
  count:      z.number().int().min(1).max(100),
})

router.post('/bulk', async (req, res, next) => {
  try {
    const body = BulkSchema.parse(req.body)
    const outletId =
      req.staff!.role === 'franchise_owner' ? req.staff!.assignedOutletId ?? undefined : body.outletId
    if (!outletId) { res.status(400).json({ error: 'outletId is required' }); return }

    // Continue numbering after the largest existing "<prefix><number>" at this outlet.
    const existing = await prisma.restaurantTable.findMany({
      where: { outletId, name: { startsWith: body.namePrefix } },
      select: { name: true },
    })
    const re = new RegExp(`^${body.namePrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)$`)
    let maxN = 0
    for (const t of existing) {
      const m = t.name.match(re)
      if (m) maxN = Math.max(maxN, parseInt(m[1], 10))
    }

    const data = Array.from({ length: body.count }, (_, i) => ({
      outletId,
      name: `${body.namePrefix}${maxN + 1 + i}`,
      capacity: body.capacity,
      zone: body.zone,
    }))

    await prisma.restaurantTable.createMany({ data })
    emitReservationEvent(outletId, { type: 'table' })
    res.status(201).json({ created: data.length, from: `${body.namePrefix}${maxN + 1}`, to: `${body.namePrefix}${maxN + body.count}` })
  } catch (err) {
    next(err)
  }
})

// ─── PATCH /cms/tables/:id ─────────────────────────────────────────────────────
// Edit a table, toggle active, or block/unblock it (floor view).
const UpdateSchema = z.object({
  name:        z.string().min(1).max(40).optional(),
  capacity:    z.number().int().min(1).max(50).optional(),
  zone:        z.enum(ZONES).optional(),
  isActive:    z.boolean().optional(),
  isBlocked:   z.boolean().optional(),
  blockReason: z.string().max(120).nullable().optional(),
  sortOrder:   z.number().int().min(0).max(9999).nullable().optional(),
  posX:        z.number().min(0).max(100).nullable().optional(),
  posY:        z.number().min(0).max(100).nullable().optional(),
  shape:       z.enum(SHAPES).optional(),
})

// ─── PATCH /cms/tables/layout ──────────────────────────────────────────────────
// Bulk-save floor-plan positions from the drag-to-arrange editor. Each item pins a
// table's posX/posY (percent of the room canvas) and optional shape. Franchise-scoped.
const LayoutSchema = z.object({
  outletId: z.string().uuid().optional(),
  tables: z.array(z.object({
    id:    z.string().uuid(),
    posX:  z.number().min(0).max(100),
    posY:  z.number().min(0).max(100),
    shape: z.enum(SHAPES).optional(),
  })).min(1).max(300),
})

router.patch('/layout', async (req, res, next) => {
  try {
    const body = LayoutSchema.parse(req.body)
    const outletId =
      req.staff!.role === 'franchise_owner' ? req.staff!.assignedOutletId ?? undefined : body.outletId
    if (!outletId) { res.status(400).json({ error: 'outletId is required' }); return }

    // Only touch tables that actually belong to this outlet (guards against spoofed ids).
    const owned = await prisma.restaurantTable.findMany({
      where: { id: { in: body.tables.map((t) => t.id) }, outletId },
      select: { id: true },
    })
    const ownedIds = new Set(owned.map((t) => t.id))

    await prisma.$transaction(
      body.tables
        .filter((t) => ownedIds.has(t.id))
        .map((t) => prisma.restaurantTable.update({
          where: { id: t.id },
          data: { posX: t.posX, posY: t.posY, ...(t.shape ? { shape: t.shape } : {}) },
        }))
    )
    emitReservationEvent(outletId, { type: 'table' })
    res.json({ ok: true, saved: ownedIds.size })
  } catch (err) {
    next(err)
  }
})

router.patch('/:id', async (req, res, next) => {
  try {
    const body = UpdateSchema.parse(req.body)

    const existing = await prisma.restaurantTable.findUnique({
      where: { id: req.params.id },
      select: { id: true, outletId: true },
    })
    if (!existing) { res.status(404).json({ error: 'Table not found' }); return }
    if (!assertOutletAllowed(req, existing.outletId)) {
      res.status(403).json({ error: 'Not permitted for this outlet' })
      return
    }

    // Clearing a block also clears any stale reason.
    const data: any = { ...body }
    if (body.isBlocked === false) data.blockReason = null

    const table = await prisma.restaurantTable.update({ where: { id: existing.id }, data })
    emitReservationEvent(existing.outletId, { type: 'table' })
    res.json(table)
  } catch (err) {
    next(err)
  }
})

// ─── DELETE /cms/tables/:id ────────────────────────────────────────────────────
// Permanently remove a table. If it has any reservation history (as a primary or
// additional table) it CANNOT be hard-deleted without destroying that history, so
// we fall back to deactivation and tell the caller. Tables that were never booked
// (the usual "added by mistake" case) are deleted for real, everywhere.
router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.restaurantTable.findUnique({
      where: { id: req.params.id },
      select: { id: true, outletId: true },
    })
    if (!existing) { res.status(404).json({ error: 'Table not found' }); return }
    if (!assertOutletAllowed(req, existing.outletId)) {
      res.status(403).json({ error: 'Not permitted for this outlet' })
      return
    }

    // Any reservation referencing this table (primary link or multi-table join)
    // pins it — deleting would orphan/erase booking history.
    const [primaryRefs, joinRefs] = await Promise.all([
      prisma.reservation.count({ where: { tableId: existing.id } }),
      prisma.reservationTable.count({ where: { tableId: existing.id } }),
    ])

    if (primaryRefs + joinRefs > 0) {
      await prisma.restaurantTable.update({ where: { id: existing.id }, data: { isActive: false } })
      emitReservationEvent(existing.outletId, { type: 'table' })
      res.json({
        ok: true,
        deleted: false,
        reason: 'has_reservations',
        message: 'Table has reservation history, so it was deactivated instead of deleted.',
      })
      return
    }

    await prisma.restaurantTable.delete({ where: { id: existing.id } })
    emitReservationEvent(existing.outletId, { type: 'table' })
    res.json({ ok: true, deleted: true })
  } catch (err) {
    next(err)
  }
})

export default router
