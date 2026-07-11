'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import type { Order, OrderSummary, OrderStatus, Outlet, PageResponse } from '@/types/api'
import GSAPDropdown from '@/components/ui/GSAPDropdown'
import {
  CheckCircle2,
  XCircle,
  Flame,
  IndianRupee,
  ShoppingBag,
  TrendingUp,
  ChevronDown,
  Calendar,
  ArrowRight,
  Users,
  User,
  Coffee,
  ChevronLeft,
  ChevronRight,
  Filter,
  Store,
  AlertCircle,
  Activity
} from 'lucide-react'

// ─── Helpers ────────────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toLocaleDateString('en-CA') // yyyy-mm-dd (local)
}

function dayRange(from: string, to: string) {
  return {
    dateFrom: new Date(`${from}T00:00:00`).toISOString(),
    dateTo:   new Date(`${to}T23:59:59.999`).toISOString(),
  }
}

const STATUS_OPTIONS: (OrderStatus | 'all')[] = ['all', 'new', 'preparing', 'ready', 'served', 'cancelled']

// ─── Tile Card Component ─────────────────────────────────────────────────────────

function Tile({ label, value, sub, icon, accent, children }: {
  label: string
  value: string | number
  sub?: string
  icon: React.ReactNode
  accent?: boolean
  children?: React.ReactNode
}) {
  return (
    <div className={`orders-summary-card ${accent ? 'accent' : ''}`}>
      <div className="summary-card-icon-wrap">
        {icon}
      </div>
      <div>
        <span className="label">{label}</span>
        <div className="value">{value}</div>
        {sub && <div className="subtext">{sub}</div>}
        {children}
      </div>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function OrdersReportPage() {
  const { isFranchise } = useAuth()
  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [outletId, setOutletId] = useState('') // '' = all outlets (admin/owner)
  const [from, setFrom] = useState(todayStr())
  const [to, setTo] = useState(todayStr())
  const [status, setStatus] = useState<OrderStatus | 'all'>('all')
  const [numberQuery, setNumberQuery] = useState('')
  const [page, setPage] = useState(0)

  const [summary, setSummary] = useState<OrderSummary | null>(null)
  const [history, setHistory] = useState<PageResponse<Order> | null>(null)
  const [loading, setLoading] = useState(true)

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
    } catch {
      /* handled by interceptor */
    } finally {
      setLoading(false)
    }
  }, [from, to, outletId, status, numberQuery, page])

  useEffect(() => { load() }, [load])

  // Reset to first page when filters change.
  useEffect(() => { setPage(0) }, [from, to, outletId, status, numberQuery])

  const money = (n: number) => `₹${n.toLocaleString('en-IN')}`

  return (
    <div className="orders-page-container">
      {/* Header + filters */}
      <div className="orders-header-bar">
        <div className="orders-title-section">
          <h1>Orders &amp; Sales</h1>
          <p>Order logs, revenue statistics, and business summaries</p>
        </div>
        
        <div className="filter-console">
          {!isFranchise && (
            <GSAPDropdown
              value={outletId}
              onChange={setOutletId}
              options={[{ value: '', label: 'All outlets' }, ...outlets.map(o => ({ value: o.id, label: o.name }))]}
              icon={<Store size={14} />}
              width="190px"
            />
          )}

          <div className="date-range-container">
            <div className="date-input-wrap">
              <Calendar size={13} className="date-input-icon" />
              <input 
                type="date" 
                className="orders-date-input" 
                value={from} 
                max={to} 
                onChange={e => setFrom(e.target.value)} 
              />
            </div>
            <ArrowRight size={12} style={{ color: 'var(--color-text-3)', margin: '0 4px' }} />
            <div className="date-input-wrap">
              <Calendar size={13} className="date-input-icon" />
              <input 
                type="date" 
                className="orders-date-input" 
                value={to} 
                min={from} 
                max={todayStr()} 
                onChange={e => setTo(e.target.value)} 
              />
            </div>
          </div>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="orders-summary-grid">
        <Tile 
          label="Served" 
          value={summary?.servedCount ?? '—'} 
          icon={<CheckCircle2 size={16} />} 
          accent 
        />
        <Tile 
          label="Revenue" 
          value={summary ? money(summary.revenue) : '—'} 
          icon={<IndianRupee size={16} />} 
          accent 
        />
        <Tile 
          label="Items Sold" 
          value={summary?.itemsSold ?? '—'} 
          icon={<ShoppingBag size={16} />} 
        />
        <Tile 
          label="Active Now" 
          value={summary?.activeCount ?? '—'} 
          icon={<Flame size={16} />}
        >
          {summary && summary.activeCount > 0 && <span className="pulse-dot-active" />}
        </Tile>
        <Tile
          label="Cancelled"
          value={summary?.cancelledCount ?? '—'}
          icon={<XCircle size={16} />}
        >
          {summary && summary.cancelledCount > 0 && (
            <div className="cancelled-sub-badge">
              <span>👤 {summary.cancelledByCustomer} by customer</span>
              <span>🧑‍🍳 {summary.cancelledByStaff} by staff</span>
            </div>
          )}
        </Tile>

        {/* Top Items Progress Card */}
        <div className="orders-summary-card top-items-card">
          <div className="top-items-header">
            <TrendingUp size={13} className="top-items-icon" />
            <span className="top-items-title">Top Items Sold</span>
          </div>
          <div className="top-items-list">
            {summary && summary.topItems.length > 0 ? (
              (() => {
                const maxQty = Math.max(...summary.topItems.map(t => t.quantity), 1)
                return summary.topItems.map((t) => {
                  const pct = Math.round((t.quantity / maxQty) * 100)
                  return (
                    <div key={t.name} className="top-item-row">
                      <div className="top-item-info">
                        <span className="top-item-name">{t.name}</span>
                        <span className="top-item-qty">×{t.quantity}</span>
                      </div>
                      <div className="top-item-progress-bg">
                        <div className="top-item-progress-bar" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })
              })()
            ) : (
              <div className="top-items-empty">No sales in range</div>
            )}
          </div>
        </div>
      </div>

      {/* History log header */}
      <div className="log-section-header">
        <h2 className="log-section-title">Order Log</h2>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="number"
          inputMode="numeric"
          placeholder="Order #"
          value={numberQuery}
          onChange={e => setNumberQuery(e.target.value)}
          className="orders-select"
          style={{ height: 34, fontSize: 12, width: 110, paddingLeft: 12 }}
        />

        <div className="select-outlet-container">
          <Filter size={12} className="select-outlet-icon" />
          <select 
            className="orders-select" 
            value={status} 
            onChange={e => setStatus(e.target.value as OrderStatus | 'all')}
            style={{ height: 34, fontSize: 12, paddingLeft: '32px', width: 'auto' }}
          >
            {STATUS_OPTIONS.map(s => (
              <option key={s} value={s}>
                {s === 'all' ? 'All Statuses' : s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
          <ChevronDown size={12} className="orders-select-arrow" />
        </div>
        </div>
      </div>

      {/* Log table */}
      <div className="table-console-card">
        <div style={{ overflowX: 'auto' }}>
          <table className="order-log-table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Time</th>
                <th>Items</th>
                <th>Service Type</th>
                <th>Source</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading && !history ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3rem 0' }}>
                    <div className="kds-card-empty-state">
                      <Activity className="animate-spin" size={20} />
                      <span>Loading orders…</span>
                    </div>
                  </td>
                </tr>
              ) : history && history.content.length > 0 ? (
                history.content.map(o => {
                  const total = o.items.reduce((s, it) => s + (it.priceSnapshot ? parseFloat(it.priceSnapshot) * it.quantity : 0), 0)
                  const dateObj = new Date(o.createdAt)
                  const dateStr = dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                  const timeStr = dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })

                  return (
                    <tr key={o.id}>
                      <td className="whitespace-nowrap">
                        <span style={{ fontWeight: 800, color: 'var(--color-primary)' }}>
                          {o.dailyNumber != null ? `#${o.dailyNumber}` : '—'}
                        </span>
                        {o.outlet && <div className="order-time-clock">{o.outlet.code}</div>}
                      </td>
                      <td className="whitespace-nowrap">
                        <div className="order-time-date">{dateStr}</div>
                        <div className="order-time-clock">{timeStr}</div>
                      </td>
                      <td style={{ maxWidth: '280px' }}>
                        {o.items.map(it => (
                          <div key={it.id} className="order-log-item-row">
                            <span className="order-log-item-qty">{it.quantity}×</span>
                            <span className="order-log-item-name">
                              {it.nameSnapshot}
                              {it.variantLabel && <span className="order-log-item-variant">({it.variantLabel})</span>}
                              {it.note && <span className="order-log-item-note">📝 {it.note}</span>}
                            </span>
                          </div>
                        ))}
                      </td>
                      <td className="whitespace-nowrap">
                        {o.serviceType === 'table' ? (
                          <span className="service-badge table">
                            <Coffee size={12} />
                            Table {o.boardNumber || '—'}
                          </span>
                        ) : (
                          <span className="service-badge self">
                            <ShoppingBag size={12} />
                            Self
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap">
                        <span className={`source-badge ${o.source}`}>
                          {o.source === 'staff' ? <Users size={12} /> : <User size={12} />}
                          <span style={{ textTransform: 'capitalize' }}>{o.source}</span>
                        </span>
                      </td>
                      <td className="whitespace-nowrap font-bold" style={{ color: 'var(--color-text-1)' }}>
                        {total > 0 ? money(total) : '—'}
                      </td>
                      <td className="whitespace-nowrap">
                        <span className={`status-pill ${o.status}`}>
                          <span className="status-dot" />
                          {o.status}
                          {o.status === 'cancelled' && o.cancelledBy ? ` · ${o.cancelledBy}` : ''}
                        </span>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3rem 0' }}>
                    <div className="kds-card-empty-state" style={{ border: 'none', background: 'transparent' }}>
                      <AlertCircle size={20} />
                      <span>No orders found in this range</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {history && history.totalPages > 1 && (
        <div className="paginator-console">
          <span>
            Page {history.number + 1} of {history.totalPages} · {history.totalElements} orders
          </span>
          <div className="paginator-buttons">
            <button 
              className="btn-paginator" 
              disabled={history.first || loading} 
              onClick={() => setPage(p => Math.max(0, p - 1))}
            >
              <ChevronLeft size={14} />
              Prev
            </button>
            <button 
              className="btn-paginator" 
              disabled={history.last || loading} 
              onClick={() => setPage(p => p + 1)}
            >
              Next
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      <style>{`
        /* ─── Page Container ─── */
        .orders-page-container {
          background: #fafaf9;
          min-height: calc(100vh - 120px);
          border-radius: var(--radius-xl);
          padding: 1.5rem;
          margin: 1.5rem;
          box-shadow: 0 4px 30px rgba(0, 2, 29, 0.015);
          border: 1px solid var(--color-border);
        }

        /* ─── Header & Filters Console ─── */
        .orders-header-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
          gap: 1rem;
        }
        .orders-title-section h1 {
          font-size: 1.5rem;
          font-weight: 800;
          color: var(--color-text-1);
          letter-spacing: -0.02em;
          margin: 0;
        }
        .orders-title-section p {
          font-size: 13px;
          color: var(--color-text-3);
          margin: 2px 0 0 0;
        }

        .filter-console {
          display: flex;
          align-items: center;
          gap: 12px;
          background: #ffffff;
          border: 1px solid var(--color-border);
          padding: 8px 12px;
          border-radius: var(--radius-lg);
          box-shadow: 0 4px 20px rgba(0, 2, 29, 0.012);
          flex-wrap: wrap;
        }

        /* Select styling */
        .select-outlet-container {
          position: relative;
          display: flex;
          align-items: center;
        }
        .select-outlet-icon {
          position: absolute;
          left: 12px;
          color: var(--color-text-3);
          pointer-events: none;
        }
        .orders-select {
          background: #ffffff;
          border: 1px solid var(--color-border-strong);
          color: var(--color-text-1);
          font-weight: 600;
          font-size: 13px;
          padding: 8px 32px 8px 36px !important;
          border-radius: var(--radius-md);
          height: 38px;
          cursor: pointer;
          appearance: none;
          -webkit-appearance: none;
          transition: all 0.2s ease;
        }
        .orders-select:hover {
          border-color: var(--color-primary);
          background-color: var(--color-primary-dim);
          color: var(--color-primary);
        }
        .orders-select:focus {
          outline: none;
          box-shadow: 0 0 0 3px var(--color-primary-border);
        }
        .orders-select-arrow {
          position: absolute;
          right: 12px;
          color: var(--color-text-3);
          pointer-events: none;
        }

        /* Date selector styling */
        .date-range-container {
          display: flex;
          align-items: center;
          gap: 4px;
          background: rgba(0, 2, 29, 0.02);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: 3px 8px;
          height: 38px;
        }
        .date-input-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }
        .date-input-icon {
          position: absolute;
          left: 8px;
          color: var(--color-text-3);
          pointer-events: none;
        }
        .orders-date-input {
          border: none;
          background: transparent;
          font-size: 12px;
          font-weight: 600;
          color: var(--color-text-1);
          padding: 4px 6px 4px 28px;
          width: 124px;
          cursor: pointer;
        }
        .orders-date-input:focus {
          outline: none;
        }

        /* ─── Metric KPI Cards ─── */
        .orders-summary-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 1rem;
          margin-bottom: 2rem;
        }
        @media (max-width: 1360px) {
          .orders-summary-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }
        @media (max-width: 768px) {
          .orders-summary-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        .orders-summary-card {
          background: #ffffff;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: 1.15rem;
          box-shadow: 0 4px 12px rgba(0, 2, 29, 0.01);
          display: flex;
          flex-direction: column;
          position: relative;
          overflow: hidden;
          transition: all 0.2s ease;
        }
        .orders-summary-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 2, 29, 0.04);
          border-color: var(--color-border-strong);
        }
        .orders-summary-card.accent {
          border-color: var(--color-primary-border);
        }
        .summary-card-icon-wrap {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 0.75rem;
          background: rgba(0, 2, 29, 0.03);
          color: var(--color-text-2);
        }
        .orders-summary-card.accent .summary-card-icon-wrap {
          background: var(--color-primary-dim);
          color: var(--color-primary);
        }
        .orders-summary-card .label {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--color-text-3);
        }
        .orders-summary-card .value {
          font-size: 1.45rem;
          font-weight: 850;
          color: var(--color-text-1);
          margin-top: 4px;
          letter-spacing: -0.02em;
          line-height: 1.2;
        }
        .orders-summary-card .subtext {
          font-size: 11px;
          color: var(--color-text-3);
          margin-top: 2px;
          font-weight: 500;
        }

        /* Active Now breathing dot */
        .pulse-dot-active {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--color-warning);
          display: inline-block;
          margin-top: 6px;
          animation: status-pulse-yellow 1.8s infinite;
        }
        @keyframes status-pulse-yellow {
          0% { box-shadow: 0 0 0 0px rgba(217, 119, 6, 0.4); }
          100% { box-shadow: 0 0 0 6px rgba(217, 119, 6, 0); }
        }

        /* Cancelled Sub info */
        .cancelled-sub-badge {
          display: flex;
          flex-direction: column;
          gap: 2px;
          margin-top: 6px;
          font-size: 10px;
          color: var(--color-text-3);
          font-weight: 600;
          line-height: 1.3;
        }

        /* Top items card progress bars */
        .top-items-card {
          grid-column: span 1;
        }
        @media (max-width: 1360px) {
          .top-items-card {
            grid-column: span 3;
          }
        }
        @media (max-width: 768px) {
          .top-items-card {
            grid-column: span 2;
          }
        }
        .top-items-header {
          display: flex;
          align-items: center;
          gap: 6px;
          border-bottom: 1px solid var(--color-border);
          padding-bottom: 0.5rem;
          margin-bottom: 0.5rem;
        }
        .top-items-icon {
          color: var(--color-primary);
        }
        .top-items-title {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--color-text-3);
        }
        .top-items-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .top-item-row {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .top-item-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 11px;
          font-weight: 750;
        }
        .top-item-name {
          color: var(--color-text-2);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 75%;
        }
        .top-item-qty {
          color: var(--color-text-1);
        }
        .top-item-progress-bg {
          height: 4px;
          background: rgba(0, 2, 29, 0.04);
          border-radius: 2px;
          width: 100%;
          overflow: hidden;
        }
        .top-item-progress-bar {
          height: 100%;
          background: var(--color-primary);
          border-radius: 2px;
          transition: width 0.4s ease-out;
        }
        .top-items-empty {
          font-size: 11px;
          color: var(--color-text-3);
          text-align: center;
          padding: 1rem 0;
          font-weight: 500;
        }

        /* ─── Log Table Header & Section ─── */
        .log-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1rem;
        }
        .log-section-title {
          font-size: 16px;
          font-weight: 800;
          color: var(--color-text-1);
          letter-spacing: -0.01em;
          margin: 0;
        }

        .table-console-card {
          background: #ffffff;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-xl);
          box-shadow: 0 4px 20px rgba(0, 2, 29, 0.01);
          overflow: hidden;
          margin-bottom: 1.5rem;
        }

        .order-log-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }
        .order-log-table th {
          background: var(--color-surface-2);
          border-bottom: 1px solid var(--color-border);
          color: var(--color-text-2);
          font-weight: 700;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          padding: 12px 16px;
        }
        .order-log-table td {
          padding: 14px 16px;
          border-bottom: 1px solid var(--color-border);
          vertical-align: middle;
          font-size: 13px;
        }
        .order-log-table tbody tr {
          transition: background 0.15s ease;
        }
        .order-log-table tbody tr:hover {
          background: rgba(0, 2, 29, 0.01);
        }
        .order-log-table tbody tr:last-child td {
          border-bottom: none;
        }

        /* Table Cells Items list */
        .order-log-item-row {
          display: flex;
          align-items: flex-start;
          gap: 6px;
          margin-bottom: 4px;
          line-height: 1.4;
        }
        .order-log-item-row:last-child {
          margin-bottom: 0;
        }
        .order-log-item-qty {
          font-weight: 800;
          color: var(--color-primary);
          background: var(--color-primary-dim);
          border: 1px solid var(--color-primary-border);
          border-radius: 4px;
          padding: 0 4px;
          font-size: 10px;
          line-height: 1.4;
          display: inline-block;
        }
        .order-log-item-name {
          color: var(--color-text-1);
          font-weight: 600;
        }
        .order-log-item-variant {
          font-size: 11px;
          color: var(--color-text-3);
          margin-left: 4px;
          font-weight: 500;
        }
        .order-log-item-note {
          font-size: 11px;
          color: var(--color-text-3);
          font-style: italic;
          display: block;
          margin-top: 1px;
        }

        .order-time-date {
          font-weight: 700;
          color: var(--color-text-1);
        }
        .order-time-clock {
          font-size: 11px;
          color: var(--color-text-3);
          margin-top: 1px;
          font-weight: 500;
        }

        /* Badges */
        .service-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 8px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
        }
        .service-badge.table {
          background: var(--color-primary-dim);
          color: var(--color-primary);
          border: 1px solid var(--color-primary-border);
        }
        .service-badge.self {
          background: rgba(22, 163, 74, 0.05);
          color: var(--color-success);
          border: 1px solid rgba(22, 163, 74, 0.1);
        }

        .source-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          font-weight: 700;
          color: var(--color-text-2);
        }
        .source-badge.staff {
          color: #a855f7;
        }
        .source-badge.customer {
          color: var(--color-info);
        }

        .status-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 3px 10px;
          border-radius: 99px;
          font-size: 11px;
          font-weight: 700;
          text-transform: capitalize;
          border: 1px solid transparent;
        }
        .status-pill.new {
          background: rgba(37, 99, 235, 0.06);
          border-color: rgba(37, 99, 235, 0.15);
          color: var(--color-info);
        }
        .status-pill.preparing {
          background: rgba(217, 119, 6, 0.06);
          border-color: rgba(217, 119, 6, 0.15);
          color: var(--color-warning);
        }
        .status-pill.ready {
          background: rgba(22, 163, 74, 0.06);
          border-color: rgba(22, 163, 74, 0.15);
          color: var(--color-success);
        }
        .status-pill.served {
          background: rgba(100, 116, 139, 0.06);
          border-color: rgba(100, 116, 139, 0.15);
          color: var(--color-text-2);
        }
        .status-pill.cancelled {
          background: rgba(220, 38, 38, 0.06);
          border-color: rgba(220, 38, 38, 0.15);
          color: var(--color-danger);
        }
        .status-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: currentColor;
        }

        /* ─── Paginator Console ─── */
        .paginator-console {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 12.5px;
          color: var(--color-text-3);
          font-weight: 500;
          padding: 0 4px;
        }
        .paginator-buttons {
          display: flex;
          gap: 6px;
        }
        .btn-paginator {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          height: 32px;
          padding: 0 10px;
          border-radius: 6px;
          border: 1px solid var(--color-border);
          background: #ffffff;
          font-size: 12px;
          font-weight: 700;
          color: var(--color-text-2);
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .btn-paginator:hover:not(:disabled) {
          border-color: var(--color-primary);
          color: var(--color-primary);
          background: var(--color-primary-dim);
        }
        .btn-paginator:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        /* Empty states */
        .kds-card-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 2rem 1rem;
          color: var(--color-text-3);
          font-size: 12.5px;
          font-weight: 600;
          text-align: center;
          background: transparent;
          gap: 8px;
        }
      `}</style>
    </div>
  )
}
