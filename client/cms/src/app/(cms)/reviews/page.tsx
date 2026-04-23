'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { format } from 'date-fns'
import type { Review, PageResponse, ReviewSummary } from '@/types/api'

function useDebounce<T>(value: T, delay: number): T {
  const [dv, setDv] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDv(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return dv
}

// ─── Star row ────────────────────────────────────────────────────────────────
function StarBar({ s, count, total }: { s: number; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 11, color: 'var(--color-text-3)', width: 8, textAlign: 'right' }}>{s}</span>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="#f59e0b" stroke="none">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
      <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: '#f59e0b', borderRadius: 99, transition: 'width 0.5s ease' }} />
      </div>
      <span style={{ fontSize: 10, color: 'var(--color-text-3)', width: 22, textAlign: 'right' }}>{count}</span>
    </div>
  )
}

// ─── Inline Review Row (table layout) ────────────────────────────────────────
function ReviewRow({ review }: { review: Review }) {
  const stars = Array.from({ length: 5 }, (_, i) => i < review.stars)
  return (
    <tr>
      <td>
        <Link href={`/customers/${review.customerId}`} style={{ textDecoration: 'none' }}>
          <div style={{ fontWeight: 600, color: 'var(--color-primary)', fontSize: 13 }}>{review.customer?.fullName ?? '—'}</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-3)' }}>{review.customer?.phone}</div>
        </Link>
      </td>
      <td>
        <div style={{ display: 'flex', gap: 2 }}>
          {stars.map((filled, i) => (
            <svg key={i} width="13" height="13" viewBox="0 0 24 24" fill={filled ? '#f59e0b' : 'none'} stroke={filled ? '#f59e0b' : 'var(--color-border-strong)'} strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          ))}
        </div>
      </td>
      <td style={{ fontSize: 13, color: 'var(--color-text-2)', maxWidth: 280 }}>
        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {review.comment ? `"${review.comment}"` : <span style={{ color: 'var(--color-text-3)', fontStyle: 'italic' }}>No comment</span>}
        </div>
      </td>
      <td>
        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 99, background: 'rgba(255,255,255,0.05)', color: 'var(--color-text-2)', textTransform: 'capitalize' }}>
          {review.reviewType === 'first_visit' ? 'First Visit' : 'Repeat'}
        </span>
      </td>
      <td style={{ fontSize: 11, color: 'var(--color-text-3)' }}>
        {review.outlet?.code && (
          <span style={{ display: 'inline-flex', padding: '1px 6px', borderRadius: 99, background: 'rgba(255,255,255,0.04)', marginBottom: 2 }}>
            {review.outlet.code}
          </span>
        )}
        <div>{format(new Date(review.createdAt), 'dd MMM yy')}</div>
      </td>
    </tr>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ReviewsPage() {
  const searchParams = useSearchParams()

  const [reviews, setReviews] = useState<Review[]>([])
  const [summary, setSummary] = useState<ReviewSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'cards' | 'table'>('table')

  // Filters
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [stars, setStars] = useState('')
  const [type, setType] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const [outletId] = useState(() => searchParams.get('outletId') ?? '')
  const debouncedSearch = useDebounce(search, 400)

  const buildQuery = useCallback(() => {
    const q = new URLSearchParams({ page: page.toString(), size: '20' })
    if (debouncedSearch) q.append('search', debouncedSearch)
    if (stars)    q.append('stars', stars)
    if (type)     q.append('type', type)
    if (dateFrom) q.append('dateFrom', dateFrom)
    if (dateTo)   q.append('dateTo', dateTo)
    if (outletId) q.append('outletId', outletId)
    return q.toString()
  }, [page, debouncedSearch, stars, type, dateFrom, dateTo, outletId])

  const fetchReviews = useCallback(async () => {
    setLoading(true)
    try {
      const q = buildQuery()
      const [revRes, sumRes] = await Promise.all([
        api.get<PageResponse<Review>>(`/cms/reviews?${q}`),
        api.get<ReviewSummary>(`/cms/reviews/summary?${q}`),
      ])
      setReviews(revRes.data.content)
      setTotal(revRes.data.totalElements)
      setSummary(sumRes.data)
    } catch { setReviews([]) }
    finally { setLoading(false) }
  }, [buildQuery])

  useEffect(() => { fetchReviews() }, [fetchReviews])
  useEffect(() => { setPage(0) }, [debouncedSearch, stars, type, dateFrom, dateTo])

  const hasFilters = !!stars || !!type || !!dateFrom || !!dateTo || !!debouncedSearch
  const clearFilters = () => { setSearch(''); setStars(''); setType(''); setDateFrom(''); setDateTo('') }
  const totalPages = Math.ceil(total / 20)

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 className="page-title">Reviews</h1>
            <p className="page-subtitle">
              {outletId ? 'Filtered by outlet — ' : ''}
              {total > 0 && !loading ? `${total.toLocaleString()} reviews` : 'Track and analyze customer feedback'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {/* View toggle */}
            <div style={{ display: 'flex', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
              {(['table', 'cards'] as const).map(v => (
                <button key={v} onClick={() => setView(v)} style={{
                  padding: '7px 14px', fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer',
                  background: view === v ? 'rgba(255,255,255,0.08)' : 'transparent',
                  color: view === v ? 'var(--color-text-1)' : 'var(--color-text-3)',
                  transition: 'all 0.15s',
                }}>
                  {v === 'table' ? '≡ Table' : '⊞ Cards'}
                </button>
              ))}
            </div>
            {/* Search */}
            <div style={{ position: 'relative' }}>
              <input className="input" placeholder="Search customer…" value={search}
                onChange={e => setSearch(e.target.value)} style={{ width: 220, paddingLeft: 34 }} />
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-3)" strokeWidth="2"
                style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="page-content">
        {/* Two-column layout: filters + summary */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 20, marginBottom: 24, alignItems: 'start' }}>

          {/* Filter chips */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <select className="input" style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }}
              value={stars} onChange={e => setStars(e.target.value)}>
              <option value="">All Ratings</option>
              {[5, 4, 3, 2, 1].map(s => <option key={s} value={s}>{'★'.repeat(s)} {s} Star{s > 1 ? 's' : ''}</option>)}
            </select>

            <select className="input" style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }}
              value={type} onChange={e => setType(e.target.value)}>
              <option value="">All Visit Types</option>
              <option value="first_visit">First Visit</option>
              <option value="repeat">Repeat</option>
            </select>

            <input type="date" className="input" style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }}
              value={dateFrom} onChange={e => setDateFrom(e.target.value)} title="From date" />
            <span style={{ fontSize: 12, color: 'var(--color-text-3)' }}>–</span>
            <input type="date" className="input" style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }}
              value={dateTo} onChange={e => setDateTo(e.target.value)} title="To date" />

            {hasFilters && (
              <button className="btn-ghost" style={{ fontSize: 12, color: 'var(--color-text-3)' }} onClick={clearFilters}>
                ✕ Clear
              </button>
            )}
          </div>

          {/* Summary panel */}
          {summary && (
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '14px 18px', minWidth: 200 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 12 }}>
                <span style={{ fontSize: 28, fontWeight: 800, color: '#f59e0b', lineHeight: 1 }}>
                  {summary.averageRating?.toFixed(1) ?? '—'}
                </span>
                <span style={{ fontSize: 16, color: '#f59e0b' }}>★</span>
                <span style={{ fontSize: 12, color: 'var(--color-text-3)' }}>{summary.totalReviews} reviews</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {[5, 4, 3, 2, 1].map(s => {
                  const d = summary.distribution.find(x => x.stars === s)
                  return <StarBar key={s} s={s} count={d?.count ?? 0} total={summary.totalReviews} />
                })}
              </div>
            </div>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} style={{ height: 52, background: 'var(--color-surface)', borderRadius: 8, opacity: 0.5, animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
            <style>{`@keyframes pulse{0%,100%{opacity:0.4}50%{opacity:0.8}}`}</style>
          </div>
        )}

        {/* Empty */}
        {!loading && reviews.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">⭐</div>
            <div className="empty-state-title">No reviews found</div>
            <div className="empty-state-desc">Try adjusting your filters or search query.</div>
            {hasFilters && <button className="btn-ghost" style={{ marginTop: 16 }} onClick={clearFilters}>Clear all filters</button>}
          </div>
        )}

        {/* TABLE view */}
        {!loading && reviews.length > 0 && view === 'table' && (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Rating</th>
                  <th>Comment</th>
                  <th>Type</th>
                  <th>Outlet / Date</th>
                </tr>
              </thead>
              <tbody>
                {reviews.map(r => <ReviewRow key={r.id} review={r} />)}
              </tbody>
            </table>
          </div>
        )}

        {/* CARDS view */}
        {!loading && reviews.length > 0 && view === 'cards' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
            {reviews.map(review => {
              const stars = Array.from({ length: 5 }, (_, i) => i < review.stars)
              return (
                <div key={review.id} className="card" style={{ padding: '16px 18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <Link href={`/customers/${review.customerId}`} style={{ textDecoration: 'none' }}>
                      <div style={{ fontWeight: 600, color: 'var(--color-primary)', fontSize: 14 }}>{review.customer?.fullName ?? '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-3)' }}>{review.customer?.phone}</div>
                    </Link>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                        {stars.map((f, i) => (
                          <svg key={i} width="13" height="13" viewBox="0 0 24 24" fill={f ? '#f59e0b' : 'none'} stroke={f ? '#f59e0b' : 'var(--color-border-strong)'} strokeWidth="2">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                          </svg>
                        ))}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--color-text-3)', marginTop: 3 }}>{format(new Date(review.createdAt), 'dd MMM yy')}</div>
                    </div>
                  </div>
                  {review.comment && (
                    <p style={{ fontSize: 13, color: 'var(--color-text-2)', lineHeight: 1.6, margin: '0 0 10px' }}>"{review.comment}"</p>
                  )}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 99, background: 'rgba(255,255,255,0.05)', color: 'var(--color-text-3)' }}>
                      {review.reviewType === 'first_visit' ? 'First Visit' : 'Repeat'}
                    </span>
                    {review.outlet?.code && (
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 99, background: 'rgba(255,255,255,0.05)', color: 'var(--color-text-3)' }}>
                        {review.outlet.code}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Pagination */}
        {!loading && reviews.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 20 }}>
            <span style={{ fontSize: 13, color: 'var(--color-text-3)' }}>
              {total.toLocaleString()} reviews · Page {page + 1} of {totalPages || 1}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-ghost" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Prev</button>
              <button className="btn-ghost" disabled={page + 1 >= totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
