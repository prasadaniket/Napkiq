'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import type { DashboardStats, RevenueInsights } from '@/types/api'
import { 
  Users, 
  Star, 
  CalendarDays, 
  AlertTriangle, 
  ArrowUpRight, 
  ChevronRight, 
  Building2, 
  Zap, 
  Calendar, 
  Heart, 
  Gift, 
  Sparkles, 
  Clock, 
  TrendingUp, 
  CheckCircle,
  Activity
} from 'lucide-react'

// ─── KPI Card Component ───────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string
  value: number | string | null
  sub?: string
  icon: React.ReactNode
  delta?: { label: string; dir?: 'up' | 'down' | 'neutral' }
  href?: string
  accent?: boolean
  sparklineData?: number[]
}

function KpiCard({
  label, value, sub, icon, delta, href, accent, sparklineData,
}: KpiCardProps) {
  const isUp = delta?.dir === 'up'
  const isDown = delta?.dir === 'down'

  const drawSparkline = (data: number[]) => {
    const w = 80
    const h = 30
    const padding = 2
    const maxVal = Math.max(...data, 1)
    const minVal = Math.min(...data, 0)
    const range = maxVal - minVal || 1
    const points = data.map((val, idx) => {
      const x = (idx / (data.length - 1)) * (w - padding * 2) + padding
      const y = h - ((val - minVal) / range) * (h - padding * 2) - padding
      return `${x},${y}`
    })
    return {
      path: `M ${points.join(' L ')}`,
      fillPath: `M ${padding},${h} L ${points.join(' L ')} L ${w - padding},${h} Z`
    }
  }

  const cardContent = (
    <div className={`group relative overflow-hidden rounded-2xl border bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg h-full flex flex-col justify-between ${
      accent 
        ? 'border-red-100 hover:border-red-300 shadow-sm' 
        : 'border-slate-100 hover:border-red-200/80 shadow-[0_2px_8px_-3px_rgba(0,2,29,0.04)]'
    }`}>
      {/* Decorative subtle background gradient */}
      <div className={`absolute -right-6 -top-6 h-24 w-24 rounded-full blur-2xl transition-opacity duration-300 group-hover:opacity-100 ${
        accent ? 'bg-red-500/5 opacity-50' : 'bg-red-500/3 opacity-0'
      }`} />

      <div>
        <div className="flex items-start justify-between">
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-300 ${
            accent 
              ? 'bg-red-50/80 text-[#D64238] group-hover:scale-110 group-hover:bg-red-100/90' 
              : 'bg-slate-50 text-slate-700 group-hover:scale-110 group-hover:bg-red-50 group-hover:text-[#D64238]'
          }`}>
            {icon}
          </div>
          
          {href && (
            <div className="rounded-lg p-1 text-slate-300 transition-colors duration-200 group-hover:bg-slate-50 group-hover:text-slate-600">
              <ArrowUpRight className="h-4 w-4" />
            </div>
          )}
        </div>

        <div className="mt-5">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {label}
          </span>
          
          <div className="mt-1.5 flex items-end justify-between gap-3">
            <span className="text-3xl font-extrabold tracking-tight text-slate-900">
              {value ?? '—'}
            </span>
            {sparklineData && sparklineData.length > 1 && (
              <div className="h-[30px] w-[80px] opacity-75 group-hover:opacity-100 transition-opacity">
                <svg width="100%" height="100%" viewBox="0 0 80 30" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id={`sparklineGrad-${label.replace(/\s+/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={accent || isDown ? "#D64238" : "#10B981"} stopOpacity="0.2" />
                      <stop offset="100%" stopColor={accent || isDown ? "#D64238" : "#10B981"} stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <path
                    d={drawSparkline(sparklineData).fillPath}
                    fill={`url(#sparklineGrad-${label.replace(/\s+/g, '')})`}
                  />
                  <path
                    d={drawSparkline(sparklineData).path}
                    fill="none"
                    stroke={accent || isDown ? "#D64238" : "#10B981"}
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            )}
          </div>

          {sub && (
            <div className="mt-1.5 text-xs font-medium text-slate-500">
              {sub}
            </div>
          )}
        </div>
      </div>

      {delta && (
        <div className="mt-4 flex items-center">
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
            isUp 
              ? 'bg-emerald-50 text-emerald-700' 
              : isDown 
                ? 'bg-rose-50 text-[#D64238]' 
                : 'bg-slate-50 text-slate-600'
          }`}>
            {isUp && <TrendingUp className="h-3 w-3" />}
            {delta.label}
          </span>
        </div>
      )}
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="h-full block no-underline">
        {cardContent}
      </Link>
    )
  }

  return cardContent
}

// ─── Skeleton Component ──────────────────────────────────────────────────────────

function Skeleton({ h, r = 16 }: { h: number; r?: number }) {
  return (
    <div 
      className="animate-pulse bg-slate-50 border border-slate-100" 
      style={{ height: h, borderRadius: r }} 
    />
  )
}

// ─── Main Page Component ─────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { user, isAdmin, isOwner } = useAuth()
  const [stats, setStats]     = useState<DashboardStats | null>(null)
  const [insights, setInsights] = useState<RevenueInsights | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(false)
  // Revenue-section period toggle. The 30d fetch above powers the KPI sparklines
  // & Activity Pulse (kept stable); this drives only the Revenue/Top-Items/Outlet
  // cards, refetching period-scoped aggregates that can't be re-sliced client-side.
  const [revenueDays, setRevenueDays] = useState<1 | 7 | 30>(30)
  const [periodRevenue, setPeriodRevenue] = useState<RevenueInsights | null>(null)
  const [revenueLoading, setRevenueLoading] = useState(false)
  const [isGraphView, setIsGraphView] = useState(false)
  const [graphTimeframe, setGraphTimeframe] = useState<'1D' | '1W' | '1M'>('1M')
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  useEffect(() => {
    if (!user) return
    api.get<DashboardStats>('/cms/dashboard/stats')
      .then(res => setStats(res.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
    // Revenue/menu intelligence is best-effort — the chart & revenue section
    // degrade gracefully if it fails, so a failure here never blanks the page.
    api.get<RevenueInsights>('/cms/dashboard/insights')
      .then(res => setInsights(res.data))
      .catch(() => {})
  }, [user])

  // Refetch period-scoped revenue when the toggle changes. 30d reuses the base
  // insights fetch above (no duplicate request); 7d/1d fetch on demand.
  useEffect(() => {
    if (!user || revenueDays === 30) { setPeriodRevenue(null); return }
    setRevenueLoading(true)
    api.get<RevenueInsights>(`/cms/dashboard/insights?days=${revenueDays}`)
      .then(res => setPeriodRevenue(res.data))
      .catch(() => {})
      .finally(() => setRevenueLoading(false))
  }, [user, revenueDays])

  // Data feeding the Revenue / Top Items / Revenue-by-Outlet cards. Falls back to
  // the 30d series while a shorter window is still loading so cards never blank.
  const revenueData = revenueDays === 30 ? insights : (periodRevenue ?? insights)

  const scopeLabel =
    isAdmin || isOwner ? 'All Outlets Combined' :
    user?.assignedOutletName ?? 'Your Outlet'

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  // Get dynamic greeting based on Indian Standard Time (IST)
  const getGreeting = () => {
    const hours = new Date().getHours()
    if (hours < 12) return { text: 'Good morning', emoji: '🌅' }
    if (hours < 17) return { text: 'Good afternoon', emoji: '☀️' }
    return { text: 'Good evening', emoji: '🌆' }
  }
  const greeting = getGreeting()

  // Compact INR formatter for revenue figures.
  const money = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`

  return (
    <div className="page-content relative overflow-hidden" style={{ padding: '24px 28px 32px', minHeight: 'calc(100vh - 80px)' }}>
      {/* Drifting ambient luxury brand glow orbs */}
      <div className="absolute top-[-10%] left-[-15%] -z-10 h-[50vw] w-[50vw] rounded-full bg-gradient-to-tr from-red-100/10 to-amber-100/10 blur-[120px] animate-pulse duration-[8000ms] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-15%] -z-10 h-[40vw] w-[40vw] rounded-full bg-gradient-to-bl from-rose-100/8 to-orange-100/8 blur-[100px] animate-pulse duration-[10000ms] pointer-events-none" />
      <div className="absolute top-[40%] left-[60%] -z-10 h-[30vw] w-[30vw] rounded-full bg-gradient-to-r from-red-50/5 to-orange-50/5 blur-[80px] animate-pulse duration-[12000ms] pointer-events-none" />

      <div className="space-y-6">
      
      {/* ── Dynamic Welcoming Hero Header ── */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-100/80 bg-white/70 backdrop-blur-md p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.015)]">
        {/* Glow effect blur decoration */}
        <div className="absolute right-10 top-0 -z-10 h-32 w-32 rounded-full bg-orange-100/20 blur-3xl" />
        <div className="absolute left-1/3 bottom-0 -z-10 h-24 w-24 rounded-full bg-red-100/5 blur-2xl" />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <Clock className="h-3.5 w-3.5" />
              <span>{today}</span>
            </div>
            
            <h1 className="mt-2 text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">
              {greeting.text}, {user?.fullName || 'Partner'}! {greeting.emoji}
            </h1>
            
            <p className="mt-1.5 text-sm font-medium text-slate-500">
              CMS Analytics • <span className="text-slate-700 font-semibold">{scopeLabel}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Live Operations Indicator */}
            <div className="flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50/60 px-3 py-1.5 text-xs font-bold text-emerald-700 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
              </span>
              <span>Live Systems</span>
            </div>

            <span className={`inline-flex items-center rounded-full px-3.5 py-1 text-xs font-bold tracking-wide uppercase ${
              isAdmin 
                ? 'bg-red-50 text-[#D64238] border border-red-100' 
                : isOwner 
                  ? 'bg-blue-50 text-blue-700 border border-blue-100' 
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
            }`}>
              {isAdmin ? 'Admin' : isOwner ? 'Owner' : 'Franchise'}
            </span>
          </div>
        </div>
      </div>
 
      {/* ── Content ── */}
      <div className="space-y-6">

        {/* Loading State */}
        {loading && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <Skeleton h={156} /><Skeleton h={156} /><Skeleton h={156} /><Skeleton h={156} />
            </div>
            <Skeleton h={220} />
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <Skeleton h={90} /><Skeleton h={90} />
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-100 bg-white py-12 px-4 text-center shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-base font-bold text-slate-900">Failed to load analytics data</h3>
            <p className="mt-1 text-sm text-slate-500">There was an error connecting to our database services.</p>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-4 rounded-xl bg-[#D64238] px-4 py-2 text-xs font-bold text-white shadow transition-all hover:bg-[#B82E25]"
            >
              Refresh Portal
            </button>
          </div>
        )}

        {stats && !loading && (
          <>
            {/* ── Primary KPI Cards Grid ── */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard
                label="Total Customers"
                value={stats.totalCustomers}
                icon={<Users className="h-5 w-5" />}
                delta={{ label: `+${stats.newCustomersThisMonth} this month`, dir: stats.newCustomersThisMonth > 0 ? 'up' : 'neutral' }}
                href="/customers"
                sparklineData={insights && insights.daily.length ? insights.daily.slice(-7).map(d => d.newCustomers) : undefined}
              />
              <KpiCard
                label="Total Reviews"
                value={stats.totalReviews}
                icon={<Star className="h-5 w-5 fill-amber-400 text-amber-400" />}
                sub={stats.averageRating ? `Rating average: ${stats.averageRating.toFixed(1)} ★` : undefined}
                delta={{ label: `+${stats.newReviewsThisWeek} this week`, dir: stats.newReviewsThisWeek > 0 ? 'up' : 'neutral' }}
                href="/reviews"
                sparklineData={insights && insights.daily.length ? insights.daily.slice(-7).map(d => d.newReviews) : undefined}
              />
              <KpiCard
                label="Total Visits"
                value={stats.totalVisits}
                icon={<CalendarDays className="h-5 w-5" />}
                delta={{ label: `${stats.totalVisitsThisMonth} this month`, dir: 'neutral' }}
                href="/visits"
                sparklineData={insights && insights.daily.length ? insights.daily.slice(-7).map(d => d.visits) : [38, 42, 49, 45, 52, 48, stats.totalVisits || 53]}
              />
              <KpiCard
                label="Inactive (30d+)"
                value={stats.inactiveCustomers}
                icon={<AlertTriangle className="h-5 w-5" />}
                sub={stats.inactiveCustomers > 0 ? 'Action required soon' : 'All customers active'}
                delta={{
                  label: stats.inactiveCustomers > 10 ? 'Needs attention' : stats.inactiveCustomers > 0 ? 'Monitor closely' : 'Looking perfect',
                  dir: stats.inactiveCustomers > 10 ? 'down' : 'neutral',
                }}
              />
            </div>

            {/* ── Revenue & Menu Intelligence ── */}
            {revenueData && (
              <div className="space-y-4">
                {/* Section header + period toggle */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-500">Revenue &amp; Menu Intelligence</h2>
                    {revenueLoading && (
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-[2px] border-slate-200 border-t-[#D64238]" />
                    )}
                  </div>
                  <div className="flex gap-1 p-1 bg-slate-100 border border-slate-200/50 rounded-xl select-none">
                    {([[1, '1D'], [7, '7D'], [30, '30D']] as const).map(([d, lbl]) => (
                      <button
                        key={d}
                        onClick={() => setRevenueDays(d)}
                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-all duration-200 ${
                          revenueDays === d
                            ? 'bg-white text-[#D64238] shadow-sm'
                            : 'text-slate-400 hover:text-slate-700'
                        }`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>

              <div className={`grid grid-cols-1 lg:grid-cols-3 gap-6 transition-opacity duration-200 ${revenueLoading ? 'opacity-60' : 'opacity-100'}`}>
                {/* Realized revenue */}
                <div className="flex flex-col justify-between h-[380px] rounded-3xl border border-slate-100 bg-white/80 backdrop-blur-md p-6 shadow-[0_8px_30px_rgb(0,0,0,0.015)] relative overflow-hidden group">
                  {/* Decorative glow */}
                  <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-emerald-500/5 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />
                  
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 transition-transform duration-300 group-hover:scale-110">
                          <TrendingUp className="h-4.5 w-4.5" />
                        </div>
                        <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Revenue</h3>
                      </div>
                      <span className="rounded-lg bg-emerald-50/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">{revenueData.days === 1 ? 'Today' : `Last ${revenueData.days}d`}</span>
                    </div>
                    
                    <div className="mt-8">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Earnings</span>
                      <div className="text-4xl font-extrabold tracking-tight text-slate-900 mt-1">
                        {money(revenueData.totals.revenue)}
                      </div>
                      <p className="mt-1 text-xs font-medium text-slate-400">Realized from served orders</p>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-auto">
                    <div className="flex-1 rounded-2xl border border-slate-100/70 bg-slate-50/50 p-4 transition-colors hover:bg-slate-50/80">
                      <div className="text-xl font-extrabold text-slate-900">{revenueData.totals.orders.toLocaleString('en-IN')}</div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">Orders</div>
                    </div>
                    <div className="flex-1 rounded-2xl border border-slate-100/70 bg-slate-50/50 p-4 transition-colors hover:bg-slate-50/80">
                      <div className="text-xl font-extrabold text-slate-900">{revenueData.totals.itemsSold.toLocaleString('en-IN')}</div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">Items Sold</div>
                    </div>
                  </div>
                </div>

                {/* Top menu items */}
                <div className="flex flex-col h-[380px] rounded-3xl border border-slate-100 bg-white/80 backdrop-blur-md p-6 shadow-[0_8px_30px_rgb(0,0,0,0.015)] relative overflow-hidden group">
                  {/* Decorative glow */}
                  <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-orange-500/5 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />
                  
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-[#D64238] transition-transform duration-300 group-hover:scale-110">
                        <Sparkles className="h-4.5 w-4.5" />
                      </div>
                      <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Top Menu Items</h3>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">By Sales</span>
                  </div>

                  {revenueData.topItems.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-6 text-center">
                      <span className="text-sm font-semibold text-slate-400">No orders in this window yet</span>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto pr-1 space-y-2.5">
                      {revenueData.topItems.map((it, i) => (
                        <div key={it.name} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/30 p-3 transition-all hover:bg-slate-50/70 hover:border-slate-200/60">
                          <span className="flex h-6.5 w-6.5 flex-shrink-0 items-center justify-center rounded-lg bg-white text-xs font-extrabold text-[#D64238] shadow-sm border border-slate-100">{i + 1}</span>
                          <span className="flex-1 truncate text-sm font-bold text-slate-800">{it.name}</span>
                          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500 shadow-sm border border-slate-100/70">×{it.quantity}</span>
                          <span className="text-sm font-extrabold text-slate-900 tabular-nums">{money(it.revenue)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Revenue by outlet (multi-outlet) OR order economics (single outlet) */}
                <div className="flex flex-col h-[380px] rounded-3xl border border-slate-100 bg-white/80 backdrop-blur-md p-6 shadow-[0_8px_30px_rgb(0,0,0,0.015)] relative overflow-hidden group">
                  {/* Decorative glow */}
                  <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-blue-500/5 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />
                  
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition-transform duration-300 group-hover:scale-110">
                        <Building2 className="h-4.5 w-4.5" />
                      </div>
                      <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                        {revenueData.byOutlet.length > 1 ? 'Revenue by Outlet' : 'Order Economics'}
                      </h3>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {revenueData.byOutlet.length > 1 ? 'Performance' : 'Averages'}
                    </span>
                  </div>

                  {revenueData.byOutlet.length > 1 ? (
                    <div className="flex-1 overflow-y-auto pr-1 space-y-4">
                      {(() => {
                        const max = Math.max(...revenueData.byOutlet.map(o => o.revenue), 1)
                        return revenueData.byOutlet.map(o => (
                          <div key={o.outletId} className="space-y-1.5 p-1 rounded-xl transition-all hover:bg-slate-50/30">
                            <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                              <span className="truncate">{o.name}</span>
                              <span className="tabular-nums text-slate-900">{money(o.revenue)}</span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                              <div className="h-full rounded-full bg-gradient-to-r from-rose-400 to-[#D64238] transition-all duration-500" style={{ width: `${Math.max(3, (o.revenue / max) * 100)}%` }} />
                            </div>
                          </div>
                        ))
                      })()}
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col justify-center space-y-3.5">
                      <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/40 p-4 transition-all hover:bg-slate-50/70">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Avg Order Value</span>
                        <span className="text-lg font-extrabold text-slate-900">
                          {money(revenueData.totals.orders > 0 ? revenueData.totals.revenue / revenueData.totals.orders : 0)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/40 p-4 transition-all hover:bg-slate-50/70">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Items / Order</span>
                        <span className="text-lg font-extrabold text-slate-900">
                          {revenueData.totals.orders > 0 ? (revenueData.totals.itemsSold / revenueData.totals.orders).toFixed(1) : '0'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              </div>
            )}

            {/* ── Spotlight Analytics Section ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Column 1 & 2: Month Spotlight Funnel */}
              {(() => {
                // Real activity series from /cms/dashboard/insights — visits over
                // time. No synthesized data: empty until insights load, then live.
                const fmtDay = (iso: string) =>
                  new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
                const fmtHour = (h: number) => `${String(h).padStart(2, '0')}:00`

                const dailySeries  = insights?.daily ?? []
                const hourlySeries = insights?.hourlyToday ?? []
                const last7        = dailySeries.slice(-7)

                const data1M  = dailySeries.map(d => d.visits)
                const dates1M = dailySeries.map(d => fmtDay(d.date))
                const data1W  = last7.map(d => d.visits)
                const dates1W = last7.map(d => fmtDay(d.date))
                const data1D  = hourlySeries.map(h => h.visits)
                const dates1D = hourlySeries.map(h => fmtHour(h.hour))

                // Guard: always feed the chart ≥2 points so the SVG math is safe
                // (empty/loading → a flat zero line, never a crash or fake curve).
                const rawPoints =
                  graphTimeframe === '1D' ? data1D :
                  graphTimeframe === '1M' ? data1M : data1W
                const rawDates =
                  graphTimeframe === '1D' ? dates1D :
                  graphTimeframe === '1M' ? dates1M : dates1W
                const points = rawPoints.length >= 2 ? rawPoints : [0, 0]
                const dates  = rawDates.length  >= 2 ? rawDates  : ['', '']

                // Headline = total visits in the window; trend = 2nd half vs 1st.
                const seriesTotal = points.reduce((a, b) => a + b, 0)
                const valFinal1M = seriesTotal
                const valFinal1W = seriesTotal
                const valFinal1D = seriesTotal
                const halfIdx    = Math.floor(points.length / 2)
                const firstHalf  = points.slice(0, halfIdx).reduce((a, b) => a + b, 0)
                const secondHalf = points.slice(halfIdx).reduce((a, b) => a + b, 0)
                const trendPct = firstHalf > 0
                  ? Math.round(((secondHalf - firstHalf) / firstHalf) * 100)
                  : secondHalf > 0 ? 100 : 0
                const trendUp = trendPct >= 0

                const maxVal = Math.max(...points, 10) * 1.15
                
                // SVG dimensions matching layout aspect ratio
                const svgWidth = 460
                const svgHeight = 90

                const chartPoints = points.map((val, idx) => {
                  const x = (idx / (points.length - 1)) * svgWidth
                  const y = svgHeight - (val / maxVal) * svgHeight + 8 // 8px margin top
                  return { x, y, val, date: dates[idx] }
                })

                // Straight line segment paths (Sharp turns, matching other stock applications)
                const pathD = chartPoints.reduce((acc, pt, idx) => {
                  return acc + `${idx === 0 ? 'M' : 'L'} ${pt.x},${pt.y}`
                }, '')
                const areaD = `${pathD} L ${svgWidth},${svgHeight + 20} L 0,${svgHeight + 20} Z`

                // Computed metrics depending on cursor position
                const activeVal = hoveredIndex !== null ? points[hoveredIndex] : (graphTimeframe === '1D' ? valFinal1D : graphTimeframe === '1M' ? valFinal1M : valFinal1W)
                const activeDate = hoveredIndex !== null 
                  ? `Value at ${dates[hoveredIndex]}` 
                  : (graphTimeframe === '1D' ? 'Visits recorded today' : graphTimeframe === '1M' ? 'Visits · last 30 days' : 'Visits · last 7 days')
                const hoverPt = hoveredIndex !== null ? chartPoints[hoveredIndex] : chartPoints[chartPoints.length - 1]

                // Y-axis side tick values
                const yTicks = [Math.round(maxVal), Math.round(maxVal * 0.66), Math.round(maxVal * 0.33), 0]

                // Pointer hover index tracker
                const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  const x = e.clientX - rect.left
                  const percent = x / rect.width
                  const index = Math.min(points.length - 1, Math.max(0, Math.round(percent * (points.length - 1))))
                  setHoveredIndex(index)
                }

                return (
                  <div className="lg:col-span-2 rounded-3xl border border-slate-100 bg-white/80 backdrop-blur-md p-6 shadow-[0_8px_30px_rgb(0,0,0,0.015)] flex flex-col justify-between hover:shadow-lg transition-all duration-300">
                    <div>
                      {/* Card Header with segment capsule */}
                      <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                        <div>
                          <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Monthly Activity Pulse</h3>
                          <p className="text-xs font-medium text-slate-400 mt-0.5">Real-time indicators for customer acquisition & flow</p>
                        </div>

                        <div className="flex items-center gap-3">
                          {/* Segment Capsule Toggle (Gauges vs Chart) */}
                          <div className="flex p-0.5 bg-slate-100 border border-slate-200/50 rounded-xl select-none">
                            <button
                              onClick={() => { setIsGraphView(false); setHoveredIndex(null); }}
                              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all duration-200 ${
                                !isGraphView 
                                  ? 'bg-white text-slate-800 shadow-sm' 
                                  : 'text-slate-400 hover:text-slate-700'
                              }`}
                            >
                              Gauges
                            </button>
                            <button
                              onClick={() => { setIsGraphView(true); setHoveredIndex(null); }}
                              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all duration-200 ${
                                isGraphView 
                                  ? 'bg-white text-[#D64238] shadow-sm' 
                                  : 'text-slate-400 hover:text-slate-700'
                              }`}
                            >
                              Chart
                            </button>
                          </div>

                          <span className="inline-flex items-center gap-1.5 rounded-xl bg-orange-50 px-2.5 py-1 text-xs font-bold text-[#D64238]">
                            <Sparkles className="h-3 w-3" />
                            <span>Spotlight</span>
                          </span>
                        </div>
                      </div>

                      {isGraphView ? (
                        /* World-Class Interactive Graph View */
                        <div className="mt-5 space-y-4 select-none relative">
                          
                          {/* FLOATING HIGH-FIDELITY TOOLTIP OVERLAY */}
                          {hoveredIndex !== null && (
                            <div 
                              className="absolute pointer-events-none bg-slate-950/95 backdrop-blur-md text-white rounded-xl py-1.5 px-3 text-[11px] font-bold shadow-xl border border-slate-800 flex flex-col items-center justify-center gap-0.5 transition-all duration-150 ease-out z-20 animate-in fade-in zoom-in-95 duration-100"
                              style={{
                                // Align exactly above the hovered point relative to container width
                                left: `calc(${(hoverPt.x / svgWidth) * 100}% - 40px * ${(hoverPt.x / svgWidth)})`,
                                top: `${(hoverPt.y / svgHeight) * 100 - 32}%`,
                                transform: 'translateX(-50%) translateY(-50px)',
                              }}
                            >
                              <span className="text-slate-400 text-[9px] uppercase tracking-wider font-extrabold">{hoverPt.date}</span>
                              <span className="text-emerald-400 text-xs font-black">{hoverPt.val} visits</span>
                              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-950/95 rotate-45 border-r border-b border-slate-800" />
                            </div>
                          )}

                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{activeDate}</div>
                              <div className="mt-1 flex items-baseline gap-2">
                                <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                                  {activeVal}
                                </span>
                                <span className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-bold border shadow-[0_1px_2px_rgba(0,0,0,0.01)] ${
                                  trendUp
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                    : 'bg-rose-50 text-[#D64238] border-rose-100'
                                }`}>
                                  <TrendingUp className={`h-3 w-3 ${trendUp ? '' : 'rotate-180'}`} />
                                  <span>{trendUp ? '+' : ''}{trendPct}%</span>
                                </span>
                              </div>
                            </div>

                            {/* Timeframe selector controls */}
                            <div className="flex gap-1 p-1 bg-slate-50 border border-slate-100 rounded-xl">
                              {(['1D', '1W', '1M'] as const).map((tf) => (
                                <button 
                                  key={tf}
                                  onClick={() => { setGraphTimeframe(tf); setHoveredIndex(null); }}
                                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all duration-200 ${
                                    graphTimeframe === tf 
                                      ? 'bg-white text-[#D64238] shadow-sm' 
                                      : 'text-slate-400 hover:text-slate-700'
                                  }`}
                                >
                                  {tf}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Split layout: Chart on the left, Y-axis ticks sidebar on the right */}
                          <div className="flex gap-3 items-stretch mt-4">
                            {/* SVG Interactive Chart Box */}
                            <div className="relative flex-1 h-[100px] bg-slate-50/20 border border-slate-100/50 rounded-xl p-1.5 overflow-hidden">
                              <svg 
                                width="100%" 
                                height="100%" 
                                viewBox={`0 0 ${svgWidth} ${svgHeight}`} 
                                preserveAspectRatio="none" 
                                className="overflow-visible cursor-crosshair"
                                onMouseMove={handleMouseMove}
                                onMouseLeave={() => setHoveredIndex(null)}
                              >
                                <defs>
                                  {/* Shadow Filter for premium Neon glow */}
                                  <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
                                    <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#10B981" floodOpacity="0.25" />
                                  </filter>
                                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#10B981" stopOpacity="0.18" />
                                    <stop offset="100%" stopColor="#10B981" stopOpacity="0.00" />
                                  </linearGradient>
                                  <linearGradient id="chartStroke" x1="0" y1="0" x2="1" y2="0">
                                    <stop offset="0%" stopColor="#34D399" />
                                    <stop offset="50%" stopColor="#10B981" />
                                    <stop offset="100%" stopColor="#059669" />
                                  </linearGradient>
                                </defs>

                                {/* Background Grid Lines aligned with our ticks */}
                                <line x1="0" y1={svgHeight * 0.05} x2={svgWidth} y2={svgHeight * 0.05} stroke="#f8fafc" strokeDasharray="3 3" />
                                <line x1="0" y1={svgHeight * 0.38} x2={svgWidth} y2={svgHeight * 0.38} stroke="#f8fafc" strokeDasharray="3 3" />
                                <line x1="0" y1={svgHeight * 0.71} x2={svgWidth} y2={svgHeight * 0.71} stroke="#f8fafc" strokeDasharray="3 3" />
                                <line x1="0" y1={svgHeight * 0.98} x2={svgWidth} y2={svgHeight * 0.98} stroke="#f8fafc" strokeDasharray="3 3" />

                                {/* SVG filled curves and path lines */}
                                <path 
                                  d={areaD} 
                                  fill="url(#chartGradient)"
                                  className="transition-all duration-300 ease-in-out"
                                />
                                <path 
                                  d={pathD} 
                                  fill="none" 
                                  stroke="url(#chartStroke)" 
                                  strokeWidth="3.5" 
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  filter="url(#neonGlow)"
                                  className="transition-all duration-300 ease-in-out"
                                />

                                {/* Dynamic Vertical guide tracking line on hover */}
                                {hoveredIndex !== null && (
                                  <>
                                    <line 
                                      x1={hoverPt.x} 
                                      y1="0" 
                                      x2={hoverPt.x} 
                                      y2={svgHeight} 
                                      stroke="#cbd5e1" 
                                      strokeWidth="1.5" 
                                      strokeDasharray="2.5 2.5" 
                                    />
                                    <line 
                                      x1={hoverPt.x} 
                                      y1={hoverPt.y} 
                                      x2={svgWidth} 
                                      y2={hoverPt.y} 
                                      stroke="#e2e8f0" 
                                      strokeWidth="1" 
                                      strokeDasharray="2 2" 
                                    />
                                  </>
                                )}

                                {/* Pointer dot marker */}
                                <circle 
                                  cx={hoverPt.x} 
                                  cy={hoverPt.y} 
                                  r="5" 
                                  fill="#D64238" 
                                  stroke="#ffffff" 
                                  strokeWidth="1.75" 
                                  className="shadow-md"
                                />
                              </svg>
                            </div>

                            {/* Y-axis Ticks Scale */}
                            <div className="flex flex-col justify-between text-[9px] font-bold text-slate-400 py-1 text-left select-none w-7 pl-1">
                              <span>{yTicks[0]}</span>
                              <span>{yTicks[1]}</span>
                              <span>{yTicks[2]}</span>
                              <span>{yTicks[3]}</span>
                            </div>
                          </div>

                          {/* X-axis Labels — sampled evenly from the real dates */}
                          <div className="flex justify-between text-[10px] font-bold text-slate-400 mt-2 px-1 pr-10">
                            {(() => {
                              const n = dates.length
                              const count = Math.min(6, n)
                              const idxs = [...new Set(
                                Array.from({ length: count }, (_, i) =>
                                  Math.round((i / (count - 1)) * (n - 1)))
                              )]
                              return idxs.map((i, k) => <span key={k}>{dates[i]}</span>)
                            })()}
                          </div>
                        </div>
                      ) : (
                        /* Progress Gauges (Red/Green Color Swapped) */
                        <div className="space-y-5 mt-6">
                          {/* Acquisition Gauge (Now Green) */}
                          <div>
                            <div className="flex items-center justify-between text-xs font-bold text-slate-600 mb-1.5">
                              <span className="flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                <span>New Customer Share</span>
                              </span>
                              <span>{stats.totalCustomers ? Math.round((stats.newCustomersThisMonth / stats.totalCustomers) * 100) : 0}% of Total</span>
                            </div>
                            
                            {/* Visual gauge */}
                            <div className="relative h-3 w-full rounded-full bg-slate-100 overflow-hidden">
                              <div 
                                className="absolute top-0 bottom-0 left-0 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-1000"
                                style={{ width: `${stats.totalCustomers ? Math.min(100, (stats.newCustomersThisMonth / stats.totalCustomers) * 100) : 0}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-[11px] font-semibold text-slate-400 mt-1">
                              <span>{stats.newCustomersThisMonth} acquired</span>
                              <span>{stats.totalCustomers} total lifetime</span>
                            </div>
                          </div>

                          {/* Visit Engagement Gauge (Now Red) */}
                          <div>
                            <div className="flex items-center justify-between text-xs font-bold text-slate-600 mb-1.5">
                              <span className="flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full bg-rose-500" />
                                <span>Visits Performance</span>
                              </span>
                              <span>{stats.totalVisits ? Math.round((stats.totalVisitsThisMonth / stats.totalVisits) * 100) : 0}% of Total</span>
                            </div>

                            {/* Visual gauge */}
                            <div className="relative h-3 w-full rounded-full bg-slate-100 overflow-hidden">
                              <div 
                                className="absolute top-0 bottom-0 left-0 rounded-full bg-gradient-to-r from-rose-400 to-[#D64238] transition-all duration-1000"
                                style={{ width: `${stats.totalVisits ? Math.min(100, (stats.totalVisitsThisMonth / stats.totalVisits) * 100) : 0}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-[11px] font-semibold text-slate-400 mt-1">
                              <span>{stats.totalVisitsThisMonth} visits this month</span>
                              <span>{stats.totalVisits} total visits</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between">
                      <div className="flex gap-4">
                        <div className="text-center">
                          <div className="text-xl font-extrabold text-slate-900">{stats.newCustomersThisWeek}</div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">New This Week</div>
                        </div>
                        <div className="h-8 w-px bg-slate-100" />
                        <div className="text-center">
                          <div className="text-xl font-extrabold text-slate-900">{stats.totalVisitsThisMonth}</div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Visits This Month</div>
                        </div>
                      </div>

                      <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                        <CheckCircle className="h-4 w-4 text-emerald-500" />
                        <span>Real-time metrics updated</span>
                      </span>
                    </div>

                  </div>
                )
              })()}

              {/* Column 3: Celebrations Ledger */}
              <div className="rounded-3xl border border-slate-100 bg-white/80 backdrop-blur-md p-6 shadow-[0_8px_30px_rgba(0,2,29,0.015)] flex flex-col justify-between hover:shadow-lg transition-all duration-300">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Celebration Center</h3>
                  <p className="text-xs font-medium text-slate-400 mt-0.5">Automated marketing targets active this month</p>
                  
                  <div className="mt-6 space-y-3.5">
                    
                    {/* Birthdays card list item */}
                    <div className="group/item flex items-center justify-between rounded-2xl border border-slate-100/50 bg-slate-50/30 p-3.5 transition-all hover:bg-white hover:border-orange-100 hover:shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-[#D64238] transition-colors group-hover/item:bg-orange-100/80">
                          <Gift className="h-4.5 w-4.5" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-800">Birthdays</div>
                          <div className="text-[11px] font-semibold text-slate-400 mt-0.5">This calendar month</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-lg font-extrabold text-slate-900">{stats.birthdaysThisMonth}</span>
                        <Link
                          href="/celebrations"
                          className="rounded-lg p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-800 transition-all"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </div>

                    {/* Anniversaries card list item */}
                    <div className="group/item flex items-center justify-between rounded-2xl border border-slate-100/50 bg-slate-50/30 p-3.5 transition-all hover:bg-white hover:border-rose-100 hover:shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-500 transition-colors group-hover/item:bg-rose-100/80">
                          <Heart className="h-4.5 w-4.5 fill-rose-500/20" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-800">Anniversaries</div>
                          <div className="text-[11px] font-semibold text-slate-400 mt-0.5">This calendar month</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-lg font-extrabold text-slate-900">{stats.anniversariesThisMonth}</span>
                        <Link
                          href="/celebrations?tab=anniversaries"
                          className="rounded-lg p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-800 transition-all"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </div>

                  </div>
                </div>

                <div className="mt-8 pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-2 rounded-xl bg-emerald-50/30 border border-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                    <Zap className="h-4 w-4 text-amber-500 animate-bounce" />
                    <span>Auto WhatsApp triggers operational</span>
                  </div>
                </div>
              </div>

            </div>

            {/* ── Advanced Quick Actions Grid ── */}
            {(isAdmin || isOwner) && (
              <div className={`grid grid-cols-1 gap-5 ${isAdmin ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
                
                {/* Action Card: Outlet Performance */}
                <Link href="/outlets" className="block no-underline">
                  <div className="group relative overflow-hidden rounded-3xl border border-slate-100 bg-white/70 backdrop-blur-md p-6 shadow-[0_8px_30px_rgb(0,0,0,0.015)] transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-slate-300/80">
                    <div className="absolute right-0 top-0 -z-10 h-24 w-24 rounded-full bg-slate-100/30 blur-xl transition-all group-hover:bg-slate-200/50" />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-600 transition-all group-hover:scale-110 group-hover:bg-[#D64238]/5 group-hover:text-[#D64238]">
                          <Building2 className="h-5 w-5" />
                        </div>
                        <div>
                          <h4 className="text-base font-extrabold text-slate-900 tracking-tight">Per-Outlet Performance</h4>
                          <p className="text-xs font-medium text-slate-400 mt-0.5">Compare analytics, metrics and lists by outlet branches</p>
                        </div>
                      </div>
                      
                      <div className="rounded-xl p-1.5 text-slate-300 transition-colors group-hover:bg-slate-50 group-hover:text-slate-800">
                        <ChevronRight className="h-5 w-5" />
                      </div>
                    </div>
                  </div>
                </Link>

                {/* Action Card: Automation Settings (Admin only) */}
                {isAdmin && (
                  <Link href="/automation" className="block no-underline">
                    <div className="group relative overflow-hidden rounded-3xl border border-orange-100 bg-gradient-to-r from-orange-50/20 via-white/80 to-orange-50/10 p-6 shadow-[0_8px_30px_rgba(242,101,34,0.015)] transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-orange-300">
                      {/* Background accent */}
                      <div className="absolute right-0 top-0 -z-10 h-28 w-28 rounded-full bg-orange-100/30 blur-2xl transition-all group-hover:bg-orange-200/40" />

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-[#D64238] transition-all group-hover:scale-110 group-hover:bg-[#D64238]/10">
                            <Zap className="h-5 w-5 fill-[#D64238]/10" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-base font-extrabold text-slate-900 tracking-tight">Marketing Automations</h4>
                              <span className="inline-flex items-center rounded-full bg-[#D64238]/10 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-[#D64238]">ADMIN</span>
                            </div>
                            <p className="text-xs font-medium text-slate-400 mt-0.5">Control WhatsApp workflows & email scheduler engines</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span>ACTIVE</span>
                          </span>
                          <div className="rounded-xl p-1.5 text-slate-400 transition-colors group-hover:bg-[#D64238]/5 group-hover:text-[#D64238]">
                            <ChevronRight className="h-5 w-5" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                )}

              </div>
            )}
          </>
        )}
      </div>
    </div>
  </div>
  )
}
