'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { format } from 'date-fns'
import type { PageResponse, Visit, VisitSummary } from '@/types/api'
import toast from 'react-hot-toast'
import GSAPDropdown from '@/components/ui/GSAPDropdown'
import LiveBadge from '@/components/ui/LiveBadge'
import { useCrmStream } from '@/hooks/useCrmStream'
import gsap from 'gsap'
import {
  Users, Phone as PhoneIcon, X, Calendar, Clock, Sparkles,
  AlertCircle, Mail, MapPin, Smartphone, User, ArrowUpDown,
  ChevronLeft, ChevronRight, Inbox, HelpCircle, Search, UserCheck
} from 'lucide-react'

function useDebounce<T>(value: T, delay: number): T {
  const [dv, setDv] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDv(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return dv
}

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

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(' ')
  const ini = (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')
  return (
    <div className="vp-avatar">
      {ini.toUpperCase()}
    </div>
  )
}

function getIstDateStr(offsetDays = 0): string {
  // India Standard Time (IST) offset is UTC+5:30.
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

export default function VisitsPage() {
  const { user, isOwnerOrAbove } = useAuth()
  const searchParams = useSearchParams()

  const [visits, setVisits]   = useState<Visit[]>([])
  const [summary, setSummary] = useState<VisitSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [live, setLive]       = useState(false)
  const [page, setPage]       = useState(0)
  const [total, setTotal]     = useState(0)

  // Filters
  const [search, setSearch]     = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')
  const [activePreset, setActivePreset] = useState('Custom')
  const [sortDir, setSortDir]   = useState<'asc' | 'desc'>('desc')

  // Drawer
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null)
  const [drawerVisit, setDrawerVisit] = useState<Visit | null>(null)

  const [outletId] = useState(() => searchParams.get('outletId') ?? '')
  const debouncedSearch = useDebounce(search, 400)

  const overlayRef = useRef<HTMLDivElement>(null)
  const drawerRef = useRef<HTMLDivElement>(null)

  const buildQuery = useCallback(() => {
    // Locked type to 'qr_scan' so that payments are completely omitted!
    const q = new URLSearchParams({ page: page.toString(), size: '20', sortDir, type: 'qr_scan' })
    if (debouncedSearch) q.append('search', debouncedSearch)
    if (dateFrom) q.append('dateFrom', dateFrom)
    if (dateTo)   q.append('dateTo', dateTo)
    if (outletId) q.append('outletId', outletId)
    return q.toString()
  }, [page, debouncedSearch, dateFrom, dateTo, outletId, sortDir])

  const fetchVisits = useCallback(async (opts?: { silent?: boolean }) => {
    if (!user) return
    if (!opts?.silent) setLoading(true)
    try {
      const q = buildQuery()
      const [visRes, sumRes] = await Promise.all([
        api.get<PageResponse<Visit>>(`/cms/visits?${q}`),
        api.get<VisitSummary>(`/cms/visits/summary?${q}`),
      ])
      setVisits(visRes.data.content)
      setTotal(visRes.data.totalElements)
      setSummary(sumRes.data)
    } catch {
      setVisits([])
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [user, buildQuery])

  useEffect(() => { fetchVisits() }, [fetchVisits])
  useEffect(() => { setPage(0) }, [debouncedSearch, dateFrom, dateTo, sortDir])

  // Live updates — silently refresh when a new visit is recorded anywhere.
  useCrmStream(['visit'], () => fetchVisits({ silent: true }), { outletId: outletId || undefined, onLive: setLive })

  // GSAP Minimal Animations on load
  useEffect(() => {
    if (!loading && visits.length > 0) {
      gsap.killTweensOf('.vp-metrics-grid, .vp-table-wrap')
      
      gsap.fromTo('.vp-metrics-grid, .vp-table-wrap',
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' }
      )
    }
  }, [loading, visits])

  const hasFilters = !!dateFrom || !!dateTo || !!debouncedSearch
  
  const clearFilters = () => { 
    setSearch('')
    setDateFrom('')
    setDateTo('')
    setSortDir('desc') 
    setActivePreset('Custom')
  }

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
    if (selectedVisit) {
      setDrawerVisit(selectedVisit)
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
  }, [selectedVisit])

  const closeDrawer = () => {
    if (overlayRef.current && drawerRef.current) {
      gsap.killTweensOf([overlayRef.current, drawerRef.current])
      gsap.to(overlayRef.current, { opacity: 0, duration: 0.2, ease: 'power2.in' })
      gsap.to(drawerRef.current, {
        x: '100%',
        duration: 0.25,
        ease: 'power3.in',
        onComplete: () => {
          setSelectedVisit(null)
          setDrawerVisit(null)
        }
      })
    } else {
      setSelectedVisit(null)
      setDrawerVisit(null)
    }
  }

  const totalPages = Math.ceil(total / 20)

  // KPI Calculations based on currently loaded rows
  const kpis = {
    total: summary?.qrScans ?? total,
    conversionRate: 0,
    repeatRate: 0,
    anonymousRate: 0,
  }

  if (visits.length > 0) {
    const convertedVisits = visits.filter(v => v.converted).length
    const repeatVisits = visits.filter(v => v.converted && v.isRepeatVisitor).length
    const anonymousVisits = visits.filter(v => !v.converted).length

    kpis.conversionRate = Math.round((convertedVisits / visits.length) * 100)
    kpis.repeatRate = convertedVisits > 0 ? Math.round((repeatVisits / convertedVisits) * 100) : 0
    kpis.anonymousRate = Math.round((anonymousVisits / visits.length) * 100)
  }

  // Numbered pagination renderer
  const renderPageNumbers = () => {
    const pages = []
    const maxButtons = 5
    let startPage = Math.max(0, page - 2)
    let endPage = Math.min(totalPages - 1, startPage + maxButtons - 1)
    
    if (endPage - startPage < maxButtons - 1) {
      startPage = Math.max(0, endPage - maxButtons + 1)
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <button 
          key={i} 
          className={`vp-page-num ${i === page ? 'active' : ''}`}
          onClick={() => setPage(i)}
          disabled={loading}
        >
          {i + 1}
        </button>
      )
    }
    return pages
  }

  return (
    <div className="vp-page">
      {/* Header Panel */}
      <div className="vp-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 className="vp-title">Guest Visits</h1>
            <LiveBadge live={live} />
          </div>
          <p className="vp-sub">
            {outletId ? 'Filtered by outlet — ' : ''}
            {total > 0 && !loading
              ? `${total.toLocaleString()} QR scan visits recorded`
              : isOwnerOrAbove ? 'All outlet QR scan activity' : `Visits · ${user?.assignedOutletName}`}
          </p>
        </div>
        
        {/* Search */}
        <div className="vp-search-wrap">
          <input
            className="vp-search-input"
            placeholder="Search customer by name/phone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <Search size={15} className="vp-search-icon" />
          {search && (
            <button className="vp-search-clear" onClick={() => setSearch('')}>
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* KPI Metrics Section */}
      <div className="vp-metrics-grid">
        <div className="vp-metric-card">
          <div className="vp-metric-icon" style={{ background: 'rgba(214, 66, 56, 0.05)', color: 'var(--color-primary)' }}>
            <Calendar size={18} />
          </div>
          <div>
            <div className="vp-metric-label">Total Visits</div>
            <div className="vp-metric-value">
              <AnimatedCounter value={kpis.total} />
            </div>
            <div className="vp-metric-sub">QR Scans count</div>
          </div>
        </div>

        <div className="vp-metric-card">
          <div className="vp-metric-icon" style={{ background: 'rgba(214, 66, 56, 0.05)', color: 'var(--color-primary)' }}>
            <UserCheck className="w-5 h-5" size={18} />
          </div>
          <div>
            <div className="vp-metric-label">Conversion Rate</div>
            <div className="vp-metric-value">
              <AnimatedCounter value={kpis.conversionRate} suffix="%" />
            </div>
            <div className="vp-metric-sub">Page profile linking</div>
          </div>
        </div>

        <div className="vp-metric-card">
          <div className="vp-metric-icon" style={{ background: 'rgba(214, 66, 56, 0.05)', color: 'var(--color-primary)' }}>
            <Sparkles size={18} />
          </div>
          <div>
            <div className="vp-metric-label">Repeat Rate</div>
            <div className="vp-metric-value">
              <AnimatedCounter value={kpis.repeatRate} suffix="%" />
            </div>
            <div className="vp-metric-sub">Page returning guests</div>
          </div>
        </div>

        <div className="vp-metric-card">
          <div className="vp-metric-icon" style={{ background: 'rgba(214, 66, 56, 0.05)', color: 'var(--color-primary)' }}>
            <Inbox size={18} />
          </div>
          <div>
            <div className="vp-metric-label">Anonymous Scans</div>
            <div className="vp-metric-value">
              <AnimatedCounter value={kpis.anonymousRate} suffix="%" />
            </div>
            <div className="vp-metric-sub">Page non-converted rate</div>
          </div>
        </div>
      </div>

      {/* Advanced Filters Card */}
      <div className="vp-filters-card">
        {/* Presets Row */}
        <div className="vp-presets-row">
          <span className="vp-presets-label">Date Presets:</span>
          <div className="vp-presets-list">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                className={`vp-preset-btn ${activePreset === p.label ? 'active' : ''}`}
                onClick={() => handlePresetClick(p.label, p.getValue)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filters Inputs */}
        <div className="vp-filters-inputs">
          <label className="vp-field">
            <span>From</span>
            <input 
              type="date" 
              className="vp-input" 
              value={dateFrom} 
              max={dateTo || undefined} 
              onChange={(e) => {
                setDateFrom(e.target.value)
                setActivePreset('Custom')
              }} 
            />
          </label>

          <label className="vp-field">
            <span>To</span>
            <input 
              type="date" 
              className="vp-input" 
              value={dateTo} 
              min={dateFrom || undefined} 
              onChange={(e) => {
                setDateTo(e.target.value)
                setActivePreset('Custom')
              }} 
            />
          </label>

          <div className="vp-field">
            <span>Sort Order</span>
            <GSAPDropdown
              value={sortDir}
              onChange={(val) => setSortDir(val as 'asc' | 'desc')}
              options={[
                { value: 'desc', label: 'Newest First' },
                { value: 'asc', label: 'Oldest First' }
              ]}
              width="145px"
            />
          </div>

          {hasFilters && (
            <button className="vp-clear" onClick={clearFilters}>
              <X size={13} /> Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Table Content */}
      {loading && (
        <div className="vp-loading-skeleton">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="vp-skeleton-row" />
          ))}
        </div>
      )}

      {!loading && visits.length === 0 && (
        <div className="vp-empty">
          <div className="vp-empty-icon"><Calendar size={32} strokeWidth={1.5} /></div>
          <h3 className="vp-empty-title">No visits found</h3>
          <p className="vp-empty-desc">
            {hasFilters ? 'Try adjusting your date filters or search parameters.' : 'Customer QR scans will appear here when they view the menu.'}
          </p>
          {hasFilters && (
            <button className="vp-btn-ghost-small" onClick={clearFilters}>
              Clear all filters
            </button>
          )}
        </div>
      )}

      {!loading && visits.length > 0 && (
        <>
          <div className="vp-table-wrap">
            <table className="vp-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Status</th>
                  {isOwnerOrAbove && <th>Outlet</th>}
                  <th>Type</th>
                  <th>Visited At (IST)</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visits.map(v => (
                  <tr key={v.id} className="vp-row-clickable" onClick={() => setSelectedVisit(v)}>
                    <td>
                      {v.converted && v.customerId ? (
                        <Link 
                          href={`/customers/${v.customerId}`} 
                          onClick={(e) => e.stopPropagation()} 
                          className="vp-customer-link"
                        >
                          <Initials name={v.customer?.fullName ?? ''} />
                          <div>
                            <div className="vp-customer-name">{v.customer?.fullName}</div>
                            <div className="vp-customer-phone">{v.customer?.phone}</div>
                          </div>
                        </Link>
                      ) : (
                        <div className="vp-anonymous-row">
                          <div className="vp-anonymous-avatar">?</div>
                          <div>
                            <div className="vp-anonymous-name">Anonymous Visitor</div>
                            <div className="vp-anonymous-desc">Scanned QR, no guest form submitted</div>
                          </div>
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`vp-status-badge ${
                        !v.converted 
                          ? 'anonymous' 
                          : v.isRepeatVisitor 
                            ? 'repeat' 
                            : 'converted'
                      }`}>
                        <span className="vp-status-dot" />
                        {!v.converted ? 'Anonymous' : v.isRepeatVisitor ? 'Repeat Customer' : 'New Guest'}
                      </span>
                    </td>
                    {isOwnerOrAbove && (
                      <td>
                        <span className="vp-outlet-pill">
                          {v.outlet?.code ?? '—'}
                        </span>
                      </td>
                    )}
                    <td>
                      <span className="vp-type-badge">
                        QR Scan
                      </span>
                    </td>
                    <td className="vp-time-cell">
                      {format(new Date(v.visitedAt), 'dd MMM yy, hh:mm a')}
                    </td>
                    <td>
                      <button 
                        className="vp-details-btn" 
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedVisit(v)
                        }}
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="vp-pager">
              <span className="vp-pager-info">
                Showing {page * 20 + 1} to {Math.min((page + 1) * 20, total)} of {total.toLocaleString()} visits
              </span>
              <div className="vp-pager-btns">
                <button disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft size={15} /> Prev
                </button>
                {renderPageNumbers()}
                <button disabled={page + 1 >= totalPages} onClick={() => setPage(p => p + 1)}>
                  Next <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Guest Visit Detail Drawer */}
      {drawerVisit && (
        <>
          <div ref={overlayRef} className="vp-drawer-backdrop" onClick={closeDrawer} />
          <div ref={drawerRef} className="vp-drawer-content">
            <div className="vp-drawer-header">
              <div>
                <h2 className="vp-drawer-title">Visit Session Details</h2>
                <div className="vp-drawer-subtitle">ID: {drawerVisit.id.slice(0, 18)}...</div>
              </div>
              <button className="vp-drawer-close" onClick={closeDrawer}>
                <X size={20} />
              </button>
            </div>

            <div className="vp-drawer-body">
              {/* Scan Status Banner */}
              <div className={`vp-drawer-banner ${
                !drawerVisit.converted 
                  ? 'anonymous' 
                  : drawerVisit.isRepeatVisitor 
                    ? 'repeat' 
                    : 'converted'
              }`}>
                <div className="vp-drawer-banner-dot" />
                <span>
                  Visitor Status: <strong>
                    {!drawerVisit.converted 
                      ? 'Anonymous Session' 
                      : drawerVisit.isRepeatVisitor 
                        ? 'Returning Repeat Guest' 
                        : 'New Profile Converted'}
                  </strong>
                </span>
              </div>

              {/* Guest Profile Section */}
              <div className="vp-drawer-section">
                <h3 className="vp-section-heading">Visitor Identity</h3>
                {drawerVisit.converted && drawerVisit.customerId ? (
                  <div className="vp-guest-profile-card">
                    <Initials name={drawerVisit.customer?.fullName ?? ''} />
                    <div>
                      <h4 className="vp-profile-name">{drawerVisit.customer?.fullName}</h4>
                      <div className="vp-profile-details">
                        <a href={`tel:${drawerVisit.customer?.phone}`} className="vp-profile-link">
                          <PhoneIcon size={11} /> {drawerVisit.customer?.phone}
                        </a>
                        <Link 
                          href={`/customers/${drawerVisit.customerId}`} 
                          className="vp-profile-view-link"
                          onClick={closeDrawer}
                        >
                          View Full CRM Profile →
                        </Link>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="vp-anonymous-profile-card">
                    <div className="vp-anonymous-profile-avatar">?</div>
                    <div>
                      <h4 className="vp-anonymous-profile-title">Anonymous Session</h4>
                      <p className="vp-anonymous-profile-desc">
                        The customer scanned the QR code to browse the menu, but did not submit their guest verification name and phone form.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Session Information */}
              <div className="vp-drawer-section">
                <h3 className="vp-section-heading">Session Parameters</h3>
                <div className="vp-details-grid">
                  <div className="vp-detail-item">
                    <span className="vp-detail-label">Scanned Date</span>
                    <span className="vp-detail-value">{format(new Date(drawerVisit.visitedAt), 'dd MMMM yyyy')}</span>
                  </div>
                  <div className="vp-detail-item">
                    <span className="vp-detail-label">Scanned Time (IST)</span>
                    <span className="vp-detail-value">{format(new Date(drawerVisit.visitedAt), 'hh:mm:ss a')}</span>
                  </div>
                  <div className="vp-detail-item">
                    <span className="vp-detail-label">Visit Type</span>
                    <span className="vp-detail-value">Menu QR Scan</span>
                  </div>
                  {drawerVisit.outlet && (
                    <>
                      <div className="vp-detail-item">
                        <span className="vp-detail-label">Outlet Name</span>
                        <span className="vp-detail-value">{drawerVisit.outlet.name}</span>
                      </div>
                      <div className="vp-detail-item">
                        <span className="vp-detail-label">Outlet Code</span>
                        <span className="vp-detail-value">{drawerVisit.outlet.code}</span>
                      </div>
                    </>
                  )}
                  {drawerVisit.deviceId && (
                    <div className="vp-detail-item" style={{ gridColumn: 'span 2' }}>
                      <span className="vp-detail-label">Device Identifier (UUID)</span>
                      <span className="vp-detail-value" style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 500 }}>
                        {drawerVisit.deviceId}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Operational Guide Info */}
              <div className="vp-drawer-section">
                <h3 className="vp-section-heading">Operational Context</h3>
                <div className="vp-context-box">
                  <HelpCircle size={15} style={{ flexShrink: 0, color: 'var(--color-primary)' }} />
                  <div>
                    <strong style={{ fontSize: 12.5, color: 'var(--color-text-1)', display: 'block', marginBottom: 2 }}>QR Scan visits</strong>
                    <p style={{ fontSize: 11.5, color: 'var(--color-text-2)', lineHeight: 1.5 }}>
                      When a guest sits down at a restaurant table and scans the table QR code with their mobile device, this starts a visit session. 
                      If they complete the guest form, it registers as "New Guest" or "Repeat Customer". If they browse without submitting, it remains "Anonymous".
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="vp-drawer-footer">
              <button className="vp-drawer-footer-close-btn" onClick={closeDrawer}>
                Close Details
              </button>
            </div>
          </div>
        </>
      )}

      {/* Page styling block overrides */}
      <style>{`
        .vp-page { 
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

        .vp-header { 
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
        .vp-title { font-size: 1.4rem; font-weight: 800; color: var(--color-text-1); letter-spacing: -0.02em; margin: 0; }
        .vp-sub { font-size: 13px; color: var(--color-text-3); margin: 2px 0 0; }

        /* Search Input */
        .vp-search-wrap {
          position: relative;
          min-width: 280px;
        }
        .vp-search-input {
          width: 100%;
          background: #ffffff;
          border: 1px solid var(--color-border-strong);
          border-radius: var(--radius-md);
          padding: 9px 12px 9px 36px;
          font-size: 13px;
          font-weight: 500;
          color: var(--color-text-1);
          outline: none;
          transition: all 0.2s;
        }
        .vp-search-input:focus {
          border-color: var(--color-primary);
          box-shadow: 0 0 0 3px var(--color-primary-dim);
        }
        .vp-search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--color-text-3);
          pointer-events: none;
        }
        .vp-search-clear {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          border: none;
          background: transparent;
          color: var(--color-text-3);
          cursor: pointer;
          padding: 2px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .vp-search-clear:hover {
          color: var(--color-text-1);
        }

        /* Metrics Dashboard Grid */
        .vp-metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
        }
        .vp-metric-card {
          background: #ffffff;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: 1.25rem;
          display: flex;
          align-items: center;
          gap: 1rem;
          transition: all 0.2s ease;
          box-shadow: 0 1px 3px rgba(0,2,29,0.02);
        }
        .vp-metric-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(214, 66, 56, 0.04);
          border-color: var(--color-primary);
        }
        .vp-metric-icon {
          width: 42px;
          height: 42px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .vp-metric-label {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          color: var(--color-text-3);
          letter-spacing: 0.05em;
        }
        .vp-metric-value {
          font-size: 20px;
          font-weight: 800;
          color: var(--color-text-1);
          margin-top: 2px;
          line-height: 1.1;
        }
        .vp-metric-sub {
          font-size: 11px;
          color: var(--color-text-3);
          margin-top: 2px;
        }

        /* Filters Card */
        .vp-filters-card {
          background: #fff;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-xl);
          padding: 1.25rem 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
          box-shadow: 0 1px 3px rgba(0,2,29,0.02);
        }
        .vp-presets-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
          border-bottom: 1px solid var(--color-border);
          padding-bottom: 0.75rem;
        }
        .vp-presets-label {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          color: var(--color-text-3);
          letter-spacing: 0.05em;
        }
        .vp-presets-list {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .vp-preset-btn {
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
        .vp-preset-btn:hover {
          border-color: var(--color-text-3);
          color: var(--color-text-1);
        }
        .vp-preset-btn.active {
          background: var(--color-primary-dim);
          border-color: var(--color-primary);
          color: var(--color-primary);
        }

        .vp-filters-inputs { display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap; }
        .vp-field { display: flex; flex-direction: column; gap: 5px; }
        .vp-field > span { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-3); }
        .vp-input { background: #fff; border: 1px solid var(--color-border-strong); border-radius: 8px; padding: 8px 12px; font-size: 13px; font-weight: 500; color: var(--color-text-1); transition: all .2s; }
        .vp-input:focus { outline: none; border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--color-primary-dim); }
        .vp-clear { display: inline-flex; align-items: center; gap: 5px; height: 38px; padding: 0 12px; border-radius: 8px; border: 1px solid transparent; background: rgba(0,2,29,0.03); font-size: 12.5px; font-weight: 700; color: var(--color-text-2); cursor: pointer; }
        .vp-clear:hover { background: rgba(0,2,29,0.06); }

        /* Loading Skeleton */
        .vp-loading-skeleton { display: flex; flex-direction: column; gap: 8px; }
        .vp-skeleton-row { height: 56px; background: #fff; border: 1px solid var(--color-border); border-radius: 8px; animation: vp-pulse 1.5s infinite ease-in-out; }
        @keyframes vp-pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 0.95; } }

        /* Empty State */
        .vp-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; min-height: 280px; text-align: center; background: #fff; border: 1px solid var(--color-border); border-radius: var(--radius-xl); padding: 2rem; }
        .vp-empty-icon { color: var(--color-text-3); opacity: 0.65; margin-bottom: 6px; }
        .vp-empty-title { font-size: 15px; font-weight: 700; color: var(--color-text-1); }
        .vp-empty-desc { font-size: 13px; color: var(--color-text-3); max-width: 320px; line-height: 1.5; }
        .vp-btn-ghost-small { margin-top: 10px; padding: 6px 12px; font-size: 12.5px; font-weight: 600; border: 1px solid var(--color-border-strong); background: transparent; color: var(--color-text-2); border-radius: 6px; cursor: pointer; }
        .vp-btn-ghost-small:hover { border-color: var(--color-primary); color: var(--color-primary); }

        /* Table Design */
        .vp-table-wrap { background: #fff; border: 1px solid var(--color-border); border-radius: var(--radius-xl); overflow-x: auto; box-shadow: 0 1px 3px rgba(0,2,29,0.02); }
        .vp-table { width: 100%; border-collapse: collapse; font-size: 13px; min-width: 800px; }
        .vp-table thead th { text-align: left; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-3); padding: 14px 16px; border-bottom: 1px solid var(--color-border); background: #fcfcfb; }
        .vp-table tbody td { padding: 12px 16px; border-bottom: 1px solid var(--color-border); color: var(--color-text-2); vertical-align: middle; }
        .vp-table tbody tr:last-child td { border-bottom: none; }
        .vp-row-clickable { cursor: pointer; transition: background 0.12s; }
        .vp-row-clickable:hover { background: #fcfcfb; }

        /* Customer Row Styles */
        .vp-customer-link { text-decoration: none; display: flex; align-items: center; gap: 10px; width: fit-content; }
        .vp-avatar { width: 34px; height: 34px; border-radius: 99px; background: var(--color-primary-dim); border: 1px solid var(--color-primary-border); display: flex; align-items: center; justify-content: center; fontSize: 12px; fontWeight: 700; color: var(--color-primary); text-transform: uppercase; flex-shrink: 0; }
        .vp-customer-name { font-weight: 700; color: var(--color-primary); font-size: 13.5px; }
        .vp-customer-phone { font-size: 11px; color: var(--color-text-3); margin-top: 1px; }

        /* Anonymous Row Styles */
        .vp-anonymous-row { display: flex; align-items: center; gap: 10px; }
        .vp-anonymous-avatar { width: 34px; height: 34px; border-radius: 99px; background: rgba(0,2,29,0.04); border: 1px solid var(--color-border-strong); display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; color: var(--color-text-3); flex-shrink: 0; }
        .vp-anonymous-name { font-weight: 600; color: var(--color-text-2); font-size: 13.5px; }
        .vp-anonymous-desc { font-size: 11px; color: var(--color-text-3); margin-top: 1px; }

        /* Badges & Pills */
        .vp-status-badge { display: inline-flex; align-items: center; gap: 6px; padding: 3px 9px; border-radius: 99px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.02em; }
        .vp-status-dot { width: 6px; height: 6px; border-radius: 99px; flex-shrink: 0; }
        .vp-status-badge.anonymous { background: rgba(0,2,29,0.04); color: var(--color-text-3); }
        .vp-status-badge.anonymous .vp-status-dot { background: var(--color-text-3); }
        .vp-status-badge.repeat { background: #fffbeb; color: #d97706; border: 1px solid #fef3c7; }
        .vp-status-badge.repeat .vp-status-dot { background: #d97706; }
        .vp-status-badge.converted { background: #f0fdf4; color: #16a34a; border: 1px solid #dcfce7; }
        .vp-status-badge.converted .vp-status-dot { background: #16a34a; }

        .vp-outlet-pill { display: inline-flex; padding: 2px 8px; border-radius: 99px; font-size: 11px; font-weight: 700; background: rgba(0,2,29,0.04); color: var(--color-text-2); border: 1px solid var(--color-border); }
        .vp-type-badge { display: inline-flex; padding: 2.5px 8.5px; border-radius: 99px; font-size: 11px; font-weight: 700; background: #eff6ff; color: #1d4ed8; border: 1px solid #dbeafe; }
        .vp-time-cell { font-size: 12.5px; color: var(--color-text-2); font-weight: 500; }
        
        .vp-details-btn {
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
        .vp-row-clickable:hover .vp-details-btn {
          border-color: var(--color-primary);
          color: var(--color-primary);
          background: var(--color-primary-dim);
        }

        /* Numbered Pager */
        .vp-pager { display: flex; align-items: center; justify-content: space-between; padding: 4px 4px; flex-wrap: wrap; gap: 10px; }
        .vp-pager-info { font-size: 12.5px; font-weight: 600; color: var(--color-text-3); }
        .vp-pager-btns { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
        .vp-pager-btns button, .vp-page-num { display: inline-flex; align-items: center; justify-content: center; height: 34px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--color-border-strong); background: #fff; font-size: 13px; font-weight: 700; color: var(--color-text-2); cursor: pointer; transition: all .15s; }
        .vp-pager-btns button:hover:not(:disabled), .vp-page-num:hover:not(.active) { border-color: var(--color-primary); color: var(--color-primary); }
        .vp-pager-btns button:disabled { opacity: .4; cursor: not-allowed; }
        .vp-page-num.active { background: var(--color-primary); color: #ffffff; border-color: var(--color-primary); }

        /* Drawer Details Layout */
        .vp-drawer-backdrop { position: fixed; inset: 0; background: rgba(0, 2, 29, 0.4); backdrop-filter: blur(4px); z-index: 1000; }
        .vp-drawer-content { position: fixed; top: 0; right: 0; bottom: 0; width: 460px; max-width: 100vw; background: #ffffff; box-shadow: -8px 0 35px rgba(0, 2, 29, 0.12); z-index: 1001; display: flex; flex-direction: column; }
        .vp-drawer-header { padding: 1.5rem; border-bottom: 1px solid var(--color-border); display: flex; justify-content: space-between; align-items: center; }
        .vp-drawer-title { font-size: 1.25rem; font-weight: 800; color: var(--color-text-1); margin: 0; letter-spacing: -0.01em; }
        .vp-drawer-subtitle { font-size: 12px; font-weight: 600; color: var(--color-text-3); margin-top: 2px; }
        .vp-drawer-close { border: none; background: transparent; color: var(--color-text-3); cursor: pointer; padding: 6px; border-radius: 99px; display: flex; align-items: center; justify-content: center; transition: all 0.15s ease; }
        .vp-drawer-close:hover { background: rgba(0,2,29,0.05); color: var(--color-text-1); }
        .vp-drawer-body { padding: 1.5rem; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 1.5rem; }
        
        .vp-drawer-banner { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: var(--radius-md); font-size: 13px; border: 1px solid transparent; }
        .vp-drawer-banner-dot { width: 8px; height: 8px; border-radius: 99px; }
        .vp-drawer-banner.anonymous { background: rgba(0,2,29,0.04); color: var(--color-text-3); border-color: var(--color-border); }
        .vp-drawer-banner.anonymous .vp-drawer-banner-dot { background: var(--color-text-3); }
        .vp-drawer-banner.repeat { background: #fffbeb; color: #d97706; border-color: #fef3c7; }
        .vp-drawer-banner.repeat .vp-drawer-banner-dot { background: #d97706; }
        .vp-drawer-banner.converted { background: #f0fdf4; color: #16a34a; border-color: #dcfce7; }
        .vp-drawer-banner.converted .vp-drawer-banner-dot { background: #16a34a; }

        .vp-drawer-section { display: flex; flex-direction: column; gap: 0.75rem; }
        .vp-section-heading { font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--color-text-3); letter-spacing: 0.06em; border-bottom: 1px solid var(--color-border); padding-bottom: 4px; }
        
        /* Guest Profile Card in Drawer */
        .vp-guest-profile-card { display: flex; align-items: center; gap: 1rem; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: 1rem; }
        .vp-profile-name { font-size: 15px; font-weight: 700; color: var(--color-text-1); margin: 0; }
        .vp-profile-details { display: flex; flex-direction: column; gap: 3px; margin-top: 4px; }
        .vp-profile-link { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--color-text-2); text-decoration: none; font-weight: 600; }
        .vp-profile-link:hover { color: var(--color-primary); }
        .vp-profile-view-link { font-size: 12px; color: var(--color-primary); font-weight: 700; text-decoration: none; display: inline-block; margin-top: 2px; }
        .vp-profile-view-link:hover { text-decoration: underline; }

        /* Anonymous Profile Card in Drawer */
        .vp-anonymous-profile-card { display: flex; gap: 1rem; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: 1rem; }
        .vp-anonymous-profile-avatar { width: 42px; height: 42px; border-radius: 99px; background: rgba(0,2,29,0.06); border: 1px solid var(--color-border-strong); display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 800; color: var(--color-text-3); flex-shrink: 0; }
        .vp-anonymous-profile-title { font-size: 14.5px; font-weight: 700; color: var(--color-text-1); margin: 0; }
        .vp-anonymous-profile-desc { font-size: 12px; color: var(--color-text-3); margin-top: 4px; line-height: 1.5; }

        /* Details Grid in Drawer */
        .vp-details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem 1rem; }
        .vp-detail-item { display: flex; flex-direction: column; gap: 2px; }
        .vp-detail-label { font-size: 11px; color: var(--color-text-3); font-weight: 600; }
        .vp-detail-value { font-size: 13px; color: var(--color-text-1); font-weight: 700; }

        /* Context Box */
        .vp-context-box { display: flex; gap: 10px; background: rgba(0,2,29,0.015); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: 1rem; }

        .vp-drawer-footer { padding: 1.25rem 1.5rem; border-top: 1px solid var(--color-border); background: var(--color-bg); }
        .vp-drawer-footer-close-btn { width: 100%; display: flex; align-items: center; justify-content: center; height: 40px; border-radius: 8px; border: 1px solid var(--color-border-strong); background: #ffffff; font-size: 13px; font-weight: 700; color: var(--color-text-1); cursor: pointer; transition: all 0.15s ease; }
        .vp-drawer-footer-close-btn:hover { background: #fafaf9; border-color: var(--color-text-3); }
      `}</style>
    </div>
  )
}
