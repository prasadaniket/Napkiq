'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { api } from '@/lib/api'
import { getToken } from '@/lib/auth'
import { useAuth } from '@/context/AuthContext'
import type { Order, OrderStatus, OrderEvent, Outlet, MenuCategory, MenuItem } from '@/types/api'
import toast from 'react-hot-toast'
import GSAPDropdown from '@/components/ui/GSAPDropdown'
import {
  Clock,
  Play,
  CheckCircle2,
  Inbox,
  Flame,
  User,
  Users,
  ChevronDown,
  Store,
  Plus,
  Minus,
  X,
  MessageSquare,
  Coffee,
  ShoppingBag,
  Bell,
  Check,
  AlertCircle,
  Activity
} from 'lucide-react'

// Mirror the axios base URL — EventSource can't use the axios instance/interceptors.
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.napkiq.in/api'

// ─── Column config ────────────────────────────────────────────────────────────

const COLUMNS: { status: OrderStatus; label: string; accent: string; icon: any; classKey: 'new' | 'preparing' | 'ready' }[] = [
  { status: 'new',       label: 'New',       accent: 'var(--color-info)',    icon: Inbox,        classKey: 'new' },
  { status: 'preparing', label: 'Preparing', accent: 'var(--color-warning)', icon: Flame,        classKey: 'preparing' },
  { status: 'ready',     label: 'Ready',     accent: 'var(--color-success)', icon: CheckCircle2, classKey: 'ready' },
]

// The forward action for each active status.
const NEXT_STATUS: Record<string, { to: OrderStatus; label: string; icon: any }> = {
  new:       { to: 'preparing', label: 'Start', icon: Play },
  preparing: { to: 'ready',     label: 'Mark Ready', icon: CheckCircle2 },
  ready:     { to: 'served',    label: 'Served', icon: Check },
}

function minutesSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000))
}

// ─── Diet Badge (FSSAI standard) ─────────────────────────────────────────────

function DietBadge({ isVeg }: { isVeg: boolean }) {
  return (
    <span 
      className={`diet-dot-badge ${isVeg ? 'veg' : 'non-veg'}`}
      title={isVeg ? 'Vegetarian' : 'Non-Vegetarian'}
    >
      <span className={isVeg ? 'diet-inner-veg' : 'diet-inner-nonveg'} />
    </span>
  )
}

// ─── Order Card ───────────────────────────────────────────────────────────────

