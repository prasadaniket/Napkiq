'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { api } from '@/lib/api'
import { useDeviceFingerprint } from '@/hooks/useDeviceFingerprint'
import Loader from '@/components/ui/Loader'
import toast from 'react-hot-toast'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.napkiq.in/api'

type OrderStatus = 'new' | 'preparing' | 'ready' | 'served' | 'cancelled'

interface OrderItemT {
  id: string
  nameSnapshot: string
  variantLabel: string | null
  priceSnapshot: string | null
  quantity: number
}
interface OrderT {
  id: string
  status: OrderStatus
  serviceType: 'table' | 'self'
  boardNumber: string | null
  dailyNumber: number | null
  note: string | null
  createdAt: string
  items: OrderItemT[]
  outlet?: { name: string; code: string; slug: string }
}

const STEPS: { key: OrderStatus; label: string; desc: string; emoji: string }[] = [
  { key: 'new',       label: 'Order Received', desc: 'Sent to the kitchen',        emoji: '🧾' },
  { key: 'preparing', label: 'Preparing',      desc: 'Our chefs are on it',        emoji: '👨‍🍳' },
  { key: 'ready',     label: 'Ready',          desc: 'Freshly prepared',           emoji: '✅' },
  { key: 'served',    label: 'Served',         desc: 'Enjoy your meal!',           emoji: '🍽️' },
]

const lightThemeStyle = { background: '#faf9f6' }

