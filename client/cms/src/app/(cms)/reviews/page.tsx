'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import ReviewCard from '@/components/cms/ReviewCard'
import type { Review, PageResponse, ReviewSummary } from '@/types/api'

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(handler)
  }, [value, delay])
  return debouncedValue
}

export default function ReviewsPage() {
  const { isOwnerOrAbove } = useAuth()
  const searchParams = useSearchParams()
  
  const [reviews, setReviews] = useState<Review[]>([])
  const [summary, setSummary] = useState<ReviewSummary | null>(null)
  const [loading, setLoading] = useState(true)
  
  // Filters & Pagination
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [stars, setStars] = useState<string>('')
  const [type, setType] = useState<string>('')
  
  // Pre-populate outletId from URL if coming from Outlets deep link
  const [outletId] = useState<string>(() => searchParams.get('outletId') ?? '')
  
  const debouncedSearch = useDebounce(search, 500)

  const fetchReviews = useCallback(async () => {
    setLoading(true)
    try {
      const q = new URLSearchParams({ page: page.toString(), size: '20' })
      if (debouncedSearch) q.append('search', debouncedSearch)
      if (stars) q.append('stars', stars)
      if (type) q.append('type', type)
      if (outletId) q.append('outletId', outletId)
      
      const [revRes, sumRes] = await Promise.all([
        api.get<PageResponse<Review>>(`/cms/reviews?${q.toString()}`),
        api.get<ReviewSummary>(`/cms/reviews/summary?${q.toString()}`),
      ])
      
      setReviews(revRes.data.content)
      setTotal(revRes.data.totalElements)
      setSummary(sumRes.data)
    } catch (err) {
      console.error(err)
      setReviews([])
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, stars, type, outletId])

  useEffect(() => {
    fetchReviews()
  }, [fetchReviews])

  useEffect(() => {
    setPage(0)
  }, [debouncedSearch, stars, type])

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 className="page-title">Reviews</h1>
            <p className="page-subtitle">Track and analyze customer feedback</p>
          </div>
          <div style={{ position: 'relative' }}>
            <input 
              className="input"
              placeholder="Search by customer name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: 260, paddingLeft: 36 }}
            />
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-3)" strokeWidth="2" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </div>
        </div>
      </div>

      <div className="page-content">
        
        {/* Filters & Summary Row */}
        <div style={{ display: 'flex', gap: 24, marginBottom: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          
          <div style={{ display: 'flex', gap: 12, flex: 1 }}>
            <select className="input" style={{ width: 140, padding: '8px 12px', fontSize: 13 }} value={stars} onChange={e => setStars(e.target.value)}>
              <option value="">All Ratings</option>
              <option value="5">5 Stars only</option>
              <option value="4">4 Stars</option>
              <option value="3">3 Stars</option>
              <option value="2">2 Stars</option>
              <option value="1">1 Star</option>
            </select>
            
            <select className="input" style={{ width: 150, padding: '8px 12px', fontSize: 13 }} value={type} onChange={e => setType(e.target.value)}>
              <option value="">All Visit Types</option>
              <option value="first_visit">First Visit</option>
              <option value="repeat">Repeat Visit</option>
            </select>
          </div>

          {summary && (
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '10px 16px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Avg Rating</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {summary.averageRating?.toFixed(1) ?? '—'} <span style={{ fontSize: 14 }}>★</span>
                </div>
              </div>
              <div style={{ width: 1, height: 30, background: 'var(--color-border)' }} />
              <div>
                <div style={{ fontSize: 11, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Filtered Total</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-1)' }}>{summary.totalReviews}</div>
              </div>
            </div>
          )}
        </div>

        {loading && <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-3)' }}>Loading reviews...</div>}

        {!loading && reviews.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">⭐</div>
            <div className="empty-state-title">No reviews found</div>
            <div className="empty-state-desc">Try adjusting your filters or search query.</div>
          </div>
        )}

        {!loading && reviews.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {reviews.map(review => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>
        )}

        {!loading && reviews.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 24, justifyContent: 'center' }}>
            <button className="btn-ghost" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Prev</button>
            <span style={{ fontSize: 13, color: 'var(--color-text-3)' }}>Page {page + 1}</span>
            <button className="btn-ghost" disabled={(page + 1) * 20 >= total} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        )}

      </div>
    </div>
  )
}