function OrderCard({ order, accent, onAdvance, onCancel, busy }: {
  order: Order
  accent: string
  onAdvance: () => void
  onCancel: () => void
  busy: boolean
}) {
  const mins = minutesSince(order.createdAt)
  const next = NEXT_STATUS[order.status]
  const NextIcon = next?.icon

  let ageClass: 'normal' | 'warning' | 'critical' = 'normal'
  if (mins >= 15) ageClass = 'critical'
  else if (mins >= 10) ageClass = 'warning'

  return (
    <div className="order-card" style={{ borderLeft: `4px solid ${accent}` }}>
      <div className="order-card-header">
        <span className="order-card-board">
          <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--color-primary)', marginRight: 8 }}>
            #{order.dailyNumber ?? '—'}
          </span>
          {order.serviceType === 'table' ? (
            <>
              <Coffee size={14} style={{ color: 'var(--color-primary)' }} />
              <span>Table {order.boardNumber || '—'}</span>
            </>
          ) : (
            <>
              <ShoppingBag size={14} style={{ color: 'var(--color-success)' }} />
              <span>Self-service</span>
            </>
          )}
        </span>
        <span className={`order-card-age ${ageClass}`}>
          <Clock size={12} />
          {mins}m
        </span>
      </div>

      <ul className="order-card-items-list">
        {order.items.map(it => (
          <li key={it.id} className="order-card-item-row">
            <span className="order-card-item-qty">{it.quantity}×</span>
            <div className="order-card-item-name">
              {it.nameSnapshot}
              {it.note && <span className="order-card-item-note">{it.note}</span>}
            </div>
          </li>
        ))}
      </ul>

      {order.note && (
        <div className="order-card-notes-bubble">
          <MessageSquare size={13} style={{ marginTop: 2, flexShrink: 0 }} />
          <span>{order.note}</span>
        </div>
      )}

      <div className="order-card-footer">
        <span className={`order-card-source-pill ${order.source}`}>
          {order.source === 'staff' ? (
            <>
              <Users size={10} />
              Staff
            </>
          ) : (
            <>
              <User size={10} />
              Customer
            </>
          )}
        </span>
        
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn-card-cancel" disabled={busy} onClick={onCancel}>
            Cancel
          </button>
          {next && (
            <button className="btn-card-advance" disabled={busy} onClick={onAdvance}>
              {NextIcon && <NextIcon size={12} />}
              {next.label}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── New Order Modal (staff manual entry) ───────────────────────────────────────

function NewOrderModal({ outletId, onClose, onCreated }: {
  outletId: string
  onClose: () => void
  onCreated: (order: Order) => void
}) {
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [loading, setLoading]       = useState(true)
  const [qty, setQty]               = useState<Record<string, number>>({})
  const [serviceType, setServiceType] = useState<'table' | 'self'>('table')
  const [boardNumber, setBoardNumber] = useState('')
  const [note, setNote]             = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    api.get<MenuCategory[]>(`/cms/menu?outletId=${outletId}`)
      .then(r => setCategories(r.data))
      .catch(() => toast.error('Failed to load menu'))
      .finally(() => setLoading(false))
  }, [outletId])

  const step = (item: MenuItem, delta: number) => {
    setQty(prev => {
      const nextQ = (prev[item.id] || 0) + delta
      if (nextQ <= 0) { const { [item.id]: _, ...rest } = prev; return rest }
      return { ...prev, [item.id]: nextQ }
    })
  }

  const selectedCount = Object.values(qty).reduce((a, b) => a + b, 0)

  const submit = async () => {
    if (selectedCount === 0) { toast.error('Add at least one item'); return }
    if (serviceType === 'table' && !boardNumber.trim()) { toast.error('Enter a board number'); return }
    setSubmitting(true)
    try {
      const res = await api.post<Order>('/cms/orders', {
        outletId,
        serviceType,
        boardNumber: serviceType === 'table' ? boardNumber.trim() : undefined,
        note: note.trim() || undefined,
        items: Object.entries(qty).map(([menuItemId, quantity]) => ({ menuItemId, quantity })),
      })
      onCreated(res.data)
      toast.success('Order sent to kitchen')
      onClose()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Could not create order')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-glass-backdrop" onClick={onClose}>
      <div className="modal-glass-card animate-appear" onClick={e => e.stopPropagation()}>
        <div className="modal-glass-header">
          <div>
            <h3 className="modal-glass-title">New Order</h3>
            <p className="modal-glass-subtitle">Add items and send them to the kitchen board</p>
          </div>
          <button className="btn-modal-close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="modal-glass-body">
          {loading ? (
            <div className="kds-card-empty-state" style={{ minHeight: 200 }}>
              <Activity className="animate-spin" size={24} />
              <span>Loading menu…</span>
            </div>
          ) : categories.length === 0 ? (
            <div className="kds-card-empty-state" style={{ minHeight: 200 }}>
              <AlertCircle size={24} />
              <span>No menu items for this outlet.</span>
            </div>
          ) : (
            categories.map(cat => (
              <div key={cat.id} className="modal-cat-section">
                <div className="modal-cat-name">{cat.name}</div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {cat.items.map(item => (
                    <div key={item.id} className="modal-menu-item-row">
                      <div className="modal-menu-item-info">
                        <DietBadge isVeg={item.isVeg} />
                        <span>{item.name}</span>
                      </div>
                      <div className="modal-stepper">
                        <button 
                          className="modal-stepper-btn" 
                          onClick={() => step(item, -1)} 
                          disabled={!qty[item.id]}
                          aria-label="Decrease"
                        >
                          <Minus size={11} strokeWidth={2.5} />
                        </button>
                        <span className="modal-stepper-val">{qty[item.id] || 0}</span>
                        <button 
                          className="modal-stepper-btn" 
                          onClick={() => step(item, 1)}
                          aria-label="Increase"
                        >
                          <Plus size={11} strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="modal-glass-controls">
          <div className="service-segmented">
            <button 
              type="button"
              className={`service-segmented-btn ${serviceType === 'table' ? 'active' : ''}`}
              onClick={() => setServiceType('table')}
            >
              <Coffee size={12} />
              Table
            </button>
            <button 
              type="button"
              className={`service-segmented-btn ${serviceType === 'self' ? 'active' : ''}`}
              onClick={() => setServiceType('self')}
            >
              <ShoppingBag size={12} />
              Self
            </button>
          </div>
          
          {serviceType === 'table' && (
            <input 
              className="modal-input-field" 
              placeholder="Board #" 
              value={boardNumber}
              onChange={e => setBoardNumber(e.target.value)} 
              style={{ width: 80 }} 
            />
          )}
          
          <input 
            className="modal-input-field" 
            placeholder="Note (optional)" 
            value={note}
            onChange={e => setNote(e.target.value)} 
            style={{ flex: 1, minWidth: 120 }} 
          />
        </div>

        <div className="modal-glass-footer">
          <button 
            className="btn-card-cancel" 
            style={{ height: 38, padding: '0 16px', fontSize: 13 }} 
            onClick={onClose}
          >
            Cancel
          </button>
          <button 
            className="btn-new-order" 
            disabled={submitting || selectedCount === 0} 
            onClick={submit}
          >
            {submitting ? 'Sending…' : `Send Order ${selectedCount ? `(${selectedCount})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── KDS Page ───────────────────────────────────────────────────────────────────

export default function KdsPage() {
  const { isFranchise } = useAuth()
  const [outlets, setOutlets]   = useState<Outlet[]>([])
  const [outletId, setOutletId] = useState('')
  const [orders, setOrders]     = useState<Order[]>([])
  const [loading, setLoading]   = useState(false)
  const [live, setLive]         = useState(false)
  const [busyId, setBusyId]     = useState<string | null>(null)
  const [showNew, setShowNew]   = useState(false)
  const [, forceTick]           = useState(0)

  // Re-render every 20s so the per-card "age" stays current.
  useEffect(() => {
    const t = setInterval(() => forceTick(n => n + 1), 20_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    api.get<Outlet[]>('/cms/outlets').then(r => {
      setOutlets(r.data)
      if (r.data.length > 0) setOutletId(r.data[0].id)
    }).catch(() => {})
  }, [])

  // Merge a pushed/created order into the board; drop it once it leaves active states.
  const mergeOrder = useCallback((order: Order) => {
    setOrders(prev => {
      const isActive = ['new', 'preparing', 'ready'].includes(order.status)
      const without = prev.filter(o => o.id !== order.id)
      return isActive ? [...without, order].sort((a, b) => a.createdAt.localeCompare(b.createdAt)) : without
    })
  }, [])

  // Initial fetch + live SSE stream, re-established whenever the outlet changes.
  useEffect(() => {
    if (!outletId) return
    let cancelled = false
    let es: EventSource | null = null
    let reconnect: ReturnType<typeof setTimeout> | null = null

    const connect = async () => {
      setLoading(true)
      try {
        const res = await api.get<Order[]>(`/cms/orders?outletId=${outletId}`)
        if (cancelled) return
        setOrders(res.data)
      } catch {
        if (!cancelled) toast.error('Failed to load orders')
      } finally {
        if (!cancelled) setLoading(false)
      }
      if (cancelled) return

      // Fresh token each (re)connect — EventSource can't send an auth header.
      es = new EventSource(`${BASE_URL}/cms/orders/stream?outletId=${outletId}&token=${getToken() ?? ''}`)
      es.onopen = () => { if (!cancelled) setLive(true) }
      es.onmessage = (e) => {
        try {
          const event: OrderEvent = JSON.parse(e.data)
          if (event?.order) mergeOrder(event.order)
        } catch { /* ignore keep-alive comments / malformed frames */ }
      }
      es.onerror = () => {
        if (cancelled) return
        setLive(false)
        es?.close()
        // Manual reconnect so we mint a fresh token and re-sync the board.
        reconnect = setTimeout(connect, 3000)
      }
    }

    connect()
    return () => {
      cancelled = true
      es?.close()
      if (reconnect) clearTimeout(reconnect)
      setLive(false)
    }
  }, [outletId, mergeOrder])

  const updateStatus = async (order: Order, status: OrderStatus) => {
    setBusyId(order.id)
    // Optimistic — the SSE echo will reconcile.
    mergeOrder({ ...order, status })
    try {
      await api.patch(`/cms/orders/${order.id}/status`, { status })
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update order')
      mergeOrder(order) // revert
    } finally {
      setBusyId(null)
    }
  }

  const selectedOutlet = outlets.find(o => o.id === outletId)
  const byStatus = (s: OrderStatus) => orders.filter(o => o.status === s)

  return (
    <div className="kds-page-container">
      <div className="kds-header">
        <div className="kds-title-wrap">
          <h1 className="kds-title">
            Kitchen Display
            <span className={`kds-status-badge ${live ? 'live' : 'reconnecting'}`}>
              <span className="pulse-dot-live" />
              {live ? 'Live' : 'Reconnecting…'}
            </span>
          </h1>
          <p className="page-subtitle" style={{ margin: 0 }}>
            {selectedOutlet ? `${orders.length} active orders · ${selectedOutlet.name}` : 'Select an outlet'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {!isFranchise && (
            <GSAPDropdown
              value={outletId}
              onChange={setOutletId}
              options={outlets.map(o => ({ value: o.id, label: o.name }))}
              icon={<Store size={14} />}
              width="190px"
            />
          )}
          <button 
            className="btn-new-order" 
            disabled={!outletId} 
            onClick={() => setShowNew(true)}
          >
            <Plus size={14} strokeWidth={2.5} />
            New Order
          </button>
        </div>
      </div>

      <div className="page-content" style={{ padding: 0 }}>
        {loading && orders.length === 0 ? (
          <div className="kds-card-empty-state" style={{ minHeight: 320 }}>
            <Activity className="animate-spin" size={24} />
            <span>Loading kitchen board…</span>
          </div>
        ) : (
          <div className="kds-columns-board">
            {COLUMNS.map(col => {
              const items = byStatus(col.status)
              const Icon = col.icon
              return (
                <div key={col.status} className="kds-board-column">
                  <div className={`kds-col-header-pill ${col.classKey}`}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Icon size={14} />
                      {col.label}
                    </span>
                    <span className="kds-col-count-bubble">{items.length}</span>
                  </div>

                  <div className="kds-col-cards-list" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    {items.length === 0 ? (
                      <div className={`kds-card-empty-state-full ${col.classKey}`}>
                        <div className="empty-state-icon-wrapper">
                          <Icon size={34} strokeWidth={1.3} />
                        </div>
                        <div className="empty-state-text-wrap">
                          <div className="empty-state-title">
                            {col.status === 'new' ? 'Inbox Clear' :
                             col.status === 'preparing' ? 'Kitchen Quiet' : 'All Clear'}
                          </div>
                          <div className="empty-state-desc">
                            {col.status === 'new' ? 'Waiting for incoming customer orders' :
                             col.status === 'preparing' ? 'No orders currently in preparation' : 'No ready orders waiting to be served'}
                          </div>
                        </div>
                      </div>
                    ) : (
                      items.map(order => (
                        <OrderCard
                          key={order.id}
                          order={order}
                          accent={col.accent}
                          busy={busyId === order.id}
                          onAdvance={() => {
                            const n = NEXT_STATUS[order.status]
                            if (n) updateStatus(order, n.to)
                          }}
                          onCancel={() => updateStatus(order, 'cancelled')}
                        />
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showNew && outletId && (
        <NewOrderModal
          outletId={outletId}
          onClose={() => setShowNew(false)}
          onCreated={mergeOrder}
        />
      )}

      <style>{`
        /* ─── KDS Container & Layout ─── */
        .kds-page-container {
          background: #fafaf9;
          min-height: calc(100vh - 40px);
          border-radius: var(--radius-xl);
          padding: 1.5rem;
          margin: 1.5rem;
          box-shadow: 0 4px 30px rgba(0, 2, 29, 0.015);
          border: 1px solid var(--color-border);
        }

        /* ─── Header Elements ─── */
        .kds-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.25rem 1.5rem;
          background: #ffffff;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-xl);
          box-shadow: 0 4px 20px rgba(0, 2, 29, 0.012);
          margin-bottom: 1.5rem;
        }
        .kds-title-wrap {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .kds-title {
          font-size: 1.4rem;
          font-weight: 800;
          color: var(--color-text-1);
          letter-spacing: -0.02em;
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 0;
        }
        .kds-status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          border-radius: 99px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          transition: all 0.3s ease;
        }
        .kds-status-badge.live {
          background: rgba(22, 163, 74, 0.06);
          border: 1px solid rgba(22, 163, 74, 0.15);
          color: var(--color-success);
        }
        .kds-status-badge.reconnecting {
          background: rgba(220, 38, 38, 0.06);
          border: 1px solid rgba(220, 38, 38, 0.15);
          color: var(--color-danger);
        }
        .pulse-dot-live {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
        }
        .kds-status-badge.live .pulse-dot-live {
          animation: kds-pulse-green 1.8s infinite;
        }
        .kds-status-badge.reconnecting .pulse-dot-live {
          animation: kds-pulse-red 1.8s infinite;
        }
        @keyframes kds-pulse-green {
          0% { box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.5); }
          70% { box-shadow: 0 0 0 6px rgba(22, 163, 74, 0); }
          100% { box-shadow: 0 0 0 0 rgba(22, 163, 74, 0); }
        }
        @keyframes kds-pulse-red {
          0% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.5); }
          70% { box-shadow: 0 0 0 6px rgba(220, 38, 38, 0); }
          100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0); }
        }

        /* Custom Outlet Select Dropdown */
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
        .kds-select {
          background: #ffffff;
          border: 1px solid var(--color-border-strong);
          color: var(--color-text-1);
          font-weight: 600;
          font-size: 13px;
          padding: 8px 36px 8px 36px !important;
          border-radius: var(--radius-md);
          height: 40px;
          width: 190px;
          cursor: pointer;
          appearance: none;
          -webkit-appearance: none;
          transition: all 0.2s ease;
        }
        .kds-select:hover {
          border-color: var(--color-primary);
          background-color: var(--color-primary-dim);
          color: var(--color-primary);
        }
        .kds-select:focus {
          outline: none;
          box-shadow: 0 0 0 3px var(--color-primary-border);
        }
        .kds-select-arrow {
          position: absolute;
          right: 12px;
          color: var(--color-text-3);
          pointer-events: none;
        }
        .btn-new-order {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: var(--color-primary);
          color: #ffffff;
          font-weight: 700;
          font-size: 13px;
          border: none;
          padding: 0 16px;
          height: 40px;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 12px rgba(214, 66, 56, 0.15);
        }
        .btn-new-order:hover:not(:disabled) {
          background: var(--color-primary-hover);
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(214, 66, 56, 0.25);
        }
        .btn-new-order:active:not(:disabled) {
          transform: translateY(0);
        }

        /* ─── Columns Board ─── */
        .kds-columns-board {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.25rem;
          align-items: start;
        }
        @media (max-width: 992px) {
          .kds-columns-board {
            grid-template-columns: 1fr;
          }
        }
        
        .kds-board-column {
          background: #ffffff;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-xl);
          padding: 1.15rem;
          min-height: 540px;
          display: flex;
          flex-direction: column;
          gap: 1rem;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        /* Subtle status backgrounds & glows */
        .kds-board-column:has(.kds-col-header-pill.new) {
          background: rgba(37, 99, 235, 0.003);
          box-shadow: 0 4px 20px rgba(37, 99, 235, 0.01), inset 0 0 16px rgba(37, 99, 235, 0.003);
        }
        .kds-board-column:has(.kds-col-header-pill.preparing) {
          background: rgba(217, 119, 6, 0.003);
          box-shadow: 0 4px 20px rgba(217, 119, 6, 0.01), inset 0 0 16px rgba(217, 119, 6, 0.003);
        }
        .kds-board-column:has(.kds-col-header-pill.ready) {
          background: rgba(22, 163, 74, 0.003);
          box-shadow: 0 4px 20px rgba(22, 163, 74, 0.01), inset 0 0 16px rgba(22, 163, 74, 0.003);
        }

        /* Focus hover effect */
        .kds-board-column:hover {
          border-color: var(--color-border-strong);
        }
        .kds-board-column:has(.kds-col-header-pill.new):hover {
          box-shadow: 0 8px 30px rgba(37, 99, 235, 0.03), inset 0 0 20px rgba(37, 99, 235, 0.01);
          border-color: rgba(37, 99, 235, 0.2);
        }
        .kds-board-column:has(.kds-col-header-pill.preparing):hover {
          box-shadow: 0 8px 30px rgba(217, 119, 6, 0.03), inset 0 0 20px rgba(217, 119, 6, 0.01);
          border-color: rgba(217, 119, 6, 0.2);
        }
        .kds-board-column:has(.kds-col-header-pill.ready):hover {
          box-shadow: 0 8px 30px rgba(22, 163, 74, 0.03), inset 0 0 20px rgba(22, 163, 74, 0.01);
          border-color: rgba(22, 163, 74, 0.2);
        }

        .kds-col-header-pill {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 14px;
          border-radius: var(--radius-md);
          font-weight: 850;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .kds-col-header-pill.new {
          background: rgba(37, 99, 235, 0.06);
          border: 1px solid rgba(37, 99, 235, 0.15);
          color: var(--color-info);
        }
        .kds-col-header-pill.preparing {
          background: rgba(217, 119, 6, 0.06);
          border: 1px solid rgba(217, 119, 6, 0.15);
          color: var(--color-warning);
        }
        .kds-col-header-pill.ready {
          background: rgba(22, 163, 74, 0.06);
          border: 1px solid rgba(22, 163, 74, 0.15);
          color: var(--color-success);
        }

        .kds-col-count-bubble {
          font-size: 11px;
          font-weight: 700;
          background: #ffffff;
          padding: 1px 8px;
          border-radius: 99px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }

        .kds-col-cards-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          overflow-y: auto;
          max-height: calc(100vh - 280px);
          padding-right: 2px;
        }

        /* Redesigned full-height empty state cards */
        .kds-card-empty-state-full {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          flex: 1;
          min-height: 380px;
          text-align: center;
          padding: 2rem 1rem;
          color: var(--color-text-3);
          gap: 1.25rem;
          animation: kds-fade-in 0.3s ease-out;
        }

        .empty-state-icon-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 76px;
          height: 76px;
          border-radius: 50%;
          background: #ffffff;
          box-shadow: 0 4px 16px rgba(0, 2, 29, 0.02);
          border: 1px solid var(--color-border);
          color: var(--color-text-3);
          transition: all 0.3s ease;
        }

        .kds-card-empty-state-full.new .empty-state-icon-wrapper {
          color: var(--color-info);
          background: rgba(37, 99, 235, 0.02);
          border-color: rgba(37, 99, 235, 0.1);
        }
        .kds-card-empty-state-full.preparing .empty-state-icon-wrapper {
          color: var(--color-warning);
          background: rgba(217, 119, 6, 0.02);
          border-color: rgba(217, 119, 6, 0.1);
        }
        .kds-card-empty-state-full.ready .empty-state-icon-wrapper {
          color: var(--color-success);
          background: rgba(22, 163, 74, 0.02);
          border-color: rgba(22, 163, 74, 0.1);
        }

        .kds-card-empty-state-full:hover .empty-state-icon-wrapper {
          transform: scale(1.08);
          box-shadow: 0 8px 24px rgba(0, 2, 29, 0.04);
        }

        .empty-state-text-wrap {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .empty-state-title {
          font-size: 14px;
          font-weight: 800;
          color: var(--color-text-1);
          letter-spacing: -0.01em;
        }

        .empty-state-desc {
          font-size: 11.5px;
          color: var(--color-text-3);
          max-width: 180px;
          line-height: 1.45;
          margin: 0 auto;
        }

        @keyframes kds-fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* ─── Order Card ─── */
        .order-card {
          background: #ffffff;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: 1rem;
          box-shadow: 0 4px 12px rgba(0, 2, 29, 0.015);
          position: relative;
          transition: all 0.2s ease;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .order-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 2, 29, 0.04);
          border-color: var(--color-border-strong);
        }

        .order-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid var(--color-border);
          padding-bottom: 0.5rem;
        }
        .order-card-board {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 800;
          color: var(--color-text-1);
        }
        .order-card-age {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 6px;
        }
        .order-card-age.normal {
          background: rgba(0, 2, 29, 0.04);
          color: var(--color-text-2);
        }
        .order-card-age.warning {
          background: rgba(217, 119, 6, 0.08);
          color: var(--color-warning);
        }
        .order-card-age.critical {
          background: rgba(220, 38, 38, 0.08);
          color: var(--color-danger);
          animation: text-pulse-danger 1.5s infinite;
        }
        @keyframes text-pulse-danger {
          0% { opacity: 0.9; }
          50% { opacity: 0.6; }
          100% { opacity: 0.9; }
        }

        .order-card-items-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .order-card-item-row {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          font-size: 12.5px;
          color: var(--color-text-1);
          line-height: 1.4;
        }
        .order-card-item-qty {
          font-weight: 800;
          color: var(--color-primary);
          background: var(--color-primary-dim);
          border: 1px solid var(--color-primary-border);
          border-radius: 4px;
          padding: 1px 5px;
          font-size: 10px;
          line-height: 1;
          display: inline-block;
          margin-top: 1px;
        }
        .order-card-item-name {
          flex: 1;
          font-weight: 500;
        }
        .order-card-item-note {
          font-size: 11px;
          color: var(--color-text-3);
          font-style: italic;
          display: block;
          margin-top: 1px;
        }
        .order-card-notes-bubble {
          background: #fafaf9;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          padding: 8px 10px;
          font-size: 11.5px;
          color: var(--color-text-2);
          display: flex;
          align-items: flex-start;
          gap: 6px;
        }

        .order-card-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-top: 1px solid var(--color-border);
          padding-top: 0.75rem;
          margin-top: auto;
        }

        .order-card-source-pill {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.02em;
          padding: 2px 6px;
          border-radius: 4px;
        }
        .order-card-source-pill.customer {
          background: rgba(37, 99, 235, 0.05);
          color: var(--color-info);
          border: 1px solid rgba(37, 99, 235, 0.1);
        }
        .order-card-source-pill.staff {
          background: rgba(168, 85, 247, 0.05);
          color: #a855f7;
          border: 1px solid rgba(168, 85, 247, 0.1);
        }

        .btn-card-cancel {
          font-size: 11px;
          font-weight: 700;
          color: var(--color-text-3);
          background: transparent;
          border: 1px solid transparent;
          padding: 4px 10px;
          height: 28px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .btn-card-cancel:hover:not(:disabled) {
          color: var(--color-danger);
          background: rgba(220, 38, 38, 0.06);
          border-color: rgba(220, 38, 38, 0.15);
        }
        
        .btn-card-advance {
          font-size: 11px;
          font-weight: 700;
          color: #ffffff;
          background: var(--color-primary);
          border: none;
          padding: 4px 12px;
          height: 28px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .btn-card-advance:hover:not(:disabled) {
          background: var(--color-primary-hover);
          transform: translateY(-1px);
        }
        .btn-card-advance:active:not(:disabled) {
          transform: translateY(0);
        }
        .btn-card-advance:disabled, .btn-card-cancel:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none !important;
        }

        /* ─── New Order Modal ─── */
        .modal-glass-backdrop {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0, 2, 29, 0.4);
          backdrop-filter: blur(8px);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
        }
        .modal-glass-card {
          background: #ffffff;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-xl);
          box-shadow: 0 10px 40px rgba(0, 2, 29, 0.08);
          width: 100%;
          max-width: 580px;
          display: flex;
          flex-direction: column;
          max-height: 85vh;
          overflow: hidden;
        }
        .modal-glass-header {
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid var(--color-border);
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        .modal-glass-title {
          font-size: 18px;
          font-weight: 800;
          color: var(--color-text-1);
          letter-spacing: -0.01em;
          margin: 0;
        }
        .modal-glass-subtitle {
          font-size: 12px;
          color: var(--color-text-3);
          margin-top: 2px;
        }
        .btn-modal-close {
          background: rgba(0, 2, 29, 0.04);
          border: none;
          color: var(--color-text-2);
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .btn-modal-close:hover {
          background: rgba(220, 38, 38, 0.08);
          color: var(--color-danger);
        }

        .modal-glass-body {
          flex: 1;
          overflow-y: auto;
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        /* Categories Scroll Container */
        .modal-cat-section {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: 1rem;
          background: rgba(0, 2, 29, 0.01);
        }
        .modal-cat-name {
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--color-text-3);
          border-bottom: 1px solid var(--color-border);
          padding-bottom: 0.5rem;
        }

        .modal-menu-item-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid rgba(0, 2, 29, 0.03);
        }
        .modal-menu-item-row:last-child {
          border-bottom: none;
        }
        .modal-menu-item-info {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13.5px;
          font-weight: 600;
          color: var(--color-text-1);
        }

        /* Diet indicator badges */
        .diet-dot-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 14px;
          height: 14px;
          border-radius: 3px;
          border-width: 1px;
          border-style: solid;
          flex-shrink: 0;
        }
        .diet-dot-badge.veg {
          border-color: #16a34a;
        }
        .diet-dot-badge.non-veg {
          border-color: #dc2626;
        }
        .diet-inner-veg {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #16a34a;
        }
        .diet-inner-nonveg {
          width: 0;
          height: 0;
          border-left: 3.5px solid transparent;
          border-right: 3.5px solid transparent;
          border-bottom: 6px solid #dc2626;
        }

        /* Stepper controls */
        .modal-stepper {
          display: flex;
          align-items: center;
          gap: 12px;
          background: rgba(0, 2, 29, 0.03);
          padding: 3px 6px;
          border-radius: 99px;
        }
        .modal-stepper-btn {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: none;
          background: #ffffff;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
          color: var(--color-text-1);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }
        .modal-stepper-btn:hover:not(:disabled) {
          background: var(--color-primary);
          color: #ffffff;
        }
        .modal-stepper-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
        .modal-stepper-val {
          font-size: 12px;
          font-weight: 800;
          color: var(--color-text-1);
          min-width: 14px;
          text-align: center;
        }

        /* Modal bottom input controls */
        .modal-glass-controls {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 1rem 1.5rem;
          background: #fafaf9;
          border-top: 1px solid var(--color-border);
          flex-wrap: wrap;
        }

        /* Segmented Service Selector */
        .service-segmented {
          display: flex;
          background: rgba(0, 2, 29, 0.04);
          padding: 3px;
          border-radius: 8px;
          border: 1px solid var(--color-border);
        }
        .service-segmented-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border: none;
          background: transparent;
          color: var(--color-text-2);
          font-size: 12px;
          font-weight: 700;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .service-segmented-btn.active {
          background: #ffffff;
          color: var(--color-text-1);
          box-shadow: 0 2px 6px rgba(0, 2, 29, 0.06);
        }

        .modal-input-field {
          background: #ffffff;
          border: 1px solid var(--color-border-strong);
          border-radius: 8px;
          padding: 8px 12px;
          font-size: 13px;
          font-weight: 500;
          color: var(--color-text-1);
          transition: all 0.2s ease;
        }
        .modal-input-field:focus {
          outline: none;
          border-color: var(--color-primary);
          box-shadow: 0 0 0 3px var(--color-primary-border);
        }

        .modal-glass-footer {
          padding: 1.25rem 1.5rem;
          border-top: 1px solid var(--color-border);
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }
      `}</style>
    </div>
  )
}
