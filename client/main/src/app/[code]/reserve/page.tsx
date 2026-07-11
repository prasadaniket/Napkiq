'use client'

import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import gsap from 'gsap'
import QRCode from 'qrcode'
import { api } from '@/lib/api'
import { useDeviceFingerprint } from '@/hooks/useDeviceFingerprint'
import { useOutlet } from '@/hooks/useOutlet'
import { useCustomer } from '@/hooks/useCustomer'
import Loader from '@/components/ui/Loader'

// ─── Types ──────────────────────────────────────────────────────────────────────

interface Slot { time: string; availableCount: number }
interface AvailTable {
  id: string; name: string; capacity: number; zone: string; available: boolean; blocked: boolean
  posX: number | null; posY: number | null; shape: string
}
interface TableRef { name: string; zone: string; capacity?: number }
interface HeldReservation {
  id: string; holdExpiresAt: string; partySize: number; joinRequested?: boolean
  table: TableRef; tables?: TableRef[]
}
interface ConfirmedReservation {
  id: string; bookingCode: string; reservedAt: string; partySize: number; joinRequested?: boolean
  occasion?: string | null
  table?: TableRef
  additionalTables?: { table: TableRef }[]
  outlet?: { name: string; address?: string | null; googleMapsUrl?: string | null }
}

type BookingStatus = 'confirmed' | 'seated' | 'completed' | 'cancelled' | 'no_show' | 'held' | 'expired'
interface Booking {
  id: string; bookingCode: string; reservedAt: string; partySize: number
  status: BookingStatus; occasion: string | null; specialRequests: string | null
  table?: { name: string; zone: string }; outlet?: { name: string; code: string; slug: string }
}

type Step = 'when' | 'slot' | 'table' | 'details' | 'done'
type BookingsTab = 'reserve' | 'mybookings'

// ─── Zone "experience tiers" (BookMyShow-style seat categories) ───────────────────
const ZONE_TIER: Record<string, { label: string; tier: string; accent: string; desc: string }> = {
  ac:      { label: 'AC',      tier: 'Prime',    accent: '#FFB800', desc: 'Climate-controlled comfort' },
  outdoor: { label: 'Outdoor', tier: 'Alfresco', accent: '#34d399', desc: 'Open-air seating under the sky' },
  non_ac:  { label: 'Non-AC',  tier: 'Classic',  accent: '#8b93a7', desc: 'Relaxed standard indoor seating' },
}
const ZONE_LABEL: Record<string, string> = { ac: 'AC', non_ac: 'Non-AC', outdoor: 'Outdoor' }
const ZONE_ORDER = ['ac', 'outdoor', 'non_ac'] as const

// ─── Meal periods (group time slots like BookMyShow show timings) ─────────────────
const MEAL_PERIODS = [
  { key: 'breakfast', label: 'Breakfast', icon: '🌅', from: 0,    to: 720 },   // < 12:00
  { key: 'lunch',     label: 'Lunch',     icon: '☀️', from: 720,  to: 960 },   // 12:00–16:00
  { key: 'dinner',    label: 'Dinner',    icon: '🌙', from: 960,  to: 1440 },  // ≥ 16:00
] as const

function slotMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
function periodOf(t: string): string {
  const mins = slotMinutes(t)
  return MEAL_PERIODS.find((p) => mins >= p.from && mins < p.to)?.key ?? 'dinner'
}

const BOOKING_STATUS_META: Record<BookingStatus, { label: string; dot: string; text: string }> = {
  confirmed: { label: 'Confirmed', dot: 'bg-emerald-400', text: 'text-emerald-400' },
  seated:    { label: 'Seated',    dot: 'bg-blue-400',   text: 'text-blue-400' },
  completed: { label: 'Completed', dot: 'bg-white/40',   text: 'text-white/50' },
  cancelled: { label: 'Cancelled', dot: 'bg-rose-400',   text: 'text-rose-400' },
  no_show:   { label: 'No-show',   dot: 'bg-amber-400',  text: 'text-amber-400' },
  held:      { label: 'Pending',   dot: 'bg-white/40',   text: 'text-white/40' },
  expired:   { label: 'Expired',   dot: 'bg-white/30',   text: 'text-white/30' },
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    weekday: 'short', day: '2-digit', month: 'short',
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
  })
}

function todayIst(): string {
  return new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10)
}

function fmtSlot(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hr = h % 12 === 0 ? 12 : h % 12
  return `${hr}:${String(m).padStart(2, '0')} ${ampm}`
}

// Build a strip of the next N IST calendar days for the horizontal date picker.
function buildDateStrip(days = 14): { iso: string; dow: string; day: string; mon: string; rel: string }[] {
  const out: { iso: string; dow: string; day: string; mon: string; rel: string }[] = []
  const base = new Date(Date.now() + 5.5 * 3600_000)
  for (let i = 0; i < days; i++) {
    const d = new Date(base.getTime() + i * 86400_000)
    const iso = d.toISOString().slice(0, 10)
    out.push({
      iso,
      dow: d.toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'UTC' }),
      day: String(d.getUTCDate()).padStart(2, '0'),
      mon: d.toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' }),
      rel: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : '',
    })
  }
  return out
}

// Fill in floor-plan coordinates: use staff-arranged posX/posY when every table has
// them, else auto-flow tables into a tidy grid so the map is always spatial.
function withCoords(tables: AvailTable[]): (AvailTable & { x: number; y: number })[] {
  const hasLayout = tables.length > 0 && tables.every((t) => t.posX != null && t.posY != null)
  if (hasLayout) return tables.map((t) => ({ ...t, x: t.posX as number, y: t.posY as number }))
  const n = tables.length
  const cols = Math.min(6, Math.max(3, Math.ceil(Math.sqrt(n * 1.5))))
  const rows = Math.max(1, Math.ceil(n / cols))
  return tables.map((t, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = cols === 1 ? 50 : 12 + col * (76 / (cols - 1))
    const y = rows === 1 ? 42 : 12 + row * (64 / (rows - 1))
    return { ...t, x, y }
  })
}

