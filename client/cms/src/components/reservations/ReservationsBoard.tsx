'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { api } from '@/lib/api'
import { getToken } from '@/lib/auth'
import { useAuth } from '@/context/AuthContext'
import type { Reservation, ReservationStatus, ReservationEvent, Outlet, RestaurantTable } from '@/types/api'
import toast from 'react-hot-toast'
import GSAPDropdown from '@/components/ui/GSAPDropdown'
import gsap from 'gsap'
import {
  CalendarClock, Users, User, Store, Plus, X, Check, Armchair,
  CheckCircle2, Ban, UserX, Clock, Phone, MessageSquare, Activity,
  Inbox, PieChart, AlertTriangle
} from 'lucide-react'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.napkiq.in/api'

const ZONE_LABEL: Record<string, string> = { ac: 'AC', non_ac: 'Non-AC', outdoor: 'Outdoor' }

const COLUMNS: { status: ReservationStatus; label: string; accent: string; icon: any }[] = [
  { status: 'confirmed', label: 'Upcoming Arrivals', accent: 'var(--color-info)',    icon: CalendarClock },
  { status: 'seated',    label: 'Currently Seated',   accent: 'var(--color-success)', icon: Armchair },
]

function todayIstDate(): string {
  return new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10)
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })
}

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(' ')
  const ini = (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')
  return (
    <div className="res-avatar">
      {ini.toUpperCase()}
    </div>
  )
}

// ─── Animated Counter Component ──────────────────────────────────────────────
interface AnimatedCounterProps {
  value: number
  duration?: number
  prefix?: string
  suffix?: string
  decimals?: number
  formatLocale?: boolean
}

function AnimatedCounter({ 
  value, 
  duration = 0.8, 
  prefix = '', 
  suffix = '', 
  decimals = 0,
  formatLocale = true
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null)
  
  useEffect(() => {
    if (!ref.current) return
    const obj = { val: 0 }
    gsap.killTweensOf(obj)
    
    gsap.to(obj, {
      val: value,
      duration: duration,
      ease: 'power2.out',
      onUpdate: () => {
        if (ref.current) {
          let str = obj.val.toFixed(decimals)
          if (formatLocale && decimals === 0) {
            str = Math.round(obj.val).toLocaleString()
          } else if (formatLocale && decimals > 0) {
            str = Number(str).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
          }
          ref.current.innerText = prefix + str + suffix
        }
      }
    })
  }, [value, duration, prefix, suffix, decimals, formatLocale])

  const initialStr = formatLocale 
    ? value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : value.toFixed(decimals)

  return <span ref={ref}>{prefix}{initialStr}{suffix}</span>
}

