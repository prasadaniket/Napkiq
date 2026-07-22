import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { writeLimiter, readLimiter } from '../middleware/rateLimit'
import { emitReservationEvent } from '../lib/reservationEvents'
import { sendReservationConfirmation } from '../lib/notifications'
import {
  ReservationError,
  istToUtc,
  generateSlots,
  tableMapForSlot,
  expireStaleHolds,
  holdTable,
  confirmReservation,
} from '../lib/reservations'

const router = Router()

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^\d{2}:\d{2}$/

/** Resolve an outlet by id or slug/code, returning reservation config too. */
async function resolveOutlet(idOrCode: string) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrCode)
  return prisma.outlet.findFirst({
    where: isUuid
      ? { id: idOrCode }
      : { OR: [{ slug: idOrCode.toLowerCase() }, { code: idOrCode.toUpperCase() }] },
    select: {
      id: true, name: true, code: true, slug: true,
      reservationsEnabled: true,
      reservationOpenTime: true, reservationCloseTime: true,
      reservationSlotMinutes: true, reservationDurationMinutes: true, reservationHoldMinutes: true,
    },
  })
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return digits.startsWith('91') ? `+${digits}` : `+91${digits}`
}

function formatIstDate(d: Date): string {
  return d.toLocaleDateString('en-IN', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata',
  })
}
function formatIstTime(d: Date): string {
  return d.toLocaleTimeString('en-IN', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
  })
}

// ─── GET /reservations/slots ───────────────────────────────────────────────────
// Bookable slots for an outlet on a date, each with how many tables can seat the
// party. Public — drives the customer date/slot picker.
router.get('/slots', readLimiter, async (req, res, next) => {
  try {
    const outletCode = (req.query.outletCode as string) || ''
    const date = (req.query.date as string) || ''
    const partySize = Math.max(1, parseInt(req.query.partySize as string) || 2)
    if (!outletCode || !DATE_RE.test(date)) {
      res.status(400).json({ error: 'outletCode and a valid date (YYYY-MM-DD) are required' })
      return
    }

    const outlet = await resolveOutlet(outletCode)
    if (!outlet) { res.status(404).json({ error: 'Unknown outlet' }); return }
    if (!outlet.reservationsEnabled) {
      res.status(403).json({ error: 'Reservations are not available at this outlet' })
      return
    }

    const slots = generateSlots(date, outlet)
    const duration = outlet.reservationDurationMinutes

    // Whether the outlet could ever seat this party — with combining, that's when the
    // total seats across all active tables covers it (not just one big-enough table).
    const activeTables = await prisma.restaurantTable.findMany({
      where: { outletId: outlet.id, isActive: true },
      select: { capacity: true },
    })
    const totalSeats = activeTables.reduce((s, t) => s + t.capacity, 0)
    const canSeatParty = totalSeats >= partySize

    // Per slot: available when the free tables (single or combined) cover the party.
    await expireStaleHolds(outlet.id)
    const withCounts = await Promise.all(
      slots.map(async (time) => {
        const map = await tableMapForSlot({
          outletId: outlet.id,
          reservedAt: istToUtc(date, time),
          durationMinutes: duration,
          partySize,
          skipExpire: true,
        })
        const freeCount = map.tables.filter((t) => t.available).length
        return { time, availableCount: map.canSeat ? freeCount : 0 }
      })
    )

    res.json({
      outlet: { id: outlet.id, name: outlet.name, code: outlet.code, slug: outlet.slug },
      date,
      durationMinutes: duration,
      totalTables: activeTables.length,
      canSeatParty,
      slots: withCounts,
    })
  } catch (err) {
    if (err instanceof ReservationError) { res.status(err.status).json({ error: err.message }); return }
    next(err)
  }
})

// ─── GET /reservations/availability ────────────────────────────────────────────
// Every table that could seat the party for a slot, each flagged available/taken —
// powers the visual floor-map picker. `bestTableId` is the smallest free table.
router.get('/availability', readLimiter, async (req, res, next) => {
  try {
    const outletCode = (req.query.outletCode as string) || ''
    const date = (req.query.date as string) || ''
    const time = (req.query.time as string) || ''
    const partySize = Math.max(1, parseInt(req.query.partySize as string) || 2)
    if (!outletCode || !DATE_RE.test(date) || !TIME_RE.test(time)) {
      res.status(400).json({ error: 'outletCode, date and time are required' })
      return
    }

    const outlet = await resolveOutlet(outletCode)
    if (!outlet) { res.status(404).json({ error: 'Unknown outlet' }); return }
    if (!outlet.reservationsEnabled) {
      res.status(403).json({ error: 'Reservations are not available at this outlet' })
      return
    }

    const reservedAt = istToUtc(date, time)
    const { tables, bestTableId, maxCapacity, seatsFree, canSeat } = await tableMapForSlot({
      outletId: outlet.id,
      reservedAt,
      durationMinutes: outlet.reservationDurationMinutes,
      partySize,
    })

    res.json({ date, time, partySize, tables, bestTableId, maxCapacity, seatsFree, canSeat })
  } catch (err) {
    if (err instanceof ReservationError) { res.status(err.status).json({ error: err.message }); return }
    next(err)
  }
})