export default function ReservePage() {
  const params = useParams()
  const router = useRouter()
  const code = params.code as string

  const { deviceId } = useDeviceFingerprint()
  const { outlet, loading: outletLoading } = useOutlet(code)
  const { customer } = useCustomer(deviceId)

  const [step, setStep] = useState<Step>('when')
  const [bookingsTab, setBookingsTab] = useState<BookingsTab>('reserve')
  const [date, setDate] = useState(todayIst())
  const [partySize, setPartySize] = useState(2)

  const [slots, setSlots] = useState<Slot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [totalTables, setTotalTables] = useState<number | null>(null)
  const [time, setTime] = useState('')
  const [activePeriod, setActivePeriod] = useState<string>('dinner')

  const [tables, setTables] = useState<AvailTable[]>([])
  const [bestTableId, setBestTableId] = useState<string | null>(null)
  const [tablesLoading, setTablesLoading] = useState(false)
  const [selected, setSelected] = useState<string[]>([])   // chosen table ids (may combine several)
  const [joinRequested, setJoinRequested] = useState(true) // "push the tables together" when combining
  const [canSeatParty, setCanSeatParty] = useState(true)   // outlet has enough seats for the party at all

  const [held, setHeld] = useState<HeldReservation | null>(null)
  const [holding, setHolding] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(0)

  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [specialRequests, setSpecialRequests] = useState('')
  const [occasion, setOccasion] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [confirmed, setConfirmed] = useState<ConfirmedReservation | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [error, setError] = useState('')

  // My Bookings inline state
  const [myBookings, setMyBookings] = useState<Booking[]>([])
  const [bookingsLoading, setBookingsLoading] = useState(false)
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  // Refs for GSAP
  const containerRef = useRef<HTMLDivElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<HTMLDivElement>(null)

  const dateStrip = useMemo(() => buildDateStrip(14), [])

  // Custom step changer with sliding/fading animation
  const changeStep = (nextStep: Step) => {
    if (nextStep === step) return
    if (containerRef.current) {
      gsap.killTweensOf(containerRef.current)
      gsap.to(containerRef.current, {
        opacity: 0, y: -15, scale: 0.98, duration: 0.2, ease: 'power2.in',
        onComplete: () => {
          setStep(nextStep)
          gsap.fromTo(containerRef.current,
            { opacity: 0, y: 15, scale: 0.98 },
            { opacity: 1, y: 0, scale: 1, duration: 0.35, ease: 'power3.out' }
          )
        }
      })
    } else {
      setStep(nextStep)
    }
  }

  // Prefill guest details from a known customer on this device
  useEffect(() => {
    if (customer) {
      setGuestName((n) => n || customer.fullName || '')
      setGuestPhone((p) => p || customer.phone || '')
    }
  }, [customer])

  // Generate the QR pass once a booking is confirmed
  useEffect(() => {
    if (!confirmed?.bookingCode) { setQrDataUrl(''); return }
    QRCode.toDataURL(confirmed.bookingCode, {
      margin: 1, width: 360, errorCorrectionLevel: 'M',
      color: { dark: '#0c0d19', light: '#ffffff' },
    }).then(setQrDataUrl).catch(() => setQrDataUrl(''))
  }, [confirmed])

  // Fetch bookings for "My Bookings" tab
  const loadMyBookings = useCallback(() => {
    if (!deviceId) return
    setBookingsLoading(true)
    api.get<Booking[]>(`/reservations/by-device/${deviceId}`)
      .then((r) => setMyBookings(r.data))
      .catch(() => {})
      .finally(() => setBookingsLoading(false))
  }, [deviceId])

  useEffect(() => { loadMyBookings() }, [loadMyBookings])

  const cancelBooking = async (b: Booking) => {
    if (!window.confirm(`Cancel booking ${b.bookingCode}?`)) return
    setCancellingId(b.id)
    try {
      await api.patch(`/reservations/${b.id}/cancel`, { deviceId })
      setMyBookings((prev) => prev.map((x) => x.id === b.id ? { ...x, status: 'cancelled' } : x))
    } catch (e: any) {
      alert(e.response?.data?.error || 'Could not cancel')
    } finally {
      setCancellingId(null)
    }
  }

  const now = Date.now()
  const isUpcomingBooking = (b: Booking) =>
    ['confirmed', 'seated'].includes(b.status) && new Date(b.reservedAt).getTime() + 3 * 3600_000 > now
  const upcomingBookings = myBookings.filter(isUpcomingBooking)
  const pastBookings = myBookings.filter((b) => !isUpcomingBooking(b) && b.status !== 'held' && b.status !== 'expired')

  // Bounce back if reservations are disabled for this outlet
  useEffect(() => {
    if (!outletLoading && outlet && outlet.reservationsEnabled === false) {
      router.replace(`/${code}`)
    }
  }, [outletLoading, outlet, code, router])

  // Hold countdown — release/expire returns to table selection
  useEffect(() => {
    if (!held) return
    const tick = () => {
      const left = Math.max(0, Math.floor((new Date(held.holdExpiresAt).getTime() - Date.now()) / 1000))
      setSecondsLeft(left)
      if (left <= 0 && step === 'details') {
        setError('Your hold expired. Please pick a table again.')
        setHeld(null)
        changeStep('table')
        loadTables()
      }
    }
    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [held, step])

  // Pulse the timer when it runs low (< 60 seconds)
  useEffect(() => {
    if (held && secondsLeft > 0 && secondsLeft < 60 && timerRef.current) {
      gsap.to(timerRef.current, { scale: 1.03, duration: 0.5, yoyo: true, repeat: 1, ease: 'power1.inOut' })
    }
  }, [secondsLeft, held])

  // Stagger tables/tokens animation on render
  useEffect(() => {
    if (step === 'table' && tables.length > 0) {
      gsap.fromTo('.floor-token',
        { opacity: 0, scale: 0.6 },
        { opacity: 1, scale: 1, duration: 0.4, stagger: 0.02, ease: 'back.out(1.6)', delay: 0.05 }
      )
    }
  }, [step, tables])

  // Success checkmark & pass layout animation
  useEffect(() => {
    if (step === 'done') {
      const tl = gsap.timeline()
      tl.fromTo('.done-card',
        { opacity: 0, scale: 0.96, y: 15 },
        { opacity: 1, scale: 1, y: 0, duration: 0.5, ease: 'back.out(1.2)' }
      )
    }
  }, [step])

  // Animate Progress Bar width via GSAP
  useEffect(() => {
    if (!progressRef.current) return
    const stepIndex = ['when', 'slot', 'table', 'details', 'done'].indexOf(step)
    const targetWidth = `${(stepIndex / 4) * 100}%`
    gsap.to(progressRef.current, { width: targetWidth, duration: 0.4, ease: 'power2.out' })
  }, [step])

  // ── Data loaders ──
  const loadSlots = async () => {
    setSlotsLoading(true); setError('')
    try {
      const res = await api.get(`/reservations/slots`, { params: { outletCode: code, date, partySize } })
      const s: Slot[] = res.data.slots || []
      setSlots(s)
      setTotalTables(typeof res.data.totalTables === 'number' ? res.data.totalTables : null)
      setCanSeatParty(res.data.canSeatParty !== false)
      // Default to the first meal period that has open slots.
      const firstOpen = MEAL_PERIODS.find((p) => s.some((x) => periodOf(x.time) === p.key && x.availableCount > 0))
        ?? MEAL_PERIODS.find((p) => s.some((x) => periodOf(x.time) === p.key))
      if (firstOpen) setActivePeriod(firstOpen.key)
      changeStep('slot')
    } catch (e: any) {
      setError(e.response?.data?.error || 'Could not load times')
    } finally {
      setSlotsLoading(false)
    }
  }

  const loadTables = async () => {
    setTablesLoading(true); setError('')
    try {
      const res = await api.get(`/reservations/availability`, { params: { outletCode: code, date, time, partySize } })
      setTables(res.data.tables || [])
      setBestTableId(res.data.bestTableId ?? null)
    } catch (e: any) {
      setError(e.response?.data?.error || 'Could not load tables')
    } finally {
      setTablesLoading(false)
    }
  }

  const pickSlot = async (t: string) => {
    setTime(t)
    setSelected([]) // fresh table selection for the new slot
    changeStep('table')
    setTablesLoading(true); setError('')
    try {
      const res = await api.get(`/reservations/availability`, { params: { outletCode: code, date, time: t, partySize } })
      setTables(res.data.tables || [])
      setBestTableId(res.data.bestTableId ?? null)
    } catch (e: any) {
      setError(e.response?.data?.error || 'Could not load tables')
    } finally {
      setTablesLoading(false)
    }
  }

  const capOf = useMemo(() => new Map(tables.map((t) => [t.id, t.capacity])), [tables])

  // Toggle a table in/out of the selection. Removing is always allowed; adding is
  // blocked once the current selection already seats the whole party (BookMyShow-style:
  // you can't grab more seats than you booked for).
  const toggleTable = (t: AvailTable) => {
    if (!t.available) return
    setSelected((cur) => {
      if (cur.includes(t.id)) return cur.filter((x) => x !== t.id)
      const seats = cur.reduce((s, id) => s + (capOf.get(id) ?? 0), 0)
      if (seats >= partySize) return cur // already enough — don't add unneeded tables
      return [...cur, t.id]
    })
  }

  const seatsSelected = useMemo(
    () => selected.reduce((s, id) => s + (capOf.get(id) ?? 0), 0),
    [capOf, selected]
  )
  const enoughSeats = seatsSelected >= partySize && selected.length > 0
  const seatsCovered = enoughSeats // selection already seats the party → lock extra tables

  // Hold whatever the guest selected (one table, or several combined for a big party).
  const proceedHold = async () => {
    if (!enoughSeats) return
    setHolding(true); setError('')
    try {
      const res = await api.post(`/reservations/hold`, {
        outletCode: code, tableIds: selected, date, time, partySize, deviceId,
        joinRequested: selected.length > 1 ? joinRequested : undefined,
      })
      setHeld(res.data)
      changeStep('details')
    } catch (e: any) {
      setError(e.response?.data?.error || 'One of those tables was just taken. Pick again.')
      setSelected([])
      loadTables()
    } finally {
      setHolding(false)
    }
  }

  const releaseHold = async () => {
    if (held && deviceId) {
      api.patch(`/reservations/${held.id}/release`, { deviceId }).catch(() => {})
    }
    setHeld(null)
    setSelected([])
    changeStep('table')
    loadTables()
  }

  const handleBackClick = (e: React.MouseEvent) => {
    if (step === 'slot') {
      e.preventDefault(); changeStep('when')
    } else if (step === 'table') {
      e.preventDefault(); changeStep('slot')
    } else if (step === 'details') {
      e.preventDefault(); releaseHold()
    }
  }

  const confirm = async () => {
    if (!held) return
    if (!guestName.trim() || guestPhone.trim().length < 10) {
      setError('Please enter your name and a valid 10-digit phone'); return
    }
    setConfirming(true); setError('')
    try {
      const res = await api.post(`/reservations/${held.id}/confirm`, {
        deviceId,
        guestName: guestName.trim(),
        guestPhone: guestPhone.trim(),
        guestEmail: guestEmail.trim() || undefined,
        specialRequests: specialRequests.trim() || undefined,
        occasion: occasion || undefined,
      })
      setConfirmed(res.data)
      changeStep('done')
    } catch (e: any) {
      setError(e.response?.data?.error || 'Could not confirm. Please try again.')
    } finally {
      setConfirming(false)
    }
  }

  const holdClock = useMemo(() => {
    const m = Math.floor(secondsLeft / 60)
    const s = secondsLeft % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }, [secondsLeft])

  if (outletLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f] text-white">
      <Loader />
    </div>
  )
  if (!outlet) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f] text-white">
      <p className="text-white/60 text-lg">Outlet not found</p>
    </div>
  )

  const stepsList: Step[] = ['when', 'slot', 'table', 'details']
  const showStickyBar = step === 'table' && tables.length > 0 && !tablesLoading

  return (
    <div className={`relative min-h-screen flex flex-col items-center px-5 pt-8 overflow-x-hidden bg-[#0c0d19] text-white font-sans ${showStickyBar ? 'pb-40' : 'pb-14'}`}>
      {/* Premium Cinematic Background Elements */}
      <div className="absolute top-[-10%] left-[-20%] w-[140%] aspect-square rounded-full bg-gradient-to-br from-[#A62B22]/12 via-transparent to-transparent blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-20%] w-[100%] aspect-square rounded-full bg-gradient-to-tl from-[#FFB800]/4 via-transparent to-transparent blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          {step === 'done' ? (
            <div className="w-[18px]" />
          ) : (
            <Link
              href={step === 'when' ? `/${code}` : '#'}
              onClick={handleBackClick}
              className="text-white/60 hover:text-white text-sm font-medium flex items-center gap-1.5 group transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transform group-hover:-translate-x-0.5 transition-transform">
                <path d="m15 18-6-6 6-6" />
              </svg>
              Back
            </Link>
          )}
          <span className="text-white/80 font-bold text-xs uppercase tracking-widest">{outlet.name}</span>
        </div>

        {/* Step Progress Tracker */}
        {step !== 'done' && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3.5 relative">
              {stepsList.map((s, idx) => {
                const currentIdx = stepsList.indexOf(step)
                const isPassed = idx < currentIdx
                const isCurrent = s === step
                return (
                  <div key={s} className="flex flex-col items-center gap-2 z-10">
                    <div
                      onClick={() => { if (isPassed) { step === 'details' ? releaseHold() : changeStep(s) } }}
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-[10.5px] font-black border transition-all duration-300 ${
                        isCurrent
                          ? 'bg-primary border-primary text-white shadow-[0_0_15px_rgba(214,66,56,0.6)] scale-110'
                          : isPassed
                            ? 'bg-primary/20 border-primary/40 text-primary-light cursor-pointer hover:bg-primary/30'
                            : 'bg-[#181824] border-white/5 text-white/30'
                      }`}
                    >
                      {idx + 1}
                    </div>
                    <span className={`text-[9.5px] font-bold tracking-wider uppercase ${isCurrent ? 'text-white' : isPassed ? 'text-white/60' : 'text-white/20'}`}>
                      {['Guests', 'Time', 'Table', 'Details'][idx]}
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="relative w-full h-[3px] bg-white/5 rounded-full overflow-hidden">
              <div ref={progressRef} className="absolute left-0 top-0 h-full bg-gradient-to-r from-primary via-primary-light to-primary" style={{ width: '0%' }} />
            </div>
          </div>
        )}

        <div className="mb-6">
          <h1 className="text-white text-3xl font-serif font-black tracking-tight leading-tight">
            {step === 'done' ? 'Your Table Pass' : 'Reserve a Table'}
          </h1>
          <p className="text-white/40 text-[13.5px] mt-1 font-medium">
            {step === 'done' ? 'Show this pass at the restaurant' : 'Choose date, size, and seat below'}
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-xl px-4 py-3 text-[13px] font-semibold text-white/90 bg-red-950/40 border border-red-500/20 backdrop-blur-md shadow-lg">
            {error}
          </div>
        )}

        {/* STEP WRAPPER WITH REF */}
        <div ref={containerRef}>
          {/* STEP 1 — date & guest selection + My Bookings tab */}
          {step === 'when' && (
            <div className="flex flex-col gap-5">
              {/* Tab switcher */}
              <div className="flex rounded-xl bg-white/[0.04] border border-white/8 p-1 gap-1">
                <button
                  onClick={() => setBookingsTab('reserve')}
                  className={`flex-1 py-2.5 rounded-lg text-[13px] font-bold transition-all outline-none cursor-pointer ${
                    bookingsTab === 'reserve' ? 'bg-white text-[#00021D] shadow-md' : 'text-white/50 hover:text-white/80'
                  }`}
                >
                  Reserve a Table
                </button>
                <button
                  onClick={() => setBookingsTab('mybookings')}
                  className={`flex-1 py-2.5 rounded-lg text-[13px] font-bold transition-all outline-none cursor-pointer relative ${
                    bookingsTab === 'mybookings' ? 'bg-white text-[#00021D] shadow-md' : 'text-white/50 hover:text-white/80'
                  }`}
                >
                  My Bookings
                  {upcomingBookings.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-white text-[9px] font-black flex items-center justify-center">
                      {upcomingBookings.length}
                    </span>
                  )}
                </button>
              </div>

              {bookingsTab === 'reserve' ? (
                <>
                  {/* ── Horizontal date strip ── */}
                  <Card>
                    <div className="flex items-center justify-between mb-3">
                      <Label>Select a date</Label>
                      <label className="relative flex items-center gap-1.5 text-[11px] font-bold text-primary-light cursor-pointer">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect width="18" height="18" x="3" y="4" rx="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" />
                        </svg>
                        More
                        <input type="date" value={date} min={todayIst()} onChange={(e) => setDate(e.target.value)}
                          className="absolute inset-0 opacity-0 cursor-pointer [color-scheme:dark]" />
                      </label>
                    </div>
                    <div className="flex gap-2.5 overflow-x-auto pb-1.5 -mx-1 px-1 date-strip">
                      {dateStrip.map((d) => {
                        const active = d.iso === date
                        return (
                          <button key={d.iso} onClick={() => setDate(d.iso)}
                            className={`shrink-0 w-[62px] rounded-2xl py-3 flex flex-col items-center gap-0.5 border transition-all outline-none cursor-pointer ${
                              active ? 'bg-white text-[#00021D] border-white shadow-[0_6px_18px_rgba(255,255,255,0.15)]'
                                     : 'bg-white/[0.03] text-white border-white/8 hover:border-white/20'
                            }`}>
                            <span className={`text-[9.5px] font-black uppercase tracking-wider ${active ? 'text-primary' : 'text-white/40'}`}>
                              {d.rel || d.dow}
                            </span>
                            <span className="text-[19px] font-black leading-none">{d.day}</span>
                            <span className={`text-[9.5px] font-bold uppercase ${active ? 'text-[#00021D]/50' : 'text-white/30'}`}>{d.mon}</span>
                          </button>
                        )
                      })}
                    </div>
                  </Card>

                  {/* ── Guest count: quick chips + stepper ── */}
                  <Card>
                    <Label>How many guests?</Label>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {[1, 2, 3, 4, 5, 6, 8].map((n) => (
                        <button key={n} onClick={() => setPartySize(n)}
                          className={`min-w-[44px] px-3 py-2 rounded-xl text-[14px] font-black border transition-all cursor-pointer ${
                            partySize === n ? 'bg-primary border-primary text-white shadow-[0_4px_14px_rgba(214,66,56,0.35)]'
                                            : 'bg-white/[0.03] border-white/8 text-white/70 hover:border-white/20'
                          }`}>
                          {n}{n === 8 ? '+' : ''}
                        </button>
                      ))}
                    </div>
                    <Stepper value={partySize} min={1} max={20} onChange={setPartySize} />
                  </Card>

                  <PrimaryButton onClick={loadSlots} loading={slotsLoading}>Find a table</PrimaryButton>
                </>
              ) : (
                /* ── My Bookings panel ── */
                <div className="flex flex-col gap-4">
                  {bookingsLoading ? (
                    <div className="py-10 flex items-center justify-center">
                      <svg className="animate-spin h-6 w-6 text-white/40" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    </div>
                  ) : myBookings.length === 0 ? (
                    <div className="rounded-2xl p-8 text-center bg-white/[0.04] border border-white/8">
                      <div className="text-4xl mb-3">🍽️</div>
                      <p className="text-white font-bold text-[16px]">No bookings yet</p>
                      <p className="text-white/40 text-[13px] mt-1.5">Reserve a table and it&apos;ll appear here.</p>
                      <button onClick={() => setBookingsTab('reserve')}
                        className="mt-4 rounded-full px-6 py-3 font-bold text-[13px] text-[#00021D] bg-white hover:bg-white/90 transition-colors cursor-pointer">
                        Reserve Now
                      </button>
                    </div>
                  ) : (
                    <>
                      {upcomingBookings.length > 0 && (
                        <div>
                          <SectionDivider>Upcoming</SectionDivider>
                          <div className="flex flex-col gap-3">
                            {upcomingBookings.map((b) => (
                              <InlineBookingCard key={b.id} b={b} onCancel={() => cancelBooking(b)} cancelling={cancellingId === b.id} allowCancel={b.status === 'confirmed'} />
                            ))}
                          </div>
                        </div>
                      )}
                      {pastBookings.length > 0 && (
                        <div>
                          <SectionDivider>Past &amp; Cancelled</SectionDivider>
                          <div className="flex flex-col gap-3">
                            {pastBookings.map((b) => (<InlineBookingCard key={b.id} b={b} />))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP 2 — time slot list grouped by meal period */}
          {step === 'slot' && (
            <div className="flex flex-col gap-4">
              <SummaryPill items={[fmtStripDate(date), `${partySize} Guest${partySize > 1 ? 's' : ''}`]} onEdit={() => changeStep('when')} />

              {totalTables === 0 || !canSeatParty ? (
                <Card>
                  <p className="text-white/40 text-sm py-4 text-center font-medium">
                    We can&apos;t seat {partySize} {partySize > 1 ? 'guests' : 'guest'} here right now. Try a smaller party or check back soon.
                  </p>
                </Card>
              ) : slots.length === 0 ? (
                <Card>
                  <p className="text-white/40 text-sm py-4 text-center font-medium">No slots available for this day. Try another date.</p>
                </Card>
              ) : (
                <>
                  {/* Meal-period selector */}
                  <div className="flex gap-2">
                    {MEAL_PERIODS.map((p) => {
                      const periodSlots = slots.filter((s) => periodOf(s.time) === p.key)
                      if (periodSlots.length === 0) return null
                      const openCount = periodSlots.filter((s) => s.availableCount > 0).length
                      const active = activePeriod === p.key
                      return (
                        <button key={p.key} onClick={() => setActivePeriod(p.key)}
                          className={`flex-1 rounded-2xl py-3 flex flex-col items-center gap-1 border transition-all cursor-pointer ${
                            active ? 'bg-white/[0.07] border-primary/50 shadow-[0_4px_14px_rgba(214,66,56,0.12)]' : 'bg-white/[0.02] border-white/8 hover:border-white/15'
                          }`}>
                          <span className="text-[17px] leading-none">{p.icon}</span>
                          <span className={`text-[12px] font-black ${active ? 'text-white' : 'text-white/60'}`}>{p.label}</span>
                          <span className={`text-[9px] font-bold uppercase tracking-wider ${openCount > 0 ? 'text-emerald-400/80' : 'text-white/25'}`}>
                            {openCount > 0 ? `${openCount} open` : 'Full'}
                          </span>
                        </button>
                      )
                    })}
                  </div>

                  <Card>
                    <Label>{MEAL_PERIODS.find((p) => p.key === activePeriod)?.label} timings</Label>
                    {(() => {
                      const periodSlots = slots.filter((s) => periodOf(s.time) === activePeriod)
                      if (periodSlots.length === 0) return <p className="text-white/40 text-sm py-4 text-center font-medium">No timings in this period.</p>
                      return (
                        <div className="grid grid-cols-3 gap-2.5 mt-1">
                          {periodSlots.map((s) => {
                            const disabled = s.availableCount <= 0
                            const scarce = !disabled && s.availableCount <= 3
                            return (
                              <button key={s.time} disabled={disabled} onClick={() => pickSlot(s.time)}
                                className="time-slot-btn relative rounded-xl py-3 px-2 text-center transition-all disabled:opacity-20 disabled:cursor-not-allowed border outline-none group cursor-pointer hover:border-primary/50"
                                style={{ background: 'rgba(255,255,255,0.03)', borderColor: scarce ? 'rgba(255,184,0,0.25)' : 'rgba(255,255,255,0.06)' }}>
                                <div className="text-[13.5px] font-black text-white group-hover:text-primary-light transition-colors">{fmtSlot(s.time)}</div>
                                <span className={`block text-[9px] font-bold tracking-wider uppercase mt-1 ${scarce ? 'text-amber-400' : 'opacity-40'}`}>
                                  {disabled ? 'Full' : `${s.availableCount} left`}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      )
                    })()}
                  </Card>
                </>
              )}
            </div>
          )}

          {/* STEP 3 — choose table on the spatial floor map */}
          {step === 'table' && (
            <div className="flex flex-col gap-4">
              <SummaryPill items={[fmtStripDate(date), fmtSlot(time), `${partySize} Guest${partySize > 1 ? 's' : ''}`]} onEdit={() => changeStep('slot')} />

              {partySize > 4 && (
                <div className="rounded-xl px-3.5 py-2.5 text-[12px] font-medium text-white/70 bg-white/[0.03] border border-white/8">
                  Big group! Tap <b className="text-white/90">multiple tables</b> until the seats add up — we&apos;ll try to seat you together.
                </div>
              )}

              {/* Zone experience-tier legend */}
              {tables.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  {ZONE_ORDER.filter((z) => tables.some((t) => t.zone === z)).map((z) => {
                    const tier = ZONE_TIER[z]
                    return (
                      <span key={z} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/[0.03] border border-white/8 text-[10.5px] font-bold">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: tier.accent }} />
                        <span className="text-white/85">{tier.tier}</span>
                        <span className="text-white/30">{tier.label}</span>
                      </span>
                    )
                  })}
                </div>
              )}

              {/* The floor map */}
              {tablesLoading ? (
                <Card><p className="text-white/40 text-sm py-8 text-center font-medium">Loading floor…</p></Card>
              ) : tables.length === 0 ? (
                <Card><p className="text-white/40 text-sm py-8 text-center font-medium">No tables here right now. Pick another slot.</p></Card>
              ) : (
                <FloorMap
                  tables={tables}
                  selected={selected}
                  bestTableId={selected.length === 0 ? bestTableId : null}
                  holding={holding}
                  locked={seatsCovered}
                  onToggle={toggleTable}
                />
              )}

              {/* Free/selected/taken legend */}
              {tables.length > 0 && !tablesLoading && (
                <div className="flex items-center justify-center gap-4 text-[11px] font-semibold text-white/60">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-white/90" />Free</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#D64238]" />Selected</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ background: 'rgba(255,255,255,0.12)' }} />Taken</span>
                </div>
              )}
            </div>
          )}

          {/* STEP 4 — details entry */}
          {step === 'details' && held && (
            <div className="flex flex-col gap-5">
              <div ref={timerRef} className="rounded-xl px-4 py-3.5 flex items-center justify-between bg-white/[0.02] border border-white/5 backdrop-blur-md">
                <div className="flex items-center gap-2 text-[12.5px] font-bold text-white/80">
                  <div className={`w-2 h-2 rounded-full bg-primary ${secondsLeft < 60 ? 'animate-pulse bg-red-500' : ''}`} />
                  <span>{(held.tables ?? [held.table]).map((t) => t.name).join(' + ')} {(held.tables?.length ?? 1) > 1 ? 'are' : 'is'} held</span>
                </div>
                <div className="flex items-center gap-1.5 text-primary-light font-black text-[13.5px] tracking-wider tabular-nums">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                  <span>{holdClock}</span>
                </div>
              </div>

              <Card>
                <Label>Your details</Label>
                <div className="flex flex-col gap-3.5 mt-1">
                  <input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Full name"
                    className="w-full rounded-xl px-4 py-3.5 text-[14px] font-bold text-white bg-[#151522] border border-white/5 focus:border-primary/40 focus:ring-1 focus:ring-primary/20 outline-none transition-all placeholder:text-white/20" />
                  <input value={guestPhone} onChange={(e) => setGuestPhone(e.target.value.replace(/[^\d]/g, '').slice(0, 10))} placeholder="10-digit mobile number" inputMode="numeric"
                    className="w-full rounded-xl px-4 py-3.5 text-[14px] font-bold text-white bg-[#151522] border border-white/5 focus:border-primary/40 focus:ring-1 focus:ring-primary/20 outline-none transition-all placeholder:text-white/20" />
                  <input value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} placeholder="Email address (optional)" inputMode="email"
                    className="w-full rounded-xl px-4 py-3.5 text-[14px] font-bold text-white bg-[#151522] border border-white/5 focus:border-primary/40 focus:ring-1 focus:ring-primary/20 outline-none transition-all placeholder:text-white/20" />
                  <input value={specialRequests} onChange={(e) => setSpecialRequests(e.target.value)} placeholder="Special requests or allergies (optional)"
                    className="w-full rounded-xl px-4 py-3.5 text-[14px] font-bold text-white bg-[#151522] border border-white/5 focus:border-primary/40 focus:ring-1 focus:ring-primary/20 outline-none transition-all placeholder:text-white/20" />
                  <div>
                    <div className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-white/35 mb-2">Occasion (optional)</div>
                    <div className="flex flex-wrap gap-2">
                      {['Birthday', 'Anniversary', 'Date', 'Business', 'Family'].map((o) => {
                        const active = occasion === o
                        return (
                          <button key={o} type="button" onClick={() => setOccasion(active ? '' : o)}
                            className={`px-3 py-1.5 rounded-full text-[12px] font-bold transition-all border ${active ? 'bg-white text-[#00021D] border-white' : 'bg-white/[0.03] text-white/60 border-white/10'}`}>
                            {o}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </Card>

              <PrimaryButton onClick={confirm} loading={confirming}>Confirm reservation</PrimaryButton>
              <button onClick={releaseHold} className="text-white/40 hover:text-white text-[12.5px] font-semibold py-1 transition-colors outline-none cursor-pointer">
                Cancel and pick another table
              </button>
            </div>
          )}

          {/* STEP 5 — booking pass with QR */}
          {step === 'done' && confirmed && (
            <BookingPass confirmed={confirmed} qrDataUrl={qrDataUrl} outletName={outlet.name}
              onViewBookings={() => { loadMyBookings(); changeStep('when'); setBookingsTab('mybookings') }}
              homeHref={`/${code}`} />
          )}
        </div>
      </div>

      {/* Sticky checkout bar (BookMyShow-style) */}
      {showStickyBar && (
        <div className="fixed bottom-0 left-0 right-0 z-30 px-4 pb-4 pt-2 pointer-events-none">
          <div className="max-w-md mx-auto pointer-events-auto rounded-2xl bg-[#12131f]/95 border border-white/10 backdrop-blur-xl shadow-[0_-8px_40px_rgba(0,0,0,0.5)] p-3.5 flex flex-col gap-2.5">
            <div className="flex items-center justify-between text-[13px] font-semibold">
              <span className="text-white/70">
                {selected.length === 0 ? 'No table selected' : `${selected.length} table${selected.length > 1 ? 's' : ''} · ${seatsSelected} seats`}
              </span>
              <span className={enoughSeats ? 'text-emerald-400 font-bold' : 'text-white/50'}>{seatsSelected}/{partySize} seats</span>
            </div>

            {seatsCovered && (
              <p className="text-[11px] font-medium text-white/45 -mt-0.5">
                Enough seats for {partySize} — tap a picked table to swap.
              </p>
            )}

            {selected.length > 1 && (
              <button onClick={() => setJoinRequested((v) => !v)} className="flex items-center gap-2.5 text-[12px] font-medium text-white/80">
                <span className={`w-9 h-5 rounded-full relative transition-colors ${joinRequested ? 'bg-emerald-500' : 'bg-white/15'}`}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${joinRequested ? 'left-[18px]' : 'left-0.5'}`} />
                </span>
                Ask to join these tables together
              </button>
            )}

            <button onClick={proceedHold} disabled={!enoughSeats || holding}
              className="w-full rounded-full py-3.5 font-bold text-[15px] text-[#00021D] bg-white disabled:opacity-40 transition-all active:scale-[0.98]">
              {holding ? 'Holding…' : enoughSeats ? 'Continue to book' : selected.length === 0 ? 'Tap a table to begin' : `Select ${partySize - seatsSelected} more seat${partySize - seatsSelected > 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .date-strip::-webkit-scrollbar { height: 0; }
        .date-strip { scrollbar-width: none; }
      `}</style>
    </div>
  )
}

