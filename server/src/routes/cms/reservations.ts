import { Router, type Request } from 'express'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { requireAuth, resolveStaffFromToken } from '../../middleware/auth'
import { paginate } from '../../lib/paginate'
import { emitReservationEvent, onReservationEvent } from '../../lib/reservationEvents'
import { sendReservationConfirmation } from '../../lib/notifications'
import {
  ReservationError,
  istToUtc,
  istDateStr,
  holdTable,
  confirmReservation,
  expireStaleHolds,
  getFloorState,
  findSeatingConflict,
} from '../../lib/reservations'

const router = Router()

const STATUSES = ['held', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show', 'expired'] as const
type Status = (typeof STATUSES)[number]
// Statuses shown on the live board by default (upcoming + in-progress).
const ACTIVE_STATUSES: Status[] = ['confirmed', 'seated']

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^\d{2}:\d{2}$/

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return digits.startsWith('91') ? `+${digits}` : `+91${digits}`
}
function formatIstDate(d: Date): string {
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
}
function formatIstTime(d: Date): string {
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })
}

const RESERVATION_INCLUDE = {
  table: { select: { id: true, name: true, zone: true, capacity: true } },
  additionalTables: { include: { table: { select: { id: true, name: true, zone: true, capacity: true } } } },
  outlet: { select: { id: true, name: true, code: true } },
} as const

