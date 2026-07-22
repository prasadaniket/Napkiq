'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { api } from '@/lib/api'
import { getToken } from '@/lib/auth'
import { useAuth } from '@/context/AuthContext'
import type { FloorTable, FloorStatus, Outlet, ReservationEvent } from '@/types/api'
import toast from 'react-hot-toast'
import GSAPDropdown from '@/components/ui/GSAPDropdown'
import { Store, Armchair, Ban, CheckCircle2, Clock, Users, X, Lock, Unlock, RefreshCw } from 'lucide-react'
import gsap from 'gsap'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.napkiq.in/api'
const ZONE_LABEL: Record<string, string> = { ac: 'AC', non_ac: 'Non-AC', outdoor: 'Outdoor' }

const STATUS_STYLE: Record<FloorStatus, { label: string; bg: string; border: string; text: string; glow: string }> = {
  available: { 
    label: 'Available', 
    bg: '#f0fdf4', 
    border: '#bbf7d0', 
    text: '#16a34a',
    glow: '0 4px 14px 0 rgba(22,163,74,0.06)'
  },
  reserved: { 
    label: 'Reserved',  
    bg: '#eff6ff', 
    border: '#bfdbfe', 
    text: '#2563eb',
    glow: '0 4px 14px 0 rgba(37,99,235,0.06)'
  },
  occupied: { 
    label: 'Occupied',  
    bg: '#fffbeb', 
    border: '#fde68a', 
    text: '#d97706',
    glow: '0 4px 14px 0 rgba(217,119,6,0.08)'
  },
  blocked: { 
    label: 'Blocked',   
    bg: '#f8fafc', 
    border: '#e2e8f0', 
    text: '#64748b',
    glow: 'none'
  },
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })
}

// Fill floor-plan coordinates: use staff-arranged posX/posY when every table has them,
// else auto-flow into a tidy grid so the live map is always spatial.
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

