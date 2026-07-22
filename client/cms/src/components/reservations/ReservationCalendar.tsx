'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import type { CalendarDay, Reservation, Outlet } from '@/types/api'
import toast from 'react-hot-toast'
import GSAPDropdown from '@/components/ui/GSAPDropdown'
import { Store, ChevronLeft, ChevronRight, Users, Clock, Armchair, Calendar as CalendarIcon, ClipboardList } from 'lucide-react'
import gsap from 'gsap'

const ZONE_LABEL: Record<string, string> = { ac: 'AC', non_ac: 'Non-AC', outdoor: 'Outdoor' }
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function todayIst(): string { return new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10) }
function monthOf(dateStr: string): string { return dateStr.slice(0, 7) }
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })
}
function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}
function daysInMonth(month: string): { cells: (string | null)[] } {
  const [y, m] = month.split('-').map(Number)
  const first = new Date(y, m - 1, 1)
  const total = new Date(y, m, 0).getDate()
  const lead = first.getDay()
  const cells: (string | null)[] = Array(lead).fill(null)
  for (let d = 1; d <= total; d++) cells.push(`${month}-${String(d).padStart(2, '0')}`)
  return { cells }
}

export default function ReservationCalendar() {
  const { isFranchise } = useAuth()
  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [outletId, setOutletId] = useState('')
  const [month, setMonth] = useState(monthOf(todayIst()))
  const [days, setDays] = useState<Record<string, CalendarDay>>({})
  const [selectedDate, setSelectedDate] = useState(todayIst())
  const [dayList, setDayList] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(false)

  const gridRef = useRef<HTMLDivElement>(null)
  const dayListRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.get<Outlet[]>('/cms/outlets').then(r => {
      setOutlets(r.data)
      if (r.data.length > 0) setOutletId(r.data[0].id)
    }).catch(() => {})
  }, [])

  const loadMonth = useCallback(async (oid: string, mo: string) => {
    setLoading(true)
    try {
      const res = await api.get<{ month: string; days: CalendarDay[] }>(`/cms/reservations/calendar`, { params: { outletId: oid, month: mo } })
      const map: Record<string, CalendarDay> = {}
      for (const d of res.data.days) map[d.date] = d
      setDays(map)
    } catch { toast.error('Failed to load calendar') } finally { setLoading(false) }
  }, [])

  const loadDay = useCallback(async (oid: string, date: string) => {
    try {
      const res = await api.get<Reservation[]>(`/cms/reservations`, { params: { outletId: oid, date, status: 'all' } })
      setDayList(res.data.filter(r => ['confirmed', 'seated', 'completed'].includes(r.status)))
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { if (outletId) loadMonth(outletId, month) }, [outletId, month, loadMonth])
  useEffect(() => { if (outletId) loadDay(outletId, selectedDate) }, [outletId, selectedDate, loadDay])

  // GSAP: Animate grid on month navigate
  useEffect(() => {
    if (gridRef.current) {
      gsap.fromTo(gridRef.current,
        { opacity: 0, scale: 0.98, y: 5 },
        { opacity: 1, scale: 1, y: 0, duration: 0.35, ease: 'power2.out' }
      )
    }
  }, [month])

  // GSAP Stagger: Animate day list on selections
  useEffect(() => {
    if (dayListRef.current && dayList.length > 0) {
      gsap.fromTo(dayListRef.current.querySelectorAll('.cal-item'),
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.3, stagger: 0.025, ease: 'power2.out' }
      )
    }
  }, [selectedDate, dayList])

  const shiftMonth = (delta: number) => {
    const [y, m] = month.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const { cells } = daysInMonth(month)
  const selectedOutlet = outlets.find(o => o.id === outletId)
  const maxCount = Math.max(1, ...Object.values(days).map(d => d.count))

  return (
    <div className="cal-page">
      <div className="cal-header">
        <div>
          <h1 className="cal-title">Bookings Calendar</h1>
          <p className="cal-sub">{selectedOutlet ? selectedOutlet.name : 'Select an outlet'} · view counts and active list by date</p>
        </div>
        {!isFranchise && (
          <GSAPDropdown value={outletId} onChange={setOutletId}
            options={outlets.map(o => ({ value: o.id, label: o.name }))} icon={<Store size={14} />} width="190px" />
        )}
      </div>

      <div className="cal-body">
        {/* Month grid card */}
        <div className="cal-grid-card">
          <div className="cal-month-nav">
            <button className="cal-nav-btn" onClick={() => shiftMonth(-1)}><ChevronLeft size={16} /></button>
            <span className="cal-month-label">
              <CalendarIcon size={15} className="inline mr-2 text-primary-light transform -translate-y-0.5" />
              {monthLabel(month)}
            </span>
            <button className="cal-nav-btn" onClick={() => shiftMonth(1)}><ChevronRight size={16} /></button>
          </div>
          
          <div className="cal-weekdays">
            {WEEKDAYS.map(w => <span key={w}>{w}</span>)}
          </div>
          
          <div className="cal-grid" ref={gridRef}>
            {cells.map((date, i) => {
              if (!date) return <span key={`e${i}`} className="cal-cell empty" />
              const info = days[date]
              const isSel = date === selectedDate
              const isToday = date === todayIst()
              const intensity = info ? 0.08 + 0.45 * (info.count / maxCount) : 0
              
              return (
                <button 
                  key={date} 
                  onClick={() => setSelectedDate(date)}
                  className={`cal-cell ${isSel ? 'sel' : ''} ${isToday ? 'today' : ''}`}
                  style={info ? { 
                    background: `rgba(214,66,56,${intensity})`,
                    color: intensity > 0.35 ? '#fff' : 'var(--color-text-1)'
                  } : undefined}
                >
                  <span className="cal-daynum">{Number(date.slice(-2))}</span>
                  {info && (
                    <span 
                      className="cal-count"
                      style={{ 
                        background: intensity > 0.35 ? '#fff' : 'var(--color-primary)',
                        color: intensity > 0.35 ? 'var(--color-primary)' : '#fff'
                      }}
                    >
                      {info.count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          {loading && (
            <div className="cal-loading flex items-center justify-center gap-1.5 mt-4">
              <div className="w-3.5 h-3.5 rounded-full border border-primary border-t-transparent animate-spin" />
              <span>Updating calendar month…</span>
            </div>
          )}
        </div>

        {/* Selected day detail */}
        <div className="cal-day-card">
          <div className="cal-day-head">
            <div className="cal-day-title">
              {new Date(selectedDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            <div className="cal-day-meta flex items-center gap-2 mt-1.5 flex-wrap">
              {days[selectedDate] ? (
                <>
                  <span className="cal-meta-pill text-blue-600 bg-blue-50 border border-blue-100">
                    {days[selectedDate].count} Bookings
                  </span>
                  <span className="cal-meta-pill text-emerald-600 bg-emerald-50 border border-emerald-100">
                    {days[selectedDate].covers} Covers
                  </span>
                </>
              ) : (
                <span className="cal-meta-pill text-slate-500 bg-slate-50 border border-slate-100">
                  No bookings scheduled
                </span>
              )}
            </div>
          </div>

          <div className="cal-day-list" ref={dayListRef}>
            {dayList.length === 0 ? (
              <div className="cal-day-empty">
                <ClipboardList size={26} strokeWidth={1.5} className="mx-auto text-neutral-light mb-2" />
                <div>No active bookings for this date.</div>
              </div>
            ) : (
              dayList.map(r => (
                <div key={r.id} className="cal-item">
                  <div className="cal-item-time">
                    <Clock size={11} className="text-neutral-medium" />
                    <span>{fmtTime(r.reservedAt)}</span>
                  </div>
                  <div className="cal-item-main">
                    <span className="cal-item-name">{r.guestName}</span>
                    <span className="cal-item-meta">
                      <span className="inline-flex items-center text-[10.5px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                        <Users size={10} className="mr-1 text-slate-400" />
                        {r.partySize} Pax
                      </span>
                      <span className="inline-flex items-center text-[10.5px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                        <Armchair size={10} className="mr-1 text-slate-400" />
                        {r.table?.name ?? 'Unassigned'}
                        {r.table?.zone ? ` (${ZONE_LABEL[r.table.zone] ?? r.table.zone})` : ''}
                      </span>
                    </span>
                  </div>
                  <span className={`cal-item-status s-${r.status}`}>{r.status}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <style>{`
        .cal-page { background:var(--color-bg); min-height:calc(100vh - 40px); border-radius:var(--radius-xl); padding:1.5rem; display:flex; flex-direction:column; gap:1.25rem; }
        .cal-header { display:flex; align-items:center; justify-content:space-between; padding:1.25rem 1.5rem; background:#fff; border:1px solid var(--color-border); border-radius:var(--radius-lg); flex-wrap:wrap; gap:12px; box-shadow:0 1px 3px rgba(0,2,29,0.02); }
        .cal-title { font-size:1.4rem; font-weight:800; color:var(--color-text-1); margin:0; letter-spacing:-0.02em; }
        .cal-sub { font-size:13px; color:var(--color-text-3); margin:2px 0 0; font-weight:500; }
        
        .cal-body { display:grid; grid-template-columns:1.25fr 1fr; gap:1.25rem; align-items:start; }
        @media (max-width:900px){ .cal-body { grid-template-columns:1fr; } }
        
        .cal-grid-card, .cal-day-card { background:#fff; border:1px solid var(--color-border); border-radius:var(--radius-lg); padding:1.25rem 1.5rem; box-shadow:0 1px 3px rgba(0,2,29,0.01); }
        
        .cal-month-nav { display:flex; align-items:center; justify-content:space-between; margin-bottom:1.15rem; }
        .cal-month-label { font-size:15px; font-weight:800; color:var(--color-text-1); display:flex; align-items:center; }
        .cal-nav-btn { width:34px; height:34px; border-radius:8px; border:1px solid var(--color-border); background:#fff; cursor:pointer; display:flex; align-items:center; justify-content:center; color:var(--color-text-2); transition:all 0.15s; outline:none; }
        .cal-nav-btn:hover { border-color:var(--color-border-strong); background:var(--color-surface-2); }
        
        .cal-weekdays { display:grid; grid-template-columns:repeat(7,1fr); gap:6px; margin-bottom:8px; }
        .cal-weekdays span { text-align:center; font-size:10.5px; font-weight:800; color:var(--color-text-3); text-transform:uppercase; letter-spacing:0.04em; }
        
        .cal-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:6px; }
        .cal-cell { position:relative; aspect-ratio:1; border:1px solid var(--color-border); border-radius:10px; background:#fff; cursor:pointer; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; transition:border-color 0.15s, box-shadow 0.15s, outline 0.15s; outline:none; }
        .cal-cell.empty { border:none; background:transparent !important; cursor:default; }
        .cal-cell:not(.empty):hover { border-color:var(--color-primary); }
        .cal-cell.sel { outline:2px solid var(--color-primary); outline-offset:2px; box-shadow:0 0 10px rgba(214,66,56,0.12); z-index:10; }
        .cal-cell.today { border-color:var(--color-primary); }
        .cal-cell.today .cal-daynum { color:var(--color-primary); font-weight:900; position:relative; }
        .cal-cell.today .cal-daynum::after { content:''; position:absolute; bottom:-3px; left:50%; transform:translateX(-50%); width:3px; height:3px; border-radius:50%; background:var(--color-primary); }
        .cal-daynum { font-size:13.5px; font-weight:700; }
        .cal-count { font-size:9.5px; font-weight:900; border-radius:99px; padding:1px 6px; box-shadow:0 1px 3px rgba(0,0,0,0.08); }
        
        .cal-loading { font-size:11.5px; color:var(--color-text-3); text-align:center; font-weight:600; }
        
        .cal-day-head { border-bottom:1px solid var(--color-border); padding-bottom:1rem; margin-bottom:1rem; }
        .cal-day-title { font-size:16px; font-weight:800; color:var(--color-text-1); letter-spacing:-0.01em; }
        .cal-day-meta { display:flex; gap:8px; }
        .cal-meta-pill { font-size:10.5px; font-weight:700; padding:2px 8px; border-radius:6px; }
        
        .cal-day-list { display:flex; flex-direction:column; gap:10px; max-height:calc(100vh - 350px); overflow-y:auto; padding-right:4px; }
        .cal-day-empty { font-size:12.5px; color:var(--color-text-3); padding:2rem 0; text-align:center; font-weight:500; border:1px dashed var(--color-border-strong); border-radius:10px; background:var(--color-surface-2); }
        
        .cal-item { display:flex; align-items:center; gap:14px; padding:10px 14px; border:1px solid var(--color-border); border-radius:12px; background:#fff; transition:border-color 0.15s; }
        .cal-item:hover { border-color:var(--color-border-strong); }
        .cal-item-time { display:flex; align-items:center; gap:5px; font-size:11.5px; font-weight:800; color:var(--color-text-1); white-space:nowrap; background:#f1f5f9; padding:4px 8px; border-radius:6px; }
        .cal-item-main { flex:1; display:flex; flex-direction:column; gap:3px; min-width:0; }
        .cal-item-name { font-size:13.5px; font-weight:800; color:var(--color-text-1); }
        .cal-item-meta { display:flex; align-items:center; gap:6px; }
        
        .cal-item-status { font-size:9.5px; font-weight:800; text-transform:uppercase; padding:2.5px 8px; border-radius:5px; background:rgba(0,2,29,0.04); color:var(--color-text-2); }
        .cal-item-status.s-seated { background:#eff6ff; border:1px solid #bfdbfe; color:#2563eb; }
        .cal-item-status.s-completed { background:#f8fafc; border:1px solid #e2e8f0; color:#64748b; }
        .cal-item-status.s-confirmed { background:#f0fdf4; border:1px solid #bbf7d0; color:#16a34a; }
      `}</style>
    </div>
  )
}