export default function OrderTrackingPage() {
  const params = useParams()
  const code = params.code as string
  const id = params.id as string

  const { deviceId } = useDeviceFingerprint()
  const [order, setOrder] = useState<OrderT | null>(null)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)

  // Initial load + live SSE subscription.
  useEffect(() => {
    let es: EventSource | null = null

    api.get<OrderT>(`/orders/${id}`)
      .then(res => setOrder(res.data))
      .catch(() => toast.error('Order not found'))
      .finally(() => setLoading(false))

    es = new EventSource(`${BASE_URL}/orders/${id}/stream`)
    es.onmessage = (e) => {
      try {
        const evt = JSON.parse(e.data)
        if (evt?.order) setOrder(evt.order)
      } catch { /* heartbeat/comment */ }
    }

    return () => es?.close()
  }, [id])

  const cancelOrder = useCallback(async () => {
    if (!deviceId) return
    setCancelling(true)
    try {
      const res = await api.patch<OrderT>(`/orders/${id}/cancel`, { deviceId })
      setOrder(res.data)
      toast.success('Order cancelled')
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Could not cancel this order')
    } finally {
      setCancelling(false)
    }
  }, [deviceId, id])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={lightThemeStyle}>
        <Loader />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6" style={lightThemeStyle}>
        <p className="text-neutral-500 text-sm font-medium">We couldn't find this order.</p>
        <Link href={`/${code}/menu`} className="text-[#D64238] font-bold text-sm">← Back to menu</Link>
      </div>
    )
  }

  const isCancelled = order.status === 'cancelled'
  const currentIdx = STEPS.findIndex(s => s.key === order.status)
  const total = order.items.reduce(
    (sum, it) => sum + (it.priceSnapshot ? parseFloat(it.priceSnapshot) * it.quantity : 0), 0
  )

  return (
    <div className="relative min-h-screen flex flex-col items-center pt-8 px-4 pb-20 overflow-x-hidden" style={lightThemeStyle}>
      <main className="relative z-10 w-full max-w-md mx-auto flex flex-col">

        {/* Header */}
        <div className="flex items-center gap-2 mb-6">
          <Link href={`/${code}/menu`} aria-label="Back to menu">
            <div className="text-neutral-600 hover:text-[#D64238] transition-colors p-2 -ml-2 rounded-full bg-white border border-neutral-100/80 shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </div>
          </Link>
          <div>
            <h2 className="text-lg font-serif font-extrabold text-[#1c1917] tracking-tight leading-none">
              Order {order.dailyNumber != null ? `#${order.dailyNumber}` : ''}
            </h2>
            <p className="text-[11px] text-neutral-400 font-medium mt-0.5">
              {order.outlet?.name ?? 'Napkiq'} · Today&apos;s token
            </p>
          </div>
        </div>

        {/* Big token number (McDonald's-style) */}
        {order.dailyNumber != null && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-3xl bg-[#00021D] text-white shadow-lg p-6 mb-5 flex items-center justify-between"
          >
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-white/50">Your Token</p>
              <p className="text-[13px] text-white/60 font-medium mt-1">
                {order.serviceType === 'table' ? `Table Board #${order.boardNumber || '—'}` : 'Self Service'}
              </p>
            </div>
            <div className="flex items-baseline gap-0.5">
              <span className="text-2xl font-bold text-[#E88C3A]">#</span>
              <span className="text-5xl font-black text-[#E88C3A] leading-none tabular-nums">{order.dailyNumber}</span>
            </div>
          </motion.div>
        )}

        {/* Status card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="bg-white rounded-3xl border border-neutral-100 shadow-sm p-6 mb-5"
        >
          {isCancelled ? (
            <div className="flex flex-col items-center text-center py-4">
              <span className="text-4xl mb-2">❌</span>
              <h3 className="font-extrabold text-lg text-rose-600">Order Cancelled</h3>
              <p className="text-xs text-neutral-500 mt-1">This order was cancelled and won't be prepared.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {STEPS.map((step, i) => {
                const done = i < currentIdx
                const active = i === currentIdx
                return (
                  <div key={step.key} className="flex items-start gap-3">
                    {/* Rail + node */}
                    <div className="flex flex-col items-center">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-base transition-all duration-300 ${
                        done ? 'bg-emerald-100' : active ? 'bg-[#D64238] shadow-md shadow-[#D64238]/20' : 'bg-neutral-100'
                      }`}>
                        {done ? <span className="text-emerald-600 font-black">✓</span> : <span className={active ? 'grayscale-0' : 'grayscale opacity-40'}>{step.emoji}</span>}
                      </div>
                      {i < STEPS.length - 1 && (
                        <div className={`w-0.5 h-7 ${i < currentIdx ? 'bg-emerald-200' : 'bg-neutral-100'}`} />
                      )}
                    </div>
                    {/* Text */}
                    <div className={`pt-1.5 pb-1 ${active ? '' : 'opacity-70'}`}>
                      <p className={`text-sm font-extrabold ${active ? 'text-[#D64238]' : done ? 'text-[#1c1917]' : 'text-neutral-400'}`}>
                        {step.label}
                        {active && <span className="ml-2 text-[10px] font-bold text-[#D64238] bg-rose-50 px-2 py-0.5 rounded-full uppercase tracking-wide align-middle">Now</span>}
                      </p>
                      <p className="text-[11px] text-neutral-400 font-medium">{step.desc}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </motion.div>

        {/* Service info */}
        <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4 mb-5 flex items-center gap-3">
          <span className="text-xl">{order.serviceType === 'table' ? '🛎️' : '🥡'}</span>
          <div>
            <p className="text-[13px] font-extrabold text-[#1c1917]">
              {order.serviceType === 'table' ? `Table Service · Board #${order.boardNumber || '—'}` : 'Self Service'}
            </p>
            <p className="text-[11px] text-neutral-400 font-medium">
              {order.serviceType === 'table' ? 'A waiter will bring your food.' : 'Collect from the counter when ready.'}
            </p>
          </div>
        </div>

        {/* Items */}
        <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-5 mb-5">
          <h4 className="text-[11px] font-extrabold text-neutral-500 uppercase tracking-wider mb-3">Order Summary</h4>
          <div className="divide-y divide-neutral-100">
            {order.items.map(it => (
              <div key={it.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                <span className="text-sm font-semibold text-[#1c1917]">
                  <span className="text-[#D64238] font-extrabold">{it.quantity}×</span> {it.nameSnapshot}
                  {it.variantLabel && <span className="text-neutral-400 capitalize"> · {it.variantLabel}</span>}
                </span>
                <span className="text-[12px] font-bold text-neutral-600">
                  {it.priceSnapshot ? `₹${(parseFloat(it.priceSnapshot) * it.quantity).toFixed(0)}` : '—'}
                </span>
              </div>
            ))}
          </div>
          {total > 0 && (
            <div className="flex justify-between items-center border-t border-neutral-100 pt-3 mt-1">
              <span className="text-xs text-neutral-400 font-medium">Total</span>
              <span className="font-extrabold text-lg text-[#D64238]">₹{total.toFixed(0)}</span>
            </div>
          )}
        </div>

        {/* Cancel (only while New) */}
        {order.status === 'new' && (
          <motion.button
            whileTap={{ scale: cancelling ? 1 : 0.98 }}
            onClick={cancelOrder}
            disabled={cancelling}
            className="w-full h-12 rounded-xl border-2 border-rose-200 text-rose-600 font-extrabold text-xs uppercase tracking-wider bg-white hover:bg-rose-50 transition-all duration-300 disabled:opacity-60"
          >
            {cancelling ? 'Cancelling…' : 'Cancel Order'}
          </motion.button>
        )}

        <Link href={`/${code}/orders`} className="text-center text-[12px] font-bold text-neutral-400 hover:text-[#D64238] mt-5 transition-colors">
          View my past orders
        </Link>
      </main>
    </div>
  )
}
