'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { format, differenceInDays, isThisMonth } from 'date-fns'
import ReviewCard from '@/components/cms/ReviewCard'
import type { Customer } from '@/types/api'

// ─── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ name }: { name: string }) {
  const parts = name.trim().split(' ')
  const ini = ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase()
  return (
    <div style={{
      width: 64, height: 64, borderRadius: '50%', flexShrink: 0,
      background: 'var(--color-primary-dim)', border: '2px solid var(--color-primary-border)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 22, fontWeight: 800, color: 'var(--color-primary)',
    }}>{ini}</div>
  )
}

// ─── Info Row ──────────────────────────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ fontSize: 10, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-1)' }}>{value}</div>
    </div>
  )
}

export default function CustomerDetailPage() {
  const params = useParams()
  const id = params.id as string
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Backend /:id endpoint now embeds both visits[] and reviews[] — single fetch
    api.get<Customer>(`/cms/customers/${id}`)
      .then(res => setCustomer(res.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return <div style={{ padding: 64, textAlign: 'center', color: 'var(--color-text-3)' }}>Loading profile…</div>
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

  const daysSinceVisit = customer.lastVisitDate ? differenceInDays(new Date(), new Date(customer.lastVisitDate)) : null
  const isInactive = daysSinceVisit !== null && daysSinceVisit >= 30
  const hasBirthdayThisMonth = customer.birthDate && isThisMonth(new Date(customer.birthDate))
  const hasAnniversaryThisMonth = customer.anniversaryDate && isThisMonth(new Date(customer.anniversaryDate))
  const reviews = customer.reviews ?? []

  return (
    <div>
      <div className="page-header">
        <Link href="/customers" style={{ textDecoration: 'none', color: 'var(--color-text-3)', fontSize: 13, display: 'inline-block', marginBottom: 14 }}>
          ← Back to Customers
        </Link>

        {/* Header row with avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Avatar name={customer.fullName} />
          <div>
            <h1 className="page-title" style={{ marginBottom: 4 }}>{customer.fullName}</h1>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--color-text-3)' }}>Joined {format(new Date(customer.createdAt), 'dd MMM yyyy')}</span>
              {isInactive && (
                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: 'rgba(239,68,68,0.12)', color: 'var(--color-danger)' }}>
                  ⚠ Inactive {daysSinceVisit}d
                </span>
              )}
              {hasBirthdayThisMonth && (
                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>
                  🎂 Birthday this month
                </span>
              )}
              {hasAnniversaryThisMonth && (
                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: 'rgba(59,130,246,0.12)', color: 'var(--color-info)' }}>
                  💍 Anniversary this month
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="page-content">
        <div style={{ display: 'grid', gap: 24, gridTemplateColumns: '1fr 300px', alignItems: 'start' }}>

          {/* ── Left column ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Identity card */}
            <div className="card">
              <div className="section-title">Contact & Demographics</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px 24px' }}>
                <InfoRow label="Phone" value={customer.phone} />
                <InfoRow label="Email" value={customer.email || '—'} />
                <InfoRow label="Gender" value={customer.gender} />
                <InfoRow label="Marital Status" value={customer.maritalStatus} />
                <InfoRow label="Birthday" value={customer.birthDate ? format(new Date(customer.birthDate), 'dd MMMM') : '—'} />
                <InfoRow label="Anniversary" value={customer.anniversaryDate ? format(new Date(customer.anniversaryDate), 'dd MMMM') : '—'} />
                <InfoRow label="First Visit Outlet" value={
                  <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600, background: 'rgba(255,255,255,0.05)', color: 'var(--color-text-2)' }}>
                    {customer.firstVisitOutlet?.code ?? '—'}
                  </span>
                } />
                <InfoRow label="Review" value={
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
                    background: customer.hasSubmittedFirstReview ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.1)',
                    color: customer.hasSubmittedFirstReview ? 'var(--color-success)' : 'var(--color-danger)',
                  }}>
                    {customer.hasSubmittedFirstReview ? '✓ Submitted' : 'Pending'}
                  </span>
                } />
              </div>
            </div>

            {/* Reviews */}
            <div>
              <div className="section-title">Reviews ({reviews.length})</div>
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

          {/* ── Right sidebar ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Visit stats card */}
            <div className="card" style={{ background: 'var(--color-primary-dim)', borderColor: 'var(--color-primary-border)', padding: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 6 }}>Total Visits</div>
              <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--color-primary)', lineHeight: 1 }}>{customer.totalVisits}</div>
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--color-primary-border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: 'var(--color-text-2)' }}>Last Visit</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: isInactive ? 'var(--color-danger)' : 'var(--color-text-1)' }}>
                    {customer.lastVisitDate ? format(new Date(customer.lastVisitDate), 'dd MMM yy') : '—'}
                    {daysSinceVisit !== null && <span style={{ fontSize: 10, color: 'var(--color-text-3)', marginLeft: 4 }}>({daysSinceVisit}d)</span>}
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

            {/* Visit History Timeline */}
            {customer.visits && customer.visits.length > 0 && (
              <div className="card" style={{ padding: '16px 20px' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-1)', marginBottom: 14 }}>
                  Visit History
                  <span style={{ fontSize: 11, color: 'var(--color-text-3)', marginLeft: 6 }}>(last {customer.visits.length})</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {customer.visits.map((v, idx) => (
                    <div key={v.id} style={{ display: 'flex', gap: 10, paddingBottom: idx < customer.visits!.length - 1 ? 14 : 0, position: 'relative' }}>
                      {idx < customer.visits!.length - 1 && (
                        <div style={{ position: 'absolute', left: 9, top: 20, bottom: 0, width: 1, background: 'var(--color-border)' }} />
                      )}
                      <div style={{
                        width: 20, height: 20, borderRadius: '50%', flexShrink: 0, zIndex: 1,
                        background: v.visitType === 'qr_scan' ? 'rgba(59,130,246,0.15)' : 'rgba(34,197,94,0.15)',
                        border: `1.5px solid ${v.visitType === 'qr_scan' ? 'var(--color-info)' : 'var(--color-success)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: v.visitType === 'qr_scan' ? 'var(--color-info)' : 'var(--color-success)' }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-1)' }}>
                          {v.visitType === 'qr_scan' ? 'QR Scan' : 'Payment'}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--color-text-3)', marginTop: 1 }}>
                          {format(new Date(v.visitedAt), 'dd MMM yy, HH:mm')}
                          {v.outlet && (
                            <span style={{ marginLeft: 5, background: 'rgba(255,255,255,0.05)', padding: '0 4px', borderRadius: 4 }}>{v.outlet.code}</span>
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
                <div style={{ fontSize: 24, marginBottom: 6 }}>📅</div>
                <div style={{ fontSize: 13 }}>No visits recorded yet</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
