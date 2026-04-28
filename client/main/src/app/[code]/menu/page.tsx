'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { api } from '@/lib/api'
import { outletConfig } from '@/lib/outletConfig'
import type { MenuItem, MenuCategory } from '@/types/menu'
import MenuSearch from '@/components/menu/MenuSearch'
import MenuCategorySection from '@/components/menu/MenuCategorySection'
import Loader from '@/components/ui/Loader'

interface MenuGroup {
  category: MenuCategory
  items: MenuItem[]
}

function MenuComingSoon({ outletName, onBack }: { outletName: string; onBack: () => void }) {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center px-6 bg-gradient-to-b from-[#1A1A1A] to-[#000000] overflow-hidden">
      <motion.div
        className="absolute top-[5%] left-1/2 w-[400px] h-[400px] bg-[#E88C3A] opacity-10 blur-[130px] rounded-full pointer-events-none"
        style={{ x: '-50%' }}
        animate={{ scale: [1, 1.08, 1], x: ['-50%', '-48%', '-52%', '-50%'], y: [0, 15, -10, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
        className="relative z-10 w-full max-w-sm flex flex-col items-center text-center"
      >
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
          className="w-20 h-20 rounded-full bg-gradient-to-b from-[#F2A65A] via-[#E88C3A] to-[#D96A1D] flex items-center justify-center mb-6 shadow-[0_0_32px_rgba(232,140,58,0.35)]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8h1a4 4 0 0 1 0 8h-1"/>
            <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
            <line x1="6" y1="1" x2="6" y2="4"/>
            <line x1="10" y1="1" x2="10" y2="4"/>
            <line x1="14" y1="1" x2="14" y2="4"/>
          </svg>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="font-extrabold text-2xl text-white mb-2 tracking-[0.3px]"
        >
          Menu Coming Soon
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.5 }}
          className="text-white/60 text-[14px] leading-relaxed mb-1"
        >
          We're preparing something delicious for
        </motion.p>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="text-[#E88C3A] text-[14px] font-semibold mb-8"
        >
          {outletName}. Stay tuned!
        </motion.p>

        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          whileHover={{ y: -2, scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          onClick={onBack}
          className="w-full h-[56px] flex items-center justify-center gap-2 rounded-full bg-[#EEEEEE] shadow-[0_6px_16px_rgba(0,0,0,0.12)] font-semibold text-[15px] text-[#1A1A1A]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E88C3A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          Back to Outlet
        </motion.button>
      </motion.div>
    </div>
  )
}

export default function MenuPage() {
  const params = useParams()
  const router = useRouter()
  const code = params.code as string
  const config = outletConfig[code]

  const [menuGroups, setMenuGroups] = useState<MenuGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [vegOnly, setVegOnly] = useState(false)

  useEffect(() => {
    if (!config?.hasMenu) {
      setLoading(false)
      return
    }
    api.get<MenuCategory[]>(`/menu/outlet/${code}`)
      .then((res) => {
        const groups: MenuGroup[] = res.data.map(cat => ({
          category: cat,
          items: cat.items || []
        }))
        setMenuGroups(groups)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [code, config?.hasMenu])

  if (!config?.hasMenu) {
    return (
      <MenuComingSoon
        outletName={config?.name ?? 'this outlet'}
        onBack={() => router.back()}
      />
    )
  }

  const filteredGroups = menuGroups.map((g) => ({
    ...g,
    items: g.items.filter((item) => {
      const matchesSearch = !search || item.name.toLowerCase().includes(search.toLowerCase())
      const matchesVeg = !vegOnly || item.isVeg
      return matchesSearch && matchesVeg
    }),
  }))

  return (
    <div className="relative min-h-screen flex flex-col items-center pt-8 px-4 bg-gradient-to-b from-[#1A1A1A] to-[#000000] overflow-x-hidden">

      <motion.div
        className="fixed top-[-5%] left-1/2 w-[350px] h-[350px] bg-[#E88C3A] opacity-10 blur-[130px] rounded-full pointer-events-none"
        style={{ x: '-50%' }}
        animate={{ scale: [1, 1.05, 1], x: ['-50%', '-48%', '-52%', '-50%'], y: [0, 15, -10, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />

      <main className="relative z-10 flex-1 w-full max-w-sm md:max-w-2xl lg:max-w-4xl mx-auto flex flex-col">

        <motion.div
           initial={{ scale: 0.9, opacity: 0 }}
           animate={{ scale: 1, opacity: 1 }}
           transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
           className="flex flex-col items-center pt-2"
        >
          <motion.div
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            whileHover={{ scale: 1.05 }}
            className="rounded-full shadow-[0_15px_35px_rgba(232,140,58,0.25)] ring-1 ring-white/10 mb-5 relative group"
          >
            <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 shadow-[0_0_25px_rgba(232,140,58,0.4)] transition-opacity duration-300 pointer-events-none" />
            <Avatar className="w-24 h-24 bg-[#1A1A1A]">
              <AvatarImage src="/images/logo/logo.jpg" alt="StoneOven" className="object-cover" />
              <AvatarFallback className="text-white text-2xl font-bold bg-[#1A1A1A]">SO</AvatarFallback>
            </Avatar>
          </motion.div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          className="font-extrabold text-2xl mb-1 text-center tracking-[0.5px]"
        >
          <span className="text-white">STONE</span>
          <motion.span
            animate={{ textShadow: ['0 0 4px rgba(232,140,58,0.1)', '0 0 12px rgba(232,140,58,0.4)', '0 0 4px rgba(232,140,58,0.1)'] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            style={{ background: 'linear-gradient(to right, #F2A65A, #E88C3A, #D96A1D)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
          >OVEN</motion.span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          className="text-white/70 text-[13px] mb-8 text-center font-medium"
        >
          Authentic flavours, crafted with love
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          className="flex items-center gap-3 mb-6"
        >
          <Link href={`/${code}`}>
            <motion.div
              whileHover={{ scale: 1.05, x: -3 }}
              whileTap={{ scale: 0.95 }}
              className="text-[#E88C3A] hover:text-[#F2A65A] transition-colors p-2 -ml-2 rounded-full cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6"/>
              </svg>
            </motion.div>
          </Link>
          <h1 className="text-2xl font-extrabold text-white tracking-[0.5px]">Our Menu</h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          className="mb-8 p-1 rounded-[20px] bg-white/5 backdrop-blur-md border border-white/10"
        >
          <MenuSearch value={search} onChange={setSearch} vegOnly={vegOnly} onVegToggle={() => setVegOnly(!vegOnly)} />
        </motion.div>

        <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ delay: 0.2, duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
           className="w-full flex-1"
        >
          {loading ? (
            <div className="flex justify-center py-10 w-full">
              <Loader />
            </div>
          ) : (
            <div className="space-y-6 pb-12">
              {filteredGroups.map((g) => (
                <div key={g.category.id} className="bg-white/5 backdrop-blur-md border border-white/5 rounded-[24px] p-5 shadow-[0_8px_24px_rgba(0,0,0,0.15)] content-layer">
                  <MenuCategorySection category={g.category} items={g.items} />
                </div>
              ))}
              {filteredGroups.every(g => g.items.length === 0) && (
                <div className="text-center py-12 text-white/50 text-sm">
                  No items found matching your search.
                </div>
              )}
            </div>
          )}
        </motion.div>
      </main>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.5 }}
        className="relative z-10 w-full text-center pb-8 pt-4 text-white/30 text-[11px] tracking-wide font-medium"
      >
        © 2026 UniCord. All rights reserved.
      </motion.div>
    </div>
  )
}
