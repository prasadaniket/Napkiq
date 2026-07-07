'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import BirthdaysPanel from '@/components/celebrations/BirthdaysPanel'
import AnniversariesPanel from '@/components/celebrations/AnniversariesPanel'

type Tab = 'birthdays' | 'anniversaries'

const TABS: [Tab, string][] = [
  ['birthdays', '🎂 Birthdays'],
  ['anniversaries', '💍 Anniversaries'],
]

// ─── Merged Celebrations page: birthdays + anniversaries as tabs ────────────────
export default function CelebrationsPage() {
  const searchParams = useSearchParams()
  const initial: Tab = searchParams.get('tab') === 'anniversaries' ? 'anniversaries' : 'birthdays'
  const [tab, setTab] = useState<Tab>(initial)

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 8, paddingBottom: 0 }}>
        <div style={{ display: 'inline-flex', gap: 4, background: '#f1f5f9', padding: 4, borderRadius: 12 }}>
          {TABS.map(([key, label]) => {
            const active = tab === key
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

      {tab === 'birthdays' ? <BirthdaysPanel /> : <AnniversariesPanel />}
    </div>
  )
}
