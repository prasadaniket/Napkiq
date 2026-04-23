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

          {/* Sidebar Column (Stats & Visit Timeline) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            
            {/* Quick Stats */}
            <div className="card" style={{ background: 'var(--color-primary-dim)', borderColor: 'var(--color-primary-border)', padding: 24 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 8 }}>Total Visits</div>
                <div style={{ fontSize: 42, fontWeight: 800, color: 'var(--color-primary)', lineHeight: 1 }}>{customer.totalVisits}</div>
              </div>
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--color-primary-border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
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
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: 'var(--color-text-2)' }}>Review</span>
                  <span style={{
                    fontSize: 11, fontWeight: 600,
                    padding: '1px 7px', borderRadius: 99,
                    background: customer.hasSubmittedFirstReview ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                    color: customer.hasSubmittedFirstReview ? 'var(--color-success)' : 'var(--color-danger)',
                  }}>
                    {customer.hasSubmittedFirstReview ? 'Submitted' : 'Pending'}
                  </span>
                </div>
              </div>
            </div>

            {/* Visit History Timeline */}
            {customer.visits && customer.visits.length > 0 && (
              <div className="card" style={{ padding: '16px 20px' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-1)', marginBottom: 14 }}>
                  Visit History
                  <span style={{ fontSize: 11, color: 'var(--color-text-3)', marginLeft: 8 }}>(last {customer.visits.length})</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {customer.visits.map((v, idx) => (
                    <div key={v.id} style={{ display: 'flex', gap: 12, paddingBottom: idx === customer.visits!.length - 1 ? 0 : 14, position: 'relative' }}>
                      {/* Timeline line */}
                      {idx < customer.visits!.length - 1 && (
                        <div style={{ position: 'absolute', left: 10, top: 20, bottom: 0, width: 1, background: 'var(--color-border)' }} />
                      )}
                      {/* Dot */}
                      <div style={{
                        width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                        background: v.visitType === 'qr_scan' ? 'rgba(59,130,246,0.15)' : 'rgba(34,197,94,0.15)',
                        border: `1.5px solid ${v.visitType === 'qr_scan' ? 'var(--color-info)' : 'var(--color-success)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1,
                      }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: v.visitType === 'qr_scan' ? 'var(--color-info)' : 'var(--color-success)' }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-1)' }}>
                          {v.visitType === 'qr_scan' ? 'QR Scan' : 'Payment'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-3)', marginTop: 2 }}>
                          {format(new Date(v.visitedAt), 'dd MMM yy, HH:mm')}
                          {v.outlet && (
                            <span style={{ marginLeft: 6, background: 'rgba(255,255,255,0.05)', padding: '0 5px', borderRadius: 4 }}>
                              {v.outlet.code}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {customer.visits && customer.visits.length === 0 && (
              <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-3)' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>📅</div>
                <div style={{ fontSize: 13 }}>No visits recorded yet</div>
              </div>
            )}

          </div>

        </div>
      </div>
    </div>
  )
}