// ─── Spatial floor map (BookMyShow-style seat selection) ──────────────────────────

function FloorMap({
  tables, selected, bestTableId, holding, locked, onToggle,
}: {
  tables: AvailTable[]; selected: string[]; bestTableId: string | null; holding: boolean
  locked: boolean; onToggle: (t: AvailTable) => void
}) {
  const positioned = useMemo(() => withCoords(tables), [tables])
  const rows = Math.max(1, Math.ceil(tables.length / Math.min(6, Math.max(3, Math.ceil(Math.sqrt(tables.length * 1.5))))))
  const hasLayout = tables.length > 0 && tables.every((t) => t.posX != null && t.posY != null)
  const height = hasLayout ? 430 : Math.min(680, Math.max(340, rows * 92 + 70))

  const tokenSize = (cap: number) => Math.min(64, 42 + Math.max(0, cap - 2) * 3)

  return (
    <div className="rounded-2xl bg-white/[0.02] border border-white/10 overflow-hidden">
      <div className="relative w-full" style={{ height }}>
        {/* subtle grid texture */}
        <div className="absolute inset-0 opacity-[0.05]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.6) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.6) 1px,transparent 1px)', backgroundSize: '28px 28px' }} />

        {/* Tables */}
        {positioned.map((t) => {
          const size = tokenSize(t.capacity)
          const isBest = t.id === bestTableId
          const isPicked = selected.includes(t.id)
          // Free but not needed anymore (party already seated) → locked, like BookMyShow.
          const isLocked = t.available && !isPicked && locked
          const clickable = t.available && !holding && (isPicked || !locked)
          const tier = ZONE_TIER[t.zone] ?? ZONE_TIER.non_ac
          const radius = t.shape === 'round' ? '50%' : t.shape === 'rect' ? '12px' : '14px'
          const width = t.shape === 'rect' ? size * 1.5 : size
          const bg = isPicked ? '#D64238' : t.available ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.06)'
          const fg = isPicked ? '#fff' : t.available ? '#00021D' : 'rgba(255,255,255,0.35)'
          return (
            <button key={t.id} disabled={!clickable} onClick={() => onToggle(t)}
              className={`floor-token absolute flex flex-col items-center justify-center transition-transform outline-none ${clickable ? 'cursor-pointer active:scale-90' : 'cursor-not-allowed'}`}
              style={{
                left: `${t.x}%`, top: `${t.y}%`, width, height: size,
                transform: 'translate(-50%,-50%)', background: bg, color: fg,
                borderRadius: radius,
                opacity: isLocked ? 0.4 : 1,
                border: isBest ? '2px solid #fff' : `2px solid ${isPicked ? '#fff' : tier.accent}`,
                boxShadow: isPicked ? '0 6px 20px rgba(214,66,56,0.5)' : t.available && !isLocked ? `0 4px 14px rgba(0,0,0,0.35)` : 'none',
              }}>
              <span className="text-[12px] font-black leading-none">{t.name}</span>
              <span className="text-[9px] font-bold leading-none mt-0.5" style={{ opacity: 0.7 }}>
                {t.blocked ? 'Held' : `${t.capacity}p`}
              </span>
              {isPicked && (
                <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-white flex items-center justify-center shadow">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#D64238" strokeWidth="3.5"><path d="M20 6 9 17l-5-5" /></svg>
                </span>
              )}
              {isBest && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[7.5px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-white text-[#D64238] shadow whitespace-nowrap">Best</span>
              )}
            </button>
          )
        })}

        {/* ENTRANCE marker (the BookMyShow "screen" analog) */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-[70%] flex flex-col items-center gap-1 pointer-events-none">
          <div className="w-full h-[3px] rounded-full bg-gradient-to-r from-transparent via-[#FFB800]/70 to-transparent" />
          <span className="text-[9px] font-black uppercase tracking-[0.35em] text-white/40">Entrance</span>
        </div>
      </div>
    </div>
  )
}

// ─── Booking pass (ticket-style confirmation with QR) ─────────────────────────────

function BookingPass({
  confirmed, qrDataUrl, outletName, onViewBookings, homeHref,
}: {
  confirmed: ConfirmedReservation; qrDataUrl: string; outletName: string
  onViewBookings: () => void; homeHref: string
}) {
  const all = [confirmed.table, ...(confirmed.additionalTables ?? []).map((a) => a.table)].filter(Boolean) as TableRef[]
  const names = all.map((t) => t.name).join(' + ')
  const zones = [...new Set(all.map((t) => ZONE_LABEL[t.zone] ?? t.zone))]
  const when = new Date(confirmed.reservedAt)

  const calendarUrl = useMemo(() => {
    const start = when
    const end = new Date(start.getTime() + 90 * 60_000)
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: `Table reservation · ${outletName}`,
      dates: `${fmt(start)}/${fmt(end)}`,
      details: `Booking ${confirmed.bookingCode} · ${names} · ${confirmed.partySize} guests`,
      location: outletName,
    })
    return `https://calendar.google.com/calendar/render?${params.toString()}`
  }, [when, outletName, confirmed.bookingCode, names, confirmed.partySize])

  const share = async () => {
    const text = `Table booked at ${outletName}! ${names} · ${when.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })} · Booking ${confirmed.bookingCode}`
    try {
      if (navigator.share) await navigator.share({ title: 'Table Reservation', text })
      else { await navigator.clipboard.writeText(text); alert('Booking details copied!') }
    } catch { /* user dismissed */ }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="done-card relative rounded-3xl overflow-hidden bg-white text-[#0c0d19] shadow-[0_16px_50px_rgba(0,0,0,0.55)]">
        {/* Pass header */}
        <div className="px-6 pt-6 pb-5 bg-gradient-to-br from-[#141527] to-[#0c0d19] text-white">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50">Confirmed</span>
            <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Booked
            </span>
          </div>
          <h2 className="text-2xl font-serif font-black tracking-tight mt-2">{outletName}</h2>
          <p className="text-white/45 text-[12px] font-medium mt-0.5">Table reservation pass</p>
        </div>

        {/* Perforation */}
        <div className="relative h-0">
          <div className="absolute -left-3 -top-3 w-6 h-6 rounded-full bg-[#0c0d19]" />
          <div className="absolute -right-3 -top-3 w-6 h-6 rounded-full bg-[#0c0d19]" />
          <div className="absolute left-4 right-4 top-0 border-t-2 border-dashed border-[#0c0d19]/15" />
        </div>

        {/* QR + code */}
        <div className="px-6 pt-6 pb-4 flex flex-col items-center">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="Booking QR" className="w-40 h-40 rounded-xl" />
          ) : (
            <div className="w-40 h-40 rounded-xl bg-[#0c0d19]/5 flex items-center justify-center text-[#0c0d19]/30 text-xs font-semibold">Generating…</div>
          )}
          <div className="mt-3 text-[10px] font-black uppercase tracking-[0.15em] text-[#0c0d19]/40">Booking code</div>
          <div className="text-2xl font-black tracking-[0.12em] text-primary">{confirmed.bookingCode}</div>
        </div>

        {/* Details */}
        <div className="px-6 pb-6 grid grid-cols-2 gap-x-4 gap-y-3">
          <PassField k={all.length > 1 ? 'Tables' : 'Table'} v={`${names}${zones.length ? ` · ${zones.join(', ')}` : ''}`} />
          <PassField k="Guests" v={String(confirmed.partySize)} />
          <PassField k="Date" v={when.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'Asia/Kolkata' })} />
          <PassField k="Time" v={when.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })} />
          {confirmed.occasion && <PassField k="Occasion" v={confirmed.occasion} />}
          {confirmed.joinRequested && all.length > 1 && <PassField k="Seating" v="Joined together" />}
        </div>

        <div className="px-6 pb-6 flex gap-2.5">
          <a href={calendarUrl} target="_blank" rel="noopener noreferrer"
            className="flex-1 rounded-xl py-3 text-center text-[12.5px] font-bold text-[#0c0d19] bg-[#0c0d19]/[0.05] hover:bg-[#0c0d19]/[0.09] transition-colors flex items-center justify-center gap-1.5">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></svg>
            Calendar
          </a>
          <button onClick={share}
            className="flex-1 rounded-xl py-3 text-center text-[12.5px] font-bold text-[#0c0d19] bg-[#0c0d19]/[0.05] hover:bg-[#0c0d19]/[0.09] transition-colors flex items-center justify-center gap-1.5">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" x2="15.42" y1="13.51" y2="17.49" /><line x1="15.41" x2="8.59" y1="6.51" y2="10.49" /></svg>
            Share
          </button>
        </div>
      </div>

      <p className="text-white/30 text-[11px] font-semibold text-center tracking-wider uppercase">
        We&apos;ve sent a WhatsApp confirmation
      </p>

      <button onClick={onViewBookings}
        className="w-full rounded-full py-4 text-center font-bold text-[15px] text-[#00021D] bg-white hover:bg-white/95 active:bg-white/90 select-none shadow-[0_8px_20px_rgba(255,255,255,0.1)] transition-colors cursor-pointer block">
        View my bookings
      </button>
      <Link href={homeHref} className="block text-center">
        <span className="text-white/60 text-[13px] font-semibold underline underline-offset-4">Back to home</span>
      </Link>
    </div>
  )
}

