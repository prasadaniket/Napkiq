'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { format } from 'date-fns'
import type { Review, PageResponse, ReviewSummary } from '@/types/api'
import GSAPDropdown from '@/components/ui/GSAPDropdown'
import LiveBadge from '@/components/ui/LiveBadge'
import { useCrmStream } from '@/hooks/useCrmStream'
import gsap from 'gsap'
import {
  Users, Phone as PhoneIcon, X, Calendar, Clock, Sparkles,
  AlertCircle, Mail, MapPin, User, ChevronLeft, ChevronRight,
  Inbox, HelpCircle, Star, Quote, MessageSquare, Grid, List, Search
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
    <div className="rv-avatar">
      {ini.toUpperCase()}
    </div>
  )
}

function getIstDateStr(offsetDays = 0): string {
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

const SENTIMENT_META: Record<string, { label: string; emoji: string; color: string; bg: string }> = {
  positive: { label: 'Positive', emoji: '😊', color: '#16a34a', bg: '#f0fdf4' },
  neutral:  { label: 'Neutral',  emoji: '😐', color: '#475569', bg: '#f8fafc' },
  mixed:    { label: 'Mixed',    emoji: '🤔', color: '#ea580c', bg: '#fff7ed' },
  negative: { label: 'Negative', emoji: '😞', color: '#dc2626', bg: '#fef2f2' },
}

function starBadgeStyle(stars: number) {
  if (stars >= 4) return { label: `${stars}★`, color: '#16a34a', bg: '#f0fdf4' }
  if (stars === 3) return { label: `${stars}★`, color: '#d97706', bg: '#fffbeb' }
  return { label: `${stars}★`, color: '#dc2626', bg: '#fef2f2' }
}

export default function ReviewsPage() {
  const searchParams = useSearchParams()

  const [reviews, setReviews] = useState<Review[]>([])
  const [summary, setSummary] = useState<ReviewSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [live, setLive] = useState(false)
  const [view, setView] = useState<'cards' | 'table'>('table')

  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [stars, setStars] = useState('')
  const [type, setType] = useState('')
  const [sentiment, setSentiment] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [activePreset, setActivePreset] = useState('Custom')
  const [sortDir, setSortDir]   = useState<'asc' | 'desc'>('desc')

  // Drawer details
  const [selectedReview, setSelectedReview] = useState<Review | null>(null)
  const [drawerReview, setDrawerReview] = useState<Review | null>(null)

  const [outletId] = useState(() => searchParams.get('outletId') ?? '')
  const debouncedSearch = useDebounce(search, 400)

  const overlayRef = useRef<HTMLDivElement>(null)
  const drawerRef = useRef<HTMLDivElement>(null)

  const buildQuery = useCallback(() => {
    const q = new URLSearchParams({ page: page.toString(), size: '20', sortDir })
    if (debouncedSearch) q.append('search', debouncedSearch)
    if (stars)     q.append('stars', stars)
    if (type)      q.append('type', type)
    if (sentiment) q.append('sentiment', sentiment)
    if (dateFrom)  q.append('dateFrom', dateFrom)
    if (dateTo)    q.append('dateTo', dateTo)
    if (outletId)  q.append('outletId', outletId)
    return q.toString()
  }, [page, debouncedSearch, stars, type, sentiment, dateFrom, dateTo, outletId, sortDir])

  const fetchReviews = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    try {
      const q = buildQuery()
      const [revRes, sumRes] = await Promise.all([
        api.get<PageResponse<Review>>(`/cms/reviews?${q}`),
        api.get<ReviewSummary>(`/cms/reviews/summary?${q}`),
      ])
      setReviews(revRes.data.content)
      setTotal(revRes.data.totalElements)
      setSummary(sumRes.data)
    } catch {
      setReviews([])
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [buildQuery])

  useEffect(() => { fetchReviews() }, [fetchReviews])
  useEffect(() => { setPage(0) }, [debouncedSearch, stars, type, sentiment, dateFrom, dateTo, sortDir])

  // Live updates — silently refresh when a new review arrives.
  useCrmStream(['review'], () => fetchReviews({ silent: true }), { outletId: outletId || undefined, onLive: setLive })

  // GSAP Minimal Animations on load
  useEffect(() => {
    if (!loading && reviews.length > 0) {
      gsap.killTweensOf('.rv-analytics-grid, .rv-table-wrap, .rv-cards-grid')
      
      gsap.fromTo('.rv-analytics-grid, .rv-table-wrap, .rv-cards-grid',
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' }
      )
    }
  }, [loading, reviews, view])

  const hasFilters = !!stars || !!type || !!sentiment || !!dateFrom || !!dateTo || !!debouncedSearch
  
  const clearFilters = () => { 
    setSearch('')
    setStars('')
    setType('')
    setSentiment('')
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
    if (selectedReview) {
      setDrawerReview(selectedReview)
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
  }, [selectedReview])

  const closeDrawer = () => {
    if (overlayRef.current && drawerRef.current) {
      gsap.killTweensOf([overlayRef.current, drawerRef.current])
      gsap.to(overlayRef.current, { opacity: 0, duration: 0.2, ease: 'power2.in' })
      gsap.to(drawerRef.current, {
        x: '100%',
        duration: 0.25,
        ease: 'power3.in',
        onComplete: () => {
          setSelectedReview(null)
          setDrawerReview(null)
        }
      })
    } else {
      setSelectedReview(null)
      setDrawerReview(null)
    }
  }

  const totalPages = Math.ceil(total / 20)

  // Page level statistics calculations
  const stats = {
    avgRating: summary?.averageRating ?? 0,
    totalReviews: summary?.totalReviews ?? total,
    positiveRate: 0,
    textDensity: 0,
    firstVisitRate: 0,
  }

  if (reviews.length > 0) {
    const positiveReviews = reviews.filter(r => r.sentimentLabel === 'positive').length
    const withText = reviews.filter(r => r.reviewText && r.reviewText.trim().length > 0).length
    const firstVisits = reviews.filter(r => r.reviewType === 'first_visit').length

    stats.positiveRate = Math.round((positiveReviews / reviews.length) * 100)
    stats.textDensity = Math.round((withText / reviews.length) * 100)
    stats.firstVisitRate = Math.round((firstVisits / reviews.length) * 100)
  }

  // Render pagination numbers dynamically
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
          className={`rv-page-num ${i === page ? 'active' : ''}`}
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
    <div className="rv-page">
      {/* Header Panel */}
      <div className="rv-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 className="rv-title">Customer Reviews</h1>
            <LiveBadge live={live} />
          </div>
          <p className="rv-sub">
            {outletId ? 'Filtered by outlet — ' : ''}
            {total > 0 && !loading 
              ? `${total.toLocaleString()} customer reviews collected`
              : 'Analyze feedback ratings and AI sentiment metrics'}
          </p>
        </div>
        
        <div className="rv-header-actions">
          {/* View Mode Toggle */}
          <div className="rv-view-toggle">
            <button 
              className={`rv-toggle-btn ${view === 'table' ? 'active' : ''}`} 
              onClick={() => setView('table')}
              title="Table View"
            >
              <List size={15} />
            </button>
            <button 
              className={`rv-toggle-btn ${view === 'cards' ? 'active' : ''}`} 
              onClick={() => setView('cards')}
              title="Cards View"
            >
              <Grid size={15} />
            </button>
          </div>

          {/* Search Input */}
          <div className="rv-search-wrap">
            <input
              className="rv-search-input"
              placeholder="Search reviewer name/phone…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <Search size={14} className="rv-search-icon" />
            {search && (
              <button className="rv-search-clear" onClick={() => setSearch('')}>
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Analytics Dashboard Panel */}
      <div className="rv-analytics-grid">
        {/* Rating Score Card */}
        <div className="rv-star-dist-card">
          <div className="rv-avg-score-section">
            <div className="rv-avg-score-val">
              {stats.avgRating > 0 ? <AnimatedCounter value={stats.avgRating} decimals={1} /> : '—'}
            </div>
            <div className="rv-avg-score-sub">
              <div className="rv-stars-gold">
                {[...Array(5)].map((_, i) => {
                  const filled = i < Math.round(stats.avgRating)
                  return <Star key={i} size={15} fill={filled ? '#f59e0b' : 'none'} stroke="#f59e0b" />
                })}
              </div>
              <span className="rv-avg-reviews-label">
                <AnimatedCounter value={stats.totalReviews} /> reviews
              </span>
            </div>
          </div>

          {/* Star Distribution Horizontal Chart */}
          <div className="rv-stars-distribution">
            {[5, 4, 3, 2, 1].map(s => {
              const d = summary?.distribution.find(x => x.stars === s)
              const count = d?.count ?? 0
              const pct = summary?.totalReviews && summary.totalReviews > 0 ? Math.round((count / summary.totalReviews) * 100) : 0
              return (
                <div key={s} className="rv-dist-row">
                  <span className="rv-dist-label">{s}★</span>
                  <div className="rv-dist-bar-bg">
                    <div className="rv-dist-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="rv-dist-count">
                    <AnimatedCounter value={count} />
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Sentiment Summary Card */}
        <div className="rv-metric-card">
          <div className="rv-metric-icon" style={{ background: 'rgba(214, 66, 56, 0.05)', color: 'var(--color-primary)' }}>
            <Sparkles size={18} />
          </div>
          <div>
            <div className="rv-metric-label">Positive Sentiment</div>
            <div className="rv-metric-value">
              <AnimatedCounter value={stats.positiveRate} suffix="%" />
            </div>
            <div className="rv-metric-sub">Page satisfaction rate</div>
          </div>
        </div>

        {/* Text Density Card */}
        <div className="rv-metric-card">
          <div className="rv-metric-icon" style={{ background: 'rgba(214, 66, 56, 0.05)', color: 'var(--color-primary)' }}>
            <MessageSquare size={18} />
          </div>
          <div>
            <div className="rv-metric-label">Comment Density</div>
            <div className="rv-metric-value">
              <AnimatedCounter value={stats.textDensity} suffix="%" />
            </div>
            <div className="rv-metric-sub">Page reviews with text</div>
          </div>
        </div>

        {/* Guest Ratio Card */}
        <div className="rv-metric-card">
          <div className="rv-metric-icon" style={{ background: 'rgba(214, 66, 56, 0.05)', color: 'var(--color-primary)' }}>
            <Users size={18} />
          </div>
          <div>
            <div className="rv-metric-label">First Visit Rate</div>
            <div className="rv-metric-value">
              <AnimatedCounter value={stats.firstVisitRate} suffix="%" />
            </div>
            <div className="rv-metric-sub">Page new guest reviews</div>
          </div>
        </div>
      </div>

      {/* Advanced Filters Card */}
      <div className="rv-filters-card">
        {/* Presets Row */}
        <div className="rv-presets-row">
          <span className="rv-presets-label">Date Presets:</span>
          <div className="rv-presets-list">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                className={`rv-preset-btn ${activePreset === p.label ? 'active' : ''}`}
                onClick={() => handlePresetClick(p.label, p.getValue)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Pill-based Selectors */}
        <div className="rv-filters-inputs">
          <div className="rv-field">
            <span>Rating Selection</span>
            <GSAPDropdown
              value={stars}
              onChange={setStars}
              options={[
                { value: '', label: 'All Ratings' },
                ...[5, 4, 3, 2, 1].map(s => ({ value: String(s), label: `${'★'.repeat(s)} (${s} Star${s > 1 ? 's' : ''})` }))
              ]}
              width="150px"
            />
          </div>

          <div className="rv-field">
            <span>Sentiment Profile</span>
            <GSAPDropdown
              value={sentiment}
              onChange={setSentiment}
              options={[
                { value: '', label: 'All Sentiments' },
                { value: 'positive', label: '😊 Positive' },
                { value: 'neutral', label: '😐 Neutral' },
                { value: 'mixed', label: '🤔 Mixed' },
                { value: 'negative', label: '😞 Negative' }
              ]}
              width="155px"
            />
          </div>

          <div className="rv-field">
            <span>Visit Context</span>
            <GSAPDropdown
              value={type}
              onChange={setType}
              options={[
                { value: '', label: 'All Visit Types' },
                { value: 'first_visit', label: 'First Visit' },
                { value: 'repeat', label: 'Repeat Customer' }
              ]}
              width="150px"
            />
          </div>

          <label className="rv-field">
            <span>From</span>
            <input 
              type="date" 
              className="rv-input" 
              value={dateFrom} 
              max={dateTo || undefined} 
              onChange={(e) => {
                setDateFrom(e.target.value)
                setActivePreset('Custom')
              }} 
            />
          </label>

          <label className="rv-field">
            <span>To</span>
            <input 
              type="date" 
              className="rv-input" 
              value={dateTo} 
              min={dateFrom || undefined} 
              onChange={(e) => {
                setDateTo(e.target.value)
                setActivePreset('Custom')
              }} 
            />
          </label>

          <div className="rv-field">
            <span>Sort Order</span>
            <GSAPDropdown
              value={sortDir}
              onChange={(val) => setSortDir(val as 'asc' | 'desc')}
              options={[
                { value: 'desc', label: 'Newest First' },
                { value: 'asc', label: 'Oldest First' }
              ]}
              width="135px"
            />
          </div>

          {hasFilters && (
            <button className="rv-clear" onClick={clearFilters}>
              <X size={13} /> Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Reviews Content */}
      {loading && (
        <div className="rv-loading-skeleton">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rv-skeleton-row" />
          ))}
        </div>
      )}

      {!loading && reviews.length === 0 && (
        <div className="rv-empty">
          <div className="rv-empty-icon"><Star size={32} strokeWidth={1.5} /></div>
          <h3 className="rv-empty-title">No reviews found</h3>
          <p className="rv-empty-desc">
            {hasFilters ? 'Try adjusting your filters or search query.' : 'Customer review submissions will appear here.'}
          </p>
          {hasFilters && (
            <button className="rv-btn-ghost-small" onClick={clearFilters}>
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Views */}
      {!loading && reviews.length > 0 && view === 'table' ? (
        /* Table View */
        <div className="rv-table-wrap">
          <table className="rv-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Rating</th>
                <th>Comment</th>
                <th>Sentiment</th>
                <th>Visit Type</th>
                <th>Outlet / Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((r) => {
                const badge = starBadgeStyle(r.stars)
                const sent = r.sentimentLabel ? SENTIMENT_META[r.sentimentLabel] : null
                return (
                  <tr key={r.id} className="rv-row-clickable" onClick={() => setSelectedReview(r)}>
                    <td>
                      <Link 
                        href={`/customers/${r.customerId}`} 
                        onClick={(e) => e.stopPropagation()} 
                        className="rv-customer-link"
                      >
                        <Initials name={r.customer?.fullName ?? ''} />
                        <div>
                          <div className="rv-customer-name">{r.customer?.fullName ?? '—'}</div>
                          <div className="rv-customer-phone">{r.customer?.phone}</div>
                        </div>
                      </Link>
                    </td>
                    <td>
                      <span className="rv-badge" style={{ color: badge.color, background: badge.bg, borderColor: badge.color + '15' }}>
                        <Star size={10} fill={badge.color} stroke="none" style={{ marginRight: 3, display: 'inline-block', verticalAlign: 'middle', marginTop: -2 }} />
                        {r.stars}★
                      </span>
                    </td>
                    <td className="rv-comment-cell">
                      {r.reviewText ? (
                        <span className="rv-text-quote">"{r.reviewText}"</span>
                      ) : (
                        <span className="rv-text-muted">Star-only rating</span>
                      )}
                    </td>
                    <td>
                      {sent && r.sentimentLabel ? (
                        <span className="rv-badge" style={{ color: sent.color, background: sent.bg, borderColor: sent.color + '15' }}>
                          <span style={{ marginRight: 4 }}>{sent.emoji}</span>
                          {sent.label}
                        </span>
                      ) : (
                        <span className="rv-text-muted">—</span>
                      )}
                    </td>
                    <td>
                      <span className={`rv-type-badge ${r.reviewType}`}>
                        {r.reviewType === 'first_visit' ? 'First Visit' : 'Repeat'}
                      </span>
                    </td>
                    <td>
                      <div className="rv-outlet-date">
                        {r.outlet?.code && <span className="rv-outlet-pill">{r.outlet.code}</span>}
                        <span className="rv-date-label">{format(new Date(r.createdAt), 'dd MMM yy')}</span>
                      </div>
                    </td>
                    <td>
                      <button 
                        className="rv-details-btn" 
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedReview(r)
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
        /* Cards view */
        !loading && reviews.length > 0 && (
          <div className="rv-cards-grid">
            {reviews.map((r) => {
              const badge = starBadgeStyle(r.stars)
              const sent = r.sentimentLabel ? SENTIMENT_META[r.sentimentLabel] : null
              return (
                <div key={r.id} className="rv-review-card" onClick={() => setSelectedReview(r)}>
                  <div className="rv-card-header">
                    <Link 
                      href={`/customers/${r.customerId}`} 
                      onClick={(e) => e.stopPropagation()} 
                      className="rv-customer-link"
                    >
                      <Initials name={r.customer?.fullName ?? ''} />
                      <div>
                        <div className="rv-customer-name">{r.customer?.fullName ?? '—'}</div>
                        <div className="rv-customer-phone">{r.customer?.phone}</div>
                      </div>
                    </Link>
                    
                    <div className="rv-card-rating-col">
                      <span className="rv-badge" style={{ color: badge.color, background: badge.bg, borderColor: badge.color + '15' }}>
                        {r.stars}★
                      </span>
                      <span className="rv-card-date">{format(new Date(r.createdAt), 'dd MMM yy')}</span>
                    </div>
                  </div>

                  <div className="rv-card-body">
                    {r.reviewText ? (
                      <p className="rv-card-quote">"{r.reviewText}"</p>
                    ) : (
                      <p className="rv-card-quote-empty">Star-only rating left by guest.</p>
                    )}
                  </div>

                  <div className="rv-card-footer">
                    <span className={`rv-type-badge ${r.reviewType}`}>
                      {r.reviewType === 'first_visit' ? 'First Visit' : 'Repeat'}
                    </span>
                    {r.outlet?.code && (
                      <span className="rv-outlet-pill">{r.outlet.code}</span>
                    )}
                    {sent && r.sentimentLabel && (
                      <span className="rv-badge" style={{ color: sent.color, background: sent.bg, borderColor: sent.color + '15' }}>
                        {sent.emoji} {sent.label}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}

      {/* Pagination Controls */}
      {!loading && reviews.length > 0 && (
        <div className="rv-pager">
          <span className="rv-pager-info">
            Showing {page * 20 + 1} to {Math.min((page + 1) * 20, total)} of {total.toLocaleString()} reviews
          </span>
          <div className="rv-pager-btns">
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

      {/* Slide-over review details drawer */}
      {drawerReview && (
        <>
          <div ref={overlayRef} className="rv-drawer-backdrop" onClick={closeDrawer} />
          <div ref={drawerRef} className="rv-drawer-content">
            <div className="rv-drawer-header">
              <div>
                <h2 className="rv-drawer-title">Review Analysis</h2>
                <div className="rv-drawer-subtitle">ID: {drawerReview.id.slice(0, 18)}...</div>
              </div>
              <button className="rv-drawer-close" onClick={closeDrawer}>
                <X size={20} />
              </button>
            </div>

            <div className="rv-drawer-body">
              {/* Review Text Quote */}
              <div className="rv-drawer-quote-section">
                <Quote size={20} className="rv-quote-icon" />
                {drawerReview.reviewText ? (
                  <blockquote className="rv-drawer-quote">
                    "{drawerReview.reviewText}"
                  </blockquote>
                ) : (
                  <blockquote className="rv-drawer-quote-empty">
                    Star-only feedback. No comment left.
                  </blockquote>
                )}
              </div>

              {/* Guest Profile Details */}
              <div className="rv-drawer-section">
                <h3 className="rv-section-heading">Guest Identity</h3>
                <div className="rv-guest-profile-card">
                  <Initials name={drawerReview.customer?.fullName ?? ''} />
                  <div>
                    <h4 className="rv-profile-name">{drawerReview.customer?.fullName ?? '—'}</h4>
                    <div className="rv-profile-details">
                      <a href={`tel:${drawerReview.customer?.phone}`} className="rv-profile-link">
                        <PhoneIcon size={11} /> {drawerReview.customer?.phone}
                      </a>
                      {drawerReview.customer?.email && (
                        <a href={`mailto:${drawerReview.customer?.email}`} className="rv-profile-link">
                          <Mail size={11} /> {drawerReview.customer?.email}
                        </a>
                      )}
                      <Link 
                        href={`/customers/${drawerReview.customerId}`} 
                        className="rv-profile-view-link"
                        onClick={closeDrawer}
                      >
                        View Guest History Profile →
                      </Link>
                    </div>
                  </div>
                </div>
              </div>

              {/* Advanced AI Sentiment Section */}
              <div className="rv-drawer-section">
                <h3 className="rv-section-heading">AI Sentiment Analysis</h3>
                <div className="rv-sentiment-analysis-box">
                  <div className="rv-sentiment-header-row">
                    <span>Sentiment Profile</span>
                    {drawerReview.sentimentLabel ? (
                      <span className="rv-badge" style={{ 
                        color: SENTIMENT_META[drawerReview.sentimentLabel].color, 
                        background: SENTIMENT_META[drawerReview.sentimentLabel].bg,
                        borderColor: SENTIMENT_META[drawerReview.sentimentLabel].color + '15'
                      }}>
                        {SENTIMENT_META[drawerReview.sentimentLabel].emoji} {SENTIMENT_META[drawerReview.sentimentLabel].label}
                      </span>
                    ) : (
                      <span className="rv-text-muted">Not Analyzed</span>
                    )}
                  </div>

                  {/* Sentiment Score Progress Gauge */}
                  {drawerReview.sentimentScore !== undefined && drawerReview.sentimentScore !== null && (
                    <div className="rv-sentiment-score-wrapper">
                      <div className="rv-score-labels">
                        <span className="rv-score-label">Sentiment Strength Score</span>
                        <span className="rv-score-val" style={{ 
                          color: drawerReview.sentimentScore >= 0 ? 'var(--color-success)' : 'var(--color-danger)'
                        }}>
                          {drawerReview.sentimentScore >= 0 ? '+' : ''}{drawerReview.sentimentScore.toFixed(2)}
                        </span>
                      </div>
                      
                      <div className="rv-score-bar-bg">
                        {/* Gauge that slider fits inside */}
                        <div className="rv-score-center-line" />
                        <div className="rv-score-fill-bar" style={{
                          left: drawerReview.sentimentScore >= 0 ? '50%' : `${50 + drawerReview.sentimentScore * 50}%`,
                          width: `${Math.abs(drawerReview.sentimentScore) * 50}%`,
                          background: drawerReview.sentimentScore >= 0 ? 'var(--color-success)' : 'var(--color-danger)'
                        }} />
                      </div>
                      <div className="rv-score-limits">
                        <span>Negative (-1.0)</span>
                        <span>Neutral (0.0)</span>
                        <span>Positive (+1.0)</span>
                      </div>
                    </div>
                  )}

                  {/* Keywords Tag Pills */}
                  {drawerReview.sentimentKeywords && drawerReview.sentimentKeywords.length > 0 && (
                    <div className="rv-sentiment-keywords-section">
                      <div className="rv-keywords-heading">AI Keywords Detected</div>
                      <div className="rv-keywords-list">
                        {drawerReview.sentimentKeywords.map((kw, i) => (
                          <span key={i} className="rv-keyword-tag">
                            🏷️ {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Review Audit Details */}
              <div className="rv-drawer-section">
                <h3 className="rv-section-heading">Feedback Parameters</h3>
                <div className="rv-details-grid">
                  <div className="rv-detail-item">
                    <span className="rv-detail-label">Rating Value</span>
                    <span className="rv-detail-value">{drawerReview.stars} out of 5 Stars</span>
                  </div>
                  <div className="rv-detail-item">
                    <span className="rv-detail-label">Visit Type</span>
                    <span className="rv-detail-value capitalize">{drawerReview.reviewType === 'first_visit' ? 'First Visit' : 'Repeat Guest'}</span>
                  </div>
                  <div className="rv-detail-item">
                    <span className="rv-detail-label">Submission Date</span>
                    <span className="rv-detail-value">{format(new Date(drawerReview.createdAt), 'dd MMMM yyyy')}</span>
                  </div>
                  <div className="rv-detail-item">
                    <span className="rv-detail-label">Submission Time (IST)</span>
                    <span className="rv-detail-value">{format(new Date(drawerReview.createdAt), 'hh:mm:ss a')}</span>
                  </div>
                  {drawerReview.outlet && (
                    <>
                      <div className="rv-detail-item">
                        <span className="rv-detail-label">Outlet Code</span>
                        <span className="rv-detail-value">{drawerReview.outlet.code}</span>
                      </div>
                      <div className="rv-detail-item">
                        <span className="rv-detail-label">Outlet Name</span>
                        <span className="rv-detail-value">{drawerReview.outlet.name}</span>
                      </div>
                      {drawerReview.outlet.googleMapsUrl && (
                        <div className="rv-detail-item" style={{ gridColumn: 'span 2' }}>
                          <span className="rv-detail-label">Google Maps Link</span>
                          <a 
                            href={drawerReview.outlet.googleMapsUrl} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="rv-maps-link"
                          >
                            <MapPin size={12} /> View Outlet on Maps
                          </a>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="rv-drawer-footer">
              <button className="rv-drawer-footer-close-btn" onClick={closeDrawer}>
                Close Review
              </button>
            </div>
          </div>
        </>
      )}

      {/* Styled Override CSS */}
      <style>{`
        .rv-page { 
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

        .rv-header { 
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
        .rv-title { font-size: 1.4rem; font-weight: 800; color: var(--color-text-1); letter-spacing: -0.02em; margin: 0; }
        .rv-sub { font-size: 13px; color: var(--color-text-3); margin: 2px 0 0; }
        .rv-header-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }

        /* View Mode Toggle */
        .rv-view-toggle { display: flex; background: #f1f5f9; padding: 4px; border-radius: 9px; border: 1px solid var(--color-border); }
        .rv-toggle-btn { width: 30px; height: 30px; border: none; background: transparent; color: var(--color-text-3); border-radius: 6px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.15s ease; }
        .rv-toggle-btn.active { background: #ffffff; color: var(--color-primary); box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
        .rv-toggle-btn:hover:not(.active) { color: var(--color-text-2); }

        /* Search Input */
        .rv-search-wrap { position: relative; min-width: 240px; }
        .rv-search-input { width: 100%; background: #ffffff; border: 1px solid var(--color-border-strong); border-radius: var(--radius-md); padding: 8px 12px 8px 34px; font-size: 13px; font-weight: 500; color: var(--color-text-1); outline: none; transition: all 0.2s; }
        .rv-search-input:focus { border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--color-primary-dim); }
        .rv-search-icon { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--color-text-3); pointer-events: none; }
        .rv-search-clear { position: absolute; right: 11px; top: 50%; transform: translateY(-50%); border: none; background: transparent; color: var(--color-text-3); cursor: pointer; padding: 2px; display: flex; align-items: center; justify-content: center; }
        .rv-search-clear:hover { color: var(--color-text-1); }

        /* Analytics Dashboard Grid */
        .rv-analytics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }
        
        /* Star distribution analytics card */
        .rv-star-dist-card { background: #ffffff; border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: 1.25rem; display: flex; align-items: center; gap: 1.5rem; grid-column: span 2; box-shadow: 0 1px 3px rgba(0,2,29,0.02); }
        @media (max-width: 768px) { .rv-star-dist-card { grid-column: span 1; flex-direction: column; align-items: stretch; gap: 1rem; } }
        
        .rv-avg-score-section { display: flex; flex-direction: column; align-items: center; text-align: center; border-right: 1px solid var(--color-border); padding-right: 1.5rem; flex-shrink: 0; }
        @media (max-width: 768px) { .rv-avg-score-section { border-right: none; padding-right: 0; border-bottom: 1px solid var(--color-border); padding-bottom: 1rem; } }
        
        .rv-avg-score-val { font-size: 32px; font-weight: 800; color: #f59e0b; line-height: 1; }
        .rv-avg-score-sub { display: flex; flex-direction: column; align-items: center; gap: 4px; margin-top: 6px; }
        .rv-stars-gold { display: flex; gap: 2px; }
        .rv-avg-reviews-label { font-size: 11px; color: var(--color-text-3); font-weight: 600; }
        
        .rv-stars-distribution { display: flex; flex-direction: column; gap: 4px; flex: 1; }
        .rv-dist-row { display: flex; align-items: center; gap: 8px; font-size: 12px; }
        .rv-dist-label { font-size: 11px; color: var(--color-text-3); width: 16px; font-weight: 700; }
        .rv-dist-bar-bg { flex: 1; height: 6px; background: rgba(0, 2, 29, 0.03); border-radius: 99px; overflow: hidden; }
        .rv-dist-bar-fill { height: 100%; background: #f59e0b; border-radius: 99px; transition: width 0.5s ease; }
        .rv-dist-count { font-size: 11px; color: var(--color-text-3); width: 28px; text-align: right; font-weight: 600; }

        .rv-metric-card { background: #ffffff; border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: 1.25rem; display: flex; align-items: center; gap: 1rem; transition: all 0.2s ease; box-shadow: 0 1px 3px rgba(0,2,29,0.02); }
        .rv-metric-card:hover { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(214, 66, 56, 0.04); border-color: var(--color-primary); }
        .rv-metric-icon { width: 42px; height: 42px; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .rv-metric-label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--color-text-3); letter-spacing: 0.05em; }
        .rv-metric-value { font-size: 20px; font-weight: 800; color: var(--color-text-1); margin-top: 2px; line-height: 1.1; }
        .rv-metric-sub { font-size: 11px; color: var(--color-text-3); margin-top: 2px; }

        /* Filters Card */
        .rv-filters-card { background: #fff; border: 1px solid var(--color-border); border-radius: var(--radius-xl); padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 1rem; box-shadow: 0 1px 3px rgba(0,2,29,0.02); }
        .rv-presets-row { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; border-bottom: 1px solid var(--color-border); padding-bottom: 0.75rem; }
        .rv-presets-label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--color-text-3); letter-spacing: 0.05em; }
        .rv-presets-list { display: flex; gap: 6px; flex-wrap: wrap; }
        .rv-preset-btn { padding: 5px 12px; border-radius: 99px; border: 1px solid var(--color-border-strong); background: transparent; font-size: 12px; font-weight: 600; color: var(--color-text-2); cursor: pointer; transition: all 0.15s ease; }
        .rv-preset-btn:hover { border-color: var(--color-text-3); color: var(--color-text-1); }
        .rv-preset-btn.active { background: var(--color-primary-dim); border-color: var(--color-primary); color: var(--color-primary); }

        .rv-filters-inputs { display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap; }
        .rv-field { display: flex; flex-direction: column; gap: 5px; }
        .rv-field > span { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-3); }
        .rv-input { background: #fff; border: 1px solid var(--color-border-strong); border-radius: 8px; padding: 8px 12px; font-size: 13px; font-weight: 500; color: var(--color-text-1); transition: all .2s; }
        .rv-input:focus { outline: none; border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--color-primary-dim); }
        .rv-clear { display: inline-flex; align-items: center; gap: 5px; height: 38px; padding: 0 12px; border-radius: 8px; border: 1px solid transparent; background: rgba(0,2,29,0.03); font-size: 12.5px; font-weight: 700; color: var(--color-text-2); cursor: pointer; }
        .rv-clear:hover { background: rgba(0,2,29,0.06); }

        /* Loading Skeleton */
        .rv-loading-skeleton { display: flex; flex-direction: column; gap: 8px; }
        .rv-skeleton-row { height: 56px; background: #fff; border: 1px solid var(--color-border); border-radius: 8px; animation: rv-pulse 1.5s infinite ease-in-out; }
        @keyframes rv-pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 0.95; } }

        /* Empty State */
        .rv-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; min-height: 280px; text-align: center; background: #fff; border: 1px solid var(--color-border); border-radius: var(--radius-xl); padding: 2rem; }
        .rv-empty-icon { color: var(--color-text-3); opacity: 0.65; margin-bottom: 6px; }
        .rv-empty-title { font-size: 15px; font-weight: 700; color: var(--color-text-1); }
        .rv-empty-desc { font-size: 13px; color: var(--color-text-3); max-width: 320px; line-height: 1.5; }
        .rv-btn-ghost-small { margin-top: 10px; padding: 6px 12px; font-size: 12.5px; font-weight: 600; border: 1px solid var(--color-border-strong); background: transparent; color: var(--color-text-2); border-radius: 6px; cursor: pointer; }
        .rv-btn-ghost-small:hover { border-color: var(--color-primary); color: var(--color-primary); }

        /* Table Wrapping and Clickable Rows */
        .rv-table-wrap { background: #fff; border: 1px solid var(--color-border); border-radius: var(--radius-xl); overflow-x: auto; box-shadow: 0 1px 3px rgba(0,2,29,0.02); }
        .rv-table { width: 100%; border-collapse: collapse; font-size: 13px; min-width: 900px; }
        .rv-table thead th { text-align: left; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-3); padding: 14px 16px; border-bottom: 1px solid var(--color-border); background: #fcfcfb; }
        .rv-table tbody td { padding: 12px 16px; border-bottom: 1px solid var(--color-border); color: var(--color-text-2); vertical-align: middle; }
        .rv-table tbody tr:last-child td { border-bottom: none; }
        .rv-row-clickable { cursor: pointer; transition: background 0.12s; }
        .rv-row-clickable:hover { background: #fcfcfb; }

        .rv-customer-link { text-decoration: none; display: flex; align-items: center; gap: 10px; width: fit-content; }
        .rv-avatar { width: 34px; height: 34px; border-radius: 99px; background: var(--color-primary-dim); border: 1px solid var(--color-primary-border); display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: var(--color-primary); text-transform: uppercase; flex-shrink: 0; }
        .rv-customer-name { font-weight: 700; color: var(--color-primary); font-size: 13.5px; }
        .rv-customer-phone { font-size: 11px; color: var(--color-text-3); margin-top: 1px; }

        .rv-badge { display: inline-flex; align-items: center; font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 99px; border: 1px solid transparent; white-space: nowrap; }
        .rv-comment-cell { max-width: 320px; }
        .rv-text-quote { font-size: 13px; color: var(--color-text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; font-style: italic; }
        .rv-text-muted { color: var(--color-text-3); font-style: italic; font-size: 12px; }
        
        .rv-type-badge { display: inline-flex; padding: 2.5px 8.5px; border-radius: 99px; font-size: 11px; font-weight: 700; }
        .rv-type-badge.first_visit { background: #f3f4f6; color: #4b5563; }
        .rv-type-badge.repeat { background: #eff6ff; color: #1d4ed8; }
        
        .rv-outlet-date { display: flex; flex-direction: column; gap: 2px; }
        .rv-outlet-pill { display: inline-flex; padding: 1.5px 6.5px; border-radius: 99px; font-size: 10px; font-weight: 700; background: rgba(0,2,29,0.04); color: var(--color-text-2); border: 1px solid var(--color-border); width: fit-content; }
        .rv-date-label { font-size: 11px; color: var(--color-text-3); font-weight: 500; }

        .rv-details-btn {
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
        .rv-row-clickable:hover .rv-details-btn {
          border-color: var(--color-primary);
          color: var(--color-primary);
          background: var(--color-primary-dim);
        }

        /* Review Cards Grid (Pinterest Bubble style) */
        .rv-cards-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.1rem; }
        .rv-review-card { background: #ffffff; border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 1px 3px rgba(0,2,29,0.02); }
        .rv-review-card:hover { transform: translateY(-3px); box-shadow: 0 12px 24px rgba(0,2,29,0.05); border-color: var(--color-border-strong); }
        
        .rv-card-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; border-bottom: 1px solid var(--color-border); padding-bottom: 0.6rem; }
        .rv-card-rating-col { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; }
        .rv-card-date { font-size: 11px; color: var(--color-text-3); font-weight: 600; }
        
        .rv-card-body { padding: 0.25rem 0; }
        .rv-card-quote { font-size: 13.5px; color: var(--color-text-1); line-height: 1.5; font-style: italic; font-weight: 500; }
        .rv-card-quote-empty { font-size: 12.5px; color: var(--color-text-3); font-style: italic; }
        
        .rv-card-footer { display: flex; gap: 6px; flex-wrap: wrap; margin-top: auto; padding-top: 0.4rem; }

        /* Pagination Panel */
        .rv-pager { display: flex; align-items: center; justify-content: space-between; padding: 4px 4px; flex-wrap: wrap; gap: 10px; }
        .rv-pager-info { font-size: 12.5px; font-weight: 600; color: var(--color-text-3); }
        .rv-pager-btns { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
        .rv-pager-btns button, .rv-page-num { display: inline-flex; align-items: center; justify-content: center; height: 34px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--color-border-strong); background: #fff; font-size: 13px; font-weight: 700; color: var(--color-text-2); cursor: pointer; transition: all .15s; }
        .rv-pager-btns button:hover:not(:disabled), .rv-page-num:hover:not(.active) { border-color: var(--color-primary); color: var(--color-primary); }
        .rv-pager-btns button:disabled { opacity: .4; cursor: not-allowed; }
        .rv-page-num.active { background: var(--color-primary); color: #ffffff; border-color: var(--color-primary); }

        /* Drawer Details Layout */
        .rv-drawer-backdrop { position: fixed; inset: 0; background: rgba(0, 2, 29, 0.4); backdrop-filter: blur(4px); z-index: 1000; }
        .rv-drawer-content { position: fixed; top: 0; right: 0; bottom: 0; width: 480px; max-width: 100vw; background: #ffffff; box-shadow: -8px 0 35px rgba(0, 2, 29, 0.12); z-index: 1001; display: flex; flex-direction: column; }
        .rv-drawer-header { padding: 1.5rem; border-bottom: 1px solid var(--color-border); display: flex; justify-content: space-between; align-items: center; }
        .rv-drawer-title { font-size: 1.25rem; font-weight: 800; color: var(--color-text-1); margin: 0; letter-spacing: -0.01em; }
        .rv-drawer-subtitle { font-size: 12px; font-weight: 600; color: var(--color-text-3); margin-top: 2px; }
        .rv-drawer-close { border: none; background: transparent; color: var(--color-text-3); cursor: pointer; padding: 6px; border-radius: 99px; display: flex; align-items: center; justify-content: center; transition: all 0.15s ease; }
        .rv-drawer-close:hover { background: rgba(0,2,29,0.05); color: var(--color-text-1); }
        .rv-drawer-body { padding: 1.5rem; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 1.5rem; }

        /* Quote Section in Drawer */
        .rv-drawer-quote-section { background: rgba(0,2,29,0.015); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: 1.25rem; position: relative; }
        .rv-quote-icon { color: var(--color-primary); opacity: 0.12; position: absolute; right: 1rem; top: 1rem; }
        .rv-drawer-quote { font-size: 14.5px; font-weight: 500; color: var(--color-text-1); line-height: 1.6; font-style: italic; }
        .rv-drawer-quote-empty { font-size: 13.5px; color: var(--color-text-3); font-style: italic; }

        .rv-drawer-section { display: flex; flex-direction: column; gap: 0.75rem; }
        .rv-section-heading { font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--color-text-3); letter-spacing: 0.06em; border-bottom: 1px solid var(--color-border); padding-bottom: 4px; }
        
        /* Guest Profile Card in Drawer */
        .rv-guest-profile-card { display: flex; align-items: center; gap: 1rem; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: 1rem; }
        .rv-profile-name { font-size: 15px; font-weight: 700; color: var(--color-text-1); margin: 0; }
        .rv-profile-details { display: flex; flex-direction: column; gap: 3px; margin-top: 4px; }
        .rv-profile-link { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--color-text-2); text-decoration: none; font-weight: 600; }
        .rv-profile-link:hover { color: var(--color-primary); }
        .rv-profile-view-link { font-size: 12px; color: var(--color-primary); font-weight: 700; text-decoration: none; display: inline-block; margin-top: 2px; }
        .rv-profile-view-link:hover { text-decoration: underline; }

        /* AI Sentiment Box in Drawer */
        .rv-sentiment-analysis-box { background: #fafaf9; border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: 1.1rem; display: flex; flex-direction: column; gap: 1rem; }
        .rv-sentiment-header-row { display: flex; justify-content: space-between; align-items: center; font-size: 12.5px; font-weight: 700; color: var(--color-text-1); }
        
        .rv-sentiment-score-wrapper { display: flex; flex-direction: column; gap: 5px; }
        .rv-score-labels { display: flex; justify-content: space-between; font-size: 12px; font-weight: 600; }
        .rv-score-label { color: var(--color-text-2); }
        .rv-score-val { font-weight: 700; }
        .rv-score-bar-bg { height: 8px; background: rgba(0,2,29,0.06); border-radius: 99px; position: relative; overflow: hidden; }
        .rv-score-center-line { position: absolute; left: 50%; top: 0; bottom: 0; width: 2px; background: rgba(0,2,29,0.15); z-index: 2; }
        .rv-score-fill-bar { height: 100%; position: absolute; border-radius: 99px; }
        .rv-score-limits { display: flex; justify-content: space-between; font-size: 10px; color: var(--color-text-3); font-weight: 600; margin-top: 1px; }

        .rv-sentiment-keywords-section { border-top: 1px solid var(--color-border); padding-top: 0.75rem; }
        .rv-keywords-heading { font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--color-text-3); letter-spacing: 0.05em; margin-bottom: 6px; }
        .rv-keywords-list { display: flex; gap: 6px; flex-wrap: wrap; }
        .rv-keyword-tag { background: #ffffff; border: 1px solid var(--color-border-strong); padding: 3px 8px; border-radius: 6px; font-size: 11.5px; font-weight: 600; color: var(--color-text-2); }

        /* Details Grid in Drawer */
        .rv-details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem 1rem; }
        .rv-detail-item { display: flex; flex-direction: column; gap: 2px; }
        .rv-detail-label { font-size: 11px; color: var(--color-text-3); font-weight: 600; }
        .rv-detail-value { font-size: 13px; color: var(--color-text-1); font-weight: 700; }
        .rv-maps-link { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: var(--color-primary); font-weight: 700; text-decoration: none; width: fit-content; margin-top: 2px; }
        .rv-maps-link:hover { text-decoration: underline; }

        .rv-drawer-footer { padding: 1.25rem 1.5rem; border-top: 1px solid var(--color-border); background: var(--color-bg); }
        .rv-drawer-footer-close-btn { width: 100%; display: flex; align-items: center; justify-content: center; height: 40px; border-radius: 8px; border: 1px solid var(--color-border-strong); background: #ffffff; font-size: 13px; font-weight: 700; color: var(--color-text-1); cursor: pointer; transition: all 0.15s ease; }
        .rv-drawer-footer-close-btn:hover { background: #fafaf9; border-color: var(--color-text-3); }
      `}</style>
    </div>
  )
}
