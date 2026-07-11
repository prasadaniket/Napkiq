'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { api } from '@/lib/api'
import { getToken } from '@/lib/auth'
import { useAuth } from '@/context/AuthContext'
import type { WaitlistEntry, Outlet, ReservationEvent } from '@/types/api'
import toast from 'react-hot-toast'
import GSAPDropdown from '@/components/ui/GSAPDropdown'
import { Store, Plus, Users, Clock, Armchair, X, UserX, Phone, ChevronRight } from 'lucide-react'
import gsap from 'gsap'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.napkiq.in/api'

function waitedMinutes(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000))
}

export default function WaitlistPanel() {
  const { isFranchise } = useAuth()
  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [outletId, setOutletId] = useState('')
  const [entries, setEntries] = useState<WaitlistEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [, tick] = useState(0)
  const outletIdRef = useRef('')

  // Add form
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [partySize, setPartySize] = useState(2)
  const [quoted, setQuoted] = useState(15)
  const [adding, setAdding] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.get<Outlet[]>('/cms/outlets').then(r => {
      setOutlets(r.data)
      if (r.data.length > 0) setOutletId(r.data[0].id)
    }).catch(() => {})
  }, [])

  // Re-render each minute so "waited" stays fresh.
  useEffect(() => { const t = setInterval(() => tick(n => n + 1), 60_000); return () => clearInterval(t) }, [])

  const fetchQueue = useCallback(async (oid: string) => {
    try {
      const res = await api.get<WaitlistEntry[]>(`/cms/waitlist?outletId=${oid}`)
      setEntries(res.data)
    } catch { toast.error('Failed to load waitlist') }
  }, [])

  useEffect(() => {
    if (!outletId) return
    outletIdRef.current = outletId
    let cancelled = false
    let es: EventSource | null = null
    let reconnect: ReturnType<typeof setTimeout> | null = null

    const connect = async () => {
      setLoading(true)
      await fetchQueue(outletId)
      if (!cancelled) setLoading(false)
      if (cancelled) return
      es = new EventSource(`${BASE_URL}/cms/reservations/stream?outletId=${outletId}&token=${getToken() ?? ''}`)
      es.onmessage = (e) => {
        try { const ev: ReservationEvent = JSON.parse(e.data); if (ev.type === 'waitlist') fetchQueue(outletIdRef.current) } catch {}
      }
      es.onerror = () => { if (cancelled) return; es?.close(); reconnect = setTimeout(connect, 3000) }
    }
    connect()
    return () => { cancelled = true; es?.close(); if (reconnect) clearTimeout(reconnect) }
  }, [outletId, fetchQueue])

  // GSAP Entrance Animations for cards
  useEffect(() => {
    if (entries.length > 0 && containerRef.current) {
      gsap.fromTo(containerRef.current.querySelectorAll('.wl-card'),
        { opacity: 0, x: -12, scale: 0.98 },
        { opacity: 1, x: 0, scale: 1, duration: 0.35, stagger: 0.02, ease: 'power2.out' }
      )
    }
  }, [entries])

  // GSAP Modal Open Animation
  useEffect(() => {
    if (showAdd) {
      gsap.fromTo(backdropRef.current, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'power2.out' })
      gsap.fromTo(modalRef.current, 
        { scale: 0.92, y: 15, opacity: 0 }, 
        { scale: 1, y: 0, opacity: 1, duration: 0.35, ease: 'back.out(1.4)' }
      )
    }
  }, [showAdd])

  const addEntry = async () => {
    if (!name.trim() || phone.trim().length < 10) { toast.error('Enter name and 10-digit phone'); return }
    setAdding(true)
    try {
      await api.post('/cms/waitlist', { outletId, guestName: name.trim(), guestPhone: phone.trim(), partySize, quotedMinutes: quoted })
      setName(''); setPhone(''); setPartySize(2); setQuoted(15)
      closeModal()
      fetchQueue(outletId)
      toast.success('Added to queue')
    } catch (e: any) { toast.error(e.response?.data?.error || 'Could not add') } finally { setAdding(false) }
  }

  const setStatus = async (entry: WaitlistEntry, status: string, cardEl: HTMLElement | null) => {
    setBusyId(entry.id)
    
    // Smooth fade out using GSAP before status updates
    if (cardEl) {
      gsap.to(cardEl, {
        opacity: 0,
        x: 30,
        scale: 0.95,
        duration: 0.25,
        ease: 'power2.in',
        onComplete: async () => {
          try {
            await api.patch(`/cms/waitlist/${entry.id}`, { status })
            fetchQueue(outletId)
          } catch (e: any) { 
            toast.error(e.response?.data?.error || 'Failed') 
            // Revert opacity on error
            gsap.to(cardEl, { opacity: 1, x: 0, scale: 1, duration: 0.2 })
          } finally { setBusyId(null) }
        }
      })
    } else {
      try {
        await api.patch(`/cms/waitlist/${entry.id}`, { status })
        fetchQueue(outletId)
      } catch (e: any) { toast.error(e.response?.data?.error || 'Failed') } finally { setBusyId(null) }
    }
  }

  const closeModal = () => {
    if (modalRef.current && backdropRef.current) {
      gsap.to(modalRef.current, { scale: 0.92, y: 15, opacity: 0, duration: 0.2, ease: 'power2.in' })
      gsap.to(backdropRef.current, { opacity: 0, duration: 0.2, ease: 'power2.in', onComplete: () => setShowAdd(false) })
    } else {
      setShowAdd(false)
    }
  }

  const selectedOutlet = outlets.find(o => o.id === outletId)

  return (
    <div className="wl-page" ref={containerRef}>
      <div className="wl-header">
        <div>
          <h1 className="wl-title">Walk-in Queue</h1>
          <p className="wl-sub">{selectedOutlet ? selectedOutlet.name : 'Select an outlet'} · {entries.length} guests waiting</p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {!isFranchise && (
            <GSAPDropdown value={outletId} onChange={setOutletId}
              options={outlets.map(o => ({ value: o.id, label: o.name }))} icon={<Store size={14} />} width="190px" />
          )}
          <button className="wl-btn-primary" disabled={!outletId} onClick={() => setShowAdd(true)}>
            <Plus size={14} strokeWidth={2.5} />Add to Queue
          </button>
        </div>
      </div>

      {loading && entries.length === 0 ? (
        <div className="wl-empty">
          <div className="animate-pulse flex flex-col items-center gap-2">
            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <span className="text-sm font-semibold text-neutral-medium">Loading waitlist...</span>
          </div>
        </div>
      ) : entries.length === 0 ? (
        <div className="wl-empty">
          <Users size={32} strokeWidth={1.5} className="text-neutral-light" />
          <div className="font-semibold text-[13.5px] text-neutral-medium">Nobody in the queue right now.</div>
          <p className="text-[12px] text-neutral-light max-w-xs text-center">Tap "Add to Queue" to seat new walk-ins with quoted wait times.</p>
        </div>
      ) : (
        <div className="wl-list">
          {entries.map((e, i) => {
            const waited = waitedMinutes(e.createdAt)
            const over = e.quotedMinutes != null && waited > e.quotedMinutes
            return (
              <div key={e.id} id={`wl-card-${e.id}`} className="wl-card">
                <div className="wl-pos">#{String(i + 1).padStart(2, '0')}</div>
                <div className="wl-main">
                  <div className="wl-name">
                    {e.guestName}
                    <span className="wl-party"><Users size={11} className="mr-1" />{e.partySize} Pax</span>
                  </div>
                  <div className="wl-meta">
                    <span className="wl-meta-phone"><Phone size={11} className="mr-1" />{e.guestPhone}</span>
                    <span className={`wl-meta-time ${over ? 'wl-over' : ''}`}>
                      <Clock size={11} className="mr-1" />
                      Waited {waited}m {e.quotedMinutes != null ? `/ ~${e.quotedMinutes}m` : ''}
                      {over && <span className="wl-over-badge">Overdue</span>}
                    </span>
                  </div>
                </div>
                <div className="wl-actions">
                  <button 
                    className="wl-btn ghost" 
                    disabled={busyId === e.id} 
                    onClick={(ev) => setStatus(e, 'left', ev.currentTarget.closest('.wl-card'))} 
                    title="Guest Left"
                  >
                    <UserX size={14} className="text-slate-400 hover:text-red-500 transition-colors" />
                  </button>
                  <button 
                    className="wl-btn primary" 
                    disabled={busyId === e.id} 
                    onClick={(ev) => setStatus(e, 'seated', ev.currentTarget.closest('.wl-card'))}
                  >
                    <Armchair size={13} />
                    Seat Guest
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showAdd && (
        <div className="wl-modal-backdrop" ref={backdropRef} onClick={closeModal}>
          <div className="wl-modal" ref={modalRef} onClick={ev => ev.stopPropagation()}>
            <div className="wl-modal-head">
              <div className="wl-modal-title">Add to queue</div>
              <button className="wl-close" onClick={closeModal}><X size={16} /></button>
            </div>
            <div className="wl-modal-body">
              <div className="wl-field">
                <span>Guest Name</span>
                <input className="wl-input" value={name} onChange={e => setName(e.target.value)} placeholder="Full name" />
              </div>
              <div className="wl-field">
                <span>Phone Number</span>
                <input className="wl-input" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit mobile" inputMode="numeric" />
              </div>
              <div className="wl-field-row">
                <div className="wl-field">
                  <span>Party Size</span>
                  <input type="number" min={1} max={50} className="wl-input" value={partySize} onChange={e => setPartySize(Math.max(1, parseInt(e.target.value) || 1))} />
                </div>
                <div className="wl-field">
                  <span>Quoted Wait (min)</span>
                  <input type="number" min={0} max={600} className="wl-input" value={quoted} onChange={e => setQuoted(Math.max(0, parseInt(e.target.value) || 0))} />
                </div>
              </div>
            </div>
            <div className="wl-modal-foot">
              <button className="wl-btn ghost" style={{ height: 40, padding: '0 16px' }} onClick={closeModal}>Cancel</button>
              <button className="wl-btn primary" style={{ height: 40, padding: '0 18px' }} disabled={adding} onClick={addEntry}>
                <Plus size={14} />{adding ? 'Adding…' : 'Add to Queue'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .wl-page { background:var(--color-bg); min-height:calc(100vh - 40px); border-radius:var(--radius-xl); padding:1.5rem; display:flex; flex-direction:column; gap:1.25rem; }
        .wl-header { display:flex; align-items:center; justify-content:space-between; padding:1.25rem 1.5rem; background:#fff; border:1px solid var(--color-border); border-radius:var(--radius-lg); flex-wrap:wrap; gap:12px; box-shadow:0 1px 3px rgba(0,2,29,0.02); }
        .wl-title { font-size:1.4rem; font-weight:800; color:var(--color-text-1); margin:0; letter-spacing:-0.02em; }
        .wl-sub { font-size:13px; color:var(--color-text-3); margin:2px 0 0; font-weight:500; }
        .wl-btn-primary { display:inline-flex; align-items:center; gap:6px; background:var(--color-primary); color:#fff; font-weight:700; font-size:13px; border:none; padding:0 18px; height:40px; border-radius:var(--radius-md); cursor:pointer; transition:all 0.15s; box-shadow:0 2px 8px rgba(214,66,56,0.15); }
        .wl-btn-primary:hover:not(:disabled){ background:var(--color-primary-hover); box-shadow:0 4px 12px rgba(214,66,56,0.22); }
        .wl-btn-primary:disabled { opacity:.5; cursor:not-allowed; }
        
        .wl-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; min-height:260px; color:var(--color-text-3); font-size:13px; background:#fff; border:1px solid var(--color-border); border-radius:var(--radius-lg); box-shadow:0 1px 3px rgba(0,2,29,0.01); }
        .wl-list { display:flex; flex-direction:column; gap:12px; }
        .wl-card { display:flex; align-items:center; gap:16px; padding:14px 18px; background:#fff; border:1px solid var(--color-border); border-radius:var(--radius-lg); box-shadow:0 1px 3px rgba(0,2,29,0.01); transition:transform 0.2s, box-shadow 0.2s; }
        .wl-card:hover { transform:translateY(-1px); box-shadow:0 6px 16px rgba(0,2,29,0.04); }
        .wl-pos { width:34px; height:34px; border-radius:50%; background:var(--color-primary-dim); color:var(--color-primary); font-weight:800; font-size:12px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .wl-main { flex:1; min-width:0; }
        .wl-name { font-size:14.5px; font-weight:800; color:var(--color-text-1); display:flex; align-items:center; gap:8px; }
        .wl-party { display:inline-flex; align-items:center; font-size:10.5px; font-weight:700; color:var(--color-text-2); background:rgba(0,2,29,0.04); padding:2px 8px; border-radius:99px; }
        .wl-meta { display:flex; gap:16px; font-size:12px; color:var(--color-text-3); margin-top:4px; font-weight:500; }
        .wl-meta span { display:inline-flex; align-items:center; }
        
        .wl-meta-time { background:#f8fafc; border:1px solid #e2e8f0; padding:2px 8px; border-radius:6px; font-size:11px; }
        .wl-meta-time.wl-over { background:#fef2f2; border-color:#fee2e2; color:var(--color-danger); font-weight:700; display:inline-flex; align-items:center; gap:4px; }
        .wl-over-badge { font-size:8px; font-weight:900; text-transform:uppercase; background:var(--color-danger); color:#fff; padding:1px 4px; border-radius:3px; letter-spacing:0.04em; }

        .wl-actions { display:flex; gap:8px; }
        .wl-btn { display:inline-flex; align-items:center; justify-content:center; gap:6px; height:36px; padding:0 14px; border-radius:8px; font-size:12.5px; font-weight:700; cursor:pointer; border:1px solid var(--color-border-strong); background:#fff; color:var(--color-text-2); transition:all 0.15s; outline:none; }
        .wl-btn:hover:not(:disabled){ border-color:var(--color-text-2); color:var(--color-text-1); }
        .wl-btn.primary { background:var(--color-primary); color:#fff; border:none; box-shadow:0 2px 6px rgba(214,66,56,0.1); }
        .wl-btn.primary:hover:not(:disabled){ background:var(--color-primary-hover); box-shadow:0 4px 10px rgba(214,66,56,0.18); }
        .wl-btn.ghost { background:transparent; border-color:transparent; width:36px; padding:0; }
        .wl-btn.ghost:hover:not(:disabled){ background:rgba(0,2,29,0.03); }
        .wl-btn:disabled { opacity:.5; cursor:not-allowed; }

        .wl-modal-backdrop { position:fixed; inset:0; background:rgba(0,2,29,0.3); backdrop-filter:blur(6px); z-index:1000; display:flex; align-items:center; justify-content:center; padding:1.5rem; }
        .wl-modal { background:#fff; border:1px solid var(--color-border); border-radius:var(--radius-xl); box-shadow:0 20px 50px rgba(0,2,29,0.1); width:100%; max-width:400px; overflow:hidden; }
        .wl-modal-head { padding:1.25rem 1.5rem; border-bottom:1px solid var(--color-border); display:flex; justify-content:space-between; align-items:center; }
        .wl-modal-title { font-size:17px; font-weight:800; color:var(--color-text-1); letter-spacing:-0.01em; }
        .wl-close { background:rgba(0,2,29,0.04); border:none; color:var(--color-text-2); width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; }
        .wl-close:hover { background:rgba(0,2,29,0.08); color:var(--color-text-1); }
        .wl-modal-body { padding:1.5rem; display:flex; flex-direction:column; gap:14px; }
        .wl-modal-foot { padding:1.1rem 1.5rem; border-top:1px solid var(--color-border); display:flex; justify-content:flex-end; gap:10px; background:#fcfcfb; }
        .wl-field { display:flex; flex-direction:column; gap:6px; flex:1; }
        .wl-field > span { font-size:10.5px; font-weight:800; text-transform:uppercase; letter-spacing:0.06em; color:var(--color-text-3); }
        .wl-field-row { display:flex; gap:14px; }
        .wl-input { background:#fff; border:1px solid var(--color-border-strong); border-radius:8px; padding:10px 12px; font-size:13px; font-weight:600; color:var(--color-text-1); outline:none; transition:all 0.15s; }
        .wl-input:focus { border-color:var(--color-primary); box-shadow:0 0 0 3px var(--color-primary-border); }
      `}</style>
    </div>
  )
}