function PassField({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-[9.5px] font-black uppercase tracking-[0.12em] text-[#0c0d19]/35">{k}</div>
      <div className="text-[13.5px] font-bold text-[#0c0d19] mt-0.5">{v}</div>
    </div>
  )
}

// ─── Inline booking card ──────────────────────────────────────────────────────────

function InlineBookingCard({ b, onCancel, cancelling, allowCancel }: { b: Booking; onCancel?: () => void; cancelling?: boolean; allowCancel?: boolean }) {
  const meta = BOOKING_STATUS_META[b.status]
  return (
    <div className="rounded-2xl p-4 bg-white/[0.04] border border-white/8 backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-white font-bold text-[15px] truncate">
            {b.table?.name ?? 'Table'}
            {b.table?.zone && (<span className="text-white/35 font-medium text-[12px] ml-1.5">{ZONE_LABEL[b.table.zone] ?? b.table.zone}</span>)}
          </div>
          <div className="text-white/50 text-[12.5px] font-medium mt-0.5">{fmtDate(b.reservedAt)}</div>
        </div>
        <div className={`flex items-center gap-1.5 shrink-0 ${meta.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
          <span className="text-[11px] font-bold">{meta.label}</span>
        </div>
      </div>
      <div className="flex items-center gap-3 mt-3 text-[12px] text-white/40 font-medium">
        <span>👥 {b.partySize}</span>
        <span className="text-primary-light font-black tracking-wide">{b.bookingCode}</span>
        {b.occasion && (<span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary-light text-[11px] font-bold">{b.occasion}</span>)}
      </div>
      {allowCancel && onCancel && (
        <button onClick={onCancel} disabled={cancelling}
          className="mt-3 w-full rounded-xl py-2.5 text-[12.5px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 disabled:opacity-50 cursor-pointer transition-colors hover:bg-rose-500/20">
          {cancelling ? 'Cancelling…' : 'Cancel booking'}
        </button>
      )}
    </div>
  )
}

// ─── Small presentational helpers ───────────────────────────────────────────────

function fmtStripDate(iso: string): string {
  return new Date(`${iso}T00:00:00+05:30`).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'Asia/Kolkata' })
}

function SectionDivider({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-black uppercase tracking-[0.14em] text-white/35 mb-2.5 flex items-center gap-2">
      <span className="h-px flex-1 bg-white/8" />{children}<span className="h-px flex-1 bg-white/8" />
    </div>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl p-5 bg-white/[0.04] backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] ${className}`}>
      {children}
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-white/40 text-[10px] font-bold uppercase tracking-[0.18em] mb-3">{children}</div>
}

function PrimaryButton({ children, onClick, loading, disabled }: { children: React.ReactNode; onClick: () => void; loading?: boolean; disabled?: boolean }) {
  const btnRef = useRef<HTMLButtonElement>(null)
  return (
    <button ref={btnRef} onClick={onClick} disabled={loading || disabled}
      onMouseEnter={() => gsap.to(btnRef.current, { scale: 1.02, duration: 0.2, ease: 'power2.out' })}
      onMouseLeave={() => gsap.to(btnRef.current, { scale: 1, duration: 0.2, ease: 'power2.out' })}
      onMouseDown={() => gsap.to(btnRef.current, { scale: 0.98, duration: 0.08 })}
      onMouseUp={() => gsap.to(btnRef.current, { scale: 1.02, duration: 0.15, ease: 'elastic.out(1, 0.3)' })}
      className="w-full rounded-full py-4 font-bold text-[15px] btn-gradient transition-all disabled:opacity-50 disabled:cursor-not-allowed select-none shadow-[0_8px_20px_rgba(214,66,56,0.3)] cursor-pointer">
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Processing...
        </span>
      ) : children}
    </button>
  )
}