// ─── Reservation Card ──────────────────────────────────────────────────────────
function ReservationCard({ r, accent, busy, onStatus }: {
  r: Reservation
  accent: string
  busy: boolean
  onStatus: (status: ReservationStatus) => void
}) {
  return (
    <div className="res-card">
      <div className="res-card-header">
        <span className="res-card-time"><Clock size={13} /> {fmtTime(r.reservedAt)}</span>
        <span className="res-card-code">{r.bookingCode}</span>
      </div>

      <div className="res-card-guest">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Initials name={r.guestName} />
          <div>
            <div className="res-card-name">{r.guestName}</div>
            <div className="res-card-contact"><Phone size={11} /> {r.guestPhone}</div>
          </div>
        </div>
        
        <div className="res-card-meta">
          <span className="res-meta-item">
            <Users size={12} /> {r.partySize} Pax
          </span>
          <span className="res-card-dot">·</span>
          <span className="res-meta-item">
            <Armchair size={12} /> {[r.table, ...(r.additionalTables ?? []).map((a) => a.table)].filter(Boolean).map((t) => t!.name).join(' + ') || '—'}
          </span>
          {r.table?.zone && (
            <span className="res-zone-pill">{ZONE_LABEL[r.table.zone] ?? r.table.zone}</span>
          )}
          {(r.additionalTables?.length ?? 0) > 0 && (
            <span className="res-zone-pill joined">
              🔗 {r.joinRequested ? 'joined' : 'combined'}
            </span>
          )}
        </div>
      </div>

      {(r.occasion || r.dietaryNotes) && (
        <div className="res-crm-tags-row">
          {r.occasion && <span className="res-crm-tag occasion">🎉 {r.occasion}</span>}
          {r.dietaryNotes && <span className="res-crm-tag diet">🥗 {r.dietaryNotes}</span>}
        </div>
      )}
      
      {r.specialRequests && (
        <div className="res-card-note">
          <MessageSquare size={12} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{r.specialRequests}</span>
        </div>
      )}

      <div className="res-card-footer">
        <span className={`res-source-pill ${r.source}`}>
          {r.source === 'staff' ? <><Users size={10} />Staff</> : <><User size={10} />App</>}
        </span>
        <div className="res-card-actions">
          {r.status === 'confirmed' && (
            <>
              <button className="res-btn-ghost danger" disabled={busy} onClick={() => onStatus('no_show')}>
                <UserX size={12} /> No-show
              </button>
              <button className="res-btn-ghost" disabled={busy} onClick={() => onStatus('cancelled')}>
                <Ban size={12} /> Cancel
              </button>
              <button className="res-btn-primary-small" disabled={busy} onClick={() => onStatus('seated')}>
                <Armchair size={12} /> Seat
              </button>
            </>
          )}
          {r.status === 'seated' && (
            <>
              <button className="res-btn-ghost" disabled={busy} onClick={() => onStatus('cancelled')}>
                <Ban size={12} /> Cancel
              </button>
              <button className="res-btn-primary-small" disabled={busy} onClick={() => onStatus('completed')}>
                <CheckCircle2 size={12} /> Complete
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── New Booking Modal ────────────────────────────────────────────────────────
function NewBookingModal({ outletId, date, onClose, onCreated, tables, tablesLoading }: {
  outletId: string
  date: string
  onClose: () => void
  onCreated: (r: Reservation) => void
  tables: RestaurantTable[]
  tablesLoading: boolean
}) {
  const [time, setTime] = useState('19:00')
  const [partySize, setPartySize] = useState(2)
  const [selected, setSelected] = useState<string[]>([])
  const [joinRequested, setJoinRequested] = useState(true)
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [specialRequests, setSpecialRequests] = useState('')
  const [occasion, setOccasion] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const toggleTable = (id: string) => setSelected(cur => cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id])
  const seatsSelected = tables.filter(t => selected.includes(t.id)).reduce((s, t) => s + t.capacity, 0)
  const enoughSeats = seatsSelected >= partySize && selected.length > 0

  const submit = async () => {
    if (!enoughSeats) { toast.error(`Select tables seating ${partySize}`); return }
    if (!guestName.trim() || !guestPhone.trim()) { toast.error('Enter guest name and phone'); return }
    setSubmitting(true)
    try {
      const res = await api.post<Reservation>('/cms/reservations', {
        outletId, tableIds: selected, date, time, partySize,
        joinRequested: selected.length > 1 ? joinRequested : undefined,
        guestName: guestName.trim(),
        guestPhone: guestPhone.trim(),
        guestEmail: guestEmail.trim() || undefined,
        specialRequests: specialRequests.trim() || undefined,
        occasion: occasion || undefined,
      })
      onCreated(res.data)
      toast.success('Reservation confirmed')
      onClose()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Could not create reservation')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="res-modal-backdrop" onClick={onClose}>
      <div className="res-modal-card" onClick={e => e.stopPropagation()}>
        <div className="res-modal-header">
          <div>
            <h3 className="res-modal-title">New Reservation</h3>
            <p className="res-modal-sub">Walk-in or phone booking for {date}</p>
          </div>
          <button className="res-btn-close" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>

        <div className="res-modal-body">
          <div className="res-field-row">
            <label className="res-field">
              <span>Time</span>
              <input type="time" className="res-input" value={time} onChange={e => setTime(e.target.value)} />
            </label>
            <label className="res-field">
              <span>Party size</span>
              <input type="number" min={1} max={50} className="res-input" value={partySize}
                onChange={e => setPartySize(Math.max(1, parseInt(e.target.value) || 1))} />
            </label>
          </div>

          <div className="res-field">
            <span>Select Table(s) · {seatsSelected}/{partySize} seats selected</span>
            {tablesLoading ? (
              <div className="res-inline-loading"><Activity className="animate-spin" size={16} /> Loading tables…</div>
            ) : tables.length === 0 ? (
              <div className="res-inline-empty">No active tables. Add tables in settings.</div>
            ) : (
              <div className="res-table-chips">
                {tables.map(t => (
                  <button key={t.id} type="button"
                    className={`res-table-chip ${selected.includes(t.id) ? 'active' : ''}`}
                    onClick={() => toggleTable(t.id)}>
                    <strong>{t.name}</strong>
                    <span>{ZONE_LABEL[t.zone] ?? t.zone} · {t.capacity} Pax</span>
                  </button>
                ))}
              </div>
            )}
            {selected.length > 1 && (
              <label className="res-join-tables-label">
                <input type="checkbox" checked={joinRequested} onChange={e => setJoinRequested(e.target.checked)} />
                Join these {selected.length} tables together
              </label>
            )}
          </div>

          <div className="res-field-row">
            <label className="res-field"><span>Guest name</span>
              <input className="res-input" value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="Full name" />
            </label>
            <label className="res-field"><span>Phone</span>
              <input className="res-input" value={guestPhone} onChange={e => setGuestPhone(e.target.value)} placeholder="10-digit mobile" />
            </label>
          </div>

          <label className="res-field"><span>Email (optional)</span>
            <input className="res-input" value={guestEmail} onChange={e => setGuestEmail(e.target.value)} placeholder="name@email.com" />
          </label>
          <label className="res-field"><span>Special requests (optional)</span>
            <input className="res-input" value={specialRequests} onChange={e => setSpecialRequests(e.target.value)} placeholder="High chair, window seat…" />
          </label>
          <div className="res-field">
            <span>Occasion (optional)</span>
            <div className="res-occasion-chips">
              {['Birthday', 'Anniversary', 'Date', 'Business', 'Family'].map(o => (
                <button key={o} type="button" onClick={() => setOccasion(occasion === o ? '' : o)}
                  className={`res-occasion-chip ${occasion === o ? 'active' : ''}`}>
                  {o}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="res-modal-footer">
          <button className="res-btn-ghost-cancel" onClick={onClose}>Cancel</button>
          <button className="res-btn-primary" style={{ height: 38 }}
            disabled={submitting || !enoughSeats} onClick={submit}>
            <Check size={14} /> {submitting ? 'Booking…' : 'Confirm booking'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Seat-conflict Warning (bottom-left, GSAP) ──────────────────────────────────
// One physical table = one seated party. When staff try to seat over an occupied
// table this slides in from the bottom-left, self-dismisses after 10s (a countdown
// bar shows the remaining time, and hovering pauses it), or can be cut manually.
interface WarningData { id: number; title: string; message: string }

function SeatConflictWarning({ warning, onDismiss }: { warning: WarningData; onDismiss: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const barTween = useRef<gsap.core.Tween | null>(null)
  const closingRef = useRef(false)

  const close = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    barTween.current?.kill()
    const el = rootRef.current
    if (!el) { onDismiss(); return }
    gsap.to(el, {
      x: 48, autoAlpha: 0, scale: 0.94, duration: 0.34, ease: 'power3.in',
      onComplete: onDismiss,
    })
  }, [onDismiss])

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const icon = el.querySelector('.res-warn-icon')

    const tl = gsap.timeline()
    gsap.set(el, { x: 48, y: 24, autoAlpha: 0, scale: 0.94 })
    tl.to(el, { x: 0, y: 0, autoAlpha: 1, scale: 1, duration: 0.55, ease: 'back.out(1.5)' })
    if (icon) tl.fromTo(icon, { rotate: -14 }, { rotate: 0, duration: 0.7, ease: 'elastic.out(1, 0.4)' }, '-=0.35')

    // 10s countdown → auto-close.
    barTween.current = gsap.fromTo(
      barRef.current,
      { scaleX: 1 },
      { scaleX: 0, duration: 10, ease: 'none', transformOrigin: 'left center', onComplete: close }
    )

    return () => { tl.kill(); barTween.current?.kill() }
  }, [close])

  return (
    <div
      ref={rootRef}
      className="res-warn"
      role="alert"
      onMouseEnter={() => barTween.current?.pause()}
      onMouseLeave={() => { if (!closingRef.current) barTween.current?.resume() }}
    >
      <div className="res-warn-body">
        <div className="res-warn-icon"><AlertTriangle size={19} strokeWidth={2.4} /></div>
        <div className="res-warn-content">
          <div className="res-warn-title">{warning.title}</div>
          <div className="res-warn-msg">{warning.message}</div>
        </div>
        <button className="res-warn-close" onClick={close} aria-label="Dismiss warning"><X size={15} /></button>
      </div>
      <div className="res-warn-track"><div ref={barRef} className="res-warn-bar" /></div>
    </div>
  )
}

// ─── Main Board ────────────────────────────────────────────────────────────────
export default function ReservationsBoard({ outletId: outletIdProp, outlets: outletsProp, onOutletChange }: {
  outletId?: string; outlets?: Outlet[]; onOutletChange?: (id: string) => void
} = {}) {
  const { isFranchise } = useAuth()
  const [outletsInternal, setOutletsInternal] = useState<Outlet[]>([])
  const [outletIdInternal, setOutletIdInternal] = useState('')
  
  const controlled = onOutletChange !== undefined
  const outlets = outletsProp ?? outletsInternal
  const outletId = outletIdProp ?? outletIdInternal
  const setOutletId = onOutletChange ?? setOutletIdInternal
  const [date, setDate] = useState(todayIstDate())
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(false)
  const [live, setLive] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [warning, setWarning] = useState<WarningData | null>(null)

  // Load tables list for metrics calculation + modal prop
  const [tables, setTables] = useState<RestaurantTable[]>([])
  const [tablesLoading, setTablesLoading] = useState(false)

  useEffect(() => {
    if (!outletId) return
    setTablesLoading(true)
    api.get<RestaurantTable[]>(`/cms/tables?outletId=${outletId}`)
      .then(r => setTables(r.data.filter(t => t.isActive && !t.isBlocked)))
      .catch(() => {})
      .finally(() => setTablesLoading(false))
  }, [outletId])

  useEffect(() => {
    if (controlled) return
    api.get<Outlet[]>('/cms/outlets').then(r => {
      setOutletsInternal(r.data)
      if (r.data.length > 0) setOutletIdInternal(r.data[0].id)
    }).catch(() => {})
  }, [controlled])

  const sameDay = useCallback((iso: string) => {
    const d = new Date(new Date(iso).getTime() + 5.5 * 3600_000).toISOString().slice(0, 10)
    return d === date
  }, [date])

  const mergeReservation = useCallback((r: Reservation) => {
    setReservations(prev => {
      const isActive = ['confirmed', 'seated'].includes(r.status) && sameDay(r.reservedAt)
      const without = prev.filter(x => x.id !== r.id)
      return isActive ? [...without, r].sort((a, b) => a.reservedAt.localeCompare(b.reservedAt)) : without
    })
  }, [sameDay])

  useEffect(() => {
    if (!outletId) return
    let cancelled = false
    let es: EventSource | null = null
    let reconnect: ReturnType<typeof setTimeout> | null = null

    const connect = async () => {
      setLoading(true)
      try {
        const res = await api.get<Reservation[]>(`/cms/reservations?outletId=${outletId}&date=${date}`)
        if (cancelled) return
        setReservations(res.data)
      } catch {
        if (!cancelled) toast.error('Failed to load reservations')
      } finally {
        if (!cancelled) setLoading(false)
      }
      if (cancelled) return

      es = new EventSource(`${BASE_URL}/cms/reservations/stream?outletId=${outletId}&token=${getToken() ?? ''}`)
      es.onopen = () => { if (!cancelled) setLive(true) }
      es.onmessage = (e) => {
        try {
          const event: ReservationEvent = JSON.parse(e.data)
          if ((event.type === 'created' || event.type === 'status') && event.reservation) {
            mergeReservation(event.reservation)
          }
        } catch { /* ignore keep-alives */ }
      }
      es.onerror = () => {
        if (cancelled) return
        setLive(false)
        es?.close()
        reconnect = setTimeout(connect, 3000)
      }
    }

    connect()
    return () => {
      cancelled = true
      es?.close()
      if (reconnect) clearTimeout(reconnect)
      setLive(false)
    }
  }, [outletId, date, mergeReservation])

  // Client-side seat guard: is any of this reservation's tables already held by another
  // seated party? Mirrors the server rule so we can block BEFORE optimistically moving
  // the card (no seat→revert flicker). Returns the blocking booking, else null.
  const findLocalSeatConflict = (r: Reservation) => {
    const tableIds = new Set([r.tableId, ...(r.additionalTables ?? []).map(a => a.table.id)])
    for (const s of reservations) {
      if (s.id === r.id || s.status !== 'seated') continue
      const sTables = [s.table, ...(s.additionalTables ?? []).map(a => a.table)]
      const shared = sTables.find(t => t && tableIds.has(t.id))
      if (shared) return { guestName: s.guestName, bookingCode: s.bookingCode, tableName: shared.name }
    }
    return null
  }

  const updateStatus = async (r: Reservation, status: ReservationStatus) => {
    // Block seating an already-occupied table up front — don't move the card or hit the
    // API. The server re-checks too (handles a race where another device just seated).
    if (status === 'seated') {
      const conflict = findLocalSeatConflict(r)
      if (conflict) {
        setWarning({
          id: Date.now(),
          title: 'Table already occupied',
          message: `Table ${conflict.tableName} is already seated with ${conflict.guestName} (${conflict.bookingCode}). Complete or cancel that party before seating here.`,
        })
        return
      }
    }
    // Completing or cancelling frees the table — dismiss any lingering conflict warning
    // so it never keeps naming a party that has just left.
    if (status === 'completed' || status === 'cancelled') setWarning(null)

    setBusyId(r.id)
    mergeReservation({ ...r, status })
    try {
      await api.patch(`/cms/reservations/${r.id}/status`, { status })
    } catch (err: any) {
      mergeReservation(r) // revert optimistic change
      const data = err.response?.data
      // Seat clash detected server-side (a race the local pre-check missed) — show the
      // dedicated warning with the server's freshly-computed occupant, not a toast.
      if (status === 'seated' && data?.code === 'SEAT_CONFLICT') {
        setWarning({
          id: Date.now(),
          title: 'Table already occupied',
          message: data.error || 'That table is already seated. Complete the current party before seating a new one.',
        })
      } else {
        toast.error(data?.error || 'Failed to update reservation')
      }
    } finally {
      setBusyId(null)
    }
  }

  // GSAP Minimal Entrance Animations on load
  useEffect(() => {
    if (!loading && reservations.length > 0) {
      gsap.killTweensOf('.res-metrics-grid, .res-board')
      gsap.fromTo('.res-metrics-grid, .res-board',
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' }
      )
    }
  }, [loading, reservations])

  const selectedOutlet = outlets.find(o => o.id === outletId)
  const byStatus = (s: ReservationStatus) => reservations.filter(r => r.status === s)

  // Real-time seating stats calculations
  const upcomingList = byStatus('confirmed')
  const seatedList = byStatus('seated')

  const stats = {
    upcomingCount: upcomingList.length,
    upcomingGuests: upcomingList.reduce((acc, r) => acc + r.partySize, 0),
    seatedCount: seatedList.length,
    seatedGuests: seatedList.reduce((acc, r) => acc + r.partySize, 0),
    totalCapacity: tables.reduce((acc, t) => acc + t.capacity, 0),
    occupancyPct: 0
  }

  if (stats.totalCapacity > 0) {
    stats.occupancyPct = Math.min(100, Math.round((stats.seatedGuests / stats.totalCapacity) * 100))
  }

  return (
    <div className="res-page">
      {/* Header Board Panel */}
      <div className="res-header">
        <div className="res-title-wrap">
          <h1 className="res-title">
            Reservations Flow
            <span className={`res-live-badge ${live ? 'live' : 'reconnecting'}`}>
              <span className="res-pulse-dot" />{live ? 'Live Stream' : 'Reconnecting…'}
            </span>
          </h1>
          <p className="res-subtitle">
            {selectedOutlet ? `${reservations.length} active entries · ${selectedOutlet.name}` : 'Select an outlet'}
          </p>
        </div>

        <div className="res-header-actions">
          <input type="date" className="res-input-date" value={date} onChange={e => setDate(e.target.value)} />
          {!isFranchise && (
            <GSAPDropdown
              value={outletId}
              onChange={setOutletId}
              options={outlets.map(o => ({ value: o.id, label: o.name }))}
              icon={<Store size={14} />}
              width="190px"
            />
          )}
          <button className="res-btn-primary" style={{ height: 40 }} disabled={!outletId} onClick={() => setShowNew(true)}>
            <Plus size={14} strokeWidth={2.5} /> New Booking
          </button>
        </div>
      </div>

      {/* Seating Metrics Dashboard */}
      <div className="res-metrics-grid">
        {/* Arrivals Card */}
        <div className="res-metric-card">
          <div className="res-metric-icon" style={{ background: 'rgba(214, 66, 56, 0.05)', color: 'var(--color-primary)' }}>
            <CalendarClock size={18} />
          </div>
          <div>
            <div className="res-metric-label">Upcoming Arrivals</div>
            <div className="res-metric-value">
              <AnimatedCounter value={stats.upcomingCount} />
              <span className="res-metric-val-sub">
                (<AnimatedCounter value={stats.upcomingGuests} /> Guest{stats.upcomingGuests !== 1 ? 's' : ''})
              </span>
            </div>
            <div className="res-metric-sub">Expected today</div>
          </div>
        </div>

        {/* Seated Card */}
        <div className="res-metric-card">
          <div className="res-metric-icon" style={{ background: 'rgba(214, 66, 56, 0.05)', color: 'var(--color-primary)' }}>
            <Armchair size={18} />
          </div>
          <div>
            <div className="res-metric-label">Currently Seated</div>
            <div className="res-metric-value">
              <AnimatedCounter value={stats.seatedCount} />
              <span className="res-metric-val-sub">
                (<AnimatedCounter value={stats.seatedGuests} /> Guest{stats.seatedGuests !== 1 ? 's' : ''})
              </span>
            </div>
            <div className="res-metric-sub">Active floor tables</div>
          </div>
        </div>

        {/* Capacity Occupancy Card */}
        <div className="res-metric-card">
          <div className="res-metric-icon" style={{ background: 'rgba(214, 66, 56, 0.05)', color: 'var(--color-primary)' }}>
            <PieChart size={18} />
          </div>
          <div>
            <div className="res-metric-label">Seating Occupancy</div>
            <div className="res-metric-value">
              <AnimatedCounter value={stats.occupancyPct} suffix="%" />
            </div>
            <div className="res-metric-sub">
              Of <AnimatedCounter value={stats.totalCapacity} /> total seats
            </div>
          </div>
        </div>
      </div>

      {/* Reservations Flow Columns */}
      {loading && reservations.length === 0 ? (
        <div className="res-empty" style={{ minHeight: 320 }}>
          <Activity className="animate-spin" size={24} /> Loading reservations board…
        </div>
      ) : (
        <div className="res-board">
          {COLUMNS.map(col => {
            const items = byStatus(col.status)
            const Icon = col.icon
            return (
              <div key={col.status} className="res-column">
                <div className="res-col-header" style={{ color: col.accent, borderBottom: `2px solid ${col.accent}15` }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon size={16} /> {col.label}
                  </span>
                  <span className="res-col-count-pill" style={{ color: col.accent, background: `${col.accent}12` }}>
                    {items.length}
                  </span>
                </div>
                
                <div className="res-col-list">
                  {items.length === 0 ? (
                    <div className="res-col-empty">
                      <Inbox size={30} strokeWidth={1.3} />
                      <span>{col.status === 'confirmed' ? 'No upcoming bookings' : 'No one seated yet'}</span>
                    </div>
                  ) : (
                    items.map(r => (
                      <ReservationCard 
                        key={r.id} 
                        r={r} 
                        accent={col.accent} 
                        busy={busyId === r.id}
                        onStatus={(s) => updateStatus(r, s)} 
                      />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showNew && outletId && (
        <NewBookingModal 
          outletId={outletId} 
          date={date} 
          onClose={() => setShowNew(false)} 
          onCreated={mergeReservation} 
          tables={tables}
          tablesLoading={tablesLoading}
        />
      )}

      {warning && (
        <SeatConflictWarning key={warning.id} warning={warning} onDismiss={() => setWarning(null)} />
      )}

      <style>{`
        .res-page { 
          background: #fafaf9; 
          min-height: calc(100vh - 40px); 
          border-radius: var(--radius-xl); 
          padding: 1.5rem; 
          margin: 1.5rem; 
          border: 1px solid var(--color-border); 
          display: flex; 
          flex-direction: column; 
          gap: 1.25rem; 
        }

        .res-header { 
          display: flex; 
          align-items: center; 
          justify-content: space-between; 
          padding: 1.25rem 1.5rem; 
          background: #fff; 
          border: 1px solid var(--color-border); 
          border-radius: var(--radius-xl); 
          flex-wrap: wrap; 
          gap: 16px; 
          box-shadow: 0 1px 3px rgba(0,2,29,0.02);
        }
        .res-title-wrap { display: flex; flex-direction: column; gap: 4px; }
        .res-title { font-size: 1.4rem; font-weight: 800; color: var(--color-text-1); letter-spacing: -0.02em; display: flex; align-items: center; gap: 12px; margin: 0; }
        .res-subtitle { font-size: 13px; color: var(--color-text-3); margin: 0; }
        
        .res-live-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 99px; font-size: 10px; font-weight: 700; letter-spacing: 0.02em; text-transform: uppercase; }
        .res-live-badge.live { background: rgba(22,163,74,0.06); border: 1px solid rgba(22,163,74,0.15); color: var(--color-success); }
        .res-live-badge.reconnecting { background: rgba(220,38,38,0.06); border: 1px solid rgba(220,38,38,0.15); color: var(--color-danger); }
        .res-pulse-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; animation: res-pulse-anim 1.5s infinite; }
        @keyframes res-pulse-anim { 0% { opacity: 0.3; } 50% { opacity: 1; } 100% { opacity: 0.3; } }

        .res-header-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .res-input-date { background: #fff; border: 1px solid var(--color-border-strong); border-radius: 8px; padding: 8px 12px; font-size: 13px; font-weight: 500; color: var(--color-text-1); height: 40px; transition: all .2s; outline: none; }
        .res-input-date:focus { border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--color-primary-dim); }

        .res-btn-primary { display: inline-flex; align-items: center; gap: 6px; background: var(--color-primary); color: #fff; font-weight: 700; font-size: 13px; border: none; padding: 0 16px; height: 40px; border-radius: 8px; cursor: pointer; transition: all .2s; }
        .res-btn-primary:hover:not(:disabled) { background: var(--color-primary-hover); transform: translateY(-1px); }
        .res-btn-primary:disabled { opacity: .5; cursor: not-allowed; }

        /* Metrics Grid Dashboard */
        .res-metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; }
        .res-metric-card { background: #ffffff; border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: 1.25rem; display: flex; align-items: center; gap: 1rem; transition: all 0.2s ease; box-shadow: 0 1px 3px rgba(0,2,29,0.02); }
        .res-metric-card:hover { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(214, 66, 56, 0.04); border-color: var(--color-primary); }
        .res-metric-icon { width: 42px; height: 42px; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .res-metric-label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--color-text-3); letter-spacing: 0.05em; }
        .res-metric-value { font-size: 20px; font-weight: 800; color: var(--color-text-1); margin-top: 2px; line-height: 1.1; display: flex; align-items: baseline; gap: 6px; }
        .res-metric-val-sub { font-size: 12.5px; color: var(--color-text-3); font-weight: 600; }
        .res-metric-sub { font-size: 11px; color: var(--color-text-3); margin-top: 2px; }

        /* Board Columns */
        .res-board { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.25rem; align-items: start; }
        @media (max-width: 992px) { .res-board { grid-template-columns: 1fr; } }
        .res-column { background: #fff; border: 1px solid var(--color-border); border-radius: var(--radius-xl); padding: 1.15rem; min-height: 480px; display: flex; flex-direction: column; gap: 1rem; box-shadow: 0 1px 3px rgba(0,2,29,0.02); }
        
        .res-col-header { display: flex; align-items: center; justify-content: space-between; font-weight: 850; font-size: 12.5px; text-transform: uppercase; letter-spacing: 0.04em; padding-bottom: 12px; margin-bottom: 2px; }
        .res-col-count-pill { font-size: 11.5px; font-weight: 800; padding: 2.5px 8.5px; border-radius: 99px; }
        .res-col-list { display: flex; flex-direction: column; gap: 0.75rem; overflow-y: auto; max-height: calc(100vh - 280px); padding-right: 2px; }
        .res-col-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; flex: 1; min-height: 300px; color: var(--color-text-3); font-size: 12.5px; }

        /* Reservation Cards */
        .res-card { background: #fff; border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: 1rem; box-shadow: 0 4px 12px rgba(0,2,29,0.01); display: flex; flex-direction: column; gap: 0.75rem; transition: all .2s; }
        .res-card:hover { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(214, 66, 56, 0.04); border-color: var(--color-primary); }
        
        .res-card-header { display: flex; align-items: center; justify-content: space-between; }
        .res-card-time { display: flex; align-items: center; gap: 5px; font-size: 13.5px; font-weight: 800; color: var(--color-text-1); }
        .res-card-code { font-size: 10.5px; font-weight: 800; color: var(--color-primary); background: var(--color-primary-dim); border: 1px solid var(--color-primary-border); padding: 2.5px 8.5px; border-radius: 6px; letter-spacing: 0.03em; }
        
        .res-card-guest { display: flex; flex-direction: column; gap: 8px; padding: 2px 0; }
        .res-avatar { width: 34px; height: 34px; border-radius: 99px; background: var(--color-primary-dim); border: 1px solid var(--color-primary-border); display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: var(--color-primary); text-transform: uppercase; flex-shrink: 0; }
        .res-card-name { font-size: 14.5px; font-weight: 700; color: var(--color-text-1); }
        .res-card-contact { display: flex; align-items: center; gap: 5px; font-size: 12px; color: var(--color-text-3); font-weight: 500; margin-top: 1px; }
        
        .res-card-meta { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--color-text-2); font-weight: 600; margin-top: 4px; }
        .res-meta-item { display: inline-flex; align-items: center; gap: 4px; }
        .res-card-dot { color: var(--color-text-3); }
        .res-zone-pill { font-size: 10px; font-weight: 700; background: rgba(0,2,29,0.04); color: var(--color-text-2); padding: 2px 6.5px; border-radius: 5px; margin-left: 2px; }
        .res-zone-pill.joined { background: rgba(22, 163, 74, 0.08); color: #16a34a; border: 1px solid rgba(22, 163, 74, 0.15); }

        .res-crm-tags-row { display: flex; flex-wrap: wrap; gap: 6px; }
        .res-crm-tag { font-size: 10.5px; font-weight: 700; padding: 2.5px 8px; border-radius: 6px; }
        .res-crm-tag.occasion { background: rgba(214,66,56,0.08); color: var(--color-primary); }
        .res-crm-tag.diet { background: rgba(22,163,74,0.08); color: var(--color-success); }
        
        .res-card-note { display: flex; align-items: flex-start; gap: 6px; font-size: 12px; color: var(--color-text-2); background: #fafaf9; border: 1px solid var(--color-border); border-radius: 6px; padding: 8px 10px; line-height: 1.4; }
        
        .res-card-footer { display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--color-border); padding-top: 0.75rem; gap: 8px; margin-top: 2px; }
        .res-source-pill { display: inline-flex; align-items: center; gap: 4px; font-size: 9.5px; font-weight: 800; text-transform: uppercase; padding: 2px 6.5px; border-radius: 4px; flex-shrink: 0; }
        .res-source-pill.customer { background: rgba(37,99,235,0.05); color: var(--color-info); border: 1px solid rgba(37,99,235,0.1); }
        .res-source-pill.staff { background: rgba(168,85,247,0.05); color: #a855f7; border: 1px solid rgba(168,85,247,0.1); }

        .res-card-actions { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
        .res-btn-ghost { display: inline-flex; align-items: center; gap: 4.5px; font-size: 11px; font-weight: 700; color: var(--color-text-2); background: transparent; border: 1px solid var(--color-border-strong); padding: 5px 10px; height: 28px; border-radius: 6px; cursor: pointer; transition: all .15s; }
        .res-btn-ghost:hover:not(:disabled) { color: var(--color-text-1); border-color: var(--color-text-3); }
        .res-btn-ghost.danger:hover:not(:disabled) { color: var(--color-danger); border-color: rgba(220,38,38,0.25); background: #fef2f2; }
        .res-btn-ghost:disabled { opacity: .5; cursor: not-allowed; }

        .res-btn-primary-small { display: inline-flex; align-items: center; gap: 4.5px; background: var(--color-primary); color: #fff; font-weight: 700; font-size: 11px; border: none; padding: 5px 12px; height: 28px; border-radius: 6px; cursor: pointer; transition: all .15s; }
        .res-btn-primary-small:hover:not(:disabled) { background: var(--color-primary-hover); transform: translateY(-1px); }

        .res-empty { display: flex; align-items: center; justify-content: center; gap: 10px; color: var(--color-text-3); font-size: 13px; }

        /* Booking Modal Styling */
        .res-modal-backdrop { position: fixed; inset: 0; background: rgba(0,2,29,0.4); backdrop-filter: blur(8px); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 1.5rem; }
        .res-modal-card { background: #fff; border: 1px solid var(--color-border); border-radius: var(--radius-xl); box-shadow: 0 10px 40px rgba(0,2,29,0.08); width: 100%; max-width: 580px; display: flex; flex-direction: column; max-height: 88vh; overflow: hidden; }
        .res-modal-header { padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--color-border); display: flex; justify-content: space-between; align-items: flex-start; }
        .res-modal-title { font-size: 18px; font-weight: 800; color: var(--color-text-1); margin: 0; letter-spacing: -0.01em; }
        .res-modal-sub { font-size: 12.5px; color: var(--color-text-3); margin-top: 2px; }
        
        .res-btn-close { background: rgba(0,2,29,0.04); border: none; color: var(--color-text-2); width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.15s; }
        .res-btn-close:hover { background: rgba(220,38,38,0.08); color: var(--color-danger); }
        
        .res-modal-body { flex: 1; overflow-y: auto; padding: 1.5rem; display: flex; flex-direction: column; gap: 1.1rem; }
        
        .res-field { display: flex; flex-direction: column; gap: 5px; flex: 1; }
        .res-field > span { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-3); }
        .res-field-row { display: flex; gap: 12px; }
        
        .res-input { background: #fff; border: 1px solid var(--color-border-strong); border-radius: 8px; padding: 9px 12px; font-size: 13px; font-weight: 500; color: var(--color-text-1); transition: all .2s; outline: none; }
        .res-input:focus { border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--color-primary-dim); }
        
        /* Table selection chips */
        .res-table-chips { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 8px; margin-top: 4px; }
        .res-table-chip { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 8px 12px; border: 1px solid var(--color-border-strong); background: #fff; border-radius: 8px; cursor: pointer; transition: all .15s; text-align: left; }
        .res-table-chip strong { font-size: 13.5px; color: var(--color-text-1); }
        .res-table-chip span { font-size: 11px; color: var(--color-text-3); font-weight: 600; }
        .res-table-chip:hover { border-color: var(--color-text-3); }
        .res-table-chip.active { border-color: var(--color-primary); background: var(--color-primary-dim); }
        .res-table-chip.active strong { color: var(--color-primary); }
        .res-table-chip.active span { color: var(--color-primary); opacity: 0.8; }
        
        .res-join-tables-label { display: flex; align-items: center; gap: 8px; margin-top: 10px; font-size: 12.5px; font-weight: 700; color: var(--color-text-2); cursor: pointer; }
        .res-inline-loading, .res-inline-empty { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--color-text-3); padding: 8px 0; }

        /* Occasions chips */
        .res-occasion-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }
        .res-occasion-chip { background: #fff; border: 1px solid var(--color-border-strong); border-radius: 8px; padding: 6px 14px; font-size: 12.5px; font-weight: 700; color: var(--color-text-2); cursor: pointer; transition: all 0.15s ease; }
        .res-occasion-chip:hover { border-color: var(--color-text-3); }
        .res-occasion-chip.active { background: var(--color-primary-dim); border-color: var(--color-primary); color: var(--color-primary); }

        .res-modal-footer { padding: 1.15rem 1.5rem; border-top: 1px solid var(--color-border); display: flex; justify-content: flex-end; gap: 12px; background: #fafaf9; }
        .res-btn-ghost-cancel { display: inline-flex; align-items: center; height: 38px; padding: 0 16px; border-radius: 8px; border: 1px solid var(--color-border-strong); background: #ffffff; font-size: 13px; font-weight: 700; color: var(--color-text-2); cursor: pointer; transition: all 0.15s; }
        .res-btn-ghost-cancel:hover { border-color: var(--color-text-3); color: var(--color-text-1); }

        /* Seat-conflict Warning (bottom-left) */
        .res-warn {
          position: fixed;
          right: 24px;
          bottom: 24px;
          z-index: 1200;
          width: 384px;
          max-width: calc(100vw - 48px);
          background: #fff;
          border: 1px solid #fde3a7;
          border-left: 4px solid #f59e0b;
          border-radius: 14px;
          box-shadow: 0 20px 48px rgba(180, 83, 9, 0.18), 0 4px 14px rgba(0, 2, 29, 0.06);
          overflow: hidden;
          visibility: hidden;
          will-change: transform, opacity;
        }
        .res-warn-body { display: flex; align-items: flex-start; gap: 12px; padding: 15px 14px 13px 16px; }
        .res-warn-icon {
          width: 38px; height: 38px; border-radius: 10px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          background: rgba(245, 158, 11, 0.13); color: #b45309;
        }
        .res-warn-content { flex: 1; min-width: 0; padding-top: 1px; }
        .res-warn-title { font-size: 13.5px; font-weight: 800; color: var(--color-text-1); letter-spacing: -0.01em; margin-bottom: 3px; }
        .res-warn-msg { font-size: 12.5px; line-height: 1.45; color: var(--color-text-2); font-weight: 500; }
        .res-warn-close {
          flex-shrink: 0; width: 26px; height: 26px; border-radius: 7px; border: none;
          background: transparent; color: var(--color-text-3); cursor: pointer;
          display: flex; align-items: center; justify-content: center; transition: all .15s;
        }
        .res-warn-close:hover { background: rgba(0, 2, 29, 0.05); color: var(--color-text-1); }
        .res-warn-track { height: 3px; background: rgba(245, 158, 11, 0.12); }
        .res-warn-bar { height: 100%; background: linear-gradient(90deg, #f59e0b, #d64238); transform-origin: left center; }
      `}</style>
    </div>
  )
}