// ─── POST /reservations/hold ───────────────────────────────────────────────────
// Lock one OR MORE tables for the slot while the guest fills in details. A large
// party can combine tables (tableIds) and request they be joined together.
const HoldSchema = z.object({
  outletCode:    z.string().min(1),
  tableIds:      z.array(z.string().uuid()).min(1).max(6),
  date:          z.string().regex(DATE_RE),
  time:          z.string().regex(TIME_RE),
  partySize:     z.number().int().min(1).max(50),
  joinRequested: z.boolean().optional(),
  deviceId:      z.string().min(1).optional(),
})

router.post('/hold', writeLimiter, async (req, res, next) => {
  try {
    const body = HoldSchema.parse(req.body)

    const outlet = await resolveOutlet(body.outletCode)
    if (!outlet) { res.status(404).json({ error: 'Unknown outlet' }); return }
    if (!outlet.reservationsEnabled) {
      res.status(403).json({ error: 'Reservations are not available at this outlet' })
      return
    }

    const reservedAt = istToUtc(body.date, body.time)
    if (reservedAt.getTime() <= Date.now()) {
      res.status(400).json({ error: 'Please pick a future time' })
      return
    }

    let customerId: string | null = null
    if (body.deviceId) {
      const c = await prisma.customer.findUnique({ where: { deviceId: body.deviceId }, select: { id: true } })
      customerId = c?.id ?? null
    }

    const reservation = await holdTable({
      outletId: outlet.id,
      tableIds: body.tableIds,
      reservedAt,
      durationMinutes: outlet.reservationDurationMinutes,
      holdMinutes: outlet.reservationHoldMinutes,
      partySize: body.partySize,
      joinRequested: body.joinRequested,
      deviceId: body.deviceId ?? null,
      customerId,
      source: 'customer',
    })

    res.status(201).json({
      id: reservation.id,
      holdExpiresAt: reservation.holdExpiresAt,
      reservedAt: reservation.reservedAt,
      partySize: reservation.partySize,
      joinRequested: reservation.joinRequested,
      table: reservation.table,
      tables: [reservation.table, ...reservation.additionalTables.map((a) => a.table)],
    })
  } catch (err) {
    if (err instanceof ReservationError) { res.status(err.status).json({ error: err.message }); return }
    next(err)
  }
})

// ─── POST /reservations/:id/confirm ────────────────────────────────────────────
// Finalise a held reservation → confirmed. Auto-confirmed (no staff approval);
// mints the booking code and fires the WhatsApp confirmation.
const ConfirmSchema = z.object({
  deviceId:        z.string().min(1).optional(),
  guestName:       z.string().min(1).max(120),
  guestPhone:      z.string().min(6).max(15),
  guestEmail:      z.string().email().max(160).optional().or(z.literal('')),
  specialRequests: z.string().max(500).optional(),
  occasion:        z.string().max(60).optional(),
  dietaryNotes:    z.string().max(200).optional(),
})

router.post('/:id/confirm', writeLimiter, async (req, res, next) => {
  try {
    const body = ConfirmSchema.parse(req.body)

    let customerId: string | null = null
    if (body.deviceId) {
      const c = await prisma.customer.findUnique({ where: { deviceId: body.deviceId }, select: { id: true } })
      customerId = c?.id ?? null
    }

    const reservation = await confirmReservation({
      reservationId: req.params.id as string,
      deviceId: body.deviceId ?? null,
      guestName: body.guestName,
      guestPhone: body.guestPhone,
      guestEmail: body.guestEmail || null,
      specialRequests: body.specialRequests ?? null,
      occasion: body.occasion ?? null,
      dietaryNotes: body.dietaryNotes ?? null,
      customerId,
    })
    if (!reservation) { res.status(404).json({ error: 'Reservation not found' }); return }

    // Broadcast to the CMS reservations board.
    emitReservationEvent(reservation.outletId, { type: 'created', reservation })

    // Fire-and-forget WhatsApp confirmation (never blocks the response).
    const allTables = [reservation.table, ...reservation.additionalTables.map((a) => a.table)]
    const tableName = allTables.map((t) => t.name).join(' + ')
    const zones = [...new Set(allTables.map((t) => t.zone as string))]
    sendReservationConfirmation({
      to:           normalizePhone(reservation.guestPhone),
      customerName: reservation.guestName,
      outletName:   reservation.outlet?.name ?? 'Napkiq',
      tableName,
      zone:         zones.length === 1 ? zones[0] : 'Mixed',
      partySize:    reservation.partySize,
      date:         formatIstDate(reservation.reservedAt),
      time:         formatIstTime(reservation.reservedAt),
      bookingCode:  reservation.bookingCode,
    }).catch((e) => console.error('[reservation] WhatsApp confirmation failed:', e))

    res.json(reservation)
  } catch (err) {
    if (err instanceof ReservationError) { res.status(err.status).json({ error: err.message }); return }
    next(err)
  }
})

