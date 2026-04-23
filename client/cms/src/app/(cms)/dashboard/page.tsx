'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import type { DashboardStats } from '@/types/api'

// ─── Icons ─────────────────────────────────────────────────────────────────────

const icons = {
  customers: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  star: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
  visits: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  inactive: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  ),
  birthday: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/>
      <path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"/>
      <path d="M2 21h20"/>
      <path d="M7 8v3"/><path d="M12 8v3"/><path d="M17 8v3"/>
    </svg>
  ),
  outlets: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  lightning: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
    </svg>
  ),
  chevron: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  ),
  anniversary: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  ),
}

// ─── KPI Card ───────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon, delta, href, accent,
}: {
  label: string
  value: number | string | null
  sub?: string
  icon: React.ReactNode
  delta?: { label: string; dir?: 'up' | 'down' | 'neutral' }
  href?: string
  accent?: boolean
}) {
  const deltaColor =
    delta?.dir === 'up'   ? 'var(--color-success)' :
    delta?.dir === 'down' ? 'var(--color-danger)'  : 'var(--color-text-3)'

  const card = (
    <div style={{
      background: accent ? 'rgba(242,101,34,0.05)' : 'var(--color-surface)',
      border: `1px solid ${accent ? 'rgba(242,101,34,0.2)' : 'var(--color-border)'}`,
      borderRadius: 'var(--radius-lg)',
      padding: '22px 24px',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      cursor: href ? 'pointer' : 'default',
      transition: 'border-color 0.2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{
          width: 42, height: 42,
          background: accent ? 'rgba(242,101,34,0.15)' : 'var(--color-primary-dim)',
          borderRadius: 'var(--radius-md)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--color-primary)',
          flexShrink: 0,
        }}>
          {icon}
        </div>
        {href && (
          <span style={{ color: 'var(--color-text-3)', marginTop: 2 }}>{icons.chevron}</span>
        )}
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </div>
      <div style={{ fontSize: 34, fontWeight: 800, color: 'var(--color-text-1)', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
        {value ?? '—'}
      </div>
      {sub && (
        <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>{sub}</div>
      )}
      {delta && (
        <div style={{ fontSize: 12, color: deltaColor, marginTop: 4, fontWeight: 500 }}>
          {delta.dir === 'up' && '↑ '}{delta.dir === 'down' && '↓ '}
          {delta.label}
        </div>
      )}
    </div>
  )

  return href ? (
    <Link href={href} style={{ textDecoration: 'none', display: 'block' }}>{card}</Link>
  ) : card
}

// ─── Month Metric ───────────────────────────────────────────────────────────────

function MonthMetric({ icon, label, value, sub }: {
  icon: React.ReactNode; label: string; value: number | null; sub?: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1 }}>
      <div style={{
        width: 38, height: 38,
        background: 'var(--color-surface-3)',
        borderRadius: 'var(--radius-md)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--color-text-2)',
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>
          {label}
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text-1)', lineHeight: 1, letterSpacing: '-0.01em' }}>
          {value ?? '—'}
        </div>
        {sub && <div style={{ fontSize: 11, color: 'var(--color-text-3)', marginTop: 3 }}>{sub}</div>}
      </div>
    </div>
  )
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ h, r = 14 }: { h: number; r?: number }) {
  return (
    <div style={{
      height: h, borderRadius: r,
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      animation: 'skPulse 1.5s ease-in-out infinite',
    }} />
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, isAdmin, isOwner } = useAuth()
  const [stats, setStats]     = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(false)

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

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div>
      <style>{`
        @keyframes skPulse { 0%,100% { opacity: 0.45 } 50% { opacity: 0.9 } }
        .action-card:hover { border-color: var(--color-border-strong) !important; }
        .action-card-accent:hover { border-color: rgba(242,101,34,0.4) !important; }
        .kpi-card-link:hover > div { border-color: var(--color-border-strong) !important; }
      `}</style>

      {/* ── Page Header ── */}
      <div className="page-header" style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--color-text-3)', marginBottom: 5, letterSpacing: '0.02em' }}>
              {today}
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-text-1)', letterSpacing: '-0.02em' }}>
              {isAdmin ? 'Admin Dashboard' : isOwner ? 'Owner Dashboard' : 'Outlet Dashboard'}
            </h1>
            <p style={{ fontSize: 13, color: 'var(--color-text-3)', marginTop: 4 }}>{scopeLabel}</p>
          </div>
          <span className={`role-badge ${isAdmin ? 'role-badge-admin' : isOwner ? 'role-badge-owner' : 'role-badge-franchise'}`}
            style={{ marginTop: 4, fontSize: 11, padding: '3px 10px' }}>
            {isAdmin ? 'Admin' : isOwner ? 'Owner' : 'Franchise'}
          </span>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="page-content">

        {/* Loading */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
              <Skeleton h={148} /><Skeleton h={148} /><Skeleton h={148} /><Skeleton h={148} />
            </div>
            <Skeleton h={100} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Skeleton h={80} /><Skeleton h={80} />
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="empty-state">
            <div className="empty-state-icon">⚠️</div>
            <div className="empty-state-title">Failed to load dashboard</div>
            <div className="empty-state-desc">Please refresh the page.</div>
          </div>
        )}

        {stats && !loading && (
          <>
            {/* ── Primary KPIs ── */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 16,
              marginBottom: 16,
            }}>
              <KpiCard
                label="Total Customers"
                value={stats.totalCustomers}
                icon={icons.customers}
                delta={{ label: `+${stats.newCustomersThisMonth} this month`, dir: stats.newCustomersThisMonth > 0 ? 'up' : 'neutral' }}
                href="/customers"
              />
              <KpiCard
                label="Total Reviews"
                value={stats.totalReviews}
                icon={icons.star}
                sub={stats.averageRating ? `Avg ${stats.averageRating.toFixed(1)} ★` : undefined}
                delta={{ label: `+${stats.newReviewsThisWeek} this week`, dir: stats.newReviewsThisWeek > 0 ? 'up' : 'neutral' }}
                href="/reviews"
              />
              <KpiCard
                label="Total Visits"
                value={stats.totalVisits}
                icon={icons.visits}
                delta={{ label: `${stats.totalVisitsThisMonth} this month`, dir: 'neutral' }}
                href="/visits"
              />
              <KpiCard
                label="Inactive (30d+)"
                value={stats.inactiveCustomers}
                icon={icons.inactive}
                sub={stats.inactiveCustomers > 0 ? 'Need re-engagement' : 'All customers active'}
                delta={{
                  label: stats.inactiveCustomers > 10 ? 'Needs attention' : stats.inactiveCustomers > 0 ? 'Monitor closely' : 'Looking good',
                  dir: stats.inactiveCustomers > 10 ? 'down' : 'neutral',
                }}
              />
            </div>

            {/* ── This Month Summary ── */}
            <div style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: '20px 24px',
              marginBottom: 16,
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 18 }}>
                This Month
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0 }}>
                <MonthMetric
                  icon={icons.customers}
                  label="New Customers"
                  value={stats.newCustomersThisMonth}
                  sub={`${stats.newCustomersThisWeek} this week`}
                />
                <div style={{ borderLeft: '1px solid var(--color-border)', paddingLeft: 24, marginLeft: 8 }}>
                  <MonthMetric
                    icon={icons.visits}
                    label="Visits"
                    value={stats.totalVisitsThisMonth}
                  />
                </div>
                <div style={{ borderLeft: '1px solid var(--color-border)', paddingLeft: 24, marginLeft: 8 }}>
                  <MonthMetric
                    icon={icons.birthday}
                    label="Birthdays"
                    value={stats.birthdaysThisMonth}
                    sub="This calendar month"
                  />
                </div>
                <div style={{ borderLeft: '1px solid var(--color-border)', paddingLeft: 24, marginLeft: 8 }}>
                  <MonthMetric
                    icon={icons.anniversary}
                    label="Anniversaries"
                    value={stats.anniversariesThisMonth}
                    sub="This calendar month"
                  />
                </div>
              </div>
            </div>

            {/* ── Quick Actions ── */}
            {(isAdmin || isOwner) && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: isAdmin ? '1fr 1fr' : '1fr',
                gap: 16,
              }}>
                {/* Outlet Overview */}
                <Link href="/outlets" style={{ textDecoration: 'none' }}>
                  <div className="action-card" style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '20px 22px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    transition: 'border-color 0.2s',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{
                        width: 40, height: 40,
                        background: 'var(--color-surface-3)',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--color-text-2)',
                        flexShrink: 0,
                      }}>
                        {icons.outlets}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-1)' }}>
                          Per-Outlet Performance
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>
                          View detailed stats for each outlet
                        </div>
                      </div>
                    </div>
                    <span style={{ color: 'var(--color-text-3)', flexShrink: 0 }}>{icons.chevron}</span>
                  </div>
                </Link>

                {/* Automation — admin only */}
                {isAdmin && (
                  <Link href="/automation" style={{ textDecoration: 'none' }}>
                    <div className="action-card-accent" style={{
                      background: 'rgba(242,101,34,0.04)',
                      border: '1px solid rgba(242,101,34,0.18)',
                      borderRadius: 'var(--radius-lg)',
                      padding: '20px 22px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      transition: 'border-color 0.2s',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{
                          width: 40, height: 40,
                          background: 'var(--color-primary-dim)',
                          borderRadius: 'var(--radius-md)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'var(--color-primary)',
                          flexShrink: 0,
                        }}>
                          {icons.lightning}
                        </div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-primary)' }}>
                            Automation
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>
                            WhatsApp & email triggers
                          </div>
                        </div>
                      </div>
                      <span className="role-badge role-badge-admin" style={{ fontSize: 10.5, flexShrink: 0 }}>ADMIN</span>
                    </div>
                  </Link>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
