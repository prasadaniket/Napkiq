'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { format, differenceInDays } from 'date-fns'
import ExportModal from '@/components/export/ExportModal'
import type { Customer, Review, PageResponse, CustomerSummary } from '@/types/api'
import GSAPDropdown from '@/components/ui/GSAPDropdown'
import LiveBadge from '@/components/ui/LiveBadge'
import { useCrmStream } from '@/hooks/useCrmStream'
import gsap from 'gsap'
import {
  Users, Phone as PhoneIcon, X, Calendar, Clock, Sparkles,
  AlertCircle, Mail, MapPin, User, ChevronLeft, ChevronRight,
  Inbox, HelpCircle, Star, Quote, MessageSquare, Grid, List,
  Download, ArrowRight, UserCheck, ShieldAlert, Search, Activity
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
    <div className="cu-avatar">
      {ini.toUpperCase()}
    </div>
  )
}

const SENTIMENT_META: Record<string, { label: string; emoji: string; color: string; bg: string }> = {
  positive: { label: 'Positive', emoji: '😊', color: '#16a34a', bg: '#f0fdf4' },
  neutral:  { label: 'Neutral',  emoji: '😐', color: '#475569', bg: '#f8fafc' },
  mixed:    { label: 'Mixed',    emoji: '🤔', color: '#ea580c', bg: '#fff7ed' },
  negative: { label: 'Negative', emoji: '😞', color: '#dc2626', bg: '#fef2f2' },
}

function starBadgeStyle(stars: number) {
  if (stars >= 4) return { color: '#16a34a', bg: '#f0fdf4' }
  if (stars === 3) return { color: '#d97706', bg: '#fffbeb' }
  return { color: '#dc2626', bg: '#fef2f2' }
}

