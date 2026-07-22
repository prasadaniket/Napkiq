'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { api } from '@/lib/api'
import { useDeviceFingerprint } from '@/hooks/useDeviceFingerprint'
import { useOutlet } from '@/hooks/useOutlet'
import Loader from '@/components/ui/Loader'

type Status = 'confirmed' | 'seated' | 'completed' | 'cancelled' | 'no_show' | 'held' | 'expired'

interface Booking {
  id: string
  bookingCode: string
  reservedAt: string
  partySize: number
  status: Status
  occasion: string | null
  specialRequests: string | null
  table?: { name: string; zone: string }
  outlet?: { name: string; code: string; slug: string }
}

const ZONE_LABEL: Record<string, string> = { ac: 'AC', non_ac: 'Non-AC', outdoor: 'Outdoor' }
const gradientStyle = { background: 'linear-gradient(135deg, #E85D52 0%, #D64238 50%, #A62B22 100%)' }

const STATUS_META: Record<Status, { label: string; cls: string }> = {
  confirmed: { label: 'Confirmed', cls: 'text-emerald-700 bg-emerald-50' },
  seated:    { label: 'Seated',    cls: 'text-blue-700 bg-blue-50' },
  completed: { label: 'Completed', cls: 'text-neutral-600 bg-neutral-100' },
  cancelled: { label: 'Cancelled', cls: 'text-rose-700 bg-rose-50' },
  no_show:   { label: 'No-show',   cls: 'text-amber-700 bg-amber-50' },
  held:      { label: 'Pending',   cls: 'text-neutral-600 bg-neutral-100' },
  expired:   { label: 'Expired',   cls: 'text-neutral-500 bg-neutral-100' },
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    weekday: 'short', day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
  })
}

export default function BookingsPage() {
  const params = useParams()
  const code = params.code as string
  const { deviceId, loading: fpLoading } = useDeviceFingerprint()
  const { outlet } = useOutlet(code)

  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!deviceId) return
    api.get<Booking[]>(`/reservations/by-device/${deviceId}`)
      .then((r) => setBookings(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [deviceId])

  useEffect(() => { load() }, [load])

  const cancel = async (b: Booking) => {
    if (!confirm(`Cancel your booking ${b.bookingCode}?`)) return
    setCancelling(b.id)
    try {
      await api.patch(`/reservations/${b.id}/cancel`, { deviceId })
      setBookings((prev) => prev.map((x) => x.id === b.id ? { ...x, status: 'cancelled' } : x))
    } catch (e: any) {
      alert(e.response?.data?.error || 'Could not cancel')
    } finally {
      setCancelling(null)
    }
  }

  const now = Date.now()
  const isUpcoming = (b: Booking) =>
    ['confirmed', 'seated'].includes(b.status) && new Date(b.reservedAt).getTime() + 3 * 3600_000 > now
  const upcoming = bookings.filter(isUpcoming)
  const past = bookings.filter((b) => !isUpcoming(b) && b.status !== 'held' && b.status !== 'expired')

  if (fpLoading || loading) return (
    <div className="min-h-screen flex items-center justify-center" style={gradientStyle}><Loader /></div>
  )

  return (
    <div className="relative min-h-screen flex flex-col items-center px-5 pt-8 pb-14" style={gradientStyle}>
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <Link href={`/${code}`} className="text-white/80 text-sm font-medium flex items-center gap-1.5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            Back
          </Link>
          <span className="text-white font-bold text-[15px]">{outlet?.name ?? 'Napkiq'}</span>
        </div>

        <h1 className="text-white text-2xl font-bold mb-1">My Bookings</h1>
        <p className="text-white/70 text-sm mb-6">Your table reservations on this device</p>

        {bookings.length === 0 ? (
          <div className="rounded-2xl p-8 text-center bg-white/95">
            <p className="text-[#00021D] font-bold text-lg">No bookings yet</p>
            <p className="text-[#00021D]/55 text-sm mt-1">Reserve a table and it'll show up here.</p>
            {outlet?.reservationsEnabled && (
              <Link href={`/${code}/reserve`} className="inline-block mt-4 rounded-full px-6 py-3 font-bold text-[14px] text-white" style={{ background: '#D64238' }}>
                Reserve a Table
              </Link>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {upcoming.length > 0 && (
              <Section title="Upcoming">
                {upcoming.map((b) => (
                  <BookingCard key={b.id} b={b} onCancel={() => cancel(b)} cancelling={cancelling === b.id} allowCancel />
                ))}
              </Section>
            )}
            {past.length > 0 && (
              <Section title="Past & cancelled">
                {past.map((b) => <BookingCard key={b.id} b={b} />)}
              </Section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-white/60 text-[11px] font-bold uppercase tracking-[0.12em] mb-2.5">{title}</div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  )
}

function BookingCard({ b, onCancel, cancelling, allowCancel }: {
  b: Booking; onCancel?: () => void; cancelling?: boolean; allowCancel?: boolean
}) {
  const meta = STATUS_META[b.status]
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl p-4 bg-white/95">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[#00021D] font-bold text-[16px]">{b.table?.name ?? 'Table'}
            {b.table?.zone && <span className="text-[#00021D]/45 font-medium text-[12px] ml-1.5">{ZONE_LABEL[b.table.zone] ?? b.table.zone}</span>}
          </div>
          <div className="text-[#00021D]/60 text-[13px] font-medium mt-0.5">{fmt(b.reservedAt)}</div>
        </div>
        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${meta.cls}`}>{meta.label}</span>
      </div>

      <div className="flex items-center gap-3 mt-3 text-[12px] text-[#00021D]/55 font-medium">
        <span>👥 {b.partySize}</span>
        <span className="text-[#D64238] font-bold tracking-wide">{b.bookingCode}</span>
        {b.occasion && <span className="px-2 py-0.5 rounded-full bg-[#D64238]/8 text-[#D64238]">{b.occasion}</span>}
      </div>

      {allowCancel && onCancel && (
        <button onClick={onCancel} disabled={cancelling}
          className="mt-3 w-full rounded-xl py-2.5 text-[13px] font-bold text-rose-600 bg-rose-50 disabled:opacity-60">
          {cancelling ? 'Cancelling…' : 'Cancel booking'}
        </button>
      )}
    </motion.div>
  )
}
