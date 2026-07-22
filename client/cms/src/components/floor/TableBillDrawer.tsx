'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { api } from '@/lib/api'
import type { FloorTable, SessionTab, MenuCategory, MenuItem, OrderItemStatus } from '@/types/api'
import toast from 'react-hot-toast'
import { X, Plus, Minus, Search, Armchair, IndianRupee, Ban, ArrowLeft, Lock, Unlock, ShoppingBag, Trash2, Flame, BellRing, CheckCircle2 } from 'lucide-react'

// Per-line kitchen status uses the ITEM-level itemStatus, not the order-level aggregate.
// This means each dish correctly shows its own state even within a multi-item round.
function LineStatus({ status }: { status: OrderItemStatus }) {
  if (status === 'served')  return <span className="bd-line-status served"><CheckCircle2 size={12} strokeWidth={2.5} />Served</span>
  if (status === 'ready')   return <span className="bd-line-status ready"><BellRing size={12} strokeWidth={2.5} />Ready</span>
  // 'pending' — still being prepared in the kitchen
  return <span className="bd-line-status preparing"><Flame size={12} strokeWidth={2.5} />Preparing</span>
}
import SettleModal from './SettleModal'

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })
}

export default function TableBillDrawer({ outletId, table, onClose, onChanged }: {
  outletId: string
  table: FloorTable
  onClose: () => void
  onChanged: () => void
}) {
  const [tab, setTab] = useState<SessionTab | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<'bill' | 'add'>('bill')
  const [settling, setSettling] = useState(false)

  const hasSession = !!table.session

  const fetchTab = useCallback(async () => {
    if (!table.session) { setTab(null); return }
    setLoading(true)
    try {
      const res = await api.get<SessionTab | null>(`/cms/sessions?outletId=${outletId}&tableId=${table.id}`)
      setTab(res.data)
    } catch {
      toast.error('Failed to load tab')
    } finally {
      setLoading(false)
    }
  }, [outletId, table.id, table.session])

  useEffect(() => { fetchTab() }, [fetchTab])

  // Open a new tab (walk-in, or seat the pending reservation on this table)
  const openTab = async () => {
    setBusy(true)
    try {
      const res = await api.post<SessionTab>('/cms/sessions', {
        outletId,
        tableId: table.id,
        reservationId: table.current?.id,
        partySize: table.current?.partySize,
      })
      setTab(res.data)
      onChanged()
      toast.success(`Table ${table.name} opened`)
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Could not open table')
    } finally {
      setBusy(false)
    }
  }

  const voidTab = async () => {
    if (!tab) return
    if (!confirm(`Void the tab on ${table.name}? This cancels its orders.`)) return
    setBusy(true)
    try {
      await api.post(`/cms/sessions/${tab.id}/cancel`)
      onChanged()
      toast.success('Tab voided')
      onClose()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Could not void tab')
    } finally {
      setBusy(false)
    }
  }

  // Cancel reservation booking from the floor
  const cancelBooking = async () => {
    if (!table.current) return
    if (!confirm(`Cancel ${table.current.guestName}'s booking on ${table.name}?`)) return
    setBusy(true)
    try {
      await api.patch(`/cms/reservations/${table.current.id}/status`, { status: 'cancelled' })
      onChanged()
      toast.success('Booking cancelled')
      onClose()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Could not cancel booking')
    } finally {
      setBusy(false)
    }
  }

  const toggleBlock = async () => {
    setBusy(true)
    try {
      const reason = !table.isBlocked ? (prompt('Block reason (optional): e.g. Cleaning, Maintenance') || undefined) : undefined
      await api.patch(`/cms/tables/${table.id}`, { isBlocked: !table.isBlocked, blockReason: reason ?? null })
      onChanged()
      toast.success(table.isBlocked ? 'Table unblocked' : 'Table blocked')
      onClose()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Could not update table')
    } finally {
      setBusy(false)
    }
  }

  // Remove a single line from the ticket (guest changed their mind). The backend only
  // allows this while the dish is still new/preparing — a plated dish can't just vanish.
  const removeItem = async (orderId: string, itemId: string, name: string) => {
    if (!confirm(`Remove "${name}" from the ticket?`)) return
    setBusy(true)
    try {
      const res = await api.delete<{ orderCancelled: boolean }>(`/cms/orders/${orderId}/items/${itemId}`)
      await fetchTab()
      onChanged()
      toast.success(res.data?.orderCancelled ? 'Item removed · round cancelled' : 'Item removed')
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Could not remove item')
    } finally {
      setBusy(false)
    }
  }

  const total = tab?.total ?? 0

  return (
    <div className="bd-backdrop" onClick={onClose}>
      <div className="bd-sheet" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bd-head">
          <div className="bd-head-main">
            {mode === 'add' && (
              <button className="bd-back" onClick={() => setMode('bill')} aria-label="Back"><ArrowLeft size={16} /></button>
            )}
            <div className="bd-meta">
              <div className="bd-title">
                Table {table.name}
              </div>
              <div className="bd-subtitle">
                <span className="bd-badge-pax">{table.capacity} Seats</span>
                {table.current && <span className="bd-badge-guest">· {table.current.guestName} ({table.current.partySize}p)</span>}
                {tab && <span className="bd-time">· opened {fmtTime(tab.openedAt)}</span>}
              </div>
            </div>
          </div>
          <button className="bd-close" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>

        {mode === 'add' && tab ? (
          <AddItemsPanel
            outletId={outletId}
            tableId={table.id}
            tableName={table.name}
            sessionId={tab.id}
            onAdded={async () => { await fetchTab(); onChanged(); setMode('bill') }}
          />
        ) : (
          <>
            {/* Body: running tab or empty-table CTA */}
            <div className="bd-body">
              {!hasSession ? (
                <div className="bd-empty-container">
                  {/* Luxury architectural table representation */}
                  <div className="bd-table-vector">
                    <div className="bd-v-table" />
                    <div className="bd-v-chair top" />
                    <div className="bd-v-chair bottom" />
                    <div className="bd-v-chair left" />
                    <div className="bd-v-chair right" />
                  </div>
                  <div className="bd-empty-title">Table is Free</div>
                  <div className="bd-empty-desc">
                    {table.current
                      ? `${table.current.guestName} holds a reservation at ${fmtTime(table.current.reservedAt)}. Open this tab to seat them.`
                      : 'Create a live dining session to start building a table ticket.'}
                  </div>
                </div>
              ) : loading && !tab ? (
                <div className="bd-spinner-state">
                  <div className="bd-spinner" />
                  <span>Loading ticket...</span>
                </div>
              ) : tab ? (
                <>
                  {tab.orders.filter(o => o.status !== 'cancelled').length === 0 ? (
                    <div className="bd-empty-container">
                      <ShoppingBag size={28} strokeWidth={1.3} style={{ color: 'var(--color-text-3)', marginBottom: 8 }} />
                      <div className="bd-empty-title">Empty Ticket</div>
                      <div className="bd-empty-desc">No orders placed in this session. Tap 'Add Items' below to start ordering.</div>
                    </div>
                  ) : (
                    /* Premium Receipt Invoice Layout */
                    <div className="bd-invoice">
                      <div className="bd-invoice-header">
                        <span>ITEM DESCRIPTION</span>
                        <span>QTY</span>
                        <span>PRICE</span>
                      </div>
                      <div className="bd-invoice-body">
                        {tab.orders.filter(o => o.status !== 'cancelled').flatMap(o => {
                          // Only new/preparing dishes can be pulled — matches the backend guard.
                          const removable = o.status === 'new' || o.status === 'preparing'
                          return o.items.map(it => (
                            <div key={it.id} className="bd-invoice-row">
                              <div className="bd-invoice-item">
                                <div className="bd-remove-slot">
                                  {removable && (
                                    <button
                                      className="bd-item-remove"
                                      onClick={() => removeItem(o.id, it.id, it.nameSnapshot)}
                                      disabled={busy}
                                      title="Remove item"
                                      aria-label={`Remove ${it.nameSnapshot}`}
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  )}
                                </div>
                                <div className="bd-item-meta-col">
                                  <div className="bd-item-name-row">
                                    <span className="bd-item-name">{it.nameSnapshot}</span>
                                    {it.variantLabel && <span className="bd-item-variant">{it.variantLabel}</span>}
                                  </div>
                                  <LineStatus status={it.itemStatus} />
                                </div>
                              </div>
                              <div className="bd-invoice-qty-col">
                                <span className={`bd-invoice-qty-badge ${it.quantity > 1 ? 'multi' : 'single'}`}>
                                  {it.quantity}
                                </span>
                              </div>
                              <span className="bd-invoice-price">
                                {it.priceSnapshot != null ? `₹${(Number(it.priceSnapshot) * it.quantity).toLocaleString('en-IN')}` : '—'}
                              </span>
                            </div>
                          ))
                        })}
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>

            {/* Footer actions */}
            {!hasSession ? (
              <div className="bd-foot">
                {/* Primary Action on Top */}
                {!table.isBlocked && (
                  <button className="bd-btn primary-red full-width" disabled={busy} onClick={openTab}>
                    <Armchair size={15} />
                    <span>{table.current ? 'Seat Guest & Open Tab' : 'Open Dining Tab'}</span>
                  </button>
                )}
                {/* Secondary Actions Side-by-Side */}
                <div className="bd-foot-group">
                  <button className="bd-btn secondary-btn flex-grow" disabled={busy} onClick={toggleBlock}>
                    {table.isBlocked ? <><Unlock size={14} /><span>Unblock Table</span></> : <><Lock size={14} /><span>Block Table</span></>}
                  </button>
                  {table.current && (
                    <button className="bd-btn error-ghost flex-grow" disabled={busy} onClick={cancelBooking}>
                      <Ban size={14} />
                      <span>Cancel Booking</span>
                    </button>
                  )}
                </div>
              </div>
            ) : tab ? (
              <div className="bd-foot">
                <div className="bd-total-row">
                  <div className="bd-total-meta">
                    <span className="bd-total-label">Subtotal Due</span>
                    <span className="bd-total-sub">
                      {tab.orders.filter(o => o.status !== 'cancelled').length} rounds ordered
                    </span>
                  </div>
                  <span className="bd-total-val"><IndianRupee size={16} />{total.toLocaleString('en-IN')}</span>
                </div>
                <div className="bd-foot-group">
                  {total === 0 ? (
                    <>
                      <button className="bd-btn primary-red flex-grow" disabled={busy} onClick={() => setMode('add')}>
                        <Plus size={15} />
                        <span>Add Items</span>
                      </button>
                      <button className="bd-btn disabled-btn" disabled={true} title="Settle Ticket (Empty ticket)">
                        <span>Settle Ticket</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="bd-btn secondary-btn" disabled={busy} style={{ flex: 1 }} onClick={() => setMode('add')}>
                        <Plus size={15} />
                        <span>Add Items</span>
                      </button>
                      <button className="bd-btn primary-red" disabled={busy} style={{ flex: 1.6 }} onClick={() => setSettling(true)}>
                        <span>Settle Ticket</span>
                      </button>
                    </>
                  )}
                </div>
                <button className="bd-void-link" disabled={busy} onClick={voidTab}>
                  Void Dining Session
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>

      {settling && tab && (
        <SettleModal
          sessionId={tab.id}
          tableName={table.name}
          total={total}
          onClose={() => setSettling(false)}
          onSettled={() => { setSettling(false); onChanged(); onClose(); }}
        />
      )}

      <style>{`
        .bd-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 2, 29, 0.28);
          backdrop-filter: blur(10px);
          z-index: 1000;
          display: flex;
          justify-content: flex-end;
          animation: bd-fadein .2s ease-out;
        }
        @keyframes bd-fadein { from { opacity: 0; } to { opacity: 1; } }

        .bd-sheet {
          width: 100%;
          max-width: 440px;
          height: 100%;
          background: #fafafa;
          display: flex;
          flex-direction: column;
          box-shadow: -8px 0 35px rgba(0, 2, 29, 0.08);
          animation: bd-slide .28s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes bd-slide { from { transform: translateX(36px); opacity: 0.8; } to { transform: translateX(0); opacity: 1; } }

        /* Header redesign */
        .bd-head {
          padding: 1.25rem 1.5rem;
          background: #ffffff;
          border-bottom: 1px solid var(--color-border);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .bd-head-main {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .bd-back {
          background: var(--color-surface-2);
          border: none;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: var(--color-text-2);
          transition: all 0.15s;
        }
        .bd-back:hover {
          background: var(--color-surface-3);
          color: var(--color-text-1);
        }
        .bd-meta {
          display: flex;
          flex-direction: column;
        }
        .bd-title {
          font-size: 1.15rem;
          font-weight: 800;
          color: var(--color-text-1);
          letter-spacing: -0.02em;
        }
        .bd-subtitle {
          font-size: 12px;
          color: var(--color-text-3);
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 4px;
          margin-top: 2px;
        }
        .bd-badge-pax {
          background: var(--color-surface-2);
          padding: 1px 6px;
          border-radius: 4px;
          color: var(--color-text-2);
        }
        .bd-close {
          background: var(--color-surface-2);
          border: none;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: var(--color-text-2);
          transition: all 0.15s;
        }
        .bd-close:hover {
          background: rgba(220, 38, 38, 0.08);
          color: var(--color-danger);
        }

        /* Drawer Body */
        .bd-body {
          flex: 1;
          overflow-y: auto;
          padding: 1.5rem;
        }

        /* Empty Seating Vectors */
        .bd-empty-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          min-height: 320px;
          padding: 1rem;
        }
        .bd-table-vector {
          position: relative;
          width: 72px;
          height: 72px;
          margin-bottom: 20px;
        }
        .bd-v-table {
          position: absolute;
          inset: 14px;
          background: #ffffff;
          border: 3px solid var(--color-border-strong);
          border-radius: 12px;
          box-shadow: 0 4px 10px rgba(0,2,29,0.04);
        }
        .bd-v-chair {
          position: absolute;
          background: var(--color-surface-3);
          border-radius: 4px;
          border: 2px solid var(--color-border-strong);
        }
        .bd-v-chair.top { top: 2px; left: 24px; width: 24px; height: 10px; }
        .bd-v-chair.bottom { bottom: 2px; left: 24px; width: 24px; height: 10px; }
        .bd-v-chair.left { left: 2px; top: 24px; width: 10px; height: 24px; }
        .bd-v-chair.right { right: 2px; top: 24px; width: 10px; height: 24px; }

        .bd-empty-title {
          font-size: 15.5px;
          font-weight: 800;
          color: var(--color-text-1);
          letter-spacing: -0.01em;
          margin-bottom: 6px;
        }
        .bd-empty-desc {
          font-size: 12.5px;
          color: var(--color-text-3);
          max-width: 240px;
          line-height: 1.5;
          font-weight: 500;
        }

        .bd-spinner-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 240px;
          color: var(--color-text-3);
          font-weight: 500;
          gap: 12px;
        }
        .bd-spinner {
          width: 22px;
          height: 22px;
          border: 2.5px solid var(--color-border);
          border-top-color: var(--color-primary);
          border-radius: 50%;
          animation: bd-spin 0.8s linear infinite;
        }
        @keyframes bd-spin { to { transform: rotate(360deg); } }

        /* Premium Invoice Receipt Redesign */
        .bd-invoice {
          background: #ffffff;
          border: 1px solid var(--color-border-strong);
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0, 2, 29, 0.015);
          overflow: hidden;
          position: relative;
        }
        .bd-invoice-header {
          display: flex;
          justify-content: space-between;
          padding: 12px 16px;
          background: #fcfcfb;
          border-bottom: 1px solid var(--color-border);
          font-size: 10px;
          font-weight: 750;
          color: var(--color-text-3);
          letter-spacing: 0.05em;
        }
        .bd-invoice-header span:nth-child(1) { flex: 1; }
        .bd-invoice-header span:nth-child(2) { width: 48px; text-align: center; }
        .bd-invoice-header span:nth-child(3) { width: 80px; text-align: right; }

        .bd-invoice-body {
          padding: 4px 16px;
          display: flex;
          flex-direction: column;
        }
        .bd-invoice-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 0;
          border-bottom: 1px solid rgba(0, 2, 29, 0.04);
        }
        .bd-invoice-row:last-child {
          border-bottom: none;
        }
        .bd-invoice-item {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .bd-item-meta-col {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
          flex: 1;
        }
        .bd-item-name-row {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 6px;
          line-height: 1.35;
        }
        .bd-item-name {
          font-size: 13.5px;
          font-weight: 700;
          color: var(--color-text-1);
        }
        .bd-item-variant {
          font-size: 10.5px;
          font-weight: 700;
          color: var(--color-text-3);
          background: var(--color-surface-2);
          padding: 1.5px 6px;
          border-radius: 4px;
          letter-spacing: -0.01em;
        }
        /* Per-line kitchen status chip */
        .bd-line-status {
          display: inline-flex;
          align-items: center;
          gap: 3.5px;
          font-size: 9.5px;
          font-weight: 800;
          padding: 3px 8px;
          border-radius: 6px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          line-height: 1;
        }
        .bd-line-status.preparing {
          background: rgba(217, 119, 6, 0.05);
          border: 1px solid rgba(217, 119, 6, 0.15);
          color: #d97706;
        }
        .bd-line-status.ready {
          background: rgba(37, 99, 235, 0.05);
          border: 1px solid rgba(37, 99, 235, 0.15);
          color: #2563eb;
        }
        .bd-line-status.served {
          background: rgba(22, 163, 74, 0.05);
          border: 1px solid rgba(22, 163, 74, 0.15);
          color: #16a34a;
        }
        /* Fixed-width slot keeps dish names aligned whether or not a remove button shows. */
        .bd-remove-slot {
          width: 24px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .bd-item-remove {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: none;
          background: transparent;
          color: var(--color-text-3);
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .bd-item-remove:hover:not(:disabled) {
          background: rgba(220, 38, 38, 0.08);
          color: var(--color-danger);
          transform: scale(1.08);
        }
        .bd-item-remove:disabled { opacity: 0.4; cursor: not-allowed; }
        .bd-diet-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .bd-diet-dot.veg { background: var(--color-success); box-shadow: 0 0 0 1.5px #ffffff, 0 0 0 2.5px var(--color-success); }
        .bd-diet-dot.nonveg { background: var(--color-danger); box-shadow: 0 0 0 1.5px #ffffff, 0 0 0 2.5px var(--color-danger); }

        .bd-invoice-qty-col {
          width: 48px;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .bd-invoice-qty-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 800;
          transition: all 0.15s;
        }
        .bd-invoice-qty-badge.single {
          background: var(--color-surface-2);
          color: var(--color-text-2);
        }
        .bd-invoice-qty-badge.multi {
          background: var(--color-primary-dim);
          color: var(--color-primary);
          border: 1px solid var(--color-primary-border);
        }

        .bd-invoice-price {
          width: 80px;
          text-align: right;
          font-size: 13.5px;
          font-weight: 750;
          color: var(--color-text-1);
        }
        .bd-invoice-receipt-tail {
          background-size: 8px 8px;
          background-repeat: repeat-x;
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          display: none;
        }

        /* Footer and Buttons */
        .bd-foot {
          background: #ffffff;
          border-top: 1px solid var(--color-border);
          padding: 1.25rem 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 12px;
          box-shadow: 0 -4px 16px rgba(0, 2, 29, 0.015);
        }
        .bd-total-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px dashed var(--color-border);
          padding-bottom: 10px;
        }
        .bd-total-label {
          font-size: 12px;
          font-weight: 700;
          color: var(--color-text-3);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .bd-total-val {
          display: inline-flex;
          align-items: center;
          font-size: 1.45rem;
          font-weight: 800;
          color: var(--color-text-1);
          letter-spacing: -0.02em;
        }

        .bd-foot-group {
          display: flex;
          gap: 8px;
          width: 100%;
        }
        .flex-grow {
          flex-grow: 1;
        }
        .bd-btn {
          height: 48px;
          border-radius: 12px;
          font-size: 13.5px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: 1px solid transparent;
          outline: none;
        }
        .bd-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .bd-btn.full-width {
          width: 100%;
        }

        /* Highly refined buttons styling */
        .bd-btn.primary-red {
          background: linear-gradient(135deg, #e34c40, #ca3227);
          color: #ffffff;
          border: 1px solid rgba(214, 66, 56, 0.4);
          box-shadow: 0 4px 14px rgba(214, 66, 56, 0.2);
        }
        .bd-btn.primary-red:hover:not(:disabled) {
          background: linear-gradient(135deg, #eb5a4f, #d64238);
          transform: translateY(-1.5px);
          box-shadow: 0 6px 18px rgba(214, 66, 56, 0.3);
        }
        .bd-btn.primary-red:active:not(:disabled) {
          transform: translateY(0.5px);
          box-shadow: 0 2px 8px rgba(214, 66, 56, 0.15);
        }

        .bd-btn.secondary-btn {
          background: #ffffff;
          border: 1.5px solid var(--color-border-strong);
          color: var(--color-text-1);
          box-shadow: 0 2px 6px rgba(0, 2, 29, 0.02);
        }
        .bd-btn.secondary-btn:hover:not(:disabled) {
          background: var(--color-surface-2);
          border-color: var(--color-text-2);
          transform: translateY(-1.5px);
          box-shadow: 0 6px 16px rgba(0, 2, 29, 0.05);
        }
        .bd-btn.secondary-btn:active:not(:disabled) {
          transform: translateY(0.5px);
          box-shadow: 0 1px 3px rgba(0, 2, 29, 0.02);
        }

        .bd-btn.error-ghost {
          background: #ffffff;
          color: var(--color-danger);
          border: 1.5px solid rgba(220, 38, 38, 0.2);
          box-shadow: 0 2px 6px rgba(220, 38, 38, 0.02);
        }
        .bd-btn.error-ghost:hover:not(:disabled) {
          background: rgba(220, 38, 38, 0.04);
          border-color: var(--color-danger);
          transform: translateY(-1.5px);
          box-shadow: 0 6px 16px rgba(220, 38, 38, 0.06);
        }
        .bd-btn.error-ghost:active:not(:disabled) {
          transform: translateY(0.5px);
        }

        .bd-btn.error-ghost-compact {
          width: 48px;
          flex-shrink: 0;
          background: #ffffff;
          border: 1.5px solid var(--color-border-strong);
          color: var(--color-text-3);
          box-shadow: 0 2px 6px rgba(0, 2, 29, 0.02);
        }
        .bd-btn.error-ghost-compact:hover:not(:disabled) {
          background: rgba(220, 38, 38, 0.04);
          color: var(--color-danger);
          border-color: rgba(220, 38, 38, 0.2);
          transform: translateY(-1.5px);
          box-shadow: 0 6px 16px rgba(220, 38, 38, 0.06);
        }
        .bd-btn.error-ghost-compact:active:not(:disabled) {
          transform: translateY(0.5px);
        }

        .bd-total-meta {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 2px;
        }
        .bd-total-sub {
          font-size: 11px;
          font-weight: 600;
          color: var(--color-text-3);
        }

        .bd-btn.disabled-btn {
          background: var(--color-surface-2);
          border: 1.5px solid var(--color-border);
          color: var(--color-text-3);
          cursor: not-allowed;
          opacity: 0.55;
          flex-grow: 1.2;
        }

        .bd-void-link {
          background: transparent;
          border: none;
          color: var(--color-text-3);
          font-size: 10.5px;
          font-weight: 750;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          cursor: pointer;
          text-align: center;
          margin-top: 4px;
          transition: color 0.15s;
          outline: none;
        }
        .bd-void-link:hover:not(:disabled) {
          color: var(--color-danger);
        }
      `}</style>
    </div>
  )
}

// ─── Add-items panel: search and diet-category item picker ──────────

function AddItemsPanel({ outletId, tableId, tableName, sessionId, onAdded }: {
  outletId: string
  tableId: string
  tableName: string
  sessionId: string
  onAdded: () => void
}) {
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [qty, setQty] = useState<Record<string, number>>({})
  const [submitting, setSubmitting] = useState(false)

  // Real-time search & diet filter states
  const [search, setSearch] = useState('')
  const [dietFilter, setDietFilter] = useState<'all' | 'veg' | 'nonveg'>('all')

  useEffect(() => {
    api.get<MenuCategory[]>(`/cms/menu?outletId=${outletId}`)
      .then(r => setCategories(r.data))
      .catch(() => toast.error('Failed to load menu'))
      .finally(() => setLoading(false))
  }, [outletId])

  // Variant-priced items (e.g. pizza sizes) are tracked per size, so the line key is
  // "<itemId>::<sizeLabel>"; single-price items key by plain itemId.
  const lineKey = (id: string, label?: string | null) => (label ? `${id}::${label}` : id)

  const step = (item: MenuItem, delta: number, variantLabel?: string) => {
    const key = lineKey(item.id, variantLabel)
    setQty(prev => {
      const next = (prev[key] || 0) + delta
      if (next <= 0) { const { [key]: _omit, ...rest } = prev; return rest }
      return { ...prev, [key]: next }
    })
  }

  const count = Object.values(qty).reduce((a, b) => a + b, 0)

  const submit = async () => {
    if (count === 0) { toast.error('Add at least one item'); return }
    setSubmitting(true)
    try {
      await api.post('/cms/orders', {
        outletId,
        serviceType: 'table',
        boardNumber: tableName.slice(0, 10),
        tableId,
        sessionId,
        items: Object.entries(qty).map(([key, quantity]) => {
          const sep = key.indexOf('::')
          return sep === -1
            ? { menuItemId: key, quantity }
            : { menuItemId: key.slice(0, sep), quantity, variantLabel: key.slice(sep + 2) }
        }),
      })
      toast.success('Sent to kitchen')
      onAdded()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Could not add items')
    } finally {
      setSubmitting(false)
    }
  }

  // Filter categories and their child items based on real-time input & diet filter
  const filteredMenu = useMemo(() => {
    return categories.map(cat => {
      const items = cat.items.filter(item => {
        const matchSearch = item.name.toLowerCase().includes(search.toLowerCase())
        const matchDiet = dietFilter === 'all' ||
                          (dietFilter === 'veg' && item.isVeg) ||
                          (dietFilter === 'nonveg' && !item.isVeg)
        return matchSearch && matchDiet
      })
      return { ...cat, items }
    }).filter(cat => cat.items.length > 0)
  }, [categories, search, dietFilter])

  return (
    <>
      {/* Filtering Header Panel */}
      <div className="ai-filters-panel">
        <div className="ai-search-box">
          <Search size={14} className="ai-search-icon" />
          <input
            type="text"
            className="ai-search-input"
            placeholder="Search items..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="ai-search-clear" onClick={() => setSearch('')}>
              <X size={12} />
            </button>
          )}
        </div>

        <div className="ai-diet-toggle">
          <button className={dietFilter === 'all' ? 'active' : ''} onClick={() => setDietFilter('all')}>All</button>
          <button className={dietFilter === 'veg' ? 'active veg' : ''} onClick={() => setDietFilter('veg')}>Veg</button>
          <button className={dietFilter === 'nonveg' ? 'active nonveg' : ''} onClick={() => setDietFilter('nonveg')}>Non-Veg</button>
        </div>
      </div>

      <div className="bd-body ai-body">
        {loading ? (
          <div className="bd-spinner-state">
            <div className="bd-spinner" />
            <span>Loading outlet menu...</span>
          </div>
        ) : filteredMenu.length === 0 ? (
          <div className="bd-empty-container">
            <ShoppingBag size={24} style={{ opacity: 0.4, marginBottom: 8 }} />
            <div className="bd-empty-title">No Items Found</div>
            <div className="bd-empty-desc">No menu items match your search or filter settings.</div>
          </div>
        ) : (
          filteredMenu.map(cat => (
            <div key={cat.id} className="ai-cat">
              <div className="ai-cat-name">{cat.name}</div>
              <div className="ai-items-list">
                {cat.items.map(item => {
                  const variants = item.priceVariants && Object.keys(item.priceVariants).length > 0
                    ? item.priceVariants
                    : null
                  return (
                    <div key={item.id} className="ai-item-block">
                      <div className="ai-row">
                        <div className="ai-item-details">
                          <span className={`ai-diet-icon ${item.isVeg ? 'veg' : 'nonveg'}`} />
                          <div className="ai-meta">
                            <span className="ai-name">{item.name}</span>
                            {variants
                              ? <span className="ai-price ai-price-hint">Choose an option</span>
                              : item.price != null && <span className="ai-price">₹{Number(item.price).toLocaleString('en-IN')}</span>}
                          </div>
                        </div>

                        {!variants && (
                          <div className="ai-stepper">
                            <button className="ai-step" onClick={() => step(item, -1)} disabled={!qty[item.id]} aria-label="Remove">
                              <Minus size={11} strokeWidth={2.5} />
                            </button>
                            <span className="ai-qty">{qty[item.id] || 0}</span>
                            <button className="ai-step" onClick={() => step(item, 1)} aria-label="Add">
                              <Plus size={11} strokeWidth={2.5} />
                            </button>
                          </div>
                        )}
                      </div>

                      {variants && (
                        <div className="ai-variants">
                          {Object.entries(variants).map(([label, price]) => {
                            const key = lineKey(item.id, label)
                            return (
                              <div key={label} className="ai-variant-row">
                                <span className="ai-variant-label">{label}</span>
                                <span className="ai-variant-price">₹{Number(price).toLocaleString('en-IN')}</span>
                                <div className="ai-stepper">
                                  <button className="ai-step" onClick={() => step(item, -1, label)} disabled={!qty[key]} aria-label="Remove">
                                    <Minus size={11} strokeWidth={2.5} />
                                  </button>
                                  <span className="ai-qty">{qty[key] || 0}</span>
                                  <button className="ai-step" onClick={() => step(item, 1, label)} aria-label="Add">
                                    <Plus size={11} strokeWidth={2.5} />
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Floating total round order checkout CTA */}
      <div className="bd-foot">
        <button className="bd-btn primary-red full-width" disabled={submitting || count === 0} onClick={submit}>
          <span>{submitting ? 'Sending order...' : `Send ${count || ''} item${count === 1 ? '' : 's'} to Kitchen`}</span>
        </button>
      </div>

      <style>{`
        /* Stepper filters */
        .ai-filters-panel {
          padding: 12px 1.5rem;
          background: #ffffff;
          border-bottom: 1px solid var(--color-border);
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .ai-search-box {
          position: relative;
          display: flex;
          align-items: center;
        }
        .ai-search-icon {
          position: absolute;
          left: 10px;
          color: var(--color-text-3);
          pointer-events: none;
        }
        .ai-search-input {
          width: 100%;
          height: 36px;
          background: var(--color-bg);
          border: 1px solid var(--color-border-strong);
          border-radius: 8px;
          padding: 0 32px;
          font-size: 13px;
          font-weight: 500;
          color: var(--color-text-1);
          outline: none;
          transition: all 0.15s;
        }
        .ai-search-input:focus {
          border-color: var(--color-primary);
          background: #ffffff;
          box-shadow: 0 0 0 3px var(--color-primary-dim);
        }
        .ai-search-clear {
          position: absolute;
          right: 10px;
          background: transparent;
          border: none;
          color: var(--color-text-3);
          cursor: pointer;
        }
        .ai-search-clear:hover {
          color: var(--color-text-1);
        }

        /* Diet toggle style */
        .ai-diet-toggle {
          display: flex;
          background: var(--color-surface-2);
          border-radius: 8px;
          padding: 2.5px;
          gap: 2px;
        }
        .ai-diet-toggle button {
          flex: 1;
          border: none;
          background: transparent;
          font-size: 11px;
          font-weight: 750;
          color: var(--color-text-3);
          padding: 5px 0;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s;
        }
        .ai-diet-toggle button.active {
          background: #ffffff;
          color: var(--color-text-1);
          box-shadow: 0 1px 4px rgba(0, 2, 29, 0.05);
        }
        .ai-diet-toggle button.active.veg { color: var(--color-success); }
        .ai-diet-toggle button.active.nonveg { color: var(--color-danger); }

        .ai-body {
          background: #ffffff;
        }
        .ai-cat {
          margin-bottom: 1.25rem;
        }
        .ai-cat-name {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--color-text-3);
          border-bottom: 1px solid var(--color-border);
          padding-bottom: 5px;
          margin-bottom: 8px;
        }
        .ai-items-list {
          display: flex;
          flex-direction: column;
        }
        .ai-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid rgba(0, 2, 29, 0.02);
        }
        .ai-item-details {
          display: flex;
          align-items: center;
          gap: 10px;
          flex: 1;
          margin-right: 12px;
        }
        .ai-meta {
          display: flex;
          flex-direction: column;
        }
        .ai-name {
          font-size: 13px;
          font-weight: 700;
          color: var(--color-text-1);
          line-height: 1.3;
        }
        .ai-price {
          font-size: 11.5px;
          font-weight: 650;
          color: var(--color-text-3);
          margin-top: 1px;
        }
        .ai-price-hint {
          color: var(--color-primary);
          font-weight: 700;
        }

        /* Variant (size) sub-rows for variant-priced items */
        .ai-item-block {
          border-bottom: 1px solid rgba(0, 2, 29, 0.02);
        }
        .ai-item-block .ai-row {
          border-bottom: none;
        }
        .ai-variants {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin: 2px 0 10px 22px;
          padding-left: 12px;
          border-left: 2px solid var(--color-border);
        }
        .ai-variant-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 0;
        }
        .ai-variant-label {
          font-size: 12px;
          font-weight: 700;
          color: var(--color-text-2);
          flex: 1;
        }
        .ai-variant-price {
          font-size: 11.5px;
          font-weight: 650;
          color: var(--color-text-3);
        }

        .ai-diet-icon {
          width: 12px;
          height: 12px;
          border: 1.5px solid;
          border-radius: 3px;
          display: inline-block;
          position: relative;
          flex-shrink: 0;
        }
        .ai-diet-icon.veg { border-color: var(--color-success); }
        .ai-diet-icon.veg::after {
          content: '';
          position: absolute;
          inset: 2px;
          border-radius: 50%;
          background: var(--color-success);
        }
        .ai-diet-icon.nonveg { border-color: var(--color-danger); }
        .ai-diet-icon.nonveg::after {
          content: '';
          position: absolute;
          inset: 2px;
          background: var(--color-danger);
          clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
        }

        /* Capsule Stepper */
        .ai-stepper {
          display: flex;
          align-items: center;
          background: var(--color-surface-2);
          border: 1px solid var(--color-border);
          border-radius: 99px;
          padding: 2px;
        }
        .ai-step {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          border: none;
          background: #ffffff;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
          color: var(--color-text-1);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
        }
        .ai-step:hover:not(:disabled) {
          background: var(--color-primary);
          color: #ffffff;
        }
        .ai-step:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
        .ai-qty {
          font-size: 11.5px;
          font-weight: 800;
          min-width: 22px;
          text-align: center;
          color: var(--color-text-1);
        }
      `}</style>
    </>
  )
}
