'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { format } from 'date-fns'
import ReviewCard from '@/components/cms/ReviewCard'
import type { Customer, Review, PageResponse } from '@/types/api'

export default function CustomerDetailPage() {
  const params = useParams()
  const id = params.id as string
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get<Customer>(`/cms/customers/${id}`),
      api.get<PageResponse<Review>>(`/cms/reviews?customerId=${id}&size=20`),
    ])
      .then(([cRes, rRes]) => {
        setCustomer(cRes.data)
        setReviews(rRes.data.content)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-3)' }}>Loading profile...</div>
  }

  if (!customer) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">⚠️</div>
        <div className="empty-state-title">Customer not found</div>
        <div className="empty-state-desc">The customer may not exist or you don't have access.</div>
        <Link href="/customers" style={{ marginTop: 16, display: 'inline-block' }}>
          <button className="btn-ghost">← Back to Customers</button>
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <Link href="/customers" style={{ textDecoration: 'none', color: 'var(--color-text-3)', fontSize: 13, display: 'inline-block', marginBottom: 12 }}>
          ← Back to Customers
        </Link>
        <h1 className="page-title">{customer.fullName}</h1>
        <p className="page-subtitle">Customer Profile</p>
      </div>

      <div className="page-content">
        <div style={{ display: 'grid', gap: 24, gridTemplateColumns: '1fr 320px', alignItems: 'start' }}>
          
          {/* Main Info Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            
            {/* Identity Card */}
            <div className="card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px 16px' }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Phone Number</div>
                <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--color-text-1)' }}>{customer.phone}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Email Address</div>
                <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--color-text-1)' }}>{customer.email || '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Demographics</div>
                <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--color-text-1)' }}>{customer.gender} · {customer.maritalStatus}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>First Visit Outlet</div>
                <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--color-text-1)' }}>
                  <span style={{
                    display: 'inline-flex', padding: '2px 8px', borderRadius: 99,
                    fontSize: 11, fontWeight: 600, background: 'rgba(255,255,255,0.05)', color: 'var(--color-text-2)'
                  }}>
                    {customer.firstVisitOutlet?.code}
                  </span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Birthday</div>
                <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--color-text-1)' }}>{customer.birthDate ? format(new Date(customer.birthDate), 'dd MMM yyyy') : '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Anniversary</div>
                <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--color-text-1)' }}>{customer.anniversaryDate ? format(new Date(customer.anniversaryDate), 'dd MMM yyyy') : '—'}</div>
              </div>
            </div>

            {/* Reviews Section */}
            <div>
              <div className="section-title">Customer Reviews ({reviews.length})</div>
              {reviews.length === 0 ? (
                <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-3)' }}>
                  No reviews submitted yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {reviews.map(r => <ReviewCard key={r.id} review={r} />)}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar Column (Stats & Timeline) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            
            {/* Quick Stats */}
            <div className="card" style={{ background: 'var(--color-primary-dim)', borderColor: 'var(--color-primary-border)', padding: 24 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 8 }}>Total Visits</div>
                <div style={{ fontSize: 42, fontWeight: 800, color: 'var(--color-primary)', lineHeight: 1 }}>{customer.totalVisits}</div>
              </div>
              <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--color-primary-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--color-text-2)' }}>Last Visit</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-1)' }}>
                    {customer.lastVisitDate ? format(new Date(customer.lastVisitDate), 'dd MMM yy') : '—'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: 'var(--color-text-2)' }}>Joined</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-1)' }}>
                    {format(new Date(customer.createdAt), 'dd MMM yy')}
                  </span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
