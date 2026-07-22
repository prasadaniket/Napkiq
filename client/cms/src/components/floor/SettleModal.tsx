'use client'

import { useState } from 'react'
import { api } from '@/lib/api'
import type { PaymentMethod } from '@/types/api'
import toast from 'react-hot-toast'
import { X, Banknote, Smartphone, CreditCard, IndianRupee } from 'lucide-react'

const METHODS: { key: PaymentMethod; label: string; icon: any; color: string; hoverBg: string }[] = [
  { key: 'cash', label: 'Cash', icon: Banknote, color: 'var(--color-success)', hoverBg: 'rgba(22, 163, 74, 0.05)' },
  { key: 'upi',  label: 'UPI App',  icon: Smartphone, color: 'var(--color-info)', hoverBg: 'rgba(37, 99, 235, 0.05)' },
  { key: 'card', label: 'Card Swipe', icon: CreditCard, color: 'var(--color-primary)', hoverBg: 'rgba(214, 66, 56, 0.05)' },
]

export default function SettleModal({ sessionId, tableName, total, onClose, onSettled }: {
  sessionId: string
  tableName: string
  total: number
  onClose: () => void
  onSettled: () => void
}) {
  const [busy, setBusy] = useState<PaymentMethod | null>(null)

  const settle = async (paymentMethod: PaymentMethod) => {
    setBusy(paymentMethod)
    try {
      await api.post(`/cms/sessions/${sessionId}/settle`, { paymentMethod })
      toast.success(`Table ${tableName} settled · ${paymentMethod.toUpperCase()}`)
      onSettled()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Could not settle')
      setBusy(null)
    }
  }

  return (
    <div className="sm-backdrop" onClick={onClose}>
      <div className="sm-card" onClick={e => e.stopPropagation()}>
        {/* Close Button */}
        <button className="sm-close" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>

        {/* Title labels */}
        <div className="sm-label-wrapper">
          <span className="sm-label">Billing Settlement</span>
          <h2 className="sm-title">Table {tableName}</h2>
        </div>

        {/* Invoice Total Banner */}
        <div className="sm-total-box">
          <span className="sm-total-title">TOTAL AMOUNT DUE</span>
          <div className="sm-total">
            <IndianRupee size={28} strokeWidth={2.5} />
            <span className="font-mono">{total.toLocaleString('en-IN')}</span>
          </div>
        </div>

        <p className="sm-hint">Choose payment collection channel to settle ticket</p>

        {/* Settle methods buttons grid */}
        <div className="sm-methods">
          {METHODS.map(({ key, label, icon: Icon, color, hoverBg }) => {
            const isSelfBusy = busy === key
            const isAnyBusy = busy !== null
            return (
              <button
                key={key}
                className={`sm-method-btn ${isSelfBusy ? 'is-settling' : ''}`}
                disabled={isAnyBusy}
                onClick={() => settle(key)}
                style={{
                  '--method-color': color,
                  '--method-hover-bg': hoverBg,
                } as React.CSSProperties}
              >
                <div className="sm-method-icon">
                  <Icon size={26} strokeWidth={1.8} />
                </div>
                <span className="sm-method-label">
                  {isSelfBusy ? 'Settle...' : label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <style>{`
        .sm-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 2, 29, 0.35);
          backdrop-filter: blur(12px);
          z-index: 1100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
          animation: sm-fade .2s ease-out;
        }
        @keyframes sm-fade { from { opacity: 0; } to { opacity: 1; } }

        .sm-card {
          position: relative;
          background: #ffffff;
          border-radius: var(--radius-xl);
          box-shadow: 0 20px 50px rgba(0, 2, 29, 0.14);
          width: 100%;
          max-width: 420px;
          padding: 2.25rem 2rem 2rem;
          text-align: center;
          animation: sm-pop .28s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          border: 1px solid var(--color-border);
        }
        @keyframes sm-pop { from { transform: scale(0.92); opacity: 0; } to { transform: scale(1); opacity: 1; } }

        .sm-close {
          position: absolute;
          top: 16px;
          right: 16px;
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
        .sm-close:hover {
          background: var(--color-surface-3);
          color: var(--color-text-1);
        }

        .sm-label-wrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          margin-bottom: 20px;
        }
        .sm-label {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--color-text-3);
        }
        .sm-title {
          font-size: 20px;
          font-weight: 800;
          color: var(--color-text-1);
          letter-spacing: -0.02em;
          margin: 0;
        }

        /* Invoice Total Display box */
        .sm-total-box {
          background: var(--color-surface-2);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: 14px;
          margin-bottom: 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }
        .sm-total-title {
          font-size: 9px;
          font-weight: 800;
          color: var(--color-text-3);
          letter-spacing: 0.06em;
        }
        .sm-total {
          display: inline-flex;
          align-items: center;
          font-size: 38px;
          font-weight: 800;
          color: var(--color-text-1);
          letter-spacing: -0.03em;
        }
        .sm-total svg {
          color: var(--color-primary);
        }

        .sm-hint {
          font-size: 12.5px;
          color: var(--color-text-3);
          font-weight: 600;
          margin: 0 0 1.5rem;
        }

        /* Methods button list */
        .sm-methods {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }
        .sm-method-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 1.25rem 0.5rem;
          border: 1.5px solid var(--color-border-strong);
          border-radius: 12px;
          background: #ffffff;
          color: var(--color-text-1);
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
          outline: none;
        }
        .sm-method-btn:hover:not(:disabled) {
          border-color: var(--method-color);
          background: var(--method-hover-bg);
          color: var(--method-color);
          transform: translateY(-3px);
          box-shadow: 0 8px 20px rgba(0, 2, 29, 0.05);
        }
        .sm-method-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .sm-method-icon {
          color: var(--color-text-2);
          transition: color 0.22s;
        }
        .sm-method-btn:hover:not(:disabled) .sm-method-icon {
          color: var(--method-color);
        }
        .sm-method-label {
          line-height: 1.1;
        }

        /* Actively Settle button style */
        .sm-method-btn.is-settling {
          border-color: var(--method-color);
          background: var(--method-hover-bg);
          color: var(--method-color);
          animation: sm-button-pulse 1.4s infinite ease-in-out;
        }
        @keyframes sm-button-pulse {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(0.96); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