function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  const numberRef = useRef<HTMLSpanElement>(null)
  const animateButton = (btn: EventTarget & Element) => {
    gsap.timeline().to(btn, { scale: 0.85, duration: 0.08, ease: 'power1.out' }).to(btn, { scale: 1, duration: 0.15, ease: 'elastic.out(1, 0.3)' })
  }
  const animateNumber = () => {
    if (numberRef.current) gsap.fromTo(numberRef.current, { scale: 0.7, opacity: 0.7 }, { scale: 1, opacity: 1, duration: 0.25, ease: 'back.out(1.7)' })
  }
  return (
    <div className="flex items-center gap-6 w-full justify-center select-none py-2">
      <button onClick={(e) => { if (value > min) { onChange(value - 1); animateButton(e.currentTarget); animateNumber() } }} disabled={value <= min}
        className="w-12 h-12 rounded-full bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 text-white text-2xl font-light flex items-center justify-center transition-colors disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer">
        −
      </button>
      <div className="flex flex-col items-center min-w-[70px]">
        <span ref={numberRef} className="text-white text-4xl font-serif font-black tabular-nums text-center block">{value}</span>
        <span className="text-[9px] text-white/30 uppercase tracking-widest font-bold mt-1.5">{value === 1 ? 'Guest' : 'Guests'}</span>
      </div>
      <button onClick={(e) => { if (value < max) { onChange(value + 1); animateButton(e.currentTarget); animateNumber() } }} disabled={value >= max}
        className="w-12 h-12 rounded-full bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 text-white text-2xl font-light flex items-center justify-center transition-colors disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer">
        +
      </button>
    </div>
  )
}

function SummaryPill({ items, onEdit }: { items: string[]; onEdit: () => void }) {
  return (
    <div className="rounded-2xl px-5 py-3.5 flex items-center justify-between text-white bg-white/[0.02] border border-white/5 backdrop-blur-md shadow-md">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {items.map((item, idx) => (
          <span key={idx} className="flex items-center text-[12.5px] font-bold text-white/90">
            {idx > 0 && <span className="text-white/20 mr-3 select-none">·</span>}{item}
          </span>
        ))}
      </div>
      <button onClick={onEdit} className="text-primary-light hover:text-primary font-bold text-[12.5px] transition-colors shrink-0 cursor-pointer pl-4 outline-none">Edit</button>
    </div>
  )
}
