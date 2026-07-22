'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import type { Reservation, ReservationStatus, Outlet } from '@/types/api'
import toast from 'react-hot-toast'
import GSAPDropdown from '@/components/ui/GSAPDropdown'
import gsap from 'gsap'
import {
  Store, Search, Download, ChevronLeft, ChevronRight, Activity, Inbox,
  Users, Phone as PhoneIcon, X, Grid, List, Calendar, Clock, Sparkles,
  BookOpen, AlertCircle, RefreshCw, Mail, User, UserCheck, XCircle, Ban,
  Armchair, CheckCircle2, UserX
} from 'lucide-react'

const ZONE_LABEL: Record<string, string> = { ac: 'AC', non_ac: 'Non-AC', outdoor: 'Outdoor' }

const STATUS_META: Record<ReservationStatus, { label: string; color: string; bg: string }> = {
  confirmed: { label: 'Confirmed', color: '#2563eb', bg: '#eff6ff' },
  seated:    { label: 'Seated',    color: '#16a34a', bg: '#f0fdf4' },
  completed: { label: 'Completed', color: '#0f766e', bg: '#f0fdfa' },
  cancelled: { label: 'Cancelled', color: '#dc2626', bg: '#fef2f2' },
  no_show:   { label: 'No-show',   color: '#d97706', bg: '#fffbeb' },
  expired:   { label: 'Expired',   color: '#64748b', bg: '#f8fafc' },
  held:      { label: 'Pending',   color: '#64748b', bg: '#f8fafc' },
}

const STATUS_OPTIONS = [
  { value: 'all',       label: 'All statuses' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'seated',    label: 'Seated' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'no_show',   label: 'No-show' },
  { value: 'expired',   label: 'Expired' },
]

const PAGE_SIZE = 20
const EXPORT_CAP = 5000

interface PageResp {
  content: Reservation[]
  totalElements: number
  totalPages: number
  number: number
  first: boolean
  last: boolean
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
  })
}

function fmtDateOnly(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
}

function tableNames(r: Reservation): string {
  return [r.table, ...(r.additionalTables ?? []).map((a) => a.table)].filter(Boolean).map((t) => t!.name).join(' + ') || '—'
}

function getIstDateStr(offsetDays = 0): string {
  // India Standard Time (IST) is UTC+5:30.
  const d = new Date(Date.now() + 5.5 * 3600 * 1000 + offsetDays * 24 * 3600 * 1000)
  return d.toISOString().slice(0, 10)
}

const PRESETS = [
  { label: 'Today', getValue: () => ({ from: getIstDateStr(0), to: getIstDateStr(0) }) },
  { label: 'Yesterday', getValue: () => ({ from: getIstDateStr(-1), to: getIstDateStr(-1) }) },
  { label: 'Last 7 Days', getValue: () => ({ from: getIstDateStr(-6), to: getIstDateStr(0) }) },
  { label: 'Last 30 Days', getValue: () => ({ from: getIstDateStr(-29), to: getIstDateStr(0) }) },
  { label: 'Custom', getValue: () => ({ from: '', to: '' }) },
]

