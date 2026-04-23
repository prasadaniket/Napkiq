'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { format, differenceInDays } from 'date-fns'
import type { Customer, PageResponse } from '@/types/api'

function useDebounce<T>(value: T, delay: number): T {
  const [dv, setDv] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDv(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return dv
}

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(' ')
  const ini = (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')
  return (
    <div style={{
      width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
      background: 'var(--color-primary-dim)', border: '1px solid var(--color-primary-border)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 12, fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase',
    }}>
      {ini.toUpperCase()}
    </div>
  )
}

export default function CustomersPage() {
  const { isOwnerOrAbove } = useAuth()
  const searchParams = useSearchParams()

  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)

  // Filters
  const [search, setSearch] = useState('')
  const [inactive, setInactive] = useState(false)
  const [gender, setGender] = useState('')
  const [hasReview, setHasReview] = useState('')
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // Pre-populate outletId from URL (deep link from Outlets page)
  const [outletId] = useState(() => searchParams.get('outletId') ?? '')

  const debouncedSearch = useDebounce(search, 400)

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    try {
      const q = new URLSearchParams({ page: page.toString(), size: '20', sortBy, sortDir })
      if (debouncedSearch) q.append('search', debouncedSearch)
      if (inactive)   q.append('inactive', 'true')
      if (gender)     q.append('gender', gender)
      if (hasReview)  q.append('hasReview', hasReview)
      if (outletId)   q.append('outletId', outletId)

      const res = await api.get<PageResponse<Customer>>(`/cms/customers?${q}`)
      setCustomers(res.data.content)
      setTotal(res.data.totalElements)
    } catch { setCustomers([]) }
    finally { setLoading(false) }
  }, [page, debouncedSearch, inactive, gender, hasReview, sortBy, sortDir, outletId])

  useEffect(() => { fetchCustomers() }, [fetchCustomers])
  useEffect(() => { setPage(0) }, [debouncedSearch, inactive, gender, hasReview, sortBy, sortDir])

  const hasFilters = inactive || !!gender || !!hasReview || !!debouncedSearch
  const clearFilters = () => {
    setSearch(''); setInactive(false); setGender(''); setHasReview('')
    setSortBy('createdAt'); setSortDir('desc')
  }

  const totalPages = Math.ceil(total / 20)

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 className="page-title">Customers</h1>
            <p className="page-subtitle">
              {outletId ? 'Filtered by outlet — ' : ''}
              {total > 0 && !loading ? `${total.toLocaleString()} total` : 'Manage your customer base'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Search */}
            <div style={{ position: 'relative' }}>
              <input
                className="input"
                placeholder="Search name, phone, email…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: 240, paddingLeft: 36 }}
              />
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-3)" strokeWidth="2"
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </div>
            {/* Export */}
            {isOwnerOrAbove && (
              <a href={`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api'}/cms/export/customers`}
                target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                <button className="btn-ghost" style={{ gap: 6, fontSize: 13 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Export CSV
                </button>
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="page-content">

        {/* Filter bar */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Gender */}
          <select className="input" style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }}
            value={gender} onChange={e => setGender(e.target.value)}>
            <option value="">All Genders</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Transgender">Transgender</option>
            <option value="RatherNotSay">Rather Not Say</option>
          </select>

          {/* Review status */}
          <select className="input" style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }}
            value={hasReview} onChange={e => setHasReview(e.target.value)}>
            <option value="">All Review Status</option>
            <option value="true">Review Submitted</option>
            <option value="false">Review Pending</option>
          </select>

          {/* Sort */}
          <select className="input" style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }}
            value={`${sortBy}-${sortDir}`}
            onChange={e => {
              const [s, d] = e.target.value.split('-')
              setSortBy(s); setSortDir(d as 'asc' | 'desc')
            }}>
            <option value="createdAt-desc">Newest First</option>
            <option value="createdAt-asc">Oldest First</option>
            <option value="lastVisitDate-desc">Recent Visit</option>
            <option value="totalVisits-desc">Most Visits</option>
          </select>

          {/* Inactive toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--color-text-2)', cursor: 'pointer',
            background: inactive ? 'rgba(239,68,68,0.1)' : 'transparent',
            border: `1px solid ${inactive ? 'rgba(239,68,68,0.3)' : 'var(--color-border)'}`,
            borderRadius: 8, padding: '5px 10px', transition: 'all 0.2s',
          }}>
            <input type="checkbox" checked={inactive} onChange={e => setInactive(e.target.checked)} style={{ accentColor: 'var(--color-danger)' }}/>
            <span style={{ color: inactive ? 'var(--color-danger)' : 'var(--color-text-2)' }}>Inactive 30d+</span>
          </label>

          {/* Clear */}
          {hasFilters && (
            <button className="btn-ghost" style={{ fontSize: 12, color: 'var(--color-text-3)' }} onClick={clearFilters}>
              ✕ Clear filters
            </button>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} style={{ height: 56, background: 'var(--color-surface)', borderRadius: 8, opacity: 0.5, animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
            <style>{`@keyframes pulse { 0%,100%{opacity:0.4}50%{opacity:0.8} }`}</style>
          </div>
        )}

        {/* Empty state */}
        {!loading && customers.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">🔍</div>
            <div className="empty-state-title">No customers found</div>
            <div className="empty-state-desc">Try adjusting your search or filters.</div>
            {hasFilters && <button className="btn-ghost" style={{ marginTop: 16 }} onClick={clearFilters}>Clear all filters</button>}
          </div>
        )}

        {/* Table */}
        {!loading && customers.length > 0 && (
          <>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Contact</th>
                    {isOwnerOrAbove && <th>Outlet</th>}
                    <th>Visits</th>
                    <th>Last Visit</th>
                    <th>Status</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map(c => {
                    const daysSinceVisit = c.lastVisitDate ? differenceInDays(new Date(), new Date(c.lastVisitDate)) : null
                    const isInactive = daysSinceVisit !== null && daysSinceVisit >= 30
                    return (
                      <tr key={c.id}>
                        <td>
                          <Link href={`/customers/${c.id}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Initials name={c.fullName} />
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{c.fullName}</div>
                              <div style={{ fontSize: 11, color: 'var(--color-text-3)' }}>{c.gender} · {c.maritalStatus}</div>
                            </div>
                          </Link>
                        </td>
                        <td>
                          <div style={{ fontSize: 13, color: 'var(--color-text-1)' }}>{c.phone}</div>
                          {c.email && <div style={{ fontSize: 11, color: 'var(--color-text-3)' }}>{c.email}</div>}
                        </td>
                        {isOwnerOrAbove && (
                          <td>
                            <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600, background: 'rgba(255,255,255,0.05)', color: 'var(--color-text-2)' }}>
                              {c.firstVisitOutlet?.code ?? '—'}
                            </span>
                          </td>
                        )}
                        <td>
                          <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600, background: 'var(--color-primary-dim)', color: 'var(--color-primary)' }}>
                            {c.totalVisits}
                          </span>
                        </td>
                        <td style={{ fontSize: 12 }}>
                          {c.lastVisitDate ? (
                            <div>
                              <div style={{ color: isInactive ? 'var(--color-danger)' : 'var(--color-text-1)' }}>
                                {format(new Date(c.lastVisitDate), 'dd MMM yy')}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--color-text-3)' }}>
                                {daysSinceVisit === 0 ? 'Today' : `${daysSinceVisit}d ago`}
                              </div>
                            </div>
                          ) : '—'}
                        </td>
                        <td>
                          {c.hasSubmittedFirstReview ? (
                            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: 'rgba(34,197,94,0.12)', color: 'var(--color-success)' }}>
                              ✓ Review
                            </span>
                          ) : (
                            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: 'rgba(239,68,68,0.10)', color: 'var(--color-danger)' }}>
                              Pending
                            </span>
                          )}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--color-text-3)' }}>
                          {format(new Date(c.createdAt), 'dd MMM yy')}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: 'var(--color-text-3)' }}>
                {total.toLocaleString()} customers · Page {page + 1} of {totalPages}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-ghost" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Prev</button>
                <button className="btn-ghost" disabled={page + 1 >= totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
