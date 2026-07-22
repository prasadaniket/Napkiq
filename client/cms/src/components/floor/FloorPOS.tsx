'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { api } from '@/lib/api'
import { getToken } from '@/lib/auth'
import { useAuth } from '@/context/AuthContext'
import type { FloorTable, Outlet } from '@/types/api'
import toast from 'react-hot-toast'
import GSAPDropdown from '@/components/ui/GSAPDropdown'
import { Store, Users, RefreshCw, Utensils, IndianRupee, Flame, CheckCircle2, Lock, Calendar, Star, Compass } from 'lucide-react'
import TableBillDrawer from './TableBillDrawer'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.napkiq.in/api'
const ZONE_LABEL: Record<string, string> = { ac: 'AC Lounge', non_ac: 'Main Dining', outdoor: 'Terrace Garden' }

// High-fidelity luxury color palettes for table statuses
const STATUS_STYLE: Record<string, { label: string; bg: string; border: string; text: string; dot: string }> = {
  available: { label: 'Available', bg: '#ffffff', border: 'rgba(0, 2, 29, 0.08)', text: '#00021D', dot: '#16a34a' },
  reserved:  { label: 'Reserved',  bg: '#f0f7ff', border: 'rgba(37, 99, 235, 0.15)', text: '#2563eb', dot: '#2563eb' },
  occupied:  { label: 'Seated',    bg: '#fdfbf7', border: 'rgba(214, 66, 56, 0.15)', text: 'var(--color-primary)', dot: 'var(--color-primary)' },
  blocked:   { label: 'Blocked',   bg: 'rgba(0, 2, 29, 0.02)', border: 'rgba(0, 2, 29, 0.06)', text: 'rgba(0, 2, 29, 0.35)', dot: 'rgba(0, 2, 29, 0.2)' },
}

