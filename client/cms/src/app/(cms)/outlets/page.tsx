'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import Link from 'next/link'
import type { OutletStats } from '@/types/api'

export default function OutletsPage() {
  const { isOwnerOrAbove } = useAuth()
  const [stats, setStats] = useState<OutletStats[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Only fetch if admin or owner
    if (!isOwnerOrAbove) {
      setLoading(false)
      return
    }
    
    api.get<OutletStats[]>('/cms/outlets/stats')
      .then(res => setStats(res.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [isOwnerOrAbove])

  if (!isOwnerOrAbove) {
    return (
      <div className="p-8 text-center text-error">
        Access Denied. Only Admin and Owners can view all outlets.
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Outlet Performance</h1>
        <p className="page-subtitle">Real-time statistics across all branches</p>
      </div>

      <div className="page-content">
        
        {loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 24 }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} style={{ height: 260, background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        )}

        {!loading && stats.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">🏪</div>
            <div className="empty-state-title">No outlets found</div>
            <div className="empty-state-desc">Outlet data could not be loaded.</div>
          </div>
        )}

        {!loading && stats.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 24 }}>
            {stats.map(os => (
              <div key={os.outletId} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 4 }}>
                      {os.outletName}
                    </h2>
                    <span style={{ 
                      display: 'inline-flex', padding: '2px 8px', borderRadius: 99, 
                      fontSize: 11, fontWeight: 600, background: 'rgba(255,255,255,0.05)', color: 'var(--color-text-2)' 
                    }}>
                      {os.outletCode}
                    </span>
                  </div>
                  {os.googleMapsUrl && (
                    <a href={os.googleMapsUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: 12, fontWeight: 500 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                      </svg>
                      Maps
                    </a>
                  )}
                </div>

                {/* Primary Metrics Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Total Customers</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text-1)' }}>{os.totalCustomers}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-success)', marginTop: 2 }}>+{os.newCustomersThisMonth} this month</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Avg Rating</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {os.averageRating?.toFixed(1) ?? '—'} <span style={{ fontSize: 16 }}>★</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>{os.totalReviews} reviews</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Visits This Month</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text-1)' }}>{os.visitsThisMonth}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>{os.totalVisits} total</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Inactive Risk</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: os.inactiveCustomers > 10 ? 'var(--color-danger)' : 'var(--color-text-1)' }}>
                      {os.inactiveCustomers}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>No visit 30d+</div>
                  </div>
                </div>

                {/* Action Bar */}
                <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--color-border)', display: 'flex', gap: 12 }}>
                  <Link href={`/customers?outletId=${os.outletId}`} style={{ flex: 1, textDecoration: 'none' }}>
                    <button className="btn-ghost" style={{ width: '100%', justifyContent: 'center', fontSize: 12 }}>
                      View Customers
                    </button>
                  </Link>
                  <Link href={`/reviews?outletId=${os.outletId}`} style={{ flex: 1, textDecoration: 'none' }}>
                    <button className="btn-ghost" style={{ width: '100%', justifyContent: 'center', fontSize: 12 }}>
                      View Reviews
                    </button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
