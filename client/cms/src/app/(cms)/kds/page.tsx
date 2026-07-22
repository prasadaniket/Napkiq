'use client'

import { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import KitchenBoard from '@/components/orders/KitchenBoard'
import OrdersReport from '@/components/orders/OrdersReport'
import MenuBuilder from '@/components/orders/MenuBuilder'
import gsap from 'gsap'

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

  const containerRef = useRef<HTMLDivElement>(null)
  const pillRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const updatePill = () => {
      if (!containerRef.current || !pillRef.current) return
      const activeBtn = containerRef.current.querySelector('.active-tab-btn') as HTMLElement | null
      
      if (activeBtn) {
        const parentRect = containerRef.current.getBoundingClientRect()
        const btnRect = activeBtn.getBoundingClientRect()

        const left = btnRect.left - parentRect.left
        const top = btnRect.top - parentRect.top
        const width = btnRect.width
        const height = btnRect.height

        const currentOpacity = gsap.getProperty(pillRef.current, 'opacity')
        if (currentOpacity === 0) {
          gsap.set(pillRef.current, { left, top, width, height })
        }

        gsap.to(pillRef.current, {
          left,
          top,
          width,
          height,
          opacity: 1,
          duration: 0.35,
          ease: 'power3.out',
          overwrite: 'auto'
        })
      }
    }

    // Run layout measuring immediately
    updatePill()

    window.addEventListener('resize', updatePill)
    return () => window.removeEventListener('resize', updatePill)
  }, [activeTab])

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 12, paddingBottom: 0, position: 'relative', zIndex: 20 }}>
        <div 
          ref={containerRef} 
          style={{ 
            display: 'inline-flex', 
            gap: 4, 
            background: '#f1f5f9', 
            padding: 4, 
            borderRadius: 12,
            position: 'relative'
          }}
        >
          {/* Sliding active indicator pill */}
          <div
            ref={pillRef}
            style={{
              position: 'absolute',
              background: '#ffffff',
              borderRadius: 9,
              boxShadow: '0 1px 3px rgba(0,2,29,0.08)',
              pointerEvents: 'none',
              zIndex: 0,
              opacity: 0,
            }}
          />

          {tabs.map(([key, label]) => {
            const active = activeTab === key
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={active ? 'active-tab-btn' : ''}
                style={{
                  padding: '7px 18px',
                  borderRadius: 9,
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  position: 'relative',
                  zIndex: 1,
                  background: 'transparent',
                  color: active ? '#D64238' : 'rgba(0,2,29,0.5)',
                  transition: 'color .3s ease',
                  outline: 'none',
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
