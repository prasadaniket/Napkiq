'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import type { Order, OrderSummary, OrderStatus, Outlet, PageResponse } from '@/types/api'
import GSAPDropdown from '@/components/ui/GSAPDropdown'
import {
  CheckCircle2, XCircle, Flame, IndianRupee, ShoppingBag, TrendingUp,
  ChevronDown, Calendar, ArrowRight, Users, User, Coffee,
  ChevronLeft, ChevronRight, Filter, Store, AlertCircle, Activity,
  Hash, CreditCard, Banknote, Smartphone, BarChart3, Clock, Search,
} from 'lucide-react'

function todayStr(): string { return new Date().toLocaleDateString('en-CA') }

function dayRange(from: string, to: string) {
  return {
    dateFrom: new Date(`${from}T00:00:00`).toISOString(),
    dateTo:   new Date(`${to}T23:59:59.999`).toISOString(),
  }
}

const STATUS_OPTIONS: (OrderStatus | 'all')[] = ['all', 'new', 'preparing', 'ready', 'served', 'cancelled']

const STATUS_META: Record<string, { color: string; bg: string; border: string }> = {
  new:       { color: '#6366f1', bg: 'rgba(99,102,241,0.08)',   border: 'rgba(99,102,241,0.2)'  },
  preparing: { color: '#d97706', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.2)'  },
  ready:     { color: '#059669', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.2)'  },
  served:    { color: '#64748b', bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.18)'},
  cancelled: { color: '#dc2626', bg: 'rgba(220,38,38,0.08)',   border: 'rgba(220,38,38,0.2)'  },
}

function KpiCard({ label, value, icon, color, sub, children }: {
  label: string; value: string | number; icon: React.ReactNode
  color: string; sub?: string; children?: React.ReactNode
}) {
  return (
    <div className="kpi-card" style={{ '--kpi-color': color } as React.CSSProperties}>
      <div className="kpi-card-icon">{icon}</div>
      <div className="kpi-card-body">
        <span className="kpi-label">{label}</span>
        <div className="kpi-value">{value}</div>
        {sub && <div className="kpi-sub">{sub}</div>}
        {children}
      </div>
    </div>
  )
}

