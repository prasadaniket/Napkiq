'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { api } from '@/lib/api'
import { useDeviceFingerprint } from '@/hooks/useDeviceFingerprint'
import Loader from '@/components/ui/Loader'

type OrderStatus = 'new' | 'preparing' | 'ready' | 'served' | 'cancelled'

interface OrderItemT { id: string; nameSnapshot: string; variantLabel: string | null; priceSnapshot: string | null; quantity: number }
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

const STATUS_META: Record<OrderStatus, { label: string; cls: string }> = {
  new:       { label: 'Placed',       cls: 'text-blue-600 bg-blue-50 border-blue-100/50' },
  preparing: { label: 'Cooking',      cls: 'text-amber-600 bg-amber-50 border-amber-100/50' },
  ready:     { label: 'Ready',          cls: 'text-emerald-600 bg-emerald-50 border-emerald-100/50' },
  served:    { label: 'Served',         cls: 'text-neutral-500 bg-neutral-100 border-neutral-200/50' },
  cancelled: { label: 'Cancelled',      cls: 'text-rose-600 bg-rose-50 border-rose-100/50' },
}

const lightThemeStyle = { background: '#faf9f6' }

// Custom SVG Icons (to guarantee compilation without external lucide-react dependency issues)
function StoreIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m2 7 4.41-3.67A2 2 0 0 1 7.73 3h8.54a2 2 0 0 1 1.32.33L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M12 7v15"/></svg>
  )
}

function ArrowRightIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
  )
}