export default function ReservationHistory() {
  const { isFranchise } = useAuth()
  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [outletId, setOutletId] = useState('') // '' = all outlets (admins)

  const [status, setStatus] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [activePreset, setActivePreset] = useState('Custom')
  
  const [codeInput, setCodeInput] = useState('')
  const [code, setCode] = useState('')

  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null)
  const [drawerRes, setDrawerRes] = useState<Reservation | null>(null)
  
  const [page, setPage] = useState(0)
  const [data, setData] = useState<PageResp | null>(null)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  const overlayRef = useRef<HTMLDivElement>(null)
  const drawerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isFranchise) return
    api.get<Outlet[]>('/cms/outlets').then((r) => setOutlets(r.data)).catch(() => {})
  }, [isFranchise])

  // Build the query for the history endpoint from the active filters.
  const buildParams = useCallback((pageNum: number, size: number) => {
    const params: Record<string, string | number> = { page: pageNum, size }
    if (!isFranchise && outletId) params.outletId = outletId
    if (status !== 'all') params.status = status
    if (code.trim()) params.code = code.trim()
    // Send IST-day boundaries so a date range matches the local calendar day.
    if (dateFrom) params.dateFrom = `${dateFrom}T00:00:00+05:30`
    if (dateTo)   params.dateTo   = `${dateTo}T23:59:59+05:30`
    return params
  }, [isFranchise, outletId, status, code, dateFrom, dateTo])

  const load = useCallback(async (pageNum: number) => {
    setLoading(true)
    try {
      const res = await api.get<PageResp>('/cms/reservations/history', { params: buildParams(pageNum, PAGE_SIZE) })
      setData(res.data)
    } catch {
      toast.error('Failed to load booking history')
    } finally {
      setLoading(false)
    }
  }, [buildParams])

  // Refetch whenever filters change; reset to first page.
  useEffect(() => { setPage(0); load(0) }, [load])
  
  // Page navigation
  const goTo = (p: number) => { setPage(p); load(p) }

  const applyCode = () => setCode(codeInput)
  
  const clearFilters = () => {
    setStatus('all')
    setDateFrom('')
    setDateTo('')
    setCodeInput('')
    setCode('')
    setActivePreset('Custom')
  }
  
  const hasFilters = status !== 'all' || !!dateFrom || !!dateTo || !!code

  const handlePresetClick = (presetLabel: string, getValue: () => { from: string; to: string }) => {
    setActivePreset(presetLabel)
    if (presetLabel !== 'Custom') {
      const { from, to } = getValue()
      setDateFrom(from)
      setDateTo(to)
    }
  }

  // Handle drawer animations with GSAP
  useEffect(() => {
    if (selectedReservation) {
      setDrawerRes(selectedReservation)
      // Small timeout to allow DOM mounting
      const timer = setTimeout(() => {
        if (overlayRef.current && drawerRef.current) {
          gsap.killTweensOf([overlayRef.current, drawerRef.current])
          gsap.fromTo(overlayRef.current, 
            { opacity: 0 }, 
            { opacity: 1, duration: 0.25, ease: 'power2.out' }
          )
          gsap.fromTo(drawerRef.current, 
            { x: '100%' }, 
            { x: '0%', duration: 0.35, ease: 'power3.out' }
          )
        }
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [selectedReservation])

  const closeDrawer = () => {
    if (overlayRef.current && drawerRef.current) {
      gsap.killTweensOf([overlayRef.current, drawerRef.current])
      gsap.to(overlayRef.current, { opacity: 0, duration: 0.2, ease: 'power2.in' })
      gsap.to(drawerRef.current, {
        x: '100%',
        duration: 0.25,
        ease: 'power3.in',
        onComplete: () => {
          setSelectedReservation(null)
          setDrawerRes(null)
        }
      })
    } else {
      setSelectedReservation(null)
      setDrawerRes(null)
    }
  }

  // Handle inline status update inside the drawer
  const handleUpdateStatus = async (resId: string, newStatus: 'seated' | 'completed' | 'cancelled' | 'no_show') => {
    setUpdatingStatus(true)
    try {
      const res = await api.patch<Reservation>(`/cms/reservations/${resId}/status`, { status: newStatus })
      toast.success(`Marked reservation as ${newStatus}`)
      
      // Update local grid/table state
      if (data) {
        const updatedContent = data.content.map(r => r.id === resId ? res.data : r)
        setData({ ...data, content: updatedContent })
      }
      // Update selected drawer state
      setSelectedReservation(res.data)
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update reservation status')
    } finally {
      setUpdatingStatus(false)
    }
  }

  // CSV export of the full filtered set
  const exportCsv = async () => {
    setExporting(true)
    try {
      const all: Reservation[] = []
      let p = 0
      while (all.length < EXPORT_CAP) {
        const res = await api.get<PageResp>('/cms/reservations/history', { params: buildParams(p, 100) })
        all.push(...res.data.content)
        if (res.data.last || res.data.content.length === 0) break
        p++
      }
      if (all.length === 0) { toast('No bookings to export'); return }

      const headers = ['S. No.', 'Booking Code', 'Status', 'Reserved At', 'Guest', 'Phone', 'Email', 'Party', 'Table(s)', 'Zone', 'Occasion', 'Dietary Notes', 'Source', 'Outlet', 'Booked On']
      const rowsData = all.map((r, i) => [
        i + 1,
        r.bookingCode,
        STATUS_META[r.status]?.label ?? r.status,
        fmtDateTime(r.reservedAt),
        r.guestName,
        r.guestPhone,
        r.guestEmail ?? '',
        r.partySize,
        tableNames(r),
        r.table?.zone ? (ZONE_LABEL[r.table.zone] ?? r.table.zone) : '',
        r.occasion ?? '',
        r.dietaryNotes ?? '',
        r.source === 'staff' ? 'Staff (walk-in)' : 'Customer app',
        r.outlet?.name ?? '',
        fmtDateOnly(r.createdAt),
      ])
      const csv = [headers, ...rowsData]
        .map((row) => row.map((cell) => {
          const s = String(cell ?? '')
          const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s // defuse formula injection
          return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
        }).join(','))
        .join('\r\n')

      const outletName = isFranchise ? 'Outlet' : (outlets.find((o) => o.id === outletId)?.name ?? 'All Outlets')
      const stamp = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).replace(',', '')
      const filename = `${outletName} Napkiq Bookings ${stamp}.csv`

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
      toast.success(`Exported ${all.length} booking${all.length > 1 ? 's' : ''}`)
    } catch {
      toast.error('Export failed')
    } finally {
      setExporting(false)
    }
  }

  const rows = data?.content ?? []

  // Dynamic statistics calculations based on current page contents
  const stats = {
    total: data?.totalElements ?? 0,
    seatedRate: 0,
    cancelRate: 0,
    avgParty: 0,
    appRatio: 0,
  }

  if (rows.length > 0) {
    const seatedOrCompleted = rows.filter(r => r.status === 'seated' || r.status === 'completed').length
    const cancelledOrNoShowOrExpired = rows.filter(r => r.status === 'cancelled' || r.status === 'no_show' || r.status === 'expired').length
    const totalPartySize = rows.reduce((acc, r) => acc + r.partySize, 0)
    const appBookings = rows.filter(r => r.source === 'customer').length

    stats.seatedRate = Math.round((seatedOrCompleted / rows.length) * 100)
    stats.cancelRate = Math.round((cancelledOrNoShowOrExpired / rows.length) * 100)
    stats.avgParty = Number((totalPartySize / rows.length).toFixed(1))
    stats.appRatio = Math.round((appBookings / rows.length) * 100)
  }

  // Render pagination buttons dynamically
  const renderPageNumbers = () => {
    if (!data) return null
    const pages = []
    const totalPages = data.totalPages
    const currentPage = data.number
    const maxButtons = 5
    
    let startPage = Math.max(0, currentPage - 2)
    let endPage = Math.min(totalPages - 1, startPage + maxButtons - 1)
    
    if (endPage - startPage < maxButtons - 1) {
      startPage = Math.max(0, endPage - maxButtons + 1)
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <button 
          key={i} 
          className={`rh-page-num ${i === currentPage ? 'active' : ''}`}
          onClick={() => goTo(i)}
          disabled={loading}
        >
          {i + 1}
        </button>
      )
    }
    return pages
  }

  return (
    <div className="rh-page">
      {/* Header Panel */}
      <div className="rh-header">
        <div>
          <h1 className="rh-title">Booking History</h1>
          <p className="rh-sub">{data ? `${data.totalElements} booking${data.totalElements === 1 ? '' : 's'} on record` : 'Full reservation log'}</p>
        </div>
        <div className="rh-header-actions">
          {!isFranchise && (
            <GSAPDropdown value={outletId} onChange={setOutletId}
              options={[{ value: '', label: 'All outlets' }, ...outlets.map((o) => ({ value: o.id, label: o.name }))]}
              icon={<Store size={14} />} width="180px" />
          )}
          <div className="rh-view-toggle">
            <button 
              className={`rh-toggle-btn ${viewMode === 'table' ? 'active' : ''}`} 
              onClick={() => setViewMode('table')}
              title="Table View"
            >
              <List size={15} />
            </button>
            <button 
              className={`rh-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`} 
              onClick={() => setViewMode('grid')}
              title="Grid View"
            >
              <Grid size={15} />
            </button>
          </div>
          <button className="rh-export" onClick={exportCsv} disabled={exporting || loading}>
            <Download size={14} />{exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
      </div>

      {/* Metrics Dashboard */}
      <div className="rh-metrics-grid">
        <div className="rh-metric-card">
          <div className="rh-metric-icon" style={{ background: 'rgba(214, 66, 56, 0.05)', color: 'var(--color-primary)' }}>
            <Calendar size={18} />
          </div>
          <div>
            <div className="rh-metric-label">Total Bookings</div>
            <div className="rh-metric-value">{stats.total}</div>
            <div className="rh-metric-sub">Across all filters</div>
          </div>
        </div>

        <div className="rh-metric-card">
          <div className="rh-metric-icon" style={{ background: 'rgba(214, 66, 56, 0.05)', color: 'var(--color-primary)' }}>
            <UserCheck size={18} />
          </div>
          <div>
            <div className="rh-metric-label">Seated / Completed</div>
            <div className="rh-metric-value">{stats.seatedRate}%</div>
            <div className="rh-metric-sub">Current page rate</div>
          </div>
        </div>

        <div className="rh-metric-card">
          <div className="rh-metric-icon" style={{ background: 'rgba(214, 66, 56, 0.05)', color: 'var(--color-primary)' }}>
            <XCircle size={18} />
          </div>
          <div>
            <div className="rh-metric-label">Cancellations</div>
            <div className="rh-metric-value">{stats.cancelRate}%</div>
            <div className="rh-metric-sub">Current page rate</div>
          </div>
        </div>

        <div className="rh-metric-card">
          <div className="rh-metric-icon" style={{ background: 'rgba(214, 66, 56, 0.05)', color: 'var(--color-primary)' }}>
            <Users size={18} />
          </div>
          <div>
            <div className="rh-metric-label">Avg. Party Size</div>
            <div className="rh-metric-value">{stats.avgParty}</div>
            <div className="rh-metric-sub">Guests per booking</div>
          </div>
        </div>

        <div className="rh-metric-card">
          <div className="rh-metric-icon" style={{ background: 'rgba(214, 66, 56, 0.05)', color: 'var(--color-primary)' }}>
            <Sparkles size={18} />
          </div>
          <div>
            <div className="rh-metric-label">App Bookings</div>
            <div className="rh-metric-value">{stats.appRatio}%</div>
            <div className="rh-metric-sub">Current page ratio</div>
          </div>
        </div>
      </div>

      {/* Advanced Filters */}
      <div className="rh-filters-card">
        {/* Presets Row */}
        <div className="rh-presets-row">
          <span className="rh-presets-label">Date Presets:</span>
          <div className="rh-presets-list">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                className={`rh-preset-btn ${activePreset === p.label ? 'active' : ''}`}
                onClick={() => handlePresetClick(p.label, p.getValue)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rh-filters-inputs">
          <div className="rh-field">
            <span>Status</span>
            <GSAPDropdown value={status} onChange={setStatus} options={STATUS_OPTIONS} width="140px" />
          </div>

          <label className="rh-field">
            <span>From</span>
            <input 
              type="date" 
              className="rh-input" 
              value={dateFrom} 
              max={dateTo || undefined} 
              onChange={(e) => {
                setDateFrom(e.target.value)
                setActivePreset('Custom')
              }} 
            />
          </label>

          <label className="rh-field">
            <span>To</span>
            <input 
              type="date" 
              className="rh-input" 
              value={dateTo} 
              min={dateFrom || undefined} 
              onChange={(e) => {
                setDateTo(e.target.value)
                setActivePreset('Custom')
              }} 
            />
          </label>

          <div className="rh-field rh-search">
            <span>Booking code</span>
            <div className="rh-search-row">
              <input 
                className="rh-input" 
                placeholder="NQABC123" 
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === 'Enter') applyCode() }} 
              />
              <button className="rh-search-btn" onClick={applyCode}><Search size={14} /></button>
            </div>
          </div>

          {hasFilters && (
            <button className="rh-clear" onClick={clearFilters}>
              <X size={13} />Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {loading && !data ? (
        <div className="rh-empty"><Activity className="animate-spin" size={22} />Loading history…</div>
      ) : rows.length === 0 ? (
        <div className="rh-empty"><Inbox size={30} strokeWidth={1.3} />No bookings match these filters.</div>
      ) : viewMode === 'table' ? (
        /* Table View */
        <div className="rh-table-wrap">
          <table className="rh-table">
            <thead>
              <tr>
                <th>Reserved</th><th>Code</th><th>Guest</th><th>Party</th><th>Table(s)</th><th>Occasion</th><th>Source</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody className={loading ? 'rh-dim' : ''}>
              {rows.map((r) => {
                const meta = STATUS_META[r.status]
                return (
                  <tr key={r.id} className="rh-row-clickable" onClick={() => setSelectedReservation(r)}>
                    <td className="rh-strong">{fmtDateTime(r.reservedAt)}</td>
                    <td className="rh-code">{r.bookingCode}</td>
                    <td>
                      <div className="rh-guest">{r.guestName}</div>
                      <div className="rh-guest-sub"><PhoneIcon size={10} />{r.guestPhone}</div>
                    </td>
                    <td><span className="rh-party"><Users size={12} />{r.partySize}</span></td>
                    <td>
                      {tableNames(r)}
                      {r.table?.zone && <span className="rh-zone">{ZONE_LABEL[r.table.zone] ?? r.table.zone}</span>}
                    </td>
                    <td>{r.occasion ? <span className="rh-occ">🎉 {r.occasion}</span> : <span className="rh-muted">—</span>}</td>
                    <td>
                      <span className={`rh-source-badge ${r.source}`}>
                        {r.source === 'staff' ? 'Walk-in' : 'App'}
                      </span>
                    </td>
                    <td><span className="rh-badge" style={{ color: meta.color, background: meta.bg }}>{meta.label}</span></td>
                    <td>
                      <button 
                        className="rh-view-details-btn" 
                        onClick={(e) => { 
                          e.stopPropagation()
                          setSelectedReservation(r)
                        }}
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* Grid Cards View */
        <div className={`rh-cards-grid ${loading ? 'rh-dim' : ''}`}>
          {rows.map((r) => {
            const meta = STATUS_META[r.status]
            return (
              <div key={r.id} className="rh-booking-card" onClick={() => setSelectedReservation(r)}>
                <div className="rh-card-header-row">
                  <span className="rh-card-time-pill">
                    <Clock size={12} /> {fmtDateTime(r.reservedAt).split(',')[1]?.trim() || ''}
                  </span>
                  <span className="rh-badge" style={{ color: meta.color, background: meta.bg }}>{meta.label}</span>
                </div>
                <div className="rh-card-date">{fmtDateOnly(r.reservedAt)}</div>
                
                <div className="rh-card-guest-sec">
                  <div className="rh-guest">{r.guestName}</div>
                  <div className="rh-guest-sub"><PhoneIcon size={10} /> {r.guestPhone}</div>
                </div>

                <div className="rh-card-meta-row">
                  <span className="rh-party"><Users size={12} /> {r.partySize}</span>
                  <span className="rh-card-tables">🪑 {tableNames(r)}</span>
                </div>

                <div className="rh-card-footer-row">
                  <span className={`rh-source-badge ${r.source}`}>
                    {r.source === 'staff' ? 'Walk-in' : 'App'}
                  </span>
                  <span className="rh-card-code">{r.bookingCode}</span>
                </div>

                {r.occasion && (
                  <div className="rh-card-tag-wrapper">
                    <span className="rh-occ">🎉 {r.occasion}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination Panel */}
      {data && data.totalPages > 1 && (
        <div className="rh-pager">
          <span className="rh-pager-info">
            Showing {data.number * PAGE_SIZE + 1} to {Math.min((data.number + 1) * PAGE_SIZE, data.totalElements)} of {data.totalElements} entries
          </span>
          <div className="rh-pager-btns">
            <button disabled={data.first || loading} onClick={() => goTo(page - 1)}>
              <ChevronLeft size={15} /> Prev
            </button>
            {renderPageNumbers()}
            <button disabled={data.last || loading} onClick={() => goTo(page + 1)}>
              Next <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Slide-over guest detail drawer */}
      {drawerRes && (
        <>
          <div 
            ref={overlayRef} 
            className="rh-drawer-backdrop" 
            onClick={closeDrawer} 
          />
          <div ref={drawerRef} className="rh-drawer-content">
            <div className="rh-drawer-header">
              <div>
                <h2 className="rh-drawer-title">Reservation Details</h2>
                <div className="rh-drawer-subtitle">Code: {drawerRes.bookingCode}</div>
              </div>
              <button className="rh-drawer-close" onClick={closeDrawer}>
                <X size={20} />
              </button>
            </div>

            <div className="rh-drawer-body">
              {/* Status Banner */}
              <div className="rh-drawer-status-banner" style={{ 
                color: STATUS_META[drawerRes.status].color, 
                background: STATUS_META[drawerRes.status].bg,
                borderColor: STATUS_META[drawerRes.status].color + '22'
              }}>
                <div className="rh-status-indicator" style={{ background: STATUS_META[drawerRes.status].color }} />
                <span>Booking Status: <strong>{STATUS_META[drawerRes.status].label}</strong></span>
              </div>

              {/* Guest Profile Section */}
              <div className="rh-drawer-section">
                <h3 className="rh-section-heading">Guest Profile</h3>
                <div className="rh-guest-profile-card">
                  <div className="rh-profile-avatar">
                    {drawerRes.guestName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                  </div>
                  <div>
                    <h4 className="rh-profile-name">{drawerRes.guestName}</h4>
                    <div className="rh-profile-details">
                      <a href={`tel:${drawerRes.guestPhone}`} className="rh-profile-link">
                        <PhoneIcon size={12} /> {drawerRes.guestPhone}
                      </a>
                      {drawerRes.guestEmail && (
                        <a href={`mailto:${drawerRes.guestEmail}`} className="rh-profile-link">
                          <Mail size={12} /> {drawerRes.guestEmail}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Booking Parameters */}
              <div className="rh-drawer-section">
                <h3 className="rh-section-heading">Booking Details</h3>
                <div className="rh-details-grid">
                  <div className="rh-detail-item">
                    <span className="rh-detail-label">Date</span>
                    <span className="rh-detail-value">{fmtDateOnly(drawerRes.reservedAt)}</span>
                  </div>
                  <div className="rh-detail-item">
                    <span className="rh-detail-label">Time (IST)</span>
                    <span className="rh-detail-value">{fmtDateTime(drawerRes.reservedAt).split(',')[1]?.trim()}</span>
                  </div>
                  <div className="rh-detail-item">
                    <span className="rh-detail-label">Party Size</span>
                    <span className="rh-detail-value">{drawerRes.partySize} Guests</span>
                  </div>
                  <div className="rh-detail-item">
                    <span className="rh-detail-label">Assigned Table(s)</span>
                    <span className="rh-detail-value">{tableNames(drawerRes)}</span>
                  </div>
                  <div className="rh-detail-item">
                    <span className="rh-detail-label">Seating Zone</span>
                    <span className="rh-detail-value">
                      {drawerRes.table?.zone ? (ZONE_LABEL[drawerRes.table.zone] ?? drawerRes.table.zone) : 'Standard'}
                    </span>
                  </div>
                  <div className="rh-detail-item">
                    <span className="rh-detail-label">Duration</span>
                    <span className="rh-detail-value">{drawerRes.durationMinutes} Minutes</span>
                  </div>
                  <div className="rh-detail-item">
                    <span className="rh-detail-label">Booking Source</span>
                    <span className="rh-detail-value capitalize">{drawerRes.source === 'staff' ? 'Walk-in (Staff)' : 'Customer App'}</span>
                  </div>
                  {drawerRes.outlet && (
                    <div className="rh-detail-item">
                      <span className="rh-detail-label">Outlet</span>
                      <span className="rh-detail-value">{drawerRes.outlet.name}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Customer CRM Notes & Special Requests */}
              {(drawerRes.occasion || drawerRes.dietaryNotes || drawerRes.specialRequests) && (
                <div className="rh-drawer-section">
                  <h3 className="rh-section-heading">CRM Notes</h3>
                  <div className="rh-crm-notes-card">
                    {drawerRes.occasion && (
                      <div className="rh-crm-note-row">
                        <span className="rh-crm-icon">🎉</span>
                        <div>
                          <strong>Special Occasion</strong>
                          <p>{drawerRes.occasion}</p>
                        </div>
                      </div>
                    )}
                    {drawerRes.dietaryNotes && (
                      <div className="rh-crm-note-row">
                        <span className="rh-crm-icon">🥗</span>
                        <div>
                          <strong>Dietary Preferences</strong>
                          <p>{drawerRes.dietaryNotes}</p>
                        </div>
                      </div>
                    )}
                    {drawerRes.specialRequests && (
                      <div className="rh-crm-note-row">
                        <span className="rh-crm-icon">💬</span>
                        <div>
                          <strong>Special Requests</strong>
                          <p>{drawerRes.specialRequests}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Timeline / Audit Trail */}
              <div className="rh-drawer-section">
                <h3 className="rh-section-heading">Audit History</h3>
                <div className="rh-timeline">
                  <div className="rh-timeline-item">
                    <div className="rh-timeline-badge" />
                    <div className="rh-timeline-info">
                      <div className="rh-timeline-title">Booking Created</div>
                      <div className="rh-timeline-time">{fmtDateTime(drawerRes.createdAt)}</div>
                    </div>
                  </div>
                  {drawerRes.confirmedAt && (
                    <div className="rh-timeline-item">
                      <div className="rh-timeline-badge confirmed" />
                      <div className="rh-timeline-info">
                        <div className="rh-timeline-title">Booking Confirmed</div>
                        <div className="rh-timeline-time">{fmtDateTime(drawerRes.confirmedAt)}</div>
                      </div>
                    </div>
                  )}
                  {drawerRes.reminderSentAt && (
                    <div className="rh-timeline-item">
                      <div className="rh-timeline-badge info" />
                      <div className="rh-timeline-info">
                        <div className="rh-timeline-title">Reminder WhatsApp Sent</div>
                        <div className="rh-timeline-time">{fmtDateTime(drawerRes.reminderSentAt)}</div>
                      </div>
                    </div>
                  )}
                  {drawerRes.status !== 'confirmed' && drawerRes.status !== 'held' && (
                    <div className="rh-timeline-item">
                      <div className="rh-timeline-badge active" style={{ background: STATUS_META[drawerRes.status].color }} />
                      <div className="rh-timeline-info">
                        <div className="rh-timeline-title">Status Updated to: {STATUS_META[drawerRes.status].label}</div>
                        <div className="rh-timeline-time">{fmtDateTime(drawerRes.updatedAt)}</div>
                        {drawerRes.status === 'cancelled' && drawerRes.cancelledBy && (
                          <div className="rh-timeline-desc">Cancelled by: {drawerRes.cancelledBy}</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Actions (Update Status) */}
            <div className="rh-drawer-footer">
              <div className="rh-actions-heading">Modify Reservation Status</div>
              <div className="rh-actions-buttons">
                {drawerRes.status === 'confirmed' && (
                  <>
                    <button 
                      className="rh-action-btn seat" 
                      disabled={updatingStatus} 
                      onClick={() => handleUpdateStatus(drawerRes.id, 'seated')}
                    >
                      <Armchair size={14} /> Seat Guest
                    </button>
                    <button 
                      className="rh-action-btn noshow" 
                      disabled={updatingStatus} 
                      onClick={() => handleUpdateStatus(drawerRes.id, 'no_show')}
                    >
                      <UserX size={14} /> No-Show
                    </button>
                    <button 
                      className="rh-action-btn cancel" 
                      disabled={updatingStatus} 
                      onClick={() => handleUpdateStatus(drawerRes.id, 'cancelled')}
                    >
                      <Ban size={14} /> Cancel Booking
                    </button>
                  </>
                )}
                {drawerRes.status === 'seated' && (
                  <>
                    <button 
                      className="rh-action-btn complete" 
                      disabled={updatingStatus} 
                      onClick={() => handleUpdateStatus(drawerRes.id, 'completed')}
                    >
                      <CheckCircle2 size={14} /> Complete Visit
                    </button>
                    <button 
                      className="rh-action-btn cancel" 
                      disabled={updatingStatus} 
                      onClick={() => handleUpdateStatus(drawerRes.id, 'cancelled')}
                    >
                      <Ban size={14} /> Cancel Booking
                    </button>
                  </>
                )}
                {drawerRes.status === 'held' && (
                  <button 
                    className="rh-action-btn cancel" 
                    disabled={updatingStatus} 
                    onClick={() => handleUpdateStatus(drawerRes.id, 'cancelled')}
                  >
                    <Ban size={14} /> Cancel Hold
                  </button>
                )}
                {['completed', 'cancelled', 'no_show', 'expired'].includes(drawerRes.status) && (
                  <div className="rh-finalized-msg">
                    <AlertCircle size={14} />
                    This reservation has been finalized.
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Styled block containing all overrides */}
      <style>{`
        .rh-page { 
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
        
        /* Metrics Grid */
        .rh-metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 1rem;
        }
        .rh-metric-card {
          background: #ffffff;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: 1.15rem;
          display: flex;
          align-items: center;
          gap: 1rem;
          transition: all 0.2s ease;
          box-shadow: 0 1px 3px rgba(0,2,29,0.02);
        }
        .rh-metric-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(214, 66, 56, 0.04);
          border-color: var(--color-primary);
        }
        .rh-metric-icon {
          width: 42px;
          height: 42px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .rh-metric-label {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          color: var(--color-text-3);
          letter-spacing: 0.05em;
        }
        .rh-metric-value {
          font-size: 20px;
          font-weight: 800;
          color: var(--color-text-1);
          margin-top: 2px;
          line-height: 1.1;
        }
        .rh-metric-sub {
          font-size: 11px;
          color: var(--color-text-3);
          margin-top: 2px;
        }

        .rh-header { 
          display: flex; 
          align-items: center; 
          justify-content: space-between; 
          padding: 1.25rem 1.5rem; 
          background: #fff; 
          border: 1px solid var(--color-border); 
          border-radius: var(--radius-xl); 
          flex-wrap: wrap; 
          gap: 12px; 
          box-shadow: 0 1px 3px rgba(0,2,29,0.02);
        }
        .rh-title { font-size: 1.4rem; font-weight: 800; color: var(--color-text-1); letter-spacing: -0.02em; margin: 0; }
        .rh-sub { font-size: 13px; color: var(--color-text-3); margin: 2px 0 0; }
        .rh-header-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        
        /* View Toggle */
        .rh-view-toggle {
          display: flex;
          background: #f1f5f9;
          padding: 4px;
          border-radius: 9px;
          border: 1px solid var(--color-border);
        }
        .rh-toggle-btn {
          width: 30px;
          height: 30px;
          border: none;
          background: transparent;
          color: var(--color-text-3);
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .rh-toggle-btn.active {
          background: #ffffff;
          color: var(--color-primary);
          box-shadow: 0 1px 3px rgba(0,0,0,0.08);
        }
        .rh-toggle-btn:hover:not(.active) {
          color: var(--color-text-2);
        }

        .rh-export { 
          display: inline-flex; 
          align-items: center; 
          gap: 6px; 
          height: 38px; 
          padding: 0 14px; 
          border-radius: 9px; 
          border: 1px solid var(--color-border-strong); 
          background: #fff; 
          font-size: 13px; 
          font-weight: 700; 
          color: var(--color-text-2); 
          cursor: pointer; 
          transition: all .15s; 
        }
        .rh-export:hover:not(:disabled) { border-color: var(--color-primary); color: var(--color-primary); }
        .rh-export:disabled { opacity: .5; cursor: not-allowed; }

        /* Filters Card */
        .rh-filters-card {
          background: #fff;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-xl);
          padding: 1.25rem 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
          box-shadow: 0 1px 3px rgba(0,2,29,0.02);
        }
        .rh-presets-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
          border-bottom: 1px solid var(--color-border);
          padding-bottom: 0.75rem;
        }
        .rh-presets-label {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          color: var(--color-text-3);
          letter-spacing: 0.05em;
        }
        .rh-presets-list {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .rh-preset-btn {
          padding: 5px 12px;
          border-radius: 99px;
          border: 1px solid var(--color-border-strong);
          background: transparent;
          font-size: 12px;
          font-weight: 600;
          color: var(--color-text-2);
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .rh-preset-btn:hover {
          border-color: var(--color-text-3);
          color: var(--color-text-1);
        }
        .rh-preset-btn.active {
          background: var(--color-primary-dim);
          border-color: var(--color-primary);
          color: var(--color-primary);
        }

        .rh-filters-inputs { display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap; }
        .rh-field { display: flex; flex-direction: column; gap: 5px; }
        .rh-field > span { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-3); }
        .rh-input { background: #fff; border: 1px solid var(--color-border-strong); border-radius: 8px; padding: 9px 12px; font-size: 13px; font-weight: 500; color: var(--color-text-1); transition: all .2s; }
        .rh-input:focus { outline: none; border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--color-primary-border); }
        .rh-search { min-width: 200px; }
        .rh-search-row { display: flex; gap: 6px; }
        .rh-search-row .rh-input { flex: 1; text-transform: uppercase; }
        .rh-search-btn { width: 38px; border-radius: 8px; border: 1px solid var(--color-border-strong); background: #fff; color: var(--color-text-2); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all .15s; }
        .rh-search-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }
        .rh-clear { display: inline-flex; align-items: center; gap: 5px; height: 38px; padding: 0 12px; border-radius: 8px; border: 1px solid transparent; background: rgba(0,2,29,0.03); font-size: 12.5px; font-weight: 700; color: var(--color-text-2); cursor: pointer; }
        .rh-clear:hover { background: rgba(0,2,29,0.06); }

        /* Table Wrapping and Clickable Rows */
        .rh-table-wrap { background: #fff; border: 1px solid var(--color-border); border-radius: var(--radius-xl); overflow-x: auto; box-shadow: 0 1px 3px rgba(0,2,29,0.02); }
        .rh-table { width: 100%; border-collapse: collapse; font-size: 13px; min-width: 820px; }
        .rh-table thead th { text-align: left; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-3); padding: 14px 16px; border-bottom: 1px solid var(--color-border); white-space: nowrap; background: #fcfcfb; }
        .rh-table tbody td { padding: 14px 16px; border-bottom: 1px solid var(--color-border); color: var(--color-text-2); vertical-align: middle; }
        .rh-table tbody tr:last-child td { border-bottom: none; }
        .rh-row-clickable { cursor: pointer; transition: background 0.12s; }
        .rh-row-clickable:hover { background: #fcfcfb; }
        
        .rh-dim { opacity: .5; transition: opacity .15s; }
        .rh-strong { font-weight: 700; color: var(--color-text-1); white-space: nowrap; }
        .rh-code { font-family: ui-monospace, monospace; font-weight: 800; color: var(--color-primary); letter-spacing: 0.04em; }
        .rh-guest { font-weight: 700; color: var(--color-text-1); }
        .rh-guest-sub { display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--color-text-3); margin-top: 2px; }
        .rh-party { display: inline-flex; align-items: center; gap: 4px; font-weight: 700; color: var(--color-text-1); }
        
        /* Badges & Tags */
        .rh-zone { margin-left: 6px; font-size: 10px; font-weight: 700; background: rgba(0,2,29,0.05); color: var(--color-text-3); padding: 1px 6px; border-radius: 99px; }
        .rh-occ { font-size: 11px; font-weight: 700; background: rgba(214,66,56,0.06); color: var(--color-primary); padding: 2px 8px; border-radius: 99px; width: fit-content; display: inline-block; }
        .rh-muted { color: var(--color-text-3); }
        .rh-badge { display: inline-block; font-size: 11px; font-weight: 800; padding: 3px 9px; border-radius: 99px; white-space: nowrap; text-transform: uppercase; letter-spacing: 0.02em; }
        .rh-source-badge { display: inline-flex; align-items: center; font-size: 10.5px; font-weight: 700; padding: 2px 7px; border-radius: 99px; }
        .rh-source-badge.staff { background: #f3f4f6; color: #4b5563; }
        .rh-source-badge.customer { background: #e0f2fe; color: #0369a1; }
        
        .rh-view-details-btn {
          border: 1px solid var(--color-border-strong);
          background: #ffffff;
          font-size: 12px;
          font-weight: 700;
          color: var(--color-text-2);
          padding: 4px 10px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .rh-row-clickable:hover .rh-view-details-btn {
          border-color: var(--color-primary);
          color: var(--color-primary);
          background: var(--color-primary-dim);
        }

        /* Grid View Cards */
        .rh-cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 1.1rem;
        }
        .rh-booking-card {
          background: #ffffff;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 1px 3px rgba(0,2,29,0.02);
          position: relative;
        }
        .rh-booking-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 10px 20px rgba(214, 66, 56, 0.04);
          border-color: var(--color-primary);
        }
        .rh-card-header-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .rh-card-time-pill {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          font-weight: 700;
          color: var(--color-text-2);
          background: #f1f5f9;
          padding: 3px 8px;
          border-radius: 6px;
        }
        .rh-card-date {
          font-size: 11px;
          color: var(--color-text-3);
          font-weight: 600;
        }
        .rh-card-guest-sec {
          border-top: 1px solid var(--color-border);
          border-bottom: 1px solid var(--color-border);
          padding: 0.6rem 0;
        }
        .rh-card-meta-row {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          font-weight: 600;
        }
        .rh-card-tables {
          color: var(--color-text-2);
        }
        .rh-card-footer-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: auto;
          padding-top: 0.25rem;
        }
        .rh-card-code {
          font-family: ui-monospace, monospace;
          font-weight: 700;
          font-size: 12px;
          color: var(--color-primary);
        }
        .rh-card-tag-wrapper {
          display: flex;
          gap: 5px;
          flex-wrap: wrap;
        }

        /* Drawer / Slide-over Details */
        .rh-drawer-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 2, 29, 0.4);
          backdrop-filter: blur(4px);
          z-index: 1000;
        }
        .rh-drawer-content {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          width: 480px;
          max-width: 100vw;
          background: #ffffff;
          box-shadow: -8px 0 35px rgba(0, 2, 29, 0.12);
          z-index: 1001;
          display: flex;
          flex-direction: column;
        }
        .rh-drawer-header {
          padding: 1.5rem;
          border-bottom: 1px solid var(--color-border);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .rh-drawer-title {
          font-size: 1.25rem;
          font-weight: 800;
          color: var(--color-text-1);
          margin: 0;
          letter-spacing: -0.01em;
        }
        .rh-drawer-subtitle {
          font-size: 12px;
          font-weight: 600;
          color: var(--color-text-3);
          margin-top: 2px;
        }
        .rh-drawer-close {
          border: none;
          background: transparent;
          color: var(--color-text-3);
          cursor: pointer;
          padding: 6px;
          border-radius: 99px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
        }
        .rh-drawer-close:hover {
          background: rgba(0,2,29,0.05);
          color: var(--color-text-1);
        }
        .rh-drawer-body {
          padding: 1.5rem;
          overflow-y: auto;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .rh-drawer-status-banner {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          border-radius: var(--radius-md);
          font-size: 13px;
          border: 1px solid transparent;
        }
        .rh-status-indicator {
          width: 8px;
          height: 8px;
          border-radius: 99px;
        }
        .rh-drawer-section {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .rh-section-heading {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          color: var(--color-text-3);
          letter-spacing: 0.06em;
          border-bottom: 1px solid var(--color-border);
          padding-bottom: 4px;
        }
        
        /* Guest Profile Card in Drawer */
        .rh-guest-profile-card {
          display: flex;
          align-items: center;
          gap: 1rem;
          background: var(--color-bg);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: 1rem;
        }
        .rh-profile-avatar {
          width: 48px;
          height: 48px;
          border-radius: 99px;
          background: var(--color-primary-dim);
          color: var(--color-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          font-weight: 800;
        }
        .rh-profile-name {
          font-size: 15px;
          font-weight: 700;
          color: var(--color-text-1);
          margin: 0;
        }
        .rh-profile-details {
          display: flex;
          flex-direction: column;
          gap: 2px;
          margin-top: 4px;
        }
        .rh-profile-link {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--color-text-2);
          text-decoration: none;
          font-weight: 600;
        }
        .rh-profile-link:hover {
          color: var(--color-primary);
        }

        /* Details Grid in Drawer */
        .rh-details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem 1rem;
        }
        .rh-detail-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .rh-detail-label {
          font-size: 11px;
          color: var(--color-text-3);
          font-weight: 600;
        }
        .rh-detail-value {
          font-size: 13px;
          color: var(--color-text-1);
          font-weight: 700;
        }

        /* CRM Notes Drawer Card */
        .rh-crm-notes-card {
          background: #fff8f8;
          border: 1px solid rgba(214,66,56,0.08);
          border-radius: var(--radius-lg);
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .rh-crm-note-row {
          display: flex;
          gap: 10px;
          font-size: 13px;
        }
        .rh-crm-icon {
          font-size: 16px;
          margin-top: 1px;
        }
        .rh-crm-note-row strong {
          color: var(--color-text-1);
          font-size: 12.5px;
          display: block;
        }
        .rh-crm-note-row p {
          color: var(--color-text-2);
          margin-top: 1px;
        }

        /* Audit Timeline */
        .rh-timeline {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          padding-left: 0.5rem;
          margin-top: 4px;
        }
        .rh-timeline-item {
          display: flex;
          gap: 12px;
          position: relative;
        }
        .rh-timeline-item:not(:last-child)::after {
          content: '';
          position: absolute;
          left: 5px;
          top: 14px;
          bottom: -18px;
          width: 2px;
          background: var(--color-border);
        }
        .rh-timeline-badge {
          width: 12px;
          height: 12px;
          border-radius: 99px;
          background: var(--color-border-strong);
          margin-top: 4px;
          flex-shrink: 0;
          border: 2px solid #fff;
          z-index: 2;
        }
        .rh-timeline-badge.confirmed { background: var(--color-info); }
        .rh-timeline-badge.info { background: var(--color-warning); }
        .rh-timeline-badge.active { background: var(--color-success); }
        .rh-timeline-info {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }
        .rh-timeline-title {
          font-size: 12.5px;
          font-weight: 700;
          color: var(--color-text-1);
        }
        .rh-timeline-time {
          font-size: 11px;
          color: var(--color-text-3);
          font-weight: 600;
        }
        .rh-timeline-desc {
          font-size: 11px;
          color: var(--color-text-2);
          margin-top: 2px;
        }

        /* Drawer Footer & Actions */
        .rh-drawer-footer {
          padding: 1.5rem;
          border-top: 1px solid var(--color-border);
          background: var(--color-bg);
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .rh-actions-heading {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          color: var(--color-text-3);
          letter-spacing: 0.05em;
        }
        .rh-actions-buttons {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .rh-action-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border: 1px solid transparent;
          border-radius: 8px;
          font-size: 12.5px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s ease;
          font-family: inherit;
        }
        .rh-action-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .rh-action-btn.seat {
          background: var(--color-success);
          color: #ffffff;
        }
        .rh-action-btn.seat:hover:not(:disabled) {
          background: #15803d;
        }
        .rh-action-btn.noshow {
          background: #fef3c7;
          border-color: #fde68a;
          color: #b45309;
        }
        .rh-action-btn.noshow:hover:not(:disabled) {
          background: #fde68a;
        }
        .rh-action-btn.cancel {
          background: #fee2e2;
          border-color: #fca5a5;
          color: #b91c1c;
        }
        .rh-action-btn.cancel:hover:not(:disabled) {
          background: #fca5a5;
        }
        .rh-action-btn.complete {
          background: var(--color-info);
          color: #ffffff;
        }
        .rh-action-btn.complete:hover:not(:disabled) {
          background: #1d4ed8;
        }
        .rh-finalized-msg {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          color: var(--color-text-3);
          background: rgba(0,2,29,0.03);
          padding: 8px 12px;
          border-radius: 8px;
          width: 100%;
        }

        /* Pager & pagination styles */
        .rh-pager { display: flex; align-items: center; justify-content: space-between; padding: 4px 4px; flex-wrap: wrap; gap: 10px; }
        .rh-pager-info { font-size: 12.5px; font-weight: 600; color: var(--color-text-3); }
        .rh-pager-btns { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
        .rh-pager-btns button, .rh-page-num { display: inline-flex; align-items: center; justify-content: center; height: 34px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--color-border-strong); background: #fff; font-size: 13px; font-weight: 700; color: var(--color-text-2); cursor: pointer; transition: all .15s; }
        .rh-pager-btns button:hover:not(:disabled), .rh-page-num:hover:not(.active) { border-color: var(--color-primary); color: var(--color-primary); }
        .rh-pager-btns button:disabled { opacity: .4; cursor: not-allowed; }
        .rh-page-num.active {
          background: var(--color-primary);
          color: #ffffff;
          border-color: var(--color-primary);
        }
        .rh-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; min-height: 260px; color: var(--color-text-3); font-size: 13px; background: #fff; border: 1px solid var(--color-border); border-radius: var(--radius-xl); }
      `}</style>
    </div>
  )
}