export default function OrdersReportPage() {
  const { isFranchise } = useAuth()
  const [outlets, setOutlets]           = useState<Outlet[]>([])
  const [outletId, setOutletId]         = useState('')
  const [from, setFrom]                 = useState(todayStr())
  const [to, setTo]                     = useState(todayStr())
  const [status, setStatus]             = useState<OrderStatus | 'all'>('all')
  const [numberQuery, setNumberQuery]   = useState('')
  const [page, setPage]                 = useState(0)
  const [summary, setSummary]           = useState<OrderSummary | null>(null)
  const [history, setHistory]           = useState<PageResponse<Order> | null>(null)
  const [loading, setLoading]           = useState(true)

  useEffect(() => {
    api.get<Outlet[]>('/cms/outlets').then(r => {
      setOutlets(r.data)
      if (isFranchise && r.data.length > 0) setOutletId(r.data[0].id)
    }).catch(() => {})
  }, [isFranchise])

  const load = useCallback(async () => {
    setLoading(true)
    const { dateFrom, dateTo } = dayRange(from, to)
    const params = new URLSearchParams({ dateFrom, dateTo })
    if (outletId) params.set('outletId', outletId)
    const histParams = new URLSearchParams(params)
    if (status !== 'all') histParams.set('status', status)
    if (numberQuery.trim()) histParams.set('number', numberQuery.trim())
    histParams.set('page', String(page))
    histParams.set('size', '20')
    try {
      const [s, h] = await Promise.all([
        api.get<OrderSummary>(`/cms/orders/summary?${params.toString()}`),
        api.get<PageResponse<Order>>(`/cms/orders/history?${histParams.toString()}`),
      ])
      setSummary(s.data)
      setHistory(h.data)
    } catch { /* handled by interceptor */ }
    finally { setLoading(false) }
  }, [from, to, outletId, status, numberQuery, page])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(0) }, [from, to, outletId, status, numberQuery])

  const money = (n: number) => `\u20b9${n.toLocaleString('en-IN')}`

  const totalPayments = summary
    ? (summary.payments?.cash ?? 0) + (summary.payments?.upi ?? 0) + (summary.payments?.card ?? 0)
    : 0

  return (
    <div className="or-root">

      {/* Premium Dark Header */}
      <div className="or-header">
        <div className="or-header-left">
          <div className="or-header-icon"><BarChart3 size={20} /></div>
          <div>
            <h1 className="or-title">Orders &amp; Sales</h1>
            <p className="or-subtitle">Revenue analytics and order history</p>
          </div>
        </div>
        <div className="or-header-controls">
          {!isFranchise && (
            <GSAPDropdown
              value={outletId}
              onChange={setOutletId}
              options={[{ value: '', label: 'All outlets' }, ...outlets.map(o => ({ value: o.id, label: o.name }))]}
              icon={<Store size={14} />}
              width="175px"
            />
          )}
          <div className="or-date-pill">
            <Calendar size={13} className="or-date-icon" />
            <input type="date" className="or-date-input" value={from} max={to} onChange={e => setFrom(e.target.value)} />
            <span className="or-date-sep"><ArrowRight size={11} /></span>
            <input type="date" className="or-date-input" value={to} min={from} max={todayStr()} onChange={e => setTo(e.target.value)} />
          </div>
        </div>
      </div>

      {/* KPI Row */}
      <div className="or-kpi-row">
        <KpiCard label="Revenue" value={summary ? money(summary.revenue) : '\u2014'} icon={<IndianRupee size={18} />} color="#d64238" sub="Total billed" />
        <KpiCard label="Orders Served" value={summary?.servedCount ?? '\u2014'} icon={<CheckCircle2 size={18} />} color="#059669"
          sub={summary ? `of ${(summary.servedCount ?? 0) + (summary.cancelledCount ?? 0) + (summary.activeCount ?? 0)} total` : undefined} />
        <KpiCard label="Items Sold" value={summary?.itemsSold ?? '\u2014'} icon={<ShoppingBag size={18} />} color="#6366f1" sub="Across all orders" />
        <KpiCard label="Active Now" value={summary?.activeCount ?? '\u2014'} icon={<Flame size={18} />} color="#d97706">
          {summary && summary.activeCount > 0 && <span className="kpi-live-dot" />}
        </KpiCard>
        <KpiCard label="Cancelled" value={summary?.cancelledCount ?? '\u2014'} icon={<XCircle size={18} />} color="#dc2626"
          sub={summary && summary.cancelledCount > 0
            ? `${summary.cancelledByCustomer ?? 0} customer \u00b7 ${summary.cancelledByStaff ?? 0} staff`
            : undefined} />
      </div>

      {/* Insights Row */}
      <div className="or-insights-row">

        {/* Payment breakdown */}
        <div className="or-insight-card">
          <div className="or-insight-header">
            <CreditCard size={14} className="or-insight-icon" />
            <span className="or-insight-title">Payment Breakdown</span>
            <span className="or-insight-badge">{summary?.settledTabs ?? 0} tabs</span>
          </div>
          <div className="or-pay-list">
            {([
              ['cash', 'Cash',   '#16a34a', <Banknote    key="c" size={14} />],
              ['upi',  'UPI',    '#2563eb', <Smartphone  key="u" size={14} />],
              ['card', 'Card',   '#a855f7', <CreditCard  key="k" size={14} />],
            ] as const).map(([k, label, color, ico]) => {
              const amt = summary?.payments?.[k] ?? 0
              const cnt = summary?.paymentCounts?.[k] ?? 0
              const pct = totalPayments > 0 ? Math.round((amt / totalPayments) * 100) : 0
              return (
                <div key={k} className="or-pay-row">
                  <span className="or-pay-ico" style={{ color }}>{ico}</span>
                  <span className="or-pay-label">{label}</span>
                  <div className="or-pay-bar-wrap">
                    <div className="or-pay-bar-bg">
                      <div className="or-pay-bar-fill" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                  <span className="or-pay-cnt">{cnt}</span>
                  <span className="or-pay-amt" style={{ color }}>{money(amt)}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Top items */}
        <div className="or-insight-card or-insight-card--wide">
          <div className="or-insight-header">
            <TrendingUp size={14} className="or-insight-icon" />
            <span className="or-insight-title">Top Items Sold</span>
          </div>
          <div className="or-top-list">
            {summary && summary.topItems.length > 0 ? (() => {
              const maxQty = Math.max(...summary.topItems.map(t => t.quantity), 1)
              return summary.topItems.map((t, idx) => (
                <div key={t.name} className="or-top-row">
                  <span className="or-top-rank">#{idx + 1}</span>
                  <span className="or-top-name">{t.name}</span>
                  <div className="or-top-bar-bg">
                    <div className="or-top-bar-fill" style={{ width: `${Math.round((t.quantity / maxQty) * 100)}%` }} />
                  </div>
                  <span className="or-top-qty">\u00d7{t.quantity}</span>
                </div>
              ))
            })() : (
              <div className="or-empty-insight">No sales data for selected range</div>
            )}
          </div>
        </div>
      </div>

      {/* Order Log */}
      <div className="or-log-section">
        <div className="or-log-header">
          <div className="or-log-title-wrap">
            <Clock size={15} className="or-log-title-icon" />
            <h2 className="or-log-title">Order Log</h2>
            {history && <span className="or-log-count">{history.totalElements} orders</span>}
          </div>
          <div className="or-log-filters">
            <div className="or-search-wrap">
              <Search size={12} className="or-search-icon" />
              <input
                type="number" inputMode="numeric" placeholder="Order #"
                value={numberQuery} onChange={e => setNumberQuery(e.target.value)}
                className="or-search-input"
              />
            </div>
            <div className="or-status-wrap">
              <Filter size={12} className="or-status-icon" />
              <select className="or-status-select" value={status} onChange={e => setStatus(e.target.value as OrderStatus | 'all')}>
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{s === 'all' ? 'All Statuses' : s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
              <ChevronDown size={12} className="or-status-arrow" />
            </div>
          </div>
        </div>

        <div className="or-table-card">
          <div style={{ overflowX: 'auto' }}>
            <table className="or-table">
              <thead>
                <tr>
                  <th><Hash size={10} style={{ display:'inline', verticalAlign:'middle', marginRight:3 }} />Order</th>
                  <th><Clock size={10} style={{ display:'inline', verticalAlign:'middle', marginRight:3 }} />Time</th>
                  <th>Items</th>
                  <th>Service</th>
                  <th>Source</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading && !history ? (
                  <tr><td colSpan={7}><div className="or-loading"><Activity className="animate-spin" size={20} /><span>Loading orders\u2026</span></div></td></tr>
                ) : history && history.content.length > 0 ? (
                  history.content.map(o => {
                    const total = o.items.reduce((s, it) => s + (it.priceSnapshot ? parseFloat(it.priceSnapshot) * it.quantity : 0), 0)
                    const dateObj = new Date(o.createdAt)
                    const dateStr = dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                    const timeStr = dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
                    const sm = STATUS_META[o.status] ?? STATUS_META.served
                    return (
                      <tr key={o.id} className="or-table-row">
                        <td>
                          <span className="or-order-num">{o.dailyNumber != null ? `#${o.dailyNumber}` : '\u2014'}</span>
                          {o.outlet && <div className="or-outlet-code">{o.outlet.code}</div>}
                        </td>
                        <td>
                          <div className="or-time-date">{dateStr}</div>
                          <div className="or-time-clock">{timeStr}</div>
                        </td>
                        <td className="or-items-cell">
                          {o.items.map(it => (
                            <div key={it.id} className="or-item-row">
                              <span className="or-item-qty">{it.quantity}\u00d7</span>
                              <span className="or-item-name">
                                {it.nameSnapshot}
                                {it.variantLabel && <span className="or-item-variant"> ({it.variantLabel})</span>}
                              </span>
                              {it.note && <span className="or-item-note">\ud83d\udcdd {it.note}</span>}
                            </div>
                          ))}
                        </td>
                        <td>
                          {o.serviceType === 'table' ? (
                            <span className="or-service-badge or-service-table"><Coffee size={11} />Table {o.boardNumber || '\u2014'}</span>
                          ) : (
                            <span className="or-service-badge or-service-self"><ShoppingBag size={11} />Self</span>
                          )}
                        </td>
                        <td>
                          <span className={`or-source-badge or-source-${o.source}`}>
                            {o.source === 'staff' ? <Users size={11} /> : <User size={11} />}
                            <span style={{ textTransform: 'capitalize' }}>{o.source}</span>
                          </span>
                        </td>
                        <td><span className="or-total">{total > 0 ? money(total) : '\u2014'}</span></td>
                        <td>
                          <span className="or-status-pill" style={{ color: sm.color, background: sm.bg, borderColor: sm.border }}>
                            <span className="or-status-dot" style={{ background: sm.color }} />
                            {o.status}{o.status === 'cancelled' && o.cancelledBy ? ` \u00b7 ${o.cancelledBy}` : ''}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr><td colSpan={7}><div className="or-empty"><AlertCircle size={20} /><span>No orders found for this range</span></div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {history && history.totalPages > 1 && (
          <div className="or-pagination">
            <span className="or-page-info">Page {history.number + 1} of {history.totalPages} \u00b7 {history.totalElements} orders</span>
            <div className="or-page-btns">
              <button className="or-page-btn" disabled={history.first || loading} onClick={() => setPage(p => Math.max(0, p - 1))}>
                <ChevronLeft size={14} />Prev
              </button>
              {Array.from({ length: Math.min(history.totalPages, 5) }, (_, i) => {
                const pageNum = Math.max(0, Math.min(history.number - 2, history.totalPages - 5)) + i
                return (
                  <button key={pageNum} className={`or-page-btn or-page-num ${pageNum === history.number ? 'active' : ''}`}
                    onClick={() => setPage(pageNum)} disabled={loading}>{pageNum + 1}</button>
                )
              })}
              <button className="or-page-btn" disabled={history.last || loading} onClick={() => setPage(p => p + 1)}>
                Next<ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .or-root {
          min-height: calc(100vh - 40px);
          background: #f4f4f2;
          display: flex;
          flex-direction: column;
          gap: 1.15rem;
          padding: 1.5rem;
        }
        /* Header */
        .or-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          background: linear-gradient(135deg, #0d0f1a 0%, #181b2e 100%);
          border-radius: 16px;
          padding: 1.1rem 1.5rem;
          box-shadow: 0 8px 32px rgba(0,0,0,0.18);
          flex-wrap: wrap;
        }
        .or-header-left { display: flex; align-items: center; gap: 14px; }
        .or-header-icon {
          width: 42px; height: 42px; border-radius: 12px;
          background: rgba(214,66,56,0.18); border: 1px solid rgba(214,66,56,0.3);
          display: flex; align-items: center; justify-content: center;
          color: #f87171; flex-shrink: 0;
        }
        .or-title { font-size: 1.3rem; font-weight: 800; color: #ffffff; letter-spacing: -0.025em; margin: 0; }
        .or-subtitle { font-size: 12px; color: rgba(255,255,255,0.4); margin: 2px 0 0; font-weight: 500; }
        .or-header-controls { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .or-date-pill {
          display: flex; align-items: center; gap: 5px;
          background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12);
          border-radius: 10px; padding: 6px 12px; height: 38px;
        }
        .or-date-icon { color: rgba(255,255,255,0.4); flex-shrink: 0; }
        .or-date-sep { color: rgba(255,255,255,0.25); display: flex; align-items: center; }
        .or-date-input {
          border: none; background: transparent; font-size: 12px; font-weight: 600;
          color: rgba(255,255,255,0.85); padding: 0 4px; width: 110px; cursor: pointer; outline: none;
        }
        .or-date-input::-webkit-calendar-picker-indicator { filter: invert(0.8); cursor: pointer; }

        /* KPI */
        .or-kpi-row { display: grid; grid-template-columns: repeat(5,1fr); gap: 0.8rem; }
        @media(max-width:1200px){.or-kpi-row{grid-template-columns:repeat(3,1fr)}}
        @media(max-width:768px){.or-kpi-row{grid-template-columns:repeat(2,1fr)}}

        .kpi-card {
          background: #fff; border: 1px solid var(--color-border);
          border-radius: 14px; padding: 1.05rem 1.1rem;
          display: flex; flex-direction: column; gap: 0.45rem;
          position: relative; overflow: hidden;
          transition: all 0.2s cubic-bezier(0.16,1,0.3,1);
          border-top: 3px solid var(--kpi-color, var(--color-border));
          box-shadow: 0 2px 8px rgba(0,2,29,0.04);
        }
        .kpi-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,2,29,0.07); }
        .kpi-card-icon {
          width: 34px; height: 34px; border-radius: 9px;
          background: color-mix(in srgb, var(--kpi-color,#ccc) 10%, transparent);
          color: var(--kpi-color, var(--color-text-2));
          display: flex; align-items: center; justify-content: center;
        }
        .kpi-card-body { display: flex; flex-direction: column; }
        .kpi-label { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: var(--color-text-3); }
        .kpi-value { font-size: 1.65rem; font-weight: 900; color: var(--color-text-1); letter-spacing: -0.035em; line-height: 1.1; margin-top: 2px; }
        .kpi-sub { font-size: 10.5px; color: var(--color-text-3); margin-top: 2px; font-weight: 500; }
        .kpi-live-dot {
          display: inline-block; width: 6px; height: 6px; border-radius: 50%;
          background: #d97706; margin-top: 5px;
          animation: kpi-pulse 1.8s infinite;
        }
        @keyframes kpi-pulse {
          0%  { box-shadow: 0 0 0 0   rgba(217,119,6,0.5); }
          100%{ box-shadow: 0 0 0 7px rgba(217,119,6,0);   }
        }

        /* Insights */
        .or-insights-row { display: grid; grid-template-columns: 1fr 1.7fr; gap: 0.8rem; }
        @media(max-width:900px){.or-insights-row{grid-template-columns:1fr}}

        .or-insight-card {
          background: #fff; border: 1px solid var(--color-border); border-radius: 14px;
          padding: 1.05rem 1.15rem; box-shadow: 0 2px 8px rgba(0,2,29,0.04);
          display: flex; flex-direction: column; gap: 0.75rem;
        }
        .or-insight-header { display: flex; align-items: center; gap: 7px; padding-bottom: 0.55rem; border-bottom: 1px solid var(--color-border); }
        .or-insight-icon { color: var(--color-primary); }
        .or-insight-title { font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.07em; color: var(--color-text-2); flex: 1; }
        .or-insight-badge { font-size: 10px; font-weight: 700; color: var(--color-text-3); background: rgba(0,2,29,0.04); padding: 2px 8px; border-radius: 99px; border: 1px solid var(--color-border); }

        .or-pay-list { display: flex; flex-direction: column; gap: 10px; }
        .or-pay-row { display: flex; align-items: center; gap: 9px; }
        .or-pay-ico { display: flex; align-items: center; flex-shrink: 0; }
        .or-pay-label { font-size: 12px; font-weight: 700; color: var(--color-text-2); width: 36px; }
        .or-pay-bar-wrap { flex: 1; }
        .or-pay-bar-bg { height: 5px; background: rgba(0,2,29,0.05); border-radius: 99px; overflow: hidden; }
        .or-pay-bar-fill { height: 100%; border-radius: 99px; transition: width 0.5s ease; }
        .or-pay-cnt { font-size: 10px; font-weight: 700; color: var(--color-text-3); background: rgba(0,2,29,0.04); padding: 1.5px 7px; border-radius: 99px; min-width: 22px; text-align: center; }
        .or-pay-amt { font-size: 12.5px; font-weight: 800; min-width: 68px; text-align: right; }

        .or-top-list { display: flex; flex-direction: column; gap: 9px; }
        .or-top-row { display: flex; align-items: center; gap: 9px; }
        .or-top-rank { font-size: 9px; font-weight: 800; color: var(--color-text-3); width: 22px; flex-shrink: 0; text-align: center; }
        .or-top-name { font-size: 12px; font-weight: 600; color: var(--color-text-1); min-width: 110px; max-width: 180px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .or-top-bar-bg { flex: 1; height: 5px; background: rgba(0,2,29,0.04); border-radius: 99px; overflow: hidden; }
        .or-top-bar-fill { height: 100%; background: linear-gradient(90deg, var(--color-primary), #e86860); border-radius: 99px; transition: width 0.5s ease; }
        .or-top-qty { font-size: 11px; font-weight: 800; color: var(--color-primary); min-width: 30px; text-align: right; }
        .or-empty-insight { font-size: 12px; color: var(--color-text-3); font-weight: 500; padding: 0.5rem 0; text-align: center; }

        /* Log section */
        .or-log-section { display: flex; flex-direction: column; gap: 0.75rem; }
        .or-log-header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
        .or-log-title-wrap { display: flex; align-items: center; gap: 8px; }
        .or-log-title-icon { color: var(--color-text-2); }
        .or-log-title { font-size: 15px; font-weight: 800; color: var(--color-text-1); letter-spacing: -0.015em; margin: 0; }
        .or-log-count { font-size: 10.5px; font-weight: 700; color: var(--color-text-3); background: rgba(0,2,29,0.04); border: 1px solid var(--color-border); padding: 2px 9px; border-radius: 99px; }
        .or-log-filters { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .or-search-wrap { position: relative; display: flex; align-items: center; }
        .or-search-icon { position: absolute; left: 10px; color: var(--color-text-3); pointer-events: none; }
        .or-search-input { height: 34px; width: 110px; padding: 0 10px 0 28px; border: 1px solid var(--color-border); border-radius: 8px; background: #fff; font-size: 12px; font-weight: 600; color: var(--color-text-1); outline: none; transition: all 0.15s ease; }
        .or-search-input:focus { border-color: var(--color-primary); box-shadow: 0 0 0 2.5px var(--color-primary-border); }
        .or-search-input::placeholder { color: var(--color-text-3); font-weight: 500; }
        .or-status-wrap { position: relative; display: flex; align-items: center; }
        .or-status-icon { position: absolute; left: 10px; color: var(--color-text-3); pointer-events: none; }
        .or-status-arrow { position: absolute; right: 10px; color: var(--color-text-3); pointer-events: none; }
        .or-status-select { height: 34px; padding: 0 30px 0 28px; border: 1px solid var(--color-border); border-radius: 8px; background: #fff; font-size: 12px; font-weight: 600; color: var(--color-text-1); cursor: pointer; appearance: none; -webkit-appearance: none; outline: none; transition: all 0.15s ease; }
        .or-status-select:focus { border-color: var(--color-primary); box-shadow: 0 0 0 2.5px var(--color-primary-border); }

        /* Table */
        .or-table-card { background: #fff; border: 1px solid var(--color-border); border-radius: 14px; box-shadow: 0 2px 8px rgba(0,2,29,0.04); overflow: hidden; }
        .or-table { width: 100%; border-collapse: collapse; text-align: left; }
        .or-table th { background: #fafaf9; border-bottom: 1.5px solid var(--color-border); color: var(--color-text-3); font-weight: 800; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.1em; padding: 11px 16px; white-space: nowrap; }
        .or-table td { padding: 11px 16px; vertical-align: top; font-size: 13px; border-bottom: 1px solid rgba(0,2,29,0.04); }
        .or-table-row { transition: background 0.12s ease; }
        .or-table-row:nth-child(even) { background: rgba(0,2,29,0.007); }
        .or-table-row:hover { background: rgba(214,66,56,0.028); }
        .or-table-row:last-child td { border-bottom: none; }

        .or-order-num { font-size: 14px; font-weight: 900; color: var(--color-primary); letter-spacing: -0.02em; }
        .or-outlet-code { font-size: 10.5px; color: var(--color-text-3); font-weight: 600; margin-top: 2px; }
        .or-time-date { font-weight: 700; color: var(--color-text-1); font-size: 12.5px; }
        .or-time-clock { font-size: 11px; color: var(--color-text-3); font-weight: 500; margin-top: 2px; }
        .or-items-cell { max-width: 280px; }
        .or-item-row { display: flex; align-items: baseline; gap: 5px; margin-bottom: 3px; line-height: 1.45; flex-wrap: wrap; }
        .or-item-row:last-child { margin-bottom: 0; }
        .or-item-qty { font-weight: 800; color: var(--color-primary); background: var(--color-primary-dim); border: 1px solid var(--color-primary-border); border-radius: 4px; padding: 0 4px; font-size: 10px; line-height: 1.5; flex-shrink: 0; }
        .or-item-name { font-weight: 600; color: var(--color-text-1); font-size: 12.5px; }
        .or-item-variant { font-size: 11px; color: var(--color-text-3); font-weight: 500; }
        .or-item-note { font-size: 11px; color: var(--color-text-3); font-style: italic; width: 100%; }
        .or-service-badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 9px; border-radius: 6px; font-size: 11px; font-weight: 700; white-space: nowrap; }
        .or-service-table { background: var(--color-primary-dim); color: var(--color-primary); border: 1px solid var(--color-primary-border); }
        .or-service-self { background: rgba(16,185,129,0.07); color: #059669; border: 1px solid rgba(16,185,129,0.15); }
        .or-source-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; font-weight: 700; white-space: nowrap; }
        .or-source-staff { color: #a855f7; }
        .or-source-customer { color: #6366f1; }
        .or-total { font-weight: 800; color: var(--color-text-1); font-size: 13px; white-space: nowrap; }
        .or-status-pill { display: inline-flex; align-items: center; gap: 5px; padding: 3.5px 10px; border-radius: 99px; font-size: 10.5px; font-weight: 700; text-transform: capitalize; border: 1px solid transparent; white-space: nowrap; }
        .or-status-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
        .or-loading, .or-empty { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 3rem 1rem; color: var(--color-text-3); font-size: 13px; font-weight: 600; }

        /* Pagination */
        .or-pagination { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
        .or-page-info { font-size: 12px; color: var(--color-text-3); font-weight: 500; }
        .or-page-btns { display: flex; gap: 4px; }
        .or-page-btn { display: inline-flex; align-items: center; gap: 4px; height: 32px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--color-border); background: #fff; font-size: 12px; font-weight: 700; color: var(--color-text-2); cursor: pointer; transition: all 0.15s ease; }
        .or-page-btn:hover:not(:disabled) { border-color: var(--color-primary); color: var(--color-primary); background: var(--color-primary-dim); }
        .or-page-btn.active { background: var(--color-primary); color: #fff; border-color: var(--color-primary); }
        .or-page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .or-page-num { min-width: 32px; justify-content: center; padding: 0 6px; }
      `}</style>
    </div>
  )
}
