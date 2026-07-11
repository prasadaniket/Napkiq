'use client'

import { useSearchParams } from 'next/navigation'
import BirthdaysPanel from '@/components/celebrations/BirthdaysPanel'
import AnniversariesPanel from '@/components/celebrations/AnniversariesPanel'

type Tab = 'birthdays' | 'anniversaries'

export default function CelebrationsPage() {
  const searchParams = useSearchParams()
  const tab: Tab = searchParams.get('tab') === 'anniversaries' ? 'anniversaries' : 'birthdays'

  return (
    <div className="page-content relative overflow-hidden" style={{ padding: '24px 28px 32px', minHeight: 'calc(100vh - 80px)' }}>
      {/* Ambient luxury brand glow orbs */}
      <div className="absolute top-[-10%] left-[-15%] -z-10 h-[50vw] w-[50vw] rounded-full bg-gradient-to-tr from-red-100/5 to-amber-100/5 blur-[120px] animate-pulse duration-[8000ms] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-15%] -z-10 h-[40vw] w-[40vw] rounded-full bg-gradient-to-bl from-rose-100/5 to-orange-100/5 blur-[100px] animate-pulse duration-[10000ms] pointer-events-none" />

      <div className="space-y-6">
        {tab === 'birthdays' ? <BirthdaysPanel /> : <AnniversariesPanel />}
      </div>
    </div>
  )
}
