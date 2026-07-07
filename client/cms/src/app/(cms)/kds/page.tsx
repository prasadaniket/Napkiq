'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import KitchenBoard from '@/components/orders/KitchenBoard'
import OrdersReport from '@/components/orders/OrdersReport'
import MenuBuilder from '@/components/orders/MenuBuilder'

type Tab = 'board' | 'report' | 'menu'

// ─── Merged Kitchen page: live board + orders report + menu builder as tabs ─────
// The Menu tab is admin-only (matches the requireAdmin backend on /api/cms/menu).
export default function KitchenPage() {
  const { isAdmin } = useAuth()
  const searchParams = useSearchParams()

  const tabs: [Tab, string][] = [
    ['board', 'Live Board'],
    ['report', 'Orders & Sales'],
    ...(isAdmin ? ([['menu', 'Menu']] as [Tab, string][]) : []),
  ]
  const allowed = tabs.map(([k]) => k)

  const requested = searchParams.get('tab') as Tab | null
  const initial: Tab = requested && allowed.includes(requested) ? requested : 'board'
  const [tab, setTab] = useState<Tab>(initial)

  // Guard: never render the admin-only Menu for a non-admin.
  const activeTab: Tab = tab === 'menu' && !isAdmin ? 'board' : tab

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 8, paddingBottom: 0 }}>
        <div style={{ display: 'inline-flex', gap: 4, background: '#f1f5f9', padding: 4, borderRadius: 12 }}>
          {tabs.map(([key, label]) => {
            const active = activeTab === key
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                style={{
                  padding: '7px 18px',
                  borderRadius: 9,
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all .2s',
                  background: active ? '#ffffff' : 'transparent',
                  color: active ? '#D64238' : 'rgba(0,2,29,0.5)',
                  boxShadow: active ? '0 1px 3px rgba(0,2,29,0.08)' : 'none',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {activeTab === 'board'
        ? <KitchenBoard />
        : activeTab === 'report'
        ? <OrdersReport />
        : <MenuBuilder />}
    </div>
  )
}