export default function MyOrdersPage() {
  const params = useParams()
  const code = params.code as string
  const { deviceId, loading: fpLoading } = useDeviceFingerprint()

  const [orders, setOrders] = useState<OrderT[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active')

  useEffect(() => {
    if (fpLoading) return
    if (!deviceId) { setLoading(false); return }
    api.get<OrderT[]>(`/orders/by-device/${deviceId}`)
      .then(res => setOrders(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [deviceId, fpLoading])

  const activeOrders = orders.filter(o => ['new', 'preparing', 'ready'].includes(o.status))
  const historyOrders = orders.filter(o => ['served', 'cancelled'].includes(o.status))

  const shownOrders = activeTab === 'active' ? activeOrders : historyOrders

  return (
    <div className="relative min-h-screen flex flex-col items-center pt-6 px-4 pb-20" style={lightThemeStyle}>
      <main className="relative z-10 w-full max-w-md mx-auto flex flex-col">

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <Link href={`/${code}/menu`} aria-label="Back to menu">
            <div className="text-neutral-600 hover:text-[#D64238] transition-colors p-2 rounded-full bg-white border border-neutral-100/80 shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </div>
          </Link>
          <div>
            <h2 className="text-xl font-serif font-extrabold text-[#1c1917] tracking-tight">My Orders</h2>
            <p className="text-[11px] text-neutral-400 font-semibold mt-0.5">
              {orders.length} order{orders.length !== 1 ? 's' : ''} placed from this device
            </p>
          </div>
        </div>

        {/* Segmented Control Tabs */}
        {!loading && orders.length > 0 && (
          <div className="flex gap-2 p-1 bg-neutral-200/50 backdrop-blur-md rounded-2xl mb-5 border border-neutral-200/20">
            <button
              onClick={() => setActiveTab('active')}
              className={`relative flex-1 py-2.5 text-center text-xs font-extrabold rounded-xl transition-all duration-300 ${
                activeTab === 'active'
                  ? 'bg-white text-neutral-800 shadow-md shadow-neutral-200/20 border border-neutral-100/50'
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              <span className="flex items-center justify-center gap-1.5">
                Active
                {activeOrders.length > 0 && (
                  <span className="w-5 h-5 rounded-full bg-[#D64238] text-white flex items-center justify-center text-[10px] font-black leading-none animate-pulse">
                    {activeOrders.length}
                  </span>
                )}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 py-2.5 text-center text-xs font-extrabold rounded-xl transition-all duration-300 ${
                activeTab === 'history'
                  ? 'bg-white text-neutral-800 shadow-md shadow-neutral-200/20 border border-neutral-100/50'
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              History
            </button>
          </div>
        )}

        {loading ? (
          <Loader />
        ) : shownOrders.length === 0 ? (
          /* Empty State */
          <div className="text-center py-12 bg-white rounded-3xl border border-neutral-100/80 shadow-md px-6 flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-neutral-50 border border-neutral-100 flex items-center justify-center mb-4">
              <span className="text-3xl filter grayscale opacity-80">🧾</span>
            </div>
            <h3 className="text-neutral-800 font-extrabold text-sm tracking-tight">
              {activeTab === 'active' ? 'No active orders' : 'No order history'}
            </h3>
            <p className="text-neutral-400 text-xs mt-1.5 max-w-[240px] leading-relaxed font-medium">
              {activeTab === 'active'
                ? 'Hungry? Place an order from our visual menu right now!'
                : 'All your past orders from this device will be listed here.'}
            </p>
            <Link
              href={`/${code}/menu`}
              className="mt-6 w-full max-w-[180px] bg-[#D64238] hover:bg-[#b03028] text-white text-xs font-bold py-3 px-4 rounded-xl shadow-md hover:shadow-lg shadow-[#D64238]/10 hover:shadow-[#D64238]/20 transition-all duration-300"
            >
              Browse Menu
            </Link>
          </div>
        ) : (
          /* Zomato/Swiggy-style Card Stack */
          <div className="flex flex-col gap-4">
            {shownOrders.map((o, i) => {
              const meta = STATUS_META[o.status]
              const count = o.items.reduce((s, it) => s + it.quantity, 0)
              const total = o.items.reduce((s, it) => s + (it.priceSnapshot ? parseFloat(it.priceSnapshot) * it.quantity : 0), 0)
              const isOrderActive = ['new', 'preparing', 'ready'].includes(o.status)

              return (
                <motion.div
                  key={o.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.04, 0.25), duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="bg-white rounded-2xl border border-neutral-100 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden"
                >
                  {/* Card Header */}
                  <div className="px-4 py-3 border-b border-neutral-100/50 bg-neutral-50/20 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-neutral-100/80 border border-neutral-200/50 flex items-center justify-center text-neutral-500">
                        <StoreIcon />
                      </div>
                      <div>
                        <h4 className="text-xs font-extrabold text-neutral-800 line-clamp-1 leading-tight">
                          {o.outlet?.name || 'Napkiq Outlet'}
                        </h4>
                        <p className="text-[10px] text-neutral-400 font-semibold mt-0.5">
                          {new Date(o.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border uppercase tracking-wider ${meta.cls}`}>
                        {meta.label}
                      </span>
                      {o.dailyNumber != null && (
                        <span className="text-[9px] font-black text-neutral-400">Token #{o.dailyNumber}</span>
                      )}
                    </div>
                  </div>

                  {/* Receipt Items list */}
                  <div className="px-4 py-3 border-b border-neutral-50 bg-white">
                    <ul className="flex flex-col gap-2">
                      {o.items.map(it => (
                        <li key={it.id} className="flex justify-between items-center text-xs font-semibold text-neutral-700">
                          <span className="flex items-center gap-2 max-w-[80%]">
                            <span className="text-[10px] font-black text-[#D64238] bg-[#D64238]/5 border border-[#D64238]/10 px-1.5 py-0.5 rounded">
                              {it.quantity}x
                            </span>
                            <span className="truncate">{it.nameSnapshot} {it.variantLabel ? `(${it.variantLabel})` : ''}</span>
                          </span>
                          <span className="text-neutral-400 font-medium text-[11px]">
                            {it.priceSnapshot ? `₹${(parseFloat(it.priceSnapshot) * it.quantity).toFixed(0)}` : ''}
                          </span>
                        </li>
                      ))}
                    </ul>

                    {o.note && (
                      <div className="mt-3 flex items-start gap-1.5 p-2 bg-neutral-50 rounded-xl text-[10px] font-semibold text-neutral-500 italic">
                        <span>📝</span>
                        <span>Note: &ldquo;{o.note}&rdquo;</span>
                      </div>
                    )}
                  </div>

                  {/* Card Footer */}
                  <div className="px-4 py-3 bg-neutral-50/20 flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      {o.serviceType === 'table' ? (
                        <span className="text-[10px] font-extrabold text-neutral-500 bg-neutral-100 border border-neutral-200/50 px-2 py-0.5 rounded">
                          🛎️ Table {o.boardNumber || '—'}
                        </span>
                      ) : (
                        <span className="text-[10px] font-extrabold text-neutral-500 bg-neutral-100 border border-neutral-200/50 px-2 py-0.5 rounded">
                          🥡 Pickup
                        </span>
                      )}
                      <span className="text-[10.5px] text-neutral-400 font-bold">
                        {count} item{count !== 1 ? 's' : ''}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {total > 0 && (
                        <span className="text-xs font-black text-neutral-800">
                          ₹{total.toFixed(0)}
                        </span>
                      )}

                      {isOrderActive ? (
                        <Link
                          href={`/${code}/order/${o.id}`}
                          className="text-[11px] font-bold text-white bg-[#D64238] hover:bg-[#b03028] px-3.5 py-1.5 rounded-lg shadow-sm hover:shadow-md transition-all flex items-center gap-1"
                        >
                          <span>Track Status</span>
                          <ArrowRightIcon />
                        </Link>
                      ) : (
                        <Link
                          href={`/${code}/menu`}
                          className="text-[11px] font-bold text-[#D64238] hover:bg-[#D64238]/5 border border-[#D64238]/10 px-3.5 py-1.5 rounded-lg transition-all"
                        >
                          Reorder
                        </Link>
                      )}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
