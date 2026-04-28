'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { api } from '@/lib/api'
import { useDeviceFingerprint } from '@/hooks/useDeviceFingerprint'
import { useCustomer } from '@/hooks/useCustomer'
import { useOutlet } from '@/hooks/useOutlet'
import Loader from '@/components/ui/Loader'

export default function OutletPage() {
  const params = useParams()
  const code = params.code as string

  const { deviceId, loading: fpLoading } = useDeviceFingerprint()
  const { outlet, loading: outletLoading } = useOutlet(code)
  const { customer, loading: customerLoading, setCustomer } = useCustomer(deviceId)
  const [visitRecorded, setVisitRecorded] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (!deviceId || !outlet || visitRecorded) return
    const sessionKey = `so_visit_${outlet.id}`
    if (sessionStorage.getItem(sessionKey)) {
      setVisitRecorded(true)
      return
    }
    api.post('/visits', { deviceId, outletId: outlet.id, visitType: 'qr_scan' })
      .catch(console.error)
      .finally(() => {
        sessionStorage.setItem(sessionKey, '1')
        setVisitRecorded(true)
      })
  }, [deviceId, outlet, visitRecorded])

  const handleFormSuccess = () => {
    if (deviceId) {
      api.get(`/customers/by-device/${deviceId}`)
        .then((res) => setCustomer(res.data))
        .catch(console.error)
    }
    setRefreshKey((k) => k + 1)
  }

  const loading = fpLoading || outletLoading || customerLoading

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#1A1A1A] to-[#000000]">
      <Loader />
    </div>
  )

  if (!outlet) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#1A1A1A] to-[#000000]">
        <p className="text-white/50 text-lg">Outlet not found</p>
      </div>
    )
  }

  const showOngoingForm = customer && customer.hasSubmittedFirstReview

  return (
    <div className="relative min-h-screen flex flex-col items-center pt-10 px-6 bg-gradient-to-b from-[#1A1A1A] to-[#000000] overflow-x-hidden">

      <motion.div
        className="absolute top-[5%] left-1/2 w-[400px] h-[400px] bg-[#E88C3A] opacity-10 blur-[130px] rounded-full pointer-events-none"
        style={{ x: '-50%' }}
        animate={{
           scale: [1, 1.05, 1],
           x: ['-50%', '-48%', '-52%', '-50%'],
           y: [0, 15, -10, 0]
        }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />

      <main className="relative z-10 flex-1 w-full max-w-sm md:max-w-md lg:max-w-lg mx-auto flex flex-col pt-4 pb-10">

        <motion.div
           initial={{ scale: 0.9, opacity: 0 }}
           animate={{ scale: 1, opacity: 1 }}
           transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
           className="flex flex-col items-center mb-6"
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

          <h1 className="font-extrabold text-2xl mb-1 text-center tracking-[0.5px]">
            <span className="text-white">STONE</span>
            <motion.span
              animate={{ textShadow: ['0 0 4px rgba(232,140,58,0.1)', '0 0 12px rgba(232,140,58,0.4)', '0 0 4px rgba(232,140,58,0.1)'] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                background: 'linear-gradient(to right, #F2A65A, #E88C3A, #D96A1D)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >OVEN</motion.span>
          </h1>
          <p className="text-white/70 text-[13px] text-center font-medium">
            Authentic flavours, crafted with love
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          className="text-center mb-8"
        >
          <p className="text-white font-bold text-lg">{outlet.name}</p>
          <p className="text-[#E88C3A] text-sm mt-1 opacity-80">{outlet.location}</p>
        </motion.div>

        <div className="w-full flex flex-col gap-4 mb-10">

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          >
            <Link href={`/${code}/menu`} className="block w-full">
              <motion.div
                whileHover={{ y: -3, scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                className="relative overflow-hidden w-full h-[64px] flex flex-col items-center justify-center rounded-full transition-shadow duration-300 bg-gradient-to-b from-[#F2A65A] via-[#E88C3A] to-[#D96A1D] shadow-[0_0_16px_rgba(232,140,58,0.3)] hover:shadow-[0_0_24px_rgba(232,140,58,0.4)] border border-white/10"
              >
                <span className="relative z-10 font-bold text-[17px] tracking-wide text-white mb-0.5">
                  View Menu
                </span>
                <span className="relative z-10 text-[11px] font-medium text-white/90">
                  Explore our dishes & pricing
                </span>
              </motion.div>
            </Link>
          </motion.div>

          {outlet.googleMapsUrl && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.30, duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
            >
              <motion.a
                whileHover={{ y: -3, scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                href={outlet.googleMapsUrl} target="_blank" rel="noopener noreferrer"
                className="w-full h-[60px] flex items-center justify-center gap-2.5 rounded-full bg-[#EEEEEE] shadow-[0_6px_16px_rgba(0,0,0,0.12)] border border-transparent transition-shadow duration-300"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E88C3A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                <span className="font-semibold text-[15px] tracking-wide text-[#1A1A1A]">Get Directions</span>
              </motion.a>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          >
            {showOngoingForm ? (
              <div className="w-full flex flex-col items-center justify-center px-6 py-3.5 rounded-[32px] bg-[#EEEEEE]/40 border border-dashed border-white/10 cursor-not-allowed">
                <div className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#E88C3A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  <span className="font-bold text-[15px] tracking-wide text-[#1A1A1A]/40">Your First Visit</span>
                </div>
                <span className="text-[11px] text-[#E88C3A]/70 font-medium mt-0.5">Already submitted — thank you!</span>
              </div>
            ) : (
              <Link href={`/${code}/feedback`} className="block w-full">
                <motion.div
                  whileHover={{ y: -3, scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  className="w-full flex flex-col items-center justify-center px-6 py-3.5 rounded-[32px] bg-[#EEEEEE] shadow-[0_6px_16px_rgba(0,0,0,0.12)] border border-transparent transition-shadow duration-300"
                >
                  <div className="flex flex-col items-center">
                    <span className="font-bold text-[16px] tracking-wide text-[#1A1A1A]">Your First Visit</span>
                    <span className="text-[12px] text-[#1A1A1A]/60 font-medium mt-0.5">Tell us how it went</span>
                  </div>
                </motion.div>
              </Link>
            )}
          </motion.div>

          {showOngoingForm && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.40, duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
            >
              <Link href={`/${code}/review`} className="block w-full">
                <motion.div
                  whileHover={{ y: -3, scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  className="w-full flex flex-col items-center justify-center px-6 py-3.5 rounded-[32px] bg-[#EEEEEE] shadow-[0_6px_16px_rgba(0,0,0,0.12)] border border-transparent transition-shadow duration-300"
                >
                  <div className="flex flex-col items-center">
                    <span className="font-bold text-[16px] tracking-wide text-[#1A1A1A]">Share Your Experience</span>
                    <span className="text-[12px] text-[#1A1A1A]/60 font-medium mt-0.5">Rate your visit and leave a review</span>
                  </div>
                </motion.div>
              </Link>
            </motion.div>
          )}
        </div>

      </main>

      {(outlet.instagramUrl || outlet.facebookUrl) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="relative z-10 w-full flex flex-col items-center gap-4 pb-6"
        >
          <p className="text-[11px] text-white/30 tracking-[0.2em] font-medium uppercase">Connect With Us</p>
          <div className="flex items-center gap-5">
            {outlet.instagramUrl && (
              <a href={outlet.instagramUrl} target="_blank" rel="noopener noreferrer" className="text-white/30 hover:text-white/60 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
              </a>
            )}
            {outlet.facebookUrl && (
              <a href={outlet.facebookUrl} target="_blank" rel="noopener noreferrer" className="text-white/30 hover:text-white/60 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
              </a>
            )}
          </div>
          <p className="text-[10px] text-white/20 tracking-wide font-medium">© 2026 UniCord. All rights reserved.</p>
        </motion.div>
      )}

      {!outlet.instagramUrl && !outlet.facebookUrl && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="relative z-10 w-full text-center pb-6 text-[10px] text-white/30 tracking-wide font-medium"
        >
          © 2026 UniCord. All rights reserved.
        </motion.div>
      )}
    </div>
  )
}