export default function FloorView({ outletId: outletIdProp, outlets: outletsProp, onOutletChange }: {
  outletId?: string; outlets?: Outlet[]; onOutletChange?: (id: string) => void
} = {}) {
  const { isFranchise } = useAuth()
  const [outletsInternal, setOutletsInternal] = useState<Outlet[]>([])
  const [outletIdInternal, setOutletIdInternal] = useState('')
  // When the parent controls the outlet (shared across page sections), use its value.
  const controlled = onOutletChange !== undefined
  const outlets = outletsProp ?? outletsInternal
  const outletId = outletIdProp ?? outletIdInternal
  const setOutletId = onOutletChange ?? setOutletIdInternal
  const [floor, setFloor] = useState<FloorTable[]>([])
  const [loading, setLoading] = useState(false)
  const [live, setLive] = useState(false)
  const [selected, setSelected] = useState<FloorTable | null>(null)
  const [busy, setBusy] = useState(false)
  const [view, setView] = useState<'map' | 'zones'>('map')
  const outletIdRef = useRef('')

  const containerRef = useRef<HTMLDivElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (controlled) return // parent owns the outlet list + selection
    api.get<Outlet[]>('/cms/outlets').then(r => {
      setOutletsInternal(r.data)
      if (r.data.length > 0) setOutletIdInternal(r.data[0].id)
    }).catch(() => {})
  }, [controlled])

  const fetchFloor = useCallback(async (oid: string) => {
    try {
      const res = await api.get<FloorTable[]>(`/cms/reservations/floor?outletId=${oid}`)
      setFloor(res.data)
    } catch {
      toast.error('Failed to load floor')
    }
  }, [])

  // Initial load + live SSE
  useEffect(() => {
    if (!outletId) return
    outletIdRef.current = outletId
    let cancelled = false
    let es: EventSource | null = null
    let reconnect: ReturnType<typeof setTimeout> | null = null

    const connect = async () => {
      setLoading(true)
      await fetchFloor(outletId)
      if (!cancelled) setLoading(false)
      if (cancelled) return

      es = new EventSource(`${BASE_URL}/cms/reservations/stream?outletId=${outletId}&token=${getToken() ?? ''}`)
      es.onopen = () => { if (!cancelled) setLive(true) }
      es.onmessage = () => { if (!cancelled) fetchFloor(outletIdRef.current) }
      es.onerror = () => {
        if (cancelled) return
        setLive(false); es?.close()
        reconnect = setTimeout(connect, 3000)
      }
    }
    connect()
    return () => { cancelled = true; es?.close(); if (reconnect) clearTimeout(reconnect); setLive(false) }
  }, [outletId, fetchFloor])

  // Stagger load floor tiles — target whichever view is showing (map tokens or zone
  // tiles); only animate when elements actually exist to avoid GSAP "target not found".
  useEffect(() => {
    if (floor.length === 0 || !containerRef.current) return
    const els = containerRef.current.querySelectorAll('.fv-tile, .fv-token')
    if (els.length === 0) return
    gsap.fromTo(els,
      { opacity: 0, y: 12, scale: 0.96 },
      { opacity: 1, y: 0, scale: 1, duration: 0.35, stagger: 0.02, ease: 'power2.out' }
    )
  }, [floor, view])

  // GSAP animation for Modal open
  useEffect(() => {
    if (selected) {
      gsap.fromTo(backdropRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.25, ease: 'power2.out' }
      )
      gsap.fromTo(modalRef.current,
        { scale: 0.93, y: 15, opacity: 0 },
        { scale: 1, y: 0, opacity: 1, duration: 0.35, ease: 'back.out(1.4)' }
      )
    }
  }, [selected])

  // Refresh every 60s
  useEffect(() => {
    if (!outletId) return
    const t = setInterval(() => fetchFloor(outletId), 60_000)
    return () => clearInterval(t)
  }, [outletId, fetchFloor])

  const updateReservation = async (reservationId: string, status: string) => {
    setBusy(true)
    try {
      await api.patch(`/cms/reservations/${reservationId}/status`, { status })
      await fetchFloor(outletId)
      closeModal()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to update')
    } finally { setBusy(false) }
  }

  const toggleBlock = async (t: FloorTable) => {
    setBusy(true)
    try {
      const reason = !t.isBlocked ? (prompt('Reason (optional): e.g. Cleaning, Reserved for event') || undefined) : undefined
      await api.patch(`/cms/tables/${t.id}`, { isBlocked: !t.isBlocked, blockReason: reason ?? null })
      await fetchFloor(outletId)
      closeModal()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to update table')
    } finally { setBusy(false) }
  }

  const closeModal = () => {
    if (modalRef.current && backdropRef.current) {
      gsap.to(modalRef.current, {
        scale: 0.93,
        y: 15,
        opacity: 0,
        duration: 0.2,
        ease: 'power2.in'
      })
      gsap.to(backdropRef.current, {
        opacity: 0,
        duration: 0.2,
        ease: 'power2.in',
        onComplete: () => setSelected(null)
      })
    } else {
      setSelected(null)
    }
  }

  const selectedOutlet = outlets.find(o => o.id === outletId)
  const zones = ['ac', 'non_ac', 'outdoor'] as const
  const counts = floor.reduce((acc, t) => { acc[t.status] = (acc[t.status] ?? 0) + 1; return acc }, {} as Record<string, number>)

  return (
    <div className="fv-page" ref={containerRef}>
      <div className="fv-header">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="fv-title">Live Floor</h1>
            <span className={`fv-live ${live ? 'on' : 'off'}`}>
              <span className={`fv-dot ${live ? 'animate-ping' : ''}`} />
              {live ? 'Live Sync' : 'Connecting…'}
            </span>
          </div>
          <p className="fv-sub">{selectedOutlet ? selectedOutlet.name : 'Select an outlet'} · {floor.length} tables total</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="fv-viewtoggle">
            <button className={view === 'map' ? 'on' : ''} onClick={() => setView('map')}>Map</button>
            <button className={view === 'zones' ? 'on' : ''} onClick={() => setView('zones')}>Zones</button>
          </div>
          <button onClick={() => fetchFloor(outletId)} className="fv-refresh-btn" title="Refresh">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          {!isFranchise && (
            <GSAPDropdown value={outletId} onChange={setOutletId}
              options={outlets.map(o => ({ value: o.id, label: o.name }))} icon={<Store size={14} />} width="190px" />
          )}
        </div>
      </div>

      {/* Status legend + counts */}
      <div className="fv-legend">
        {(Object.keys(STATUS_STYLE) as FloorStatus[]).map(s => (
          <span key={s} className="fv-legend-item">
            <span className="fv-swatch" style={{ background: STATUS_STYLE[s].bg, borderColor: STATUS_STYLE[s].border }} />
            <span className="fv-legend-name">{STATUS_STYLE[s].label}</span>
            <b className="fv-legend-count">{counts[s] ?? 0}</b>
          </span>
        ))}
      </div>

      {loading && floor.length === 0 ? (
        <div className="fv-empty">
          <div className="animate-pulse flex flex-col items-center gap-2">
            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <span className="text-sm font-semibold text-neutral-medium">Loading restaurant layout…</span>
          </div>
        </div>
      ) : floor.length === 0 ? (
        <div className="fv-empty text-center p-8">
          <Users size={32} strokeWidth={1.5} className="mx-auto text-neutral-light mb-3" />
          <p className="text-sm font-medium text-neutral-medium">No tables yet. Add tables in the Tables &amp; Settings tab.</p>
        </div>
      ) : view === 'map' ? (
        <div className="fv-map-wrap">
          <div className="fv-map" style={{ height: 480 }}>
            <div className="fv-map-grid" />
            {withCoords(floor).map(t => {
              const st = STATUS_STYLE[t.status]
              const size = Math.min(78, 54 + Math.max(0, t.capacity - 2) * 3)
              const width = t.shape === 'rect' ? size * 1.5 : size
              const radius = t.shape === 'round' ? '50%' : t.shape === 'rect' ? '12px' : '14px'
              return (
                <button key={t.id} className="fv-token" onClick={() => setSelected(t)}
                  style={{
                    left: `${t.x}%`, top: `${t.y}%`, width, height: size, borderRadius: radius,
                    background: st.bg, borderColor: st.border, color: st.text,
                  }}>
                  <span className="fv-token-name">{t.name}</span>
                  <span className="fv-token-cap"><Users size={9} />{t.capacity}</span>
                  {t.current && <span className="fv-token-guest">{t.current.guestName.split(' ')[0]}</span>}
                </button>
              )
            })}
            <div className="fv-entrance">
              <span className="fv-entrance-line" />
              <span className="fv-entrance-label">Entrance</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="fv-zones">
          {zones.map(zone => {
            const zoneTables = floor.filter(t => t.zone === zone)
            if (zoneTables.length === 0) return null
            return (
              <div key={zone} className="fv-zone">
                <div className="fv-zone-title">
                  {ZONE_LABEL[zone] ?? zone}
                  <span className="fv-zone-badge">{zoneTables.length} Tables</span>
                </div>
                <div className="fv-grid">
                  {zoneTables.map(t => {
                    const st = STATUS_STYLE[t.status]
                    return (
                      <button key={t.id} className={`fv-tile ${t.status}`} onClick={() => setSelected(t)}
                        style={{ 
                          background: st.bg, 
                          borderColor: st.border,
                          boxShadow: st.glow 
                        }}>
                        <div className="fv-tile-header">
                          <span className="fv-tile-name" style={{ color: st.text }}>{t.name}</span>
                          <span className="fv-tile-cap"><Users size={11} className="inline mr-0.5" />{t.capacity}</span>
                        </div>
                        
                        {t.current ? (
                          <div className="fv-tile-info">
                            <div className="fv-tile-time"><Clock size={10} className="inline mr-1" />{fmtTime(t.current.reservedAt)}</div>
                            <div className="fv-tile-guest-name truncate w-full">{t.current.guestName}</div>
                          </div>
                        ) : t.isBlocked ? (
                          <div className="fv-tile-info-blocked">
                            Blocked
                          </div>
                        ) : (
                          <div className="fv-tile-info-empty">
                            Available
                          </div>
                        )}
                        <span className="fv-tile-badge" style={{ color: st.text, borderColor: st.border }}>{st.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Table detail modal sheet */}
      {selected && (
        <div className="fv-modal-backdrop" ref={backdropRef} onClick={closeModal}>
          <div className="fv-modal" ref={modalRef} onClick={e => e.stopPropagation()}>
            <div className="fv-modal-head">
              <div>
                <div className="fv-modal-title">{selected.name}</div>
                <div className="fv-modal-sub">
                  {ZONE_LABEL[selected.zone] ?? selected.zone} Zone · Seats {selected.capacity} · <span className="font-semibold" style={{ color: STATUS_STYLE[selected.status].text }}>{STATUS_STYLE[selected.status].label}</span>
                </div>
              </div>
              <button className="fv-close" onClick={closeModal}><X size={16} /></button>
            </div>

            {selected.current ? (
              <div className="fv-cur">
                <div className="fv-cur-pass">
                  <div className="fv-pass-title">Active Booking</div>
                  <div className="fv-pass-row"><Users size={14} className="text-neutral-medium mr-2" />{selected.current.guestName} <span className="font-semibold text-neutral-light ml-1">({selected.current.partySize} Guests)</span></div>
                  <div className="fv-pass-row"><Clock size={14} className="text-neutral-medium mr-2" />{fmtTime(selected.current.reservedAt)} · Code <span className="font-bold font-mono text-primary-light ml-1">{selected.current.bookingCode}</span></div>
                  {selected.current.tableCount > 1 && (
                    <div className="fv-pass-row" style={{ color: '#D64238', fontWeight: 700 }}>
                      🔗 {selected.current.tableCount} tables {selected.current.joinRequested ? 'joined together' : 'combined'} for this party
                    </div>
                  )}
                </div>
                {selected.upcomingCount > 1 && (
                  <div className="fv-cur-more-pill">
                    +{selected.upcomingCount - 1} more bookings scheduled today
                  </div>
                )}
              </div>
            ) : selected.isBlocked ? (
              <div className="fv-cur">
                <div className="fv-cur-blocked-state">
                  <span className="text-2xl mr-2">🔒</span>
                  <div>
                    <div className="font-bold text-slate-700">Blocked Table</div>
                    <div className="text-xs text-slate-500 mt-0.5">{selected.blockReason || 'Blocked temporarily'}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="fv-cur text-center py-6 bg-slate-50/50">
                <div className="text-xs font-semibold text-slate-400">Ready for Seating · No active reservation</div>
              </div>
            )}

            <div className="fv-actions">
              {selected.current && selected.status === 'reserved' && (
                <button className="fv-btn primary" disabled={busy} onClick={() => updateReservation(selected.current!.id, 'seated')}>
                  <Armchair size={14} />Seat Guest
                </button>
              )}
              {selected.current && selected.status === 'occupied' && (
                <button className="fv-btn primary" disabled={busy} onClick={() => updateReservation(selected.current!.id, 'completed')}>
                  <CheckCircle2 size={14} />Mark Completed
                </button>
              )}
              {selected.current && (
                <button className="fv-btn danger" disabled={busy} onClick={() => updateReservation(selected.current!.id, 'cancelled')}>
                  <Ban size={14} />Cancel Booking
                </button>
              )}
              <button className="fv-btn ghost" disabled={busy} onClick={() => toggleBlock(selected)}>
                {selected.isBlocked ? (
                  <>
                    <Unlock size={14} className="text-slate-500" />
                    Unblock Table
                  </>
                ) : (
                  <>
                    <Lock size={14} className="text-slate-500" />
                    Block Table
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .fv-page { background:var(--color-bg); min-height:calc(100vh - 40px); border-radius:var(--radius-xl); padding:1.5rem; display:flex; flex-direction:column; gap:1.25rem; }
        .fv-header { display:flex; align-items:center; justify-content:space-between; padding:1.25rem 1.5rem; background:#fff; border:1px solid var(--color-border); border-radius:var(--radius-lg); flex-wrap:wrap; gap:12px; box-shadow:0 1px 3px rgba(0,2,29,0.02); }
        .fv-title { font-size:1.4rem; font-weight:800; color:var(--color-text-1); margin:0; display:flex; align-items:center; gap:10px; letter-spacing:-0.02em; }
        .fv-sub { font-size:13px; color:var(--color-text-3); margin:2px 0 0; font-weight:500; }
        .fv-live { display:inline-flex; align-items:center; gap:6px; padding:4px 10px; border-radius:99px; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; }
        .fv-live.on { background:rgba(22,163,74,0.06); border:1px solid rgba(22,163,74,0.15); color:var(--color-success); }
        .fv-live.off { background:rgba(220,38,38,0.06); border:1px solid rgba(220,38,38,0.15); color:var(--color-danger); }
        .fv-dot { width:6px; height:6px; border-radius:50%; background:currentColor; }
        .fv-refresh-btn { display:inline-flex; align-items:center; justify-content:center; width:34px; height:34px; border-radius:8px; border:1px solid var(--color-border); background:#fff; color:var(--color-text-2); cursor:pointer; transition:all 0.15s; }
        .fv-refresh-btn:hover { border-color:var(--color-border-strong); background:var(--color-surface-2); }
        .fv-viewtoggle { display:inline-flex; background:var(--color-surface-2); border:1px solid var(--color-border); border-radius:9px; padding:3px; gap:2px; }
        .fv-viewtoggle button { border:none; background:transparent; font-size:12px; font-weight:700; color:var(--color-text-3); padding:5px 12px; border-radius:6px; cursor:pointer; transition:all .15s; }
        .fv-viewtoggle button.on { background:#fff; color:var(--color-text-1); box-shadow:0 1px 3px rgba(0,2,29,0.08); }

        .fv-map-wrap { background:#fff; border:1px solid var(--color-border); border-radius:var(--radius-lg); padding:14px; box-shadow:0 1px 4px rgba(0,2,29,0.01); }
        .fv-map { position:relative; width:100%; border-radius:14px; background:linear-gradient(160deg,#fbfbfa,#f4f5f7); border:1px solid var(--color-border); overflow:hidden; }
        .fv-map-grid { position:absolute; inset:0; opacity:0.5; background-image:linear-gradient(rgba(0,2,29,0.035) 1px,transparent 1px),linear-gradient(90deg,rgba(0,2,29,0.035) 1px,transparent 1px); background-size:32px 32px; }
        .fv-token { position:absolute; transform:translate(-50%,-50%); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:1px; border:1.5px solid; cursor:pointer; transition:transform .15s, box-shadow .15s; box-shadow:0 2px 8px rgba(0,2,29,0.06); outline:none; padding:2px; }
        .fv-token:hover { transform:translate(-50%,-50%) scale(1.08); box-shadow:0 6px 18px rgba(0,2,29,0.12); z-index:5; }
        .fv-token-name { font-size:13px; font-weight:800; line-height:1; }
        .fv-token-cap { font-size:9px; font-weight:700; opacity:0.7; display:inline-flex; align-items:center; gap:1px; line-height:1; }
        .fv-token-guest { font-size:8.5px; font-weight:700; opacity:0.85; max-width:52px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; line-height:1.1; }
        .fv-entrance { position:absolute; bottom:12px; left:50%; transform:translateX(-50%); width:64%; display:flex; flex-direction:column; align-items:center; gap:4px; pointer-events:none; }
        .fv-entrance-line { width:100%; height:3px; border-radius:99px; background:linear-gradient(90deg,transparent,rgba(214,66,56,0.5),transparent); }
        .fv-entrance-label { font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:0.32em; color:var(--color-text-3); }

        .fv-legend { display:flex; flex-wrap:wrap; gap:16px; padding:12px 18px; background:#fff; border:1px solid var(--color-border); border-radius:var(--radius-lg); box-shadow:0 1px 3px rgba(0,2,29,0.01); }
        .fv-legend-item { display:flex; align-items:center; gap:8px; font-size:12px; font-weight:600; color:var(--color-text-2); }
        .fv-legend-name { font-weight:500; }
        .fv-legend-count { margin-left:3px; background:rgba(0,2,29,0.04); padding:1px 6px; border-radius:99px; font-size:11px; color:var(--color-text-1); }
        .fv-swatch { width:13px; height:13px; border-radius:4px; border:1px solid; }

        .fv-zones { display:flex; flex-direction:column; gap:1.25rem; }
        .fv-zone { background:#fff; border:1px solid var(--color-border); border-radius:var(--radius-lg); padding:1.25rem 1.5rem; box-shadow:0 1px 4px rgba(0,2,29,0.01); }
        .fv-zone-title { font-size:12.5px; font-weight:800; text-transform:uppercase; letter-spacing:0.08em; color:var(--color-text-2); margin-bottom:1.15rem; display:flex; align-items:center; gap:10px; }
        .fv-zone-badge { font-size:10px; font-weight:700; background:rgba(0,2,29,0.04); color:var(--color-text-3); padding:2px 8px; border-radius:99px; text-transform:none; letter-spacing:normal; }
        
        .fv-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(130px, 1fr)); gap:14px; }
        .fv-tile { position:relative; display:flex; flex-direction:column; align-items:flex-start; justify-content:space-between; padding:14px 14px 10px; border:1px solid; border-radius:14px; cursor:pointer; transition:transform 0.2s, box-shadow 0.2s, border-color 0.2s; text-align:left; min-height:102px; outline:none; }
        .fv-tile:hover { transform:translateY(-2px); border-color:transparent !important; box-shadow:0 8px 24px rgba(0,2,29,0.06) !important; }
        .fv-tile:active { transform:translateY(0); }
        .fv-tile-header { display:flex; align-items:center; justify-content:space-between; width:100%; margin-bottom:6px; }
        .fv-tile-name { font-size:15px; font-weight:800; }
        .fv-tile-cap { font-size:11px; font-weight:700; color:var(--color-text-3); display:inline-flex; align-items:center; }
        
        .fv-tile-info { width:100%; display:flex; flex-direction:column; gap:1px; margin-top:2px; padding:4px 0; }
        .fv-tile-time { font-size:10px; font-weight:700; color:var(--color-text-2); display:flex; align-items:center; }
        .fv-tile-guest-name { font-size:11.5px; font-weight:700; color:var(--color-text-1); }
        
        .fv-tile-info-blocked { font-size:10.5px; font-weight:700; color:var(--color-text-3); font-style:italic; margin-top:12px; }
        .fv-tile-info-empty { font-size:10.5px; font-weight:600; opacity:0.35; margin-top:12px; }
        
        .fv-tile-badge { position:absolute; bottom:10px; right:12px; font-size:8.5px; font-weight:800; text-transform:uppercase; letter-spacing:0.04em; padding:1px 5px; border:1px solid; border-radius:4px; opacity:0.85; }
        .fv-empty { display:flex; align-items:center; justify-content:center; min-height:240px; background:#fff; border:1px solid var(--color-border); border-radius:var(--radius-lg); }

        .fv-modal-backdrop { position:fixed; inset:0; background:rgba(0,2,29,0.3); backdrop-filter:blur(6px); z-index:1000; display:flex; align-items:center; justify-content:center; padding:1.5rem; }
        .fv-modal { background:#fff; border:1px solid var(--color-border); border-radius:var(--radius-xl); box-shadow:0 20px 50px rgba(0,2,29,0.1); width:100%; max-width:400px; overflow:hidden; }
        .fv-modal-head { padding:1.25rem 1.5rem; border-bottom:1px solid var(--color-border); display:flex; justify-content:space-between; align-items:flex-start; }
        .fv-modal-title { font-size:18px; font-weight:800; color:var(--color-text-1); letter-spacing:-0.01em; }
        .fv-modal-sub { font-size:12.5px; color:var(--color-text-3); margin-top:3px; font-weight:500; }
        .fv-close { background:rgba(0,2,29,0.04); border:none; color:var(--color-text-2); width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:background 0.15s; }
        .fv-close:hover { background:rgba(0,2,29,0.08); color:var(--color-text-1); }
        
        .fv-cur { padding:1.25rem 1.5rem; display:flex; flex-direction:column; gap:10px; border-bottom:1px solid var(--color-border); }
        .fv-cur-pass { background:rgba(214,66,56,0.03); border:1px solid rgba(214,66,56,0.08); border-radius:12px; padding:12px 14px; display:flex; flex-direction:column; gap:6px; }
        .fv-pass-title { font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:0.06em; color:var(--color-primary); }
        .fv-pass-row { display:flex; align-items:center; font-size:13px; font-weight:600; color:var(--color-text-1); }
        .fv-cur-more-pill { background:rgba(0,2,29,0.03); color:var(--color-text-2); font-size:11px; font-weight:700; padding:6px 12px; border-radius:8px; width:fit-content; }
        .fv-cur-blocked-state { display:flex; align-items:center; padding:6px 0; }
        
        .fv-actions { padding:1.25rem 1.5rem; display:flex; flex-direction:column; gap:8px; background:#fcfcfb; }
        .fv-btn { display:inline-flex; align-items:center; justify-content:center; gap:8px; height:42px; border-radius:10px; font-size:13px; font-weight:700; cursor:pointer; transition:all 0.18s; border:1px solid var(--color-border-strong); background:#fff; color:var(--color-text-2); outline:none; }
        .fv-btn:hover:not(:disabled) { border-color:var(--color-text-2); color:var(--color-text-1); }
        .fv-btn.primary { background:var(--color-primary); color:#fff; border:none; box-shadow:0 2px 10px rgba(214,66,56,0.18); }
        .fv-btn.primary:hover:not(:disabled) { background:var(--color-primary-hover); box-shadow:0 4px 14px rgba(214,66,56,0.25); }
        .fv-btn.danger { background:#ef4444; color:#fff; border:none; }
        .fv-btn.danger:hover:not(:disabled) { background:#dc2626; }
        .fv-btn.ghost { background:transparent; border-color:transparent; }
        .fv-btn.ghost:hover:not(:disabled) { background:rgba(0,2,29,0.03); }
        .fv-btn:disabled { opacity:.5; cursor:not-allowed; }
      `}</style>
    </div>
  )
}

function Phone({ size, className }: { size?: number; className?: string }) {
  return (
    <svg width={size ?? 16} height={size ?? 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
    </svg>
  )
}