// ─── PATCH /reservations/:id/release ───────────────────────────────────────────
// Guest backs out before confirming — free the held table immediately.
const ReleaseSchema = z.object({ deviceId: z.string().min(1) })

router.patch('/:id/release', writeLimiter, async (req, res, next) => {
  try {
    const { deviceId } = ReleaseSchema.parse(req.body)
    const existing = await prisma.reservation.findUnique({
      where: { id: req.params.id as string },
      select: { id: true, status: true, deviceId: true },
    })
    if (!existing) { res.status(404).json({ error: 'Reservation not found' }); return }
    if (existing.status !== 'held' || existing.deviceId !== deviceId) {
      // Nothing to release (or not the holder) — treat as a no-op success.
      res.json({ ok: true })
      return
    }
    await prisma.reservation.update({ where: { id: existing.id }, data: { status: 'expired' } })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// ─── PATCH /reservations/:id/cancel ────────────────────────────────────────────
// Guest cancels their own upcoming confirmed booking (from My Bookings). Only the
// holding device may cancel, and only before the reservation start time.
const CancelSchema = z.object({ deviceId: z.string().min(1) })

router.patch('/:id/cancel', writeLimiter, async (req, res, next) => {
  try {
    const { deviceId } = CancelSchema.parse(req.body)
    const existing = await prisma.reservation.findUnique({
      where: { id: req.params.id as string },
      select: { id: true, status: true, deviceId: true, reservedAt: true },
    })
    if (!existing) { res.status(404).json({ error: 'Reservation not found' }); return }
    if (!existing.deviceId || existing.deviceId !== deviceId) {
      res.status(403).json({ error: 'Not permitted' }); return
    }
    if (existing.status === 'seated') {
      res.status(409).json({ error: "You're already seated — please speak to the restaurant." }); return
    }
    if (existing.status !== 'confirmed') {
      res.status(409).json({ error: 'This booking can no longer be cancelled' }); return
    }
    if (existing.reservedAt.getTime() <= Date.now()) {
      res.status(409).json({ error: 'Past bookings cannot be cancelled — please call the restaurant' }); return
    }

    const reservation = await prisma.reservation.update({
      where: { id: existing.id },
      data: { status: 'cancelled', cancelledBy: 'customer' },
      include: { table: { select: { id: true, name: true, zone: true, capacity: true } }, outlet: { select: { id: true, name: true, code: true } } },
    })
    emitReservationEvent(reservation.outletId, { type: 'status', reservation })
    res.json(reservation)
  } catch (err) {
    next(err)
  }
})

// ─── GET /reservations/by-device/:deviceId ─────────────────────────────────────
// A guest's own reservations for this device (newest first). Public — the device
// fingerprint is an unguessable local id (mirrors /orders/by-device).
router.get('/by-device/:deviceId', readLimiter, async (req, res, next) => {
  try {
    const reservations = await prisma.reservation.findMany({
      where: { deviceId: req.params.deviceId as string, status: { not: 'expired' } },
      include: {
        table: { select: { name: true, zone: true } },
        additionalTables: { include: { table: { select: { name: true, zone: true } } } },
        outlet: { select: { name: true, code: true, slug: true } },
      },
      orderBy: { reservedAt: 'desc' },
      take: 25,
    })
    res.json(reservations)
  } catch (err) {
    next(err)
  }
})

// ─── GET /reservations/:id ─────────────────────────────────────────────────────
// Single reservation by opaque UUID (customer confirmation/tracking page).
router.get('/:id', readLimiter, async (req, res, next) => {
  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id: req.params.id as string },
      include: {
        table: { select: { name: true, zone: true, capacity: true } },
        additionalTables: { include: { table: { select: { name: true, zone: true, capacity: true } } } },
        outlet: { select: { name: true, code: true, slug: true, address: true, googleMapsUrl: true } },
      },
    })
    if (!reservation) { res.status(404).json({ error: 'Reservation not found' }); return }
    res.json(reservation)
  } catch (err) {
    next(err)
  }
})

export default router