// ─── GET /cms/reservations/stream ──────────────────────────────────────────────
// Live board feed via SSE. Registered BEFORE requireAuth — EventSource cannot send
// an Authorization header, so it authenticates via ?token= (same as the KDS stream).
router.get('/stream', async (req, res, next) => {
  try {
    const token = (req.query.token as string) || ''
    if (!token) { res.status(401).json({ error: 'Missing token' }); return }

    const staff = await resolveStaffFromToken(token)
    if (!staff) { res.status(401).json({ error: 'Invalid or expired token' }); return }

    let outletId: string | undefined
    if (staff.role === 'franchise_owner') {
      outletId = staff.assignedOutletId ?? undefined
    } else if (req.query.outletId) {
      outletId = req.query.outletId as string
    }
    if (!outletId) { res.status(400).json({ error: 'outletId is required' }); return }

    res.writeHead(200, {
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache, no-transform',
      Connection:          'keep-alive',
      'X-Accel-Buffering': 'no',
    })
    res.write(': connected\n\n')

    const unsubscribe = onReservationEvent(outletId, (event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`)
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

// Everything below requires a Bearer token.
router.use(requireAuth)

/** Effective outlet filter with the standard franchise scoping. */
function scopedOutletId(req: Request): string | undefined {
  if (req.staff!.role === 'franchise_owner') {
    return req.staff!.assignedOutletId ?? undefined
  }
  return (req.query.outletId as string) || undefined
}

// ─── GET /cms/reservations/settings ────────────────────────────────────────────
// Reservation on/off + slot config for an outlet (drives the CMS settings panel).
router.get('/settings', async (req, res, next) => {
  try {
    const outletId = scopedOutletId(req)
    if (!outletId) { res.status(400).json({ error: 'outletId is required' }); return }

    const outlet = await prisma.outlet.findUnique({
      where: { id: outletId },
      select: {
        id: true, name: true,
        reservationsEnabled: true,
        reservationOpenTime: true, reservationCloseTime: true,
        reservationSlotMinutes: true, reservationDurationMinutes: true, reservationHoldMinutes: true,
      },
    })
    if (!outlet) { res.status(404).json({ error: 'Outlet not found' }); return }
    res.json(outlet)
  } catch (err) {
    next(err)
  }
})

// ─── PATCH /cms/reservations/settings ──────────────────────────────────────────
// Turn reservations on/off and tune slot config. Every outlet controls its own
// availability, so franchise_owner may edit their assigned outlet.
const SettingsSchema = z.object({
  outletId:                   z.string().uuid().optional(),
  reservationsEnabled:        z.boolean().optional(),
  reservationOpenTime:        z.string().regex(TIME_RE).nullable().optional(),
  reservationCloseTime:       z.string().regex(TIME_RE).nullable().optional(),
  reservationSlotMinutes:     z.number().int().min(15).max(240).optional(),
  reservationDurationMinutes: z.number().int().min(15).max(480).optional(),
  reservationHoldMinutes:     z.number().int().min(2).max(60).optional(),
})

router.patch('/settings', async (req, res, next) => {
  try {
    const body = SettingsSchema.parse(req.body)
    const outletId =
      req.staff!.role === 'franchise_owner' ? req.staff!.assignedOutletId ?? undefined : body.outletId
    if (!outletId) { res.status(400).json({ error: 'outletId is required' }); return }

    const { outletId: _omit, ...data } = body
    const outlet = await prisma.outlet.update({
      where: { id: outletId },
      data,
      select: {
        id: true, name: true,
        reservationsEnabled: true,
        reservationOpenTime: true, reservationCloseTime: true,
        reservationSlotMinutes: true, reservationDurationMinutes: true, reservationHoldMinutes: true,
      },
    })
    res.json(outlet)
  } catch (err) {
    next(err)
  }
})

// ─── GET /cms/reservations/floor ───────────────────────────────────────────────
// Live floor view: every table with its current state (available/reserved/occupied/
// blocked) plus the reservation defining that state. Refetched on SSE 'table'/'status'.
router.get('/floor', async (req, res, next) => {
  try {
    const outletId = scopedOutletId(req)
    if (!outletId) { res.status(400).json({ error: 'outletId is required' }); return }
    const floor = await getFloorState(outletId)
    res.json(floor)
  } catch (err) {
    next(err)
  }
})

// ─── GET /cms/reservations/calendar ────────────────────────────────────────────
// Booking counts per IST day for a month (or arbitrary range) — powers the calendar.
router.get('/calendar', async (req, res, next) => {
  try {
    const outletId = scopedOutletId(req)

    // Default: the month containing ?month=YYYY-MM (or current IST month).
    const monthStr = (req.query.month as string) || istDateStr().slice(0, 7)
    if (!/^\d{4}-\d{2}$/.test(monthStr)) { res.status(400).json({ error: 'Invalid month (YYYY-MM)' }); return }
    const [y, m] = monthStr.split('-').map(Number)
    const from = istToUtc(`${monthStr}-01`, '00:00')
    const nextMonth = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
    const to = istToUtc(`${nextMonth}-01`, '00:00')

    const where: any = { reservedAt: { gte: from, lt: to }, status: { in: ['confirmed', 'seated', 'completed'] } }
    if (outletId) where.outletId = outletId

    const rows = await prisma.reservation.findMany({
      where,
      select: { reservedAt: true, partySize: true },
      orderBy: { reservedAt: 'asc' },
    })

    // Bucket by IST calendar day.
    const days = new Map<string, { count: number; covers: number }>()
    for (const r of rows) {
      const day = istDateStr(r.reservedAt)
      const cur = days.get(day) ?? { count: 0, covers: 0 }
      cur.count += 1
      cur.covers += r.partySize
      days.set(day, cur)
    }

    res.json({
      month: monthStr,
      days: [...days.entries()].map(([date, v]) => ({ date, ...v })),
    })
  } catch (err) {
    next(err)
  }
})

// ─── GET /cms/reservations ─────────────────────────────────────────────────────
// The live board. Defaults to a single IST day (today) and active statuses; pass
// ?date=YYYY-MM-DD and ?status=all|confirmed|seated|... to filter.
router.get('/', async (req, res, next) => {
  try {
    const outletId = scopedOutletId(req)
    if (outletId) await expireStaleHolds(outletId)

    const where: any = {}
    if (outletId) where.outletId = outletId

    const date = (req.query.date as string) || istDateStr()
    if (!DATE_RE.test(date)) { res.status(400).json({ error: 'Invalid date' }); return }
    // Full IST-day window for the chosen date.
    const dayStart = istToUtc(date, '00:00')
    where.reservedAt = { gte: dayStart, lt: new Date(dayStart.getTime() + 24 * 60 * 60_000) }

    const statusParam = req.query.status as string | undefined
    if (statusParam && statusParam !== 'all') {
      if (!STATUSES.includes(statusParam as Status)) { res.status(400).json({ error: 'Invalid status' }); return }
      where.status = statusParam
    } else if (!statusParam) {
      where.status = { in: ACTIVE_STATUSES }
    }

    const reservations = await prisma.reservation.findMany({
      where,
      include: RESERVATION_INCLUDE,
      orderBy: { reservedAt: 'asc' },
    })
    res.json(reservations)
  } catch (err) {
    next(err)
  }
})

// ─── POST /cms/reservations ────────────────────────────────────────────────────
// Staff walk-in / phone booking. Reuses the same lock + confirm path as the app,
// so it respects availability and fires the WhatsApp confirmation.
const StaffCreateSchema = z.object({
  outletId:        z.string().uuid().optional(),
  tableId:         z.string().uuid().optional(),          // single table (back-compat)
  tableIds:        z.array(z.string().uuid()).min(1).max(6).optional(), // or combine several
  joinRequested:   z.boolean().optional(),
  date:            z.string().regex(DATE_RE),
  time:            z.string().regex(TIME_RE),
  partySize:       z.number().int().min(1).max(50),
  guestName:       z.string().min(1).max(120),
  guestPhone:      z.string().min(6).max(15),
  guestEmail:      z.string().email().max(160).optional().or(z.literal('')),
  specialRequests: z.string().max(500).optional(),
  occasion:        z.string().max(60).optional(),
  dietaryNotes:    z.string().max(200).optional(),
}).refine((d) => d.tableId || (d.tableIds && d.tableIds.length), { message: 'Pick at least one table' })

router.post('/', async (req, res, next) => {
  try {
    const body = StaffCreateSchema.parse(req.body)
    const outletId =
      req.staff!.role === 'franchise_owner' ? req.staff!.assignedOutletId ?? undefined : body.outletId
    if (!outletId) { res.status(400).json({ error: 'outletId is required' }); return }

    const outlet = await prisma.outlet.findUnique({
      where: { id: outletId },
      select: { name: true, reservationDurationMinutes: true, reservationHoldMinutes: true },
    })
    if (!outlet) { res.status(404).json({ error: 'Outlet not found' }); return }

    const reservedAt = istToUtc(body.date, body.time)
    const tableIds = body.tableIds ?? [body.tableId!]

    const held = await holdTable({
      outletId,
      tableIds,
      reservedAt,
      durationMinutes: outlet.reservationDurationMinutes,
      holdMinutes: outlet.reservationHoldMinutes,
      partySize: body.partySize,
      joinRequested: body.joinRequested,
      source: 'staff',
      createdById: req.staff!.id,
      guest: {
        name: body.guestName,
        phone: body.guestPhone,
        email: body.guestEmail || null,
        specialRequests: body.specialRequests ?? null,
        occasion: body.occasion ?? null,
        dietaryNotes: body.dietaryNotes ?? null,
      },
    })

    const reservation = await confirmReservation({
      reservationId: held.id,
      guestName: body.guestName,
      guestPhone: body.guestPhone,
      guestEmail: body.guestEmail || null,
      specialRequests: body.specialRequests ?? null,
      occasion: body.occasion ?? null,
      dietaryNotes: body.dietaryNotes ?? null,
    })
    if (!reservation) { res.status(500).json({ error: 'Could not create reservation' }); return }

    emitReservationEvent(reservation.outletId, { type: 'created', reservation })

    const allTables = [reservation.table, ...reservation.additionalTables.map((a) => a.table)]
    const zones = [...new Set(allTables.map((t) => t.zone as string))]
    sendReservationConfirmation({
      to:           normalizePhone(reservation.guestPhone),
      customerName: reservation.guestName,
      outletName:   reservation.outlet?.name ?? outlet.name,
      tableName:    allTables.map((t) => t.name).join(' + '),
      zone:         zones.length === 1 ? zones[0] : 'Mixed',
      partySize:    reservation.partySize,
      date:         formatIstDate(reservation.reservedAt),
      time:         formatIstTime(reservation.reservedAt),
      bookingCode:  reservation.bookingCode,
    }).catch((e) => console.error('[reservation] WhatsApp confirmation failed:', e))

    res.status(201).json(reservation)
  } catch (err) {
    if (err instanceof ReservationError) { res.status(err.status).json({ error: err.message }); return }
    next(err)
  }
})

// ─── PATCH /cms/reservations/:id/status ────────────────────────────────────────
const UpdateStatusSchema = z.object({
  status: z.enum(['seated', 'completed', 'cancelled', 'no_show']),
})

router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = UpdateStatusSchema.parse(req.body)

    const existing = await prisma.reservation.findUnique({
      where: { id: req.params.id },
      select: { id: true, outletId: true },
    })
    if (!existing) { res.status(404).json({ error: 'Reservation not found' }); return }

    if (req.staff!.role === 'franchise_owner' && existing.outletId !== req.staff!.assignedOutletId) {
      res.status(403).json({ error: 'Not permitted for this outlet' })
      return
    }

    // A table holds one seated party at a time — block seating over an occupied table
    // until the current party is completed or cancelled.
    if (status === 'seated') {
      const conflict = await findSeatingConflict(existing.id)
      if (conflict) {
        res.status(409).json({
          code: 'SEAT_CONFLICT',
          error: `Table ${conflict.tableName} is already seated with ${conflict.guestName} (${conflict.bookingCode}). Complete or cancel that party before seating here.`,
        })
        return
      }
    }

    const data: any = { status }
    if (status === 'cancelled') data.cancelledBy = 'staff'

    const reservation = await prisma.reservation.update({
      where: { id: existing.id },
      data,
      include: RESERVATION_INCLUDE,
    })

    emitReservationEvent(reservation.outletId, { type: 'status', reservation })
    res.json(reservation)
  } catch (err) {
    next(err)
  }
})

// ─── GET /cms/reservations/history ─────────────────────────────────────────────
// Paginated reservation log with date/status/outlet filters.
router.get('/history', async (req, res, next) => {
  try {
    const page = Math.max(0, parseInt(req.query.page as string) || 0)
    const size = Math.min(100, Math.max(1, parseInt(req.query.size as string) || 20))
    const outletId = scopedOutletId(req)

    const where: any = {}
    if (outletId) where.outletId = outletId

    const statusParam = req.query.status as string | undefined
    if (statusParam && statusParam !== 'all') {
      if (!STATUSES.includes(statusParam as Status)) { res.status(400).json({ error: 'Invalid status' }); return }
      where.status = statusParam
    }

    if (req.query.dateFrom || req.query.dateTo) {
      where.reservedAt = {}
      if (req.query.dateFrom) where.reservedAt.gte = new Date(req.query.dateFrom as string)
      if (req.query.dateTo)   where.reservedAt.lte = new Date(req.query.dateTo as string)
    }

    const code = (req.query.code as string) || undefined
    if (code) where.bookingCode = code.toUpperCase()

    const [reservations, total] = await Promise.all([
      prisma.reservation.findMany({
        where,
        include: RESERVATION_INCLUDE,
        orderBy: { reservedAt: 'desc' },
        skip: page * size,
        take: size,
      }),
      prisma.reservation.count({ where }),
    ])

    res.json(paginate(reservations, total, page, size))
  } catch (err) {
    next(err)
  }
})

export default router
