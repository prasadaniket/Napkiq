'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import type { DashboardStats } from '@/types/api'

// ─── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon,
  delta,
  href,
}: {
  label: string
  value: number | string | null
  sub?: string
  icon: React.ReactNode
  delta?: { label: string; dir?: 'up' | 'down' | 'neutral' }
  href?: string
}) {
  const card = (
    <div className="stat-card" style={{ cursor: href ? 'pointer' : 'default' }}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value ?? '—'}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--color-text-3)', marginTop: 4 }}>{sub}</div>}
      {delta && (
        <div className={`stat-delta stat-delta-${delta.dir ?? 'neutral'}`}>
          {delta.dir === 'up' && '↑ '}{delta.dir === 'down' && '↓ '}
          {delta.label}
        </div>
      )}
    </div>
  )
  return href ? <Link href={href} style={{ textDecoration: 'none' }}>{card}</Link> : card
}

// ─── Icons ─────────────────────────────────────────────────────────────────────

const icons = {
  customers:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  star:       <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  visits:     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  inactive:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  birthday:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"/><path d="M2 21h20"/><path d="M7 8v3"/><path d="M12 8v3"/><path d="M17 8v3"/><path d="M7 4h.01"/><path d="M12 4h.01"/><path d="M17 4h.01"/></svg>,
  outlets:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, isAdmin, isOwner, isFranchise } = useAuth()
  const [stats, setStats]   = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]    = useState(false)

  useEffect(() => {
    if (!user) return
    api.get<DashboardStats>('/cms/dashboard/stats')
      .then(res => setStats(res.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [user])

  const scopeLabel =
    isAdmin || isOwner ? 'All Outlets Combined' :
    user?.assignedOutletName ?? 'Your Outlet'

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 className="page-title">
              {isAdmin ? 'Admin Dashboard' : isOwner ? 'Owner Dashboard' : 'Outlet Dashboard'}
            </h1>
            <p className="page-subtitle">{scopeLabel}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className={`role-badge ${isAdmin ? 'role-badge-admin' : isOwner ? 'role-badge-owner' : 'role-badge-franchise'}`}>
              {isAdmin ? 'Admin' : isOwner ? 'Owner' : 'Franchise'}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="page-content">

        {loading && (
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {[...Array(8)].map((_, i) => (
              <div key={i} style={{
                height: 120, flex: '1 1 180px', minWidth: 140,
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                animation: 'pulse 1.5s ease-in-out infinite',
              }} />
            ))}
            <style>{`@keyframes pulse { 0%,100% { opacity: 0.5 } 50% { opacity: 1 } }`}</style>
          </div>
        )}

        {error && (
          <div className="empty-state">
            <div className="empty-state-icon">⚠️</div>
            <div className="empty-state-title">Failed to load dashboard</div>
            <div className="empty-state-desc">Please refresh the page.</div>
          </div>
        )}

        {stats && !loading && (
          <>
            {/* Primary stats */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
              gap: 16,
              marginBottom: 24,
            }}>
              <StatCard
                label="Total Customers"
                value={stats.totalCustomers}
                icon={icons.customers}
                delta={{ label: `+${stats.newCustomersThisMonth} this month`, dir: stats.newCustomersThisMonth > 0 ? 'up' : 'neutral' }}
                href="/customers"
              />
              <StatCard
                label="Total Reviews"
                value={stats.totalReviews}
                icon={icons.star}
                sub={stats.averageRating ? `Avg ${stats.averageRating.toFixed(1)} ★` : undefined}
                delta={{ label: `+${stats.newReviewsThisWeek} this week`, dir: stats.newReviewsThisWeek > 0 ? 'up' : 'neutral' }}
                href="/reviews"
              />
              <StatCard
                label="Total Visits"
                value={stats.totalVisits}
                icon={icons.visits}
                delta={{ label: `${stats.totalVisitsThisMonth} this month`, dir: 'neutral' }}
                href="/visits"
              />
              <StatCard
                label="Inactive (30d+)"
                value={stats.inactiveCustomers}
                icon={icons.inactive}
                sub="No recent visit"
                delta={{ label: stats.inactiveCustomers > 0 ? 'Needs attention' : 'All active', dir: stats.inactiveCustomers > 10 ? 'down' : 'neutral' }}
              />
            </div>

            {/* Engagement stats */}
            <div className="section-title">This Month</div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap: 16,
              marginBottom: 24,
            }}>
              <StatCard
                label="New Customers"
                value={stats.newCustomersThisMonth}
                icon={icons.customers}
                sub={`${stats.newCustomersThisWeek} this week`}
              />
              <StatCard
                label="Visits"
                value={stats.totalVisitsThisMonth}
                icon={icons.visits}
              />
              <StatCard
                label="Birthdays"
                value={stats.birthdaysThisMonth}
                icon={icons.birthday}
                sub="This calendar month"
              />
              <StatCard
                label="Anniversaries"
                value={stats.anniversariesThisMonth}
                icon={icons.birthday}
                sub="This calendar month"
              />
            </div>

            {/* Quick links for admin/owner */}
            {(isAdmin || isOwner) && (
              <>
                <div className="section-title">Outlet Overview</div>
                <Link href="/outlets" style={{ textDecoration: 'none' }}>
                  <div className="card" style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    transition: 'border-color 0.2s',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-border-strong)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div className="stat-icon" style={{ margin: 0 }}>{icons.outlets}</div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-1)' }}>
                          Per-Outlet Performance
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>
                          View detailed stats for each of the 4 outlets
                        </div>
                      </div>
                    </div>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-3)" strokeWidth="2">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </div>
                </Link>
              </>
            )}

            {/* Admin-only automation shortcut */}
            {isAdmin && (
              <div style={{ marginTop: 16 }}>
                <Link href="/automation" style={{ textDecoration: 'none' }}>
                  <div className="card" style={{
                    background: 'rgba(242,101,34,0.04)',
                    borderColor: 'var(--color-primary-border)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    cursor: 'pointer',
                  }}>
                    <div style={{
                      width: 38, height: 38,
                      background: 'var(--color-primary-dim)',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--color-primary)',
                    }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#F26522' }}>Automation</div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>
                        WhatsApp & email triggers · Admin only
                      </div>
                    </div>
                    <span className="role-badge role-badge-admin" style={{ marginLeft: 'auto' }}>ADMIN</span>
                  </div>
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