function fmtMoney(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`
}

function withCoords(tables: FloorTable[]): (FloorTable & { x: number; y: number })[] {
  const hasLayout = tables.length > 0 && tables.every(t => t.posX != null && t.posY != null)
  if (hasLayout) return tables.map(t => ({ ...t, x: t.posX as number, y: t.posY as number }))
  const n = tables.length
  const cols = Math.min(7, Math.max(3, Math.ceil(Math.sqrt(n * 1.6))))
  const rows = Math.max(1, Math.ceil(n / cols))
  return tables.map((t, i) => {
    const col = i % cols, row = Math.floor(i / cols)
    const x = cols === 1 ? 50 : 10 + col * (80 / (cols - 1))
    const y = rows === 1 ? 45 : 12 + row * (66 / (rows - 1))
    return { ...t, x, y }
  })
}

export default function FloorPOS({ outletId: outletIdProp, outlets: outletsProp, onOutletChange }: {
  outletId?: string; outlets?: Outlet[]; onOutletChange?: (id: string) => void
} = {}) {
  const { isFranchise } = useAuth()
  const [outletsInternal, setOutletsInternal] = useState<Outlet[]>([])
  const [outletIdInternal, setOutletIdInternal] = useState('')
  const controlled = onOutletChange !== undefined
  const outlets = outletsProp ?? outletsInternal
  const outletId = outletIdProp ?? outletIdInternal
  const setOutletId = onOutletChange ?? setOutletIdInternal

  const [floor, setFloor] = useState<FloorTable[]>([])
  const [loading, setLoading] = useState(false)
  const [live, setLive] = useState(false)
  const [selected, setSelected] = useState<FloorTable | null>(null)
  const [view, setView] = useState<'map' | 'zones'>('map')
  const outletIdRef = useRef('')

  useEffect(() => {
    if (controlled) return
    api.get<Outlet[]>('/cms/outlets').then(r => {
      setOutletsInternal(r.data)
      if (r.data.length > 0) setOutletIdInternal(r.data[0].id)
    }).catch(() => {})
  }, [controlled])

  const fetchFloor = useCallback(async (oid: string) => {
    try {
      const res = await api.get<FloorTable[]>(`/cms/sessions/floor?outletId=${oid}`)
      setFloor(res.data)
      setSelected(prev => (prev ? res.data.find(t => t.id === prev.id) ?? prev : prev))
    } catch {
      toast.error('Failed to load floor')
    }
  }, [])

  useEffect(() => {
    if (!outletId) return
    outletIdRef.current = outletId
    let cancelled = false
    let sources: EventSource[] = []
    let reconnect: ReturnType<typeof setTimeout> | null = null

    const closeAll = () => { sources.forEach(s => s.close()); sources = [] }

    const scheduleReconnect = () => {
      if (cancelled || reconnect) return
      setLive(false)
      closeAll()
      reconnect = setTimeout(() => { reconnect = null; connect() }, 3000)
    }

    const connect = async () => {
      setLoading(true)
      await fetchFloor(outletId)
      if (!cancelled) setLoading(false)
      if (cancelled) return

      const token = getToken() ?? ''
      for (const path of ['reservations', 'orders']) {
        const es = new EventSource(`${BASE_URL}/cms/${path}/stream?outletId=${outletId}&token=${token}`)
        es.onopen = () => { if (!cancelled) setLive(true) }
        es.onmessage = () => { if (!cancelled) fetchFloor(outletIdRef.current) }
        es.onerror = scheduleReconnect
        sources.push(es)
      }
    }
    connect()
    return () => {
      cancelled = true
      closeAll()
      if (reconnect) clearTimeout(reconnect)
      setLive(false)
    }
  }, [outletId, fetchFloor])

  const selectedOutlet = outlets.find(o => o.id === outletId)
  const zones = ['ac', 'non_ac', 'outdoor'] as const

  const occupied = floor.filter(t => t.session).length
  const openMoney = floor.reduce((s, t) => s + (t.session?.total ?? 0), 0)
  const available = floor.filter(t => t.status === 'available').length
  const reserved = floor.filter(t => t.status === 'reserved').length
  const blocked = floor.filter(t => t.status === 'blocked').length

  return (
    <div className="fp-page">
      {/* ─── Premium Header Module ─── */}
      <div className="fp-header">
        <div className="fp-header-left">
          <div className="fp-title-row">
            <h1 className="fp-title">
              FOH Floor Map
            </h1>
            <div className={`fp-live-badge ${live ? 'is-live' : 'is-connecting'}`}>
              <span className="fp-pulse-dot" />
              <span>{live ? 'Live Stream' : 'Syncing...'}</span>
            </div>
          </div>
          <p className="fp-subtitle">
            {selectedOutlet ? selectedOutlet.name : 'Select outlet'} · Current dining session status
          </p>
        </div>

        {/* Header Dashboard Metrics */}
        <div className="fp-tallies">
          <div className="fp-tally-item">
            <span className="fp-tally-val">{occupied}</span>
            <span className="fp-tally-lbl">Seated</span>
          </div>
          <div className="fp-tally-item">
            <span className="fp-tally-val" style={{ color: 'var(--color-success)' }}>{available}</span>
            <span className="fp-tally-lbl">Available</span>
          </div>
          {reserved > 0 && (
            <div className="fp-tally-item">
              <span className="fp-tally-val" style={{ color: 'var(--color-info)' }}>{reserved}</span>
              <span className="fp-tally-lbl">Reserved</span>
            </div>
          )}
          {openMoney > 0 && (
            <div className="fp-tally-item highlight">
              <span className="fp-tally-val font-mono">{fmtMoney(openMoney)}</span>
              <span className="fp-tally-lbl">Open Revenue</span>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="fp-controls">
          <div className="fp-viewtoggle">
            <button className={view === 'map' ? 'active' : ''} onClick={() => setView('map')}>Visual Map</button>
            <button className={view === 'zones' ? 'active' : ''} onClick={() => setView('zones')}>Zone Columns</button>
          </div>
          <button onClick={() => fetchFloor(outletId)} className="fp-refresh" title="Force Refresh">
            <RefreshCw size={14} className={loading ? 'fp-spin' : ''} />
          </button>
          {!isFranchise && (
            <div className="fp-dropdown-wrapper">
              <GSAPDropdown value={outletId} onChange={setOutletId}
                options={outlets.map(o => ({ value: o.id, label: o.name }))} icon={<Store size={14} />} width="190px" />
            </div>
          )}
        </div>
      </div>

      {/* ─── Main Viewport Grid ─── */}
      {loading && floor.length === 0 ? (
        <div className="fp-empty-state">
          <div className="fp-pulse-container">
            <div className="fp-loading-pulse" />
          </div>
          <span>Retrieving floor layout parameters...</span>
        </div>
      ) : floor.length === 0 ? (
        <div className="fp-empty-state">
          <Compass size={40} strokeWidth={1.2} style={{ color: 'var(--color-text-3)', marginBottom: 12 }} />
          <span>No tables configured for this branch. Create layouts under **Tables &amp; Settings** tab.</span>
        </div>
      ) : view === 'map' ? (
        <div className="fp-map-viewport">
          <div className="fp-map-canvas">
            <div className="fp-blueprint-grid" />
            {withCoords(floor).map(t => {
              const billed = t.session?.status === 'billed'
              const st = STATUS_STYLE[t.status] ?? STATUS_STYLE.available
              const size = Math.min(92, 64 + Math.max(0, t.capacity - 2) * 4)
              const width = t.shape === 'rect' ? size * 1.55 : size
              const radius = t.shape === 'round' ? '50%' : t.shape === 'rect' ? '14px' : '16px'
              
              return (
                <button
                  key={t.id}
                  className={`fp-table-token ${t.status} ${billed ? 'is-billed' : ''}`}
                  onClick={() => setSelected(t)}
                  style={{
                    left: `${t.x}%`,
                    top: `${t.y}%`,
                    width,
                    height: size,
                    borderRadius: radius,
                    background: st.bg,
                    borderColor: billed ? 'rgba(217, 119, 6, 0.4)' : st.border,
                    color: st.text,
                  }}
                >
                  <div className="fp-token-inner">
                    {/* Status mini dot indicator */}
                    <span className="fp-status-dot" style={{ backgroundColor: billed ? '#d97706' : st.dot }} />
                    
                    {/* Table ID Code */}
                    <span className="fp-token-name">{t.name}</span>

                    {/* Interactive Session/Order Content */}
                    {billed ? (
                      <div className="fp-token-badge billed-pulse">
                        <span className="fp-badge-text">Settle</span>
                        <span className="fp-badge-val">₹{t.session?.total.toLocaleString('en-IN')}</span>
                      </div>
                    ) : t.session ? (
                      <div className="fp-token-badge active-tab">
                        <IndianRupee size={9} />
                        <span className="fp-badge-val font-mono">{t.session.total.toLocaleString('en-IN')}</span>
                      </div>
                    ) : t.current ? (
                      <div className="fp-token-badge reserved-tab">
                        <Calendar size={9} />
                        <span className="fp-badge-guest">{t.current.guestName.split(' ')[0]}</span>
                      </div>
                    ) : t.status === 'blocked' ? (
                      <Lock size={12} strokeWidth={2.2} style={{ opacity: 0.6 }} />
                    ) : (
                      <span className="fp-token-cap">
                        <Users size={9} />
                        <span>{t.capacity}</span>
                      </span>
                    )}
                  </div>
                </button>
              )
            })}

            {/* Architectural Entrance swings */}
            <div className="fp-entrance-door">
              <div className="fp-door-arc" />
              <div className="fp-door-leaf" />
              <span className="fp-door-label">Entrance</span>
            </div>
          </div>
        </div>
      ) : (
        /* ─── Zone Columns ─── */
        <div className="fp-zones-panel">
          {zones.map(zone => {
            const zoneTables = floor.filter(t => t.zone === zone)
            if (zoneTables.length === 0) return null
            return (
              <div key={zone} className="fp-zone-column">
                <div className="fp-zone-header">
                  <span className="fp-zone-name">{ZONE_LABEL[zone] ?? zone}</span>
                  <span className="fp-zone-badge">{zoneTables.length}</span>
                </div>
                <div className="fp-zone-grid">
                  {zoneTables.map(t => {
                    const billed = t.session?.status === 'billed'
                    const st = STATUS_STYLE[t.status] ?? STATUS_STYLE.available
                    return (
                      <button
                        key={t.id}
                        className={`fp-zone-tile ${t.status} ${billed ? 'is-billed' : ''}`}
                        onClick={() => setSelected(t)}
                        style={{
                          background: st.bg,
                          borderColor: billed ? 'rgba(217, 119, 6, 0.3)' : st.border,
                        }}
                      >
                        <div className="fp-tile-header">
                          <span className="fp-tile-name" style={{ color: st.text }}>{t.name}</span>
                          <span className="fp-tile-capacity">
                            <Users size={11} strokeWidth={1.8} />
                            <span>{t.capacity} pax</span>
                          </span>
                        </div>

                        <div className="fp-tile-body">
                          {t.session ? (
                            <div className="fp-tile-finances">
                              <span className="fp-tile-total">
                                <IndianRupee size={13} strokeWidth={2} />
                                <span className="font-mono">{t.session.total.toLocaleString('en-IN')}</span>
                              </span>
                              <KitchenDot state={t.session.kitchenState} />
                            </div>
                          ) : t.current ? (
                            <div className="fp-tile-reservation">
                              <span className="fp-res-icon"><Star size={10} fill="currentColor" /></span>
                              <span className="fp-res-name">{t.current.guestName.split(' ')[0]} ({t.current.partySize}p)</span>
                            </div>
                          ) : t.isBlocked ? (
                            <div className="fp-tile-blocked-reason">
                              <Lock size={10} />
                              <span>{t.blockReason || 'Maintenance'}</span>
                            </div>
                          ) : (
                            <span className="fp-tile-action-prompt">Free to Seat</span>
                          )}
                        </div>

                        <div className="fp-tile-footer">
                          <span className="fp-status-label" style={{ color: billed ? '#b45309' : st.text }}>
                            {billed ? 'Payment Due' : t.session ? 'Occupied' : st.label}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {selected && outletId && (
        <TableBillDrawer
          outletId={outletId}
          table={selected}
          onClose={() => setSelected(null)}
          onChanged={() => fetchFloor(outletId)}
        />
      )}

      <style>{`
        .fp-page {
          background: var(--color-bg);
          min-height: calc(100vh - 40px);
          border-radius: var(--radius-xl);
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          font-family: inherit;
        }

        /* ─── Header Redesign ─── */
        .fp-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.25rem 1.75rem;
          background: #ffffff;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          box-shadow: 0 4px 18px rgba(0, 2, 29, 0.02);
          flex-wrap: wrap;
          gap: 16px;
        }
        .fp-header-left {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .fp-title-row {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .fp-title {
          font-size: 1.45rem;
          font-weight: 800;
          color: var(--color-text-1);
          margin: 0;
          letter-spacing: -0.03em;
        }
        .fp-subtitle {
          font-size: 12.5px;
          color: var(--color-text-3);
          margin: 0;
          font-weight: 500;
        }

        /* Live indicator */
        .fp-live-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 99px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .fp-live-badge.is-live {
          background: rgba(22, 163, 74, 0.06);
          border: 1px solid rgba(22, 163, 74, 0.15);
          color: var(--color-success);
        }
        .fp-live-badge.is-connecting {
          background: rgba(220, 38, 38, 0.06);
          border: 1px solid rgba(220, 38, 38, 0.15);
          color: var(--color-danger);
        }
        .fp-pulse-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
          animation: fp-ping 1.4s infinite cubic-bezier(0.4, 0, 0.6, 1);
        }
        @keyframes fp-ping {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.6); opacity: 0.4; }
        }

        /* Tally metrics */
        .fp-tallies {
          display: flex;
          align-items: center;
          gap: 20px;
          background: var(--color-surface-2);
          padding: 6px 16px;
          border-radius: var(--radius-md);
          border: 1px solid var(--color-border);
        }
        .fp-tally-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 0 4px;
        }
        .fp-tally-item:not(:last-child) {
          border-right: 1px solid var(--color-border-strong);
          padding-right: 20px;
        }
        .fp-tally-val {
          font-size: 18px;
          font-weight: 800;
          color: var(--color-text-1);
          line-height: 1.1;
        }
        .fp-tally-lbl {
          font-size: 9.5px;
          font-weight: 700;
          color: var(--color-text-3);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-top: 2px;
        }
        .fp-tally-item.highlight .fp-tally-val {
          color: var(--color-primary);
        }

        /* Controls */
        .fp-controls {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .fp-viewtoggle {
          display: inline-flex;
          background: var(--color-surface-2);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: 3px;
          gap: 2px;
        }
        .fp-viewtoggle button {
          border: none;
          background: transparent;
          font-size: 11.5px;
          font-weight: 700;
          color: var(--color-text-3);
          padding: 6px 14px;
          border-radius: var(--radius-sm);
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .fp-viewtoggle button.active {
          background: #ffffff;
          color: var(--color-text-1);
          box-shadow: 0 2px 6px rgba(0, 2, 29, 0.06);
        }
        .fp-refresh {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: var(--radius-md);
          border: 1px solid var(--color-border);
          background: #ffffff;
          color: var(--color-text-2);
          cursor: pointer;
          transition: all 0.15s;
        }
        .fp-refresh:hover {
          border-color: var(--color-border-strong);
          color: var(--color-text-1);
          background: var(--color-bg);
        }
        .fp-spin {
          animation: fp-rotate 1s linear infinite;
        }
        @keyframes fp-rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .fp-dropdown-wrapper {
          position: relative;
        }

        /* ─── Map Canvas Redesign ─── */
        .fp-map-viewport {
          background: #ffffff;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: 18px;
          box-shadow: 0 6px 24px rgba(0, 2, 29, 0.015);
        }
        .fp-map-canvas {
          position: relative;
          width: 100%;
          height: 520px;
          border-radius: var(--radius-md);
          background: linear-gradient(180deg, #fdfdfd, #f6f6f5);
          border: 1.5px dashed var(--color-border-strong);
          overflow: hidden;
        }
        .fp-blueprint-grid {
          position: absolute;
          inset: 0;
          opacity: 0.65;
          background-image: radial-gradient(rgba(0, 2, 29, 0.05) 1.5px, transparent 1.5px);
          background-size: 24px 24px;
        }

        /* ─── Table Tokens Redesign ─── */
        .fp-table-token {
          position: absolute;
          transform: translate(-50%, -50%);
          border: 2px solid;
          cursor: pointer;
          transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s, border-color 0.2s;
          box-shadow: 0 4px 12px rgba(0, 2, 29, 0.04);
          outline: none;
          padding: 4px;
        }
        .fp-table-token:hover {
          transform: translate(-50%, -50%) scale(1.06);
          box-shadow: 0 10px 24px rgba(0, 2, 29, 0.09);
          z-index: 10;
        }
        .fp-table-token.is-billed {
          animation: fp-pulse-orange 2s infinite ease-in-out;
        }
        @keyframes fp-pulse-orange {
          0%, 100% { box-shadow: 0 0 0 0px rgba(217, 119, 6, 0.25), 0 4px 12px rgba(0, 2, 29, 0.04); }
          50% { box-shadow: 0 0 0 6px rgba(217, 119, 6, 0.15), 0 4px 12px rgba(0, 2, 29, 0.04); }
        }

        .fp-token-inner {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          position: relative;
        }

        /* Token components */
        .fp-status-dot {
          position: absolute;
          top: 0px;
          right: 0px;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          border: 1px solid #ffffff;
        }
        .fp-token-name {
          font-size: 13.5px;
          font-weight: 800;
          letter-spacing: -0.01em;
          line-height: 1.1;
        }
        .fp-token-cap {
          font-size: 10px;
          font-weight: 700;
          opacity: 0.55;
          display: inline-flex;
          align-items: center;
          gap: 2.5px;
        }

        /* Token badge layouts */
        .fp-token-badge {
          display: inline-flex;
          align-items: center;
          gap: 2.5px;
          padding: 2.5px 7px;
          border-radius: 99px;
          font-size: 9.5px;
          font-weight: 800;
          line-height: 1;
        }
        .fp-token-badge.active-tab {
          background: var(--color-primary-dim);
          color: var(--color-primary);
          border: 1px solid var(--color-primary-border);
        }
        .fp-token-badge.reserved-tab {
          background: rgba(37, 99, 235, 0.05);
          color: var(--color-info);
          border: 1px solid rgba(37, 99, 235, 0.1);
        }
        .fp-token-badge.reserved-tab .fp-badge-guest {
          max-width: 48px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .fp-token-badge.billed-pulse {
          background: rgba(217, 119, 6, 0.08);
          color: #d97706;
          border: 1px solid rgba(217, 119, 6, 0.15);
          flex-direction: column;
          gap: 1px;
          padding: 3px 8px;
          border-radius: 6px;
        }
        .fp-token-badge.billed-pulse .fp-badge-text {
          font-size: 8px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          opacity: 0.8;
        }

        /* Architectural entrance swung door */
        .fp-entrance-door {
          position: absolute;
          bottom: 0px;
          left: 50%;
          transform: translateX(-50%);
          width: 80px;
          height: 38px;
          pointer-events: none;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-end;
          padding-bottom: 6px;
        }
        .fp-door-arc {
          position: absolute;
          bottom: 2px;
          width: 50px;
          height: 25px;
          border-top: 1.5px dashed var(--color-text-3);
          border-left: 1.5px dashed var(--color-text-3);
          border-top-left-radius: 35px;
          opacity: 0.35;
          transform: rotate(-10deg) translateX(4px);
        }
        .fp-door-leaf {
          position: absolute;
          bottom: 2px;
          left: 15px;
          width: 2px;
          height: 26px;
          background: var(--color-text-2);
          opacity: 0.65;
          transform-origin: bottom;
          transform: rotate(45deg);
        }
        .fp-door-label {
          font-size: 8.5px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.28em;
          color: var(--color-text-3);
          position: relative;
          z-index: 1;
        }

        /* Empty state views */
        .fp-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 340px;
          background: #ffffff;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          font-size: 13px;
          font-weight: 600;
          color: var(--color-text-2);
          text-align: center;
          padding: 3rem;
          box-shadow: 0 4px 16px rgba(0,2,29,0.01);
        }
        .fp-pulse-container {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 42px;
          height: 42px;
          margin-bottom: 12px;
        }
        .fp-loading-pulse {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: var(--color-primary);
          animation: fp-bounce-pulse 1.2s infinite ease-in-out;
        }
        @keyframes fp-bounce-pulse {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(2.2); opacity: 1; background: var(--color-primary-hover); }
        }

        /* ─── Zones Panel Redesign ─── */
        .fp-zones-panel {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1.5rem;
        }
        .fp-zone-column {
          background: #ffffff;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: 1.25rem 1.4rem;
          box-shadow: 0 4px 18px rgba(0,2,29,0.015);
          display: flex;
          flex-direction: column;
        }
        .fp-zone-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid var(--color-border);
          padding-bottom: 10px;
          margin-bottom: 1rem;
        }
        .fp-zone-name {
          font-size: 13px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--color-text-1);
        }
        .fp-zone-badge {
          font-size: 10px;
          font-weight: 700;
          background: var(--color-surface-2);
          color: var(--color-text-2);
          padding: 3px 9px;
          border-radius: 99px;
          border: 1px solid var(--color-border);
        }
        .fp-zone-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
          gap: 12px;
        }

        /* Mini tiles inside zones */
        .fp-zone-tile {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          justify-content: space-between;
          padding: 14px;
          border: 1.5px solid;
          border-radius: 14px;
          cursor: pointer;
          transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s, border-color 0.2s;
          text-align: left;
          min-height: 112px;
          outline: none;
          box-shadow: 0 2px 6px rgba(0, 2, 29, 0.02);
        }
        .fp-zone-tile:hover {
          transform: translateY(-2.5px);
          box-shadow: 0 8px 20px rgba(0, 2, 29, 0.07);
        }
        .fp-zone-tile.is-billed {
          box-shadow: 0 0 0 3px rgba(217, 119, 6, 0.2);
        }

        .fp-tile-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
        }
        .fp-tile-name {
          font-size: 15.5px;
          font-weight: 800;
          letter-spacing: -0.01em;
        }
        .fp-tile-capacity {
          font-size: 10.5px;
          font-weight: 600;
          color: var(--color-text-3);
          display: inline-flex;
          align-items: center;
          gap: 2.5px;
        }

        .fp-tile-body {
          margin: 10px 0;
          flex-grow: 1;
        }
        .fp-tile-finances {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
        }
        .fp-tile-total {
          display: inline-flex;
          align-items: center;
          font-size: 15.5px;
          font-weight: 800;
          color: var(--color-text-1);
        }
        .fp-tile-total svg {
          margin-right: 1.5px;
        }
        .fp-tile-reservation {
          display: flex;
          align-items: center;
          gap: 4px;
          color: var(--color-info);
        }
        .fp-res-icon {
          display: flex;
          align-items: center;
          color: #d97706;
        }
        .fp-res-name {
          font-size: 11px;
          font-weight: 700;
          max-width: 90px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .fp-tile-blocked-reason {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 10.5px;
          color: var(--color-text-3);
          font-weight: 600;
        }
        .fp-tile-action-prompt {
          font-size: 10.5px;
          font-weight: 600;
          color: var(--color-text-3);
          opacity: 0.65;
        }

        .fp-tile-footer {
          display: flex;
          align-items: center;
        }
        .fp-status-label {
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        /* Kitchen states badges */
        .fp-kdot {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          font-size: 9.5px;
          font-weight: 800;
          padding: 2.5px 7.5px;
          border-radius: 99px;
        }
        .fp-kdot.preparing {
          background: rgba(217, 119, 6, 0.08);
          color: #d97706;
        }
        .fp-kdot.ready {
          background: rgba(22, 163, 74, 0.08);
          color: #16a34a;
        }
        .fp-kdot.served {
          background: rgba(0, 2, 29, 0.04);
          color: var(--color-text-3);
        }
      `}</style>
    </div>
  )
}

function KitchenDot({ state }: { state: 'preparing' | 'ready' | 'served' | null }) {
  if (!state) return <span className="fp-kdot served"><Utensils size={9} />New</span>
  if (state === 'preparing') return <span className="fp-kdot preparing"><Flame size={9} />Cooking</span>
  if (state === 'ready') return <span className="fp-kdot ready"><CheckCircle2 size={9} />Ready</span>
  return <span className="fp-kdot served"><CheckCircle2 size={9} />Served</span>
}