export default function CustomersPage() {
  const { isAdmin, isOwnerOrAbove } = useAuth()
  const searchParams = useSearchParams()

  const [customers, setCustomers] = useState<Customer[]>([])
  const [summary, setSummary] = useState<CustomerSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [live, setLive] = useState(false)
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')

  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [showExport, setShowExport] = useState(false)

  // Filters
  const [search, setSearch] = useState('')
  const [inactive, setInactive] = useState(false)
  const [gender, setGender] = useState('')
  const [hasReview, setHasReview] = useState('')
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // Drawer
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [drawerCustomer, setDrawerCustomer] = useState<Customer | null>(null)
  const [customerReviews, setCustomerReviews] = useState<Review[]>([])
  const [reviewsLoading, setReviewsLoading] = useState(false)

  const [outletId] = useState(() => searchParams.get('outletId') ?? '')
  const debouncedSearch = useDebounce(search, 400)

  const overlayRef = useRef<HTMLDivElement>(null)
  const drawerRef = useRef<HTMLDivElement>(null)

  const fetchCustomers = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    try {
      const q = new URLSearchParams({ page: page.toString(), size: '20', sortBy, sortDir })
      if (debouncedSearch) q.append('search', debouncedSearch)
      if (inactive)   q.append('inactive', 'true')
      if (gender)     q.append('gender', gender)
      if (hasReview)  q.append('hasReview', hasReview)
      if (outletId)   q.append('outletId', outletId)

      // Summary shares the same filters but no pagination/sort.
      const sq = new URLSearchParams()
      if (debouncedSearch) sq.append('search', debouncedSearch)
      if (inactive)   sq.append('inactive', 'true')
      if (gender)     sq.append('gender', gender)
      if (hasReview)  sq.append('hasReview', hasReview)
      if (outletId)   sq.append('outletId', outletId)

      const [listRes, sumRes] = await Promise.all([
        api.get<PageResponse<Customer>>(`/cms/customers?${q}`),
        api.get<CustomerSummary>(`/cms/customers/summary?${sq}`),
      ])
      setCustomers(listRes.data.content)
      setTotal(listRes.data.totalElements)
      setSummary(sumRes.data)
    } catch {
      setCustomers([])
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [page, debouncedSearch, inactive, gender, hasReview, sortBy, sortDir, outletId])

  useEffect(() => { fetchCustomers() }, [fetchCustomers])
  useEffect(() => { setPage(0) }, [debouncedSearch, inactive, gender, hasReview, sortBy, sortDir])

  // Live updates — a new customer, visit or review updates the list & derived columns.
  useCrmStream(['customer', 'visit', 'review'], () => fetchCustomers({ silent: true }), { outletId: outletId || undefined, onLive: setLive })

  // GSAP Minimal Animations on load
  useEffect(() => {
    if (!loading && customers.length > 0) {
      gsap.killTweensOf('.cu-metrics-grid, .cu-table-wrap, .cu-cards-grid')
      
      gsap.fromTo('.cu-metrics-grid, .cu-table-wrap, .cu-cards-grid',
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' }
      )
    }
  }, [loading, customers, viewMode])

  const hasFilters = inactive || !!gender || !!hasReview || !!debouncedSearch
  
  const clearFilters = () => {
    setSearch('')
    setInactive(false)
    setGender('')
    setHasReview('')
    setSortBy('createdAt')
    setSortDir('desc')
  }

  const totalPages = Math.ceil(total / 20)

  // Customer detailed reviews loading inside the drawer
  useEffect(() => {
    if (selectedCustomer) {
      setDrawerCustomer(selectedCustomer)
      setReviewsLoading(true)
      setCustomerReviews([])
      
      api.get<Customer>(`/cms/customers/${selectedCustomer.id}`)
        .then(res => {
          setCustomerReviews(res.data.reviews ?? [])
        })
        .catch(() => {
          setCustomerReviews([])
        })
        .finally(() => {
          setReviewsLoading(false)
        })

      // GSAP Drawer Animation
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
  }, [selectedCustomer])

  const closeDrawer = () => {
    if (overlayRef.current && drawerRef.current) {
      gsap.killTweensOf([overlayRef.current, drawerRef.current])
      gsap.to(overlayRef.current, { opacity: 0, duration: 0.2, ease: 'power2.in' })
      gsap.to(drawerRef.current, {
        x: '100%',
        duration: 0.25,
        ease: 'power3.in',
        onComplete: () => {
          setSelectedCustomer(null)
          setDrawerCustomer(null)
          setCustomerReviews([])
        }
      })
    } else {
      setSelectedCustomer(null)
      setDrawerCustomer(null)
      setCustomerReviews([])
    }
  }

  // Dashboard KPIs — computed server-side across the ENTIRE filtered set (accurate,
  // and refreshed on every live update), not just the visible page.
  const stats = {
    total:         summary?.totalCustomers ?? total,
    avgSpend:      summary?.avgSpend ?? 0,
    retentionRate: summary?.retentionRate ?? 0,
    reviewRate:    summary?.reviewRate ?? 0,
  }

  // Render numbered pagination jump buttons
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
          className={`cu-page-num ${i === page ? 'active' : ''}`}
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
    <div className="cu-page">
      {/* Header Panel */}
      <div className="cu-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 className="cu-title">Customers CRM</h1>
            <LiveBadge live={live} />
          </div>
          <p className="cu-sub">
            {outletId ? 'Filtered by outlet — ' : ''}
            {total > 0 && !loading ? `${total.toLocaleString()} total profiles managed` : 'Manage your restaurant customer database'}
          </p>
        </div>

        <div className="cu-header-actions">
          {/* Layout Mode Toggle */}
          <div className="cu-view-toggle">
            <button 
              className={`cu-toggle-btn ${viewMode === 'table' ? 'active' : ''}`} 
              onClick={() => setViewMode('table')}
              title="Table View"
            >
              <List size={15} />
            </button>
            <button 
              className={`cu-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`} 
              onClick={() => setViewMode('grid')}
              title="Grid Cards View"
            >
              <Grid size={15} />
            </button>
          </div>

          {/* Search Input */}
          <div className="cu-search-wrap">
            <input
              className="cu-search-input"
              placeholder="Search name, phone, email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <Search size={14} className="cu-search-icon" />
            {search && (
              <button className="cu-search-clear" onClick={() => setSearch('')}>
                <X size={12} />
              </button>
            )}
          </div>

          {isAdmin && (
            <button onClick={() => setShowExport(true)} className="cu-export-btn">
              <Download size={14} /> Export
            </button>
          )}
        </div>
      </div>

      {/* KPI Metrics Dashboard Grid */}
      <div className="cu-metrics-grid">
        <div className="cu-metric-card">
          <div className="cu-metric-icon" style={{ background: 'rgba(214, 66, 56, 0.05)', color: 'var(--color-primary)' }}>
            <Users size={18} />
          </div>
          <div>
            <div className="cu-metric-label">Total Customers</div>
            <div className="cu-metric-value">
              <AnimatedCounter value={stats.total} />
            </div>
            <div className="cu-metric-sub">Across all filters</div>
          </div>
        </div>

        <div className="cu-metric-card">
          <div className="cu-metric-icon" style={{ background: 'rgba(214, 66, 56, 0.05)', color: 'var(--color-primary)' }}>
            <UserCheck size={18} />
          </div>
          <div>
            <div className="cu-metric-label">Avg. Spending (CLV)</div>
            <div className="cu-metric-value">
              <AnimatedCounter value={stats.avgSpend} prefix="₹" />
            </div>
            <div className="cu-metric-sub">Current page average</div>
          </div>
        </div>

        <div className="cu-metric-card">
          <div className="cu-metric-icon" style={{ background: 'rgba(214, 66, 56, 0.05)', color: 'var(--color-primary)' }}>
            <Sparkles size={18} />
          </div>
          <div>
            <div className="cu-metric-label">Retention Rate</div>
            <div className="cu-metric-value">
              <AnimatedCounter value={stats.retentionRate} suffix="%" />
            </div>
            <div className="cu-metric-sub">Visited in last 30 days</div>
          </div>
        </div>

        <div className="cu-metric-card">
          <div className="cu-metric-icon" style={{ background: 'rgba(214, 66, 56, 0.05)', color: 'var(--color-primary)' }}>
            <MessageSquare size={18} />
          </div>
          <div>
            <div className="cu-metric-label">Review Submissions</div>
            <div className="cu-metric-value">
              <AnimatedCounter value={stats.reviewRate} suffix="%" />
            </div>
            <div className="cu-metric-sub">Customer reviews left</div>
          </div>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      <div className="cu-filters-card">
        <div className="cu-filters-inputs">
          <div className="cu-field">
            <span>Gender Identity</span>
            <GSAPDropdown
              value={gender}
              onChange={setGender}
              options={[
                { value: '', label: 'All Genders' },
                { value: 'Male', label: 'Male' },
                { value: 'Female', label: 'Female' },
                { value: 'RatherNotSay', label: 'Others' }
              ]}
              width="135px"
            />
          </div>

          <div className="cu-field">
            <span>Review Status</span>
            <GSAPDropdown
              value={hasReview}
              onChange={setHasReview}
              options={[
                { value: '', label: 'All Review Status' },
                { value: 'true', label: 'Review Submitted' },
                { value: 'false', label: 'Review Pending' }
              ]}
              width="165px"
            />
          </div>

          <div className="cu-field">
            <span>Sort Customers By</span>
            <GSAPDropdown
              value={`${sortBy}-${sortDir}`}
              onChange={(val) => {
                const [s, d] = val.split('-')
                setSortBy(s)
                setSortDir(d as 'asc' | 'desc')
              }}
              options={[
                { value: 'createdAt-desc', label: 'Newest Joined' },
                { value: 'createdAt-asc', label: 'Oldest Joined' },
                { value: 'lastVisitDate-desc', label: 'Recent Visited' },
                { value: 'totalVisits-desc', label: 'Most Visited' }
              ]}
              width="170px"
            />
          </div>

          {/* Retention Inactive Switch */}
          <div className="cu-field">
            <span>Retention filter</span>
            <label className={`cu-switch-btn ${inactive ? 'active' : ''}`}>
              <input 
                type="checkbox" 
                checked={inactive} 
                onChange={e => setInactive(e.target.checked)} 
                style={{ display: 'none' }}
              />
              <ShieldAlert size={13} style={{ marginRight: 4 }} />
              Inactive 30d+
            </label>
          </div>

          {hasFilters && (
            <button className="cu-clear" onClick={clearFilters}>
              <X size={13} /> Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Main CRM Content */}
      {loading && (
        <div className="cu-loading-skeleton">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="cu-skeleton-row" />
          ))}
        </div>
      )}

      {!loading && customers.length === 0 && (
        <div className="cu-empty">
          <div className="cu-empty-icon"><Users size={32} strokeWidth={1.5} /></div>
          <h3 className="cu-empty-title">No customers found</h3>
          <p className="cu-empty-desc">
            {hasFilters ? 'Try adjusting your search criteria or filter properties.' : 'Your guest database records will list here.'}
          </p>
          {hasFilters && (
            <button className="cu-btn-ghost-small" onClick={clearFilters}>
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Content Rendering Views */}
      {!loading && customers.length > 0 && viewMode === 'table' ? (
        /* Table View */
        <div className="cu-table-wrap">
          <table className="cu-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Contact details</th>
                {isOwnerOrAbove && <th>First Outlet</th>}
                <th>Visits</th>
                <th>CLV Spend</th>
                <th>Feedback</th>
                <th>Last Visit</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => {
                const daysSinceVisit = c.lastVisitDate ? differenceInDays(new Date(), new Date(c.lastVisitDate)) : null
                const isInactive = daysSinceVisit !== null && daysSinceVisit >= 30
                const reviewCount = c.totalReviews ?? 0

                return (
                  <tr key={c.id} className="cu-row-clickable" onClick={() => setSelectedCustomer(c)}>
                    <td>
                      <div className="cu-profile-link-wrap">
                        <Initials name={c.fullName} />
                        <div>
                          <div className="cu-customer-name">{c.fullName}</div>
                          <div className="cu-customer-gender">
                            {c.gender === 'RatherNotSay' || c.gender === 'Transgender' ? 'Others' : c.gender} · {c.maritalStatus}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="cu-contact-phone">{c.phone}</div>
                      {c.email && <div className="cu-contact-email">{c.email}</div>}
                    </td>
                    {isOwnerOrAbove && (
                      <td>
                        <span className="cu-outlet-pill">
                          {c.firstVisitOutlet?.code ?? '—'}
                        </span>
                      </td>
                    )}
                    <td>
                      <span className="cu-badge-visits">
                        {c.totalVisits}
                      </span>
                    </td>
                    <td>
                      <span className="cu-spend-value">
                        {c.clv && c.clv > 0 ? `₹${Math.round(c.clv).toLocaleString('en-IN')}` : '—'}
                      </span>
                    </td>
                    <td>
                      <span className={`cu-reviews-badge-pill ${reviewCount > 0 ? 'active' : ''}`}>
                        {reviewCount} review{reviewCount !== 1 ? 's' : ''}
                      </span>
                    </td>
                    <td className="cu-visit-date-cell">
                      {c.lastVisitDate ? (
                        <div>
                          <div style={{ color: isInactive ? 'var(--color-danger)' : 'var(--color-text-1)', fontWeight: 700 }}>
                            {format(new Date(c.lastVisitDate), 'dd MMM yy')}
                          </div>
                          <div className="cu-visit-days-sub">
                            {daysSinceVisit === 0 ? 'Today' : `${daysSinceVisit}d ago`}
                          </div>
                        </div>
                      ) : '—'}
                    </td>
                    <td>
                      {c.hasSubmittedFirstReview ? (
                        <span className="cu-status-pill submitted">✓ Review</span>
                      ) : (
                        <span className="cu-status-pill pending">Pending</span>
                      )}
                    </td>
                    <td className="cu-joined-date">
                      {format(new Date(c.createdAt), 'dd MMM yy')}
                    </td>
                    <td>
                      <button 
                        className="cu-details-btn" 
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedCustomer(c)
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
        /* Cards Grid View */
        !loading && customers.length > 0 && (
          <div className="cu-cards-grid">
            {customers.map((c) => {
              const daysSinceVisit = c.lastVisitDate ? differenceInDays(new Date(), new Date(c.lastVisitDate)) : null
              const isInactive = daysSinceVisit !== null && daysSinceVisit >= 30
              const reviewCount = c.totalReviews ?? 0

              return (
                <div key={c.id} className="cu-customer-card" onClick={() => setSelectedCustomer(c)}>
                  <div className="cu-card-header">
                    <Initials name={c.fullName} />
                    <div>
                      <div className="cu-customer-name">{c.fullName}</div>
                      <div className="cu-customer-gender">
                        {c.gender === 'RatherNotSay' || c.gender === 'Transgender' ? 'Others' : c.gender} · {c.maritalStatus}
                      </div>
                    </div>
                  </div>

                  <div className="cu-card-contact-sec">
                    <div className="cu-card-phone"><PhoneIcon size={11} /> {c.phone}</div>
                    {c.email && <div className="cu-card-email"><Mail size={11} /> {c.email}</div>}
                  </div>

                  <div className="cu-card-stats-row">
                    <div className="cu-stat-col">
                      <span className="cu-stat-lbl">Visits</span>
                      <span className="cu-stat-val font-bold text-slate-800">{c.totalVisits}</span>
                    </div>
                    <div className="cu-stat-col">
                      <span className="cu-stat-lbl">Total Spend</span>
                      <span className="cu-stat-val text-red-600 font-extrabold">
                        {c.clv && c.clv > 0 ? `₹${Math.round(c.clv).toLocaleString('en-IN')}` : '—'}
                      </span>
                    </div>
                    <div className="cu-stat-col">
                      <span className="cu-stat-lbl">Reviews</span>
                      <span className="cu-stat-val text-blue-600 font-bold">{reviewCount}</span>
                    </div>
                  </div>

                  <div className="cu-card-footer">
                    <div className="cu-card-footer-days" style={{ 
                      color: isInactive ? 'var(--color-danger)' : 'var(--color-text-2)' 
                    }}>
                      Last: {c.lastVisitDate ? `${daysSinceVisit === 0 ? 'Today' : `${daysSinceVisit}d ago`}` : '—'}
                    </div>
                    {c.hasSubmittedFirstReview ? (
                      <span className="cu-status-pill-small submitted">✓ Review</span>
                    ) : (
                      <span className="cu-status-pill-small pending">Pending</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}

      {/* Pagination Controls */}
      {!loading && customers.length > 0 && (
        <div className="cu-pager">
          <span className="cu-pager-info">
            Showing {page * 20 + 1} to {Math.min((page + 1) * 20, total)} of {total.toLocaleString()} customers
          </span>
          <div className="cu-pager-btns">
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

      {/* Guest CRM Drawer slideover */}
      {drawerCustomer && (
        <>
          <div ref={overlayRef} className="cu-drawer-backdrop" onClick={closeDrawer} />
          <div ref={drawerRef} className="cu-drawer-content">
            <div className="cu-drawer-header">
              <div>
                <h2 className="cu-drawer-title">Customer CRM Profile</h2>
                <div className="cu-drawer-subtitle">UID: {drawerCustomer.id.slice(0, 18)}...</div>
              </div>
              <button className="cu-drawer-close" onClick={closeDrawer}>
                <X size={20} />
              </button>
            </div>

            <div className="cu-drawer-body">
              {/* Profile Card Header */}
              <div className="cu-drawer-profile-card">
                <Initials name={drawerCustomer.fullName} />
                <div>
                  <h4 className="cu-profile-name">{drawerCustomer.fullName}</h4>
                  <div className="cu-profile-tags">
                    <span className="cu-profile-tag-pill">{drawerCustomer.gender === 'RatherNotSay' || drawerCustomer.gender === 'Transgender' ? 'Others' : drawerCustomer.gender}</span>
                    <span className="cu-profile-tag-pill">{drawerCustomer.maritalStatus}</span>
                  </div>
                </div>
              </div>

              {/* Direct Actions (Call, Mail) */}
              <div className="cu-drawer-section">
                <h3 className="cu-section-heading">Contact Details</h3>
                <div className="cu-actions-contact-box">
                  <a href={`tel:${drawerCustomer.phone}`} className="cu-contact-action-link select-none">
                    <PhoneIcon size={14} /> Call Guest ({drawerCustomer.phone})
                  </a>
                  {drawerCustomer.email ? (
                    <a href={`mailto:${drawerCustomer.email}`} className="cu-contact-action-link select-none">
                      <Mail size={14} /> Email Guest ({drawerCustomer.email})
                    </a>
                  ) : (
                    <div className="cu-contact-action-disabled">
                      <Mail size={14} /> No Email Registered
                    </div>
                  )}
                </div>
              </div>

              {/* CRM Key Spend Stats */}
              <div className="cu-drawer-section">
                <h3 className="cu-section-heading">Spend & Loyalty Stats</h3>
                <div className="cu-details-grid">
                  <div className="cu-detail-item">
                    <span className="cu-detail-label">Total Visits</span>
                    <span className="cu-detail-value">{drawerCustomer.totalVisits} Scans</span>
                  </div>
                  <div className="cu-detail-item">
                    <span className="cu-detail-label">Lifetime Spend (CLV)</span>
                    <span className="cu-detail-value font-bold" style={{ color: 'var(--color-primary)' }}>
                      {drawerCustomer.clv && drawerCustomer.clv > 0 ? `₹${Math.round(drawerCustomer.clv).toLocaleString('en-IN')}` : '—'}
                    </span>
                  </div>
                  <div className="cu-detail-item">
                    <span className="cu-detail-label">Feedback Left</span>
                    <span className="cu-detail-value">{drawerCustomer.totalReviews ?? 0} Review(s)</span>
                  </div>
                  <div className="cu-detail-item">
                    <span className="cu-detail-label">Retention State</span>
                    <span className="cu-detail-value">
                      {drawerCustomer.lastVisitDate ? (
                        differenceInDays(new Date(), new Date(drawerCustomer.lastVisitDate)) >= 30 ? (
                          <span style={{ color: 'var(--color-danger)' }}>Inactive 30d+</span>
                        ) : (
                          <span style={{ color: 'var(--color-success)' }}>Active Guest</span>
                        )
                      ) : 'Unknown'}
                    </span>
                  </div>
                  <div className="cu-detail-item">
                    <span className="cu-detail-label">Joined CRM Date</span>
                    <span className="cu-detail-value">{format(new Date(drawerCustomer.createdAt), 'dd MMMM yyyy')}</span>
                  </div>
                  {drawerCustomer.firstVisitOutlet && (
                    <div className="cu-detail-item">
                      <span className="cu-detail-label">Acquired Outlet</span>
                      <span className="cu-detail-value">{drawerCustomer.firstVisitOutlet.name}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Guest Reviews Timeline */}
              <div className="cu-drawer-section">
                <h3 className="cu-section-heading">Feedback & Reviews Timeline</h3>
                
                {reviewsLoading ? (
                  <div className="cu-reviews-loading">
                    <Activity className="animate-spin" size={16} /> Loading guest feedback...
                  </div>
                ) : customerReviews.length === 0 ? (
                  <div className="cu-reviews-empty">
                    <Star size={16} /> Guest has not submitted any ratings yet.
                  </div>
                ) : (
                  <div className="cu-reviews-timeline">
                    {customerReviews.map((r) => {
                      const badge = starBadgeStyle(r.stars)
                      const sent = r.sentimentLabel ? SENTIMENT_META[r.sentimentLabel] : null
                      return (
                        <div key={r.id} className="cu-timeline-card">
                          <div className="cu-timeline-header-row">
                            <span className="cu-timeline-star-badge" style={{ color: badge.color, background: badge.bg }}>
                              {r.stars}★
                            </span>
                            <span className="cu-timeline-date">{format(new Date(r.createdAt), 'dd MMM yyyy')}</span>
                          </div>
                          
                          <div className="cu-timeline-body">
                            {r.reviewText ? (
                              <p className="cu-timeline-comment">"{r.reviewText}"</p>
                            ) : (
                              <p className="cu-timeline-comment-empty">Left a ratings-only score.</p>
                            )}
                          </div>

                          <div className="cu-timeline-footer">
                            {r.outlet?.code && <span className="cu-timeline-outlet-pill">🏣 {r.outlet.name ?? r.outlet.code}</span>}
                            {sent && r.sentimentLabel && (
                              <span className="cu-timeline-sent-badge" style={{ color: sent.color, background: sent.bg }}>
                                {sent.emoji} {sent.label}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="cu-drawer-footer">
              <button className="cu-drawer-footer-close-btn" onClick={closeDrawer}>
                Close Profile
              </button>
            </div>
          </div>
        </>
      )}

      {/* Export Modal trigger container */}
      {showExport && (
        <ExportModal
          endpoint="/cms/export/customers"
          filenameBase="customers"
          title="Export Customers"
          onClose={() => setShowExport(false)}
        />
      )}

      {/* Styled block overrides */}
      <style>{`
        .cu-page { 
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

        .cu-header { 
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
        .cu-title { font-size: 1.4rem; font-weight: 800; color: var(--color-text-1); letter-spacing: -0.02em; margin: 0; }
        .cu-sub { font-size: 13px; color: var(--color-text-3); margin: 2px 0 0; }
        .cu-header-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }

        /* View Mode Toggle */
        .cu-view-toggle { display: flex; background: #f1f5f9; padding: 4px; border-radius: 99px; border: 1px solid var(--color-border); }
        .cu-toggle-btn { width: 30px; height: 30px; border: none; background: transparent; color: var(--color-text-3); border-radius: 99px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.15s ease; }
        .cu-toggle-btn.active { background: #ffffff; color: var(--color-primary); box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
        .cu-toggle-btn:hover:not(.active) { color: var(--color-text-2); }

        /* Search Input */
        .cu-search-wrap { position: relative; min-width: 240px; }
        .cu-search-input { width: 100%; background: #ffffff; border: 1px solid var(--color-border-strong); border-radius: var(--radius-md); padding: 8px 12px 8px 34px; font-size: 13px; font-weight: 500; color: var(--color-text-1); outline: none; transition: all 0.2s; }
        .cu-search-input:focus { border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--color-primary-dim); }
        .cu-search-icon { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--color-text-3); pointer-events: none; }
        .cu-search-clear { position: absolute; right: 11px; top: 50%; transform: translateY(-50%); border: none; background: transparent; color: var(--color-text-3); cursor: pointer; padding: 2px; display: flex; align-items: center; justify-content: center; }
        .cu-search-clear:hover { color: var(--color-text-1); }

        .cu-export-btn { display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 14px; border-radius: var(--radius-md); border: 1px solid var(--color-border-strong); background: #fff; font-size: 13px; font-weight: 700; color: var(--color-text-2); cursor: pointer; transition: all .15s; }
        .cu-export-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }

        /* Metrics Dashboard Grid */
        .cu-metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; }
        .cu-metric-card { background: #ffffff; border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: 1.25rem; display: flex; align-items: center; gap: 1rem; transition: all 0.2s ease; box-shadow: 0 1px 3px rgba(0,2,29,0.02); }
        .cu-metric-card:hover { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(214, 66, 56, 0.04); border-color: var(--color-primary); }
        .cu-metric-icon { width: 42px; height: 42px; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .cu-metric-label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--color-text-3); letter-spacing: 0.05em; }
        .cu-metric-value { font-size: 20px; font-weight: 800; color: var(--color-text-1); margin-top: 2px; line-height: 1.1; }
        .cu-metric-sub { font-size: 11px; color: var(--color-text-3); margin-top: 2px; }

        /* Filters Card */
        .cu-filters-card { background: #fff; border: 1px solid var(--color-border); border-radius: var(--radius-xl); padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 1rem; box-shadow: 0 1px 3px rgba(0,2,29,0.02); }
        .cu-filters-inputs { display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap; }
        .cu-field { display: flex; flex-direction: column; gap: 5px; }
        .cu-field > span { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-3); }
        .cu-input { background: #fff; border: 1px solid var(--color-border-strong); border-radius: 8px; padding: 8px 12px; font-size: 13px; font-weight: 500; color: var(--color-text-1); transition: all .2s; }
        .cu-input:focus { outline: none; border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--color-primary-dim); }
        .cu-clear { display: inline-flex; align-items: center; gap: 5px; height: 38px; padding: 0 12px; border-radius: 8px; border: 1px solid transparent; background: rgba(0,2,29,0.03); font-size: 12.5px; font-weight: 700; color: var(--color-text-2); cursor: pointer; }
        .cu-clear:hover { background: rgba(0,2,29,0.06); }
        
        .cu-switch-btn { display: inline-flex; align-items: center; height: 38px; padding: 0 12px; border: 1px solid var(--color-border-strong); border-radius: 8px; font-size: 13px; font-weight: 600; color: var(--color-text-2); cursor: pointer; transition: all 0.2s; background: #fff; }
        .cu-switch-btn.active { background: #fef2f2; border-color: var(--color-danger); color: var(--color-danger); }
        .cu-switch-btn:hover:not(.active) { border-color: var(--color-text-3); color: var(--color-text-1); }

        /* Loading Skeleton */
        .cu-loading-skeleton { display: flex; flex-direction: column; gap: 8px; }
        .cu-skeleton-row { height: 56px; background: #fff; border: 1px solid var(--color-border); border-radius: 8px; animation: cu-pulse 1.5s infinite ease-in-out; }
        @keyframes cu-pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 0.95; } }

        /* Empty State */
        .cu-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; min-height: 280px; text-align: center; background: #fff; border: 1px solid var(--color-border); border-radius: var(--radius-xl); padding: 2rem; }
        .cu-empty-icon { color: var(--color-text-3); opacity: 0.65; margin-bottom: 6px; }
        .cu-empty-title { font-size: 15px; font-weight: 700; color: var(--color-text-1); }
        .cu-empty-desc { font-size: 13px; color: var(--color-text-3); max-width: 320px; line-height: 1.5; }
        .cu-btn-ghost-small { margin-top: 10px; padding: 6px 12px; font-size: 12.5px; font-weight: 600; border: 1px solid var(--color-border-strong); background: transparent; color: var(--color-text-2); border-radius: 6px; cursor: pointer; }
        .cu-btn-ghost-small:hover { border-color: var(--color-primary); color: var(--color-primary); }

        /* Table Design */
        .cu-table-wrap { background: #fff; border: 1px solid var(--color-border); border-radius: var(--radius-xl); overflow-x: auto; box-shadow: 0 1px 3px rgba(0,2,29,0.02); }
        .cu-table { width: 100%; border-collapse: collapse; font-size: 13px; min-width: 960px; }
        .cu-table thead th { text-align: left; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-3); padding: 14px 16px; border-bottom: 1px solid var(--color-border); background: #fcfcfb; }
        .cu-table tbody td { padding: 12px 16px; border-bottom: 1px solid var(--color-border); color: var(--color-text-2); vertical-align: middle; }
        .cu-table tbody tr:last-child td { border-bottom: none; }
        .cu-row-clickable { cursor: pointer; transition: background 0.12s; }
        .cu-row-clickable:hover { background: #fcfcfb; }

        /* Profile & links inside table */
        .cu-profile-link-wrap { display: flex; align-items: center; gap: 10px; width: fit-content; }
        .cu-avatar { width: 34px; height: 34px; border-radius: 99px; background: var(--color-primary-dim); border: 1px solid var(--color-primary-border); display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: var(--color-primary); text-transform: uppercase; flex-shrink: 0; }
        .cu-customer-name { font-weight: 700; color: var(--color-primary); font-size: 13.5px; }
        .cu-customer-gender { font-size: 11px; color: var(--color-text-3); margin-top: 1px; }
        
        .cu-contact-phone { font-size: 13px; color: var(--color-text-1); font-weight: 600; }
        .cu-contact-email { font-size: 11px; color: var(--color-text-3); margin-top: 1px; }
        .cu-outlet-pill { display: inline-flex; padding: 2px 8px; border-radius: 99px; font-size: 11px; font-weight: 700; background: rgba(0,2,29,0.04); color: var(--color-text-2); border: 1px solid var(--color-border); }
        .cu-badge-visits { display: inline-flex; padding: 2.5px 8.5px; border-radius: 99px; font-size: 11px; font-weight: 700; background: var(--color-primary-dim); color: var(--color-primary); border: 1px solid var(--color-primary-border); }
        .cu-spend-value { font-weight: 800; font-size: 13px; color: var(--color-text-1); }
        .cu-reviews-badge-pill { display: inline-flex; padding: 2.5px 8.5px; border-radius: 99px; font-size: 11px; font-weight: 700; background: rgba(0,2,29,0.04); color: var(--color-text-3); }
        .cu-reviews-badge-pill.active { background: #eff6ff; color: #1d4ed8; border: 1px solid #dbeafe; }
        .cu-visit-date-cell { font-size: 12.5px; }
        .cu-visit-days-sub { font-size: 11px; color: var(--color-text-3); margin-top: 1px; }
        
        .cu-status-pill { display: inline-flex; font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 99px; }
        .cu-status-pill.submitted { background: #f0fdf4; color: #16a34a; }
        .cu-status-pill.pending { background: #fee2e2; color: #b91c1c; }
        
        .cu-joined-date { font-size: 12px; color: var(--color-text-3); font-weight: 500; }

        .cu-details-btn {
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
        .cu-row-clickable:hover .cu-details-btn {
          border-color: var(--color-primary);
          color: var(--color-primary);
          background: var(--color-primary-dim);
        }

        /* Card Grid view */
        .cu-cards-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1.1rem; }
        .cu-customer-card { background: #ffffff; border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 1px 3px rgba(0,2,29,0.02); }
        .cu-customer-card:hover { transform: translateY(-3px); box-shadow: 0 10px 20px rgba(214, 66, 56, 0.04); border-color: var(--color-primary); }
        
        .cu-card-header { display: flex; align-items: center; gap: 10px; border-bottom: 1px solid var(--color-border); padding-bottom: 0.6rem; }
        .cu-card-contact-sec { display: flex; flex-direction: column; gap: 3px; font-size: 11.5px; color: var(--color-text-2); font-weight: 500; }
        .cu-card-phone, .cu-card-email { display: flex; align-items: center; gap: 6px; }
        .cu-card-stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; background: var(--color-bg); padding: 8px; border-radius: var(--radius-md); border: 1px solid var(--color-border); text-align: center; }
        .cu-stat-col { display: flex; flex-direction: column; gap: 2px; }
        .cu-stat-lbl { font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--color-text-3); letter-spacing: 0.02em; }
        .cu-stat-val { font-size: 12.5px; }
        
        .cu-card-footer { display: flex; justify-content: space-between; align-items: center; margin-top: auto; padding-top: 0.4rem; font-size: 11.5px; }
        .cu-card-footer-days { font-weight: 600; }
        .cu-status-pill-small { font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 99px; }
        .cu-status-pill-small.submitted { background: #f0fdf4; color: #16a34a; }
        .cu-status-pill-small.pending { background: #fee2e2; color: #b91c1c; }

        /* Numbered Pager */
        .cu-pager { display: flex; align-items: center; justify-content: space-between; padding: 4px 4px; flex-wrap: wrap; gap: 10px; }
        .cu-pager-info { font-size: 12.5px; font-weight: 600; color: var(--color-text-3); }
        .cu-pager-btns { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
        .cu-pager-btns button, .cu-page-num { display: inline-flex; align-items: center; justify-content: center; height: 34px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--color-border-strong); background: #fff; font-size: 13px; font-weight: 700; color: var(--color-text-2); cursor: pointer; transition: all .15s; }
        .cu-pager-btns button:hover:not(:disabled), .cu-page-num:hover:not(.active) { border-color: var(--color-primary); color: var(--color-primary); }
        .cu-pager-btns button:disabled { opacity: .4; cursor: not-allowed; }
        .cu-page-num.active { background: var(--color-primary); color: #ffffff; border-color: var(--color-primary); }

        /* Drawer Details Layout */
        .cu-drawer-backdrop { position: fixed; inset: 0; background: rgba(0, 2, 29, 0.4); backdrop-filter: blur(4px); z-index: 1000; }
        .cu-drawer-content { position: fixed; top: 0; right: 0; bottom: 0; width: 480px; max-width: 100vw; background: #ffffff; box-shadow: -8px 0 35px rgba(0, 2, 29, 0.12); z-index: 1001; display: flex; flex-direction: column; }
        .cu-drawer-header { padding: 1.5rem; border-bottom: 1px solid var(--color-border); display: flex; justify-content: space-between; align-items: center; }
        .cu-drawer-title { font-size: 1.25rem; font-weight: 800; color: var(--color-text-1); margin: 0; letter-spacing: -0.01em; }
        .cu-drawer-subtitle { font-size: 12px; font-weight: 600; color: var(--color-text-3); margin-top: 2px; }
        .cu-drawer-close { border: none; background: transparent; color: var(--color-text-3); cursor: pointer; padding: 6px; border-radius: 99px; display: flex; align-items: center; justify-content: center; transition: all 0.15s ease; }
        .cu-drawer-close:hover { background: rgba(0,2,29,0.05); color: var(--color-text-1); }
        .cu-drawer-body { padding: 1.5rem; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 1.5rem; }

        /* Profile card inside drawer */
        .cu-drawer-profile-card { display: flex; align-items: center; gap: 1rem; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: 1.1rem; }
        .cu-profile-name { font-size: 16px; font-weight: 800; color: var(--color-text-1); margin: 0; }
        .cu-profile-tags { display: flex; gap: 6px; margin-top: 6px; }
        .cu-profile-tag-pill { display: inline-flex; padding: 2px 8px; border-radius: 99px; font-size: 10.5px; font-weight: 700; background: #ffffff; color: var(--color-text-2); border: 1px solid var(--color-border-strong); }

        .cu-drawer-section { display: flex; flex-direction: column; gap: 0.75rem; }
        .cu-section-heading { font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--color-text-3); letter-spacing: 0.06em; border-bottom: 1px solid var(--color-border); padding-bottom: 4px; }
        
        /* Direct Actions contacts */
        .cu-actions-contact-box { display: flex; flex-direction: column; gap: 8px; }
        .cu-contact-action-link { display: inline-flex; align-items: center; gap: 8px; height: 38px; padding: 0 14px; border-radius: 8px; border: 1px solid var(--color-border-strong); background: #ffffff; font-size: 13px; font-weight: 700; color: var(--color-text-2); text-decoration: none; transition: all 0.15s ease; }
        .cu-contact-action-link:hover { border-color: var(--color-primary); color: var(--color-primary); background: var(--color-primary-dim); }
        .cu-contact-action-disabled { display: inline-flex; align-items: center; gap: 8px; height: 38px; padding: 0 14px; border-radius: 8px; border: 1px solid var(--color-border); background: rgba(0,2,29,0.02); font-size: 13px; font-weight: 600; color: var(--color-text-3); pointer-events: none; cursor: not-allowed; }

        /* Spend stats grid */
        .cu-details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem 1rem; }
        .cu-detail-item { display: flex; flex-direction: column; gap: 2px; }
        .cu-detail-label { font-size: 11px; color: var(--color-text-3); font-weight: 600; }
        .cu-detail-value { font-size: 13px; color: var(--color-text-1); font-weight: 700; }

        /* Reviews timeline section */
        .cu-reviews-loading { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--color-text-3); padding: 12px 4px; }
        .cu-reviews-empty { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--color-text-3); background: rgba(0,2,29,0.02); padding: 12px 14px; border-radius: 8px; border: 1px dashed var(--color-border-strong); }
        
        .cu-reviews-timeline { display: flex; flex-direction: column; gap: 12px; }
        .cu-timeline-card { background: #fafaf9; border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: 1rem; display: flex; flex-direction: column; gap: 6px; }
        .cu-timeline-header-row { display: flex; justify-content: space-between; align-items: center; }
        .cu-timeline-star-badge { display: inline-flex; font-size: 11px; font-weight: 800; padding: 2px 7px; border-radius: 99px; }
        .cu-timeline-date { font-size: 11px; color: var(--color-text-3); font-weight: 600; }
        .cu-timeline-comment { font-size: 13px; color: var(--color-text-2); margin: 2px 0; font-style: italic; line-height: 1.5; }
        .cu-timeline-comment-empty { font-size: 12px; color: var(--color-text-3); margin: 2px 0; font-style: italic; }
        .cu-timeline-footer { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 2px; }
        .cu-timeline-outlet-pill { display: inline-flex; font-size: 10px; font-weight: 700; color: var(--color-text-2); background: #ffffff; border: 1px solid var(--color-border-strong); padding: 1.5px 6.5px; border-radius: 6px; }
        .cu-timeline-sent-badge { display: inline-flex; font-size: 10px; font-weight: 700; padding: 1.5px 6.5px; border-radius: 6px; }

        .cu-drawer-footer { padding: 1.25rem 1.5rem; border-top: 1px solid var(--color-border); background: var(--color-bg); }
        .cu-drawer-footer-close-btn { width: 100%; display: flex; align-items: center; justify-content: center; height: 40px; border-radius: 8px; border: 1px solid var(--color-border-strong); background: #ffffff; font-size: 13px; font-weight: 700; color: var(--color-text-1); cursor: pointer; transition: all 0.15s ease; }
        .cu-drawer-footer-close-btn:hover { background: #fafaf9; border-color: var(--color-text-3); }
      `}</style>
    </div>
  )
}
