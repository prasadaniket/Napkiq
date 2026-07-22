'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { api } from '@/lib/api'
import type { Outlet } from '@/types/api'
import ReservationsBoard from '@/components/reservations/ReservationsBoard'
import FloorPOS from '@/components/floor/FloorPOS'
import ReservationCalendar from '@/components/reservations/ReservationCalendar'
import WaitlistPanel from '@/components/reservations/WaitlistPanel'
import TablesManager from '@/components/reservations/TablesManager'
import ReservationHistory from '@/components/reservations/ReservationHistory'

type Tab = 'board' | 'calendar' | 'waitlist' | 'history' | 'tables'

// ─── Reservations page: bookings board, live floor, calendar, waitlist, tables ──
// Available to all roles; franchise owners are scoped to their assigned outlet by
// the backend. Each outlet controls its own reservation on/off + slot config.
export default function ReservationsPage() {
  const searchParams = useSearchParams()

  const tabs: [Tab, string][] = [
    ['board', 'Live Seating'],
    ['calendar', 'Calendar'],
    ['waitlist', 'Waitlist'],
    ['history', 'History'],
    ['tables', 'Tables & Settings'],
  ]
  const allowed = tabs.map(([k]) => k)
  const requested = searchParams.get('tab') as Tab | null
  const initial: Tab = requested && allowed.includes(requested) ? requested : 'board'
  const [tab, setTab] = useState<Tab>(initial)

  // Shared outlet selection so the Live Board's two sections (bookings + floor) stay
  // in sync — changing the outlet in either section updates both.
  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [outletId, setOutletId] = useState('')
  useEffect(() => {
    api.get<Outlet[]>('/cms/outlets').then(r => {
      setOutlets(r.data)
      if (r.data.length > 0) setOutletId(prev => prev || r.data[0].id)
    }).catch(() => {})
  }, [])

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 8, paddingBottom: 0 }}>
        <div style={{ display: 'inline-flex', gap: 4, background: '#f1f5f9', padding: 4, borderRadius: 12 }}>
          {tabs.map(([key, label]) => {
            const active = tab === key
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                style={{
                  padding: '7px 18px',
                  borderRadius: 9,
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all .2s',
                  background: active ? '#ffffff' : 'transparent',
                  color: active ? '#D64238' : 'rgba(0,2,29,0.5)',
                  boxShadow: active ? '0 1px 3px rgba(0,2,29,0.08)' : 'none',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {tab === 'board' ? (
        <div className="live-seating-stack">
          {/* Unified front-of-house floor: seating status + live POS billing on one map. */}
          <FloorPOS outletId={outletId} outlets={outlets} onOutletChange={setOutletId} />
          <ReservationsBoard outletId={outletId} outlets={outlets} onOutletChange={setOutletId} />
          {/* When stacked, sections size to their content (no full-viewport min-height)
              so there's no dead space between the floor and the reservations board. */}
          <style>{`
            .live-seating-stack .fp-page,
            .live-seating-stack .res-page { min-height: 0; }
          `}</style>
        </div>
      )
        : tab === 'calendar' ? <ReservationCalendar />
        : tab === 'waitlist' ? <WaitlistPanel />
        : tab === 'history' ? <ReservationHistory />
        : <TablesManager />}
    </div>
  )
}
