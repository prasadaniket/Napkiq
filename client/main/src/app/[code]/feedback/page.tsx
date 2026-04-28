'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useDeviceFingerprint } from '@/hooks/useDeviceFingerprint'
import { useCustomer } from '@/hooks/useCustomer'
import { useOutlet } from '@/hooks/useOutlet'
import FeedbackForm from '@/components/form1/feedback'
import Loader from '@/components/ui/Loader'

export default function FeedbackPage() {
  const params = useParams()
  const router = useRouter()
  const code = params.code as string

  const { deviceId, loading: fpLoading } = useDeviceFingerprint()
  const { outlet, loading: outletLoading } = useOutlet(code)
  const { customer, loading: customerLoading } = useCustomer(deviceId)
  const [success, setSuccess] = useState(false)

  const loading = fpLoading || outletLoading || customerLoading

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#1A1A1A] to-[#000000]">
      <Loader />
    </div>
  )

  if (!outlet || !deviceId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#1A1A1A] to-[#000000]">
        <p className="text-white/50 text-lg">Unable to load form data</p>
      </div>
    )
  }

  const handleSuccess = () => {
    setSuccess(true)
    setTimeout(() => {
      router.push(`/${code}`)
    }, 2000)
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center pt-8 px-4 bg-gradient-to-b from-[#1A1A1A] to-[#000000] overflow-x-hidden">
      <motion.div
        className="fixed top-[-5%] left-1/2 w-[350px] h-[350px] bg-[#E88C3A] opacity-10 blur-[130px] rounded-full pointer-events-none"
        style={{ x: '-50%' }}
        animate={{
           scale: [1, 1.05, 1],
           x: ['-50%', '-48%', '-52%', '-50%'],
           y: [0, 15, -10, 0]
        }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />

      <main className="relative z-10 w-full max-w-md mx-auto flex flex-col">
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
          <h1 className="text-2xl font-extrabold text-white tracking-[0.5px]">Feedback</h1>
        </motion.div>

        <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ delay: 0.1, duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        >
          {customer?.hasSubmittedFirstReview ? (
            <div className="bg-[#111111] rounded-[28px] border border-white/5 p-10 text-center shadow-[0_15px_40px_rgba(0,0,0,0.5)]">
              <div className="flex justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#E88C3A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Already Submitted</h3>
              <p className="text-white/50 text-[13px] font-medium leading-relaxed mb-6">
                You've already filled out your first visit form.<br />Want to share another experience?
              </p>
              <Link href={`/${code}/review`}>
                <motion.div
                  whileHover={{ y: -2, scale: 1.01 }}
                  whileTap={{ scale: 0.97 }}
                  className="w-full bg-gradient-to-b from-[#F2A65A] via-[#E88C3A] to-[#D96A1D] text-white font-bold text-[15px] py-3.5 rounded-[14px] shadow-[0_8px_20px_rgba(232,140,58,0.2)] transition-shadow duration-300"
                >
                  Share Your Experience
                </motion.div>
              </Link>
            </div>
          ) : success ? (
            <div className="bg-[#111111] rounded-[28px] border border-white/5 p-8 text-center shadow-[0_15px_40px_rgba(0,0,0,0.5)]">
              <h3 className="text-2xl font-bold text-white mb-2">Thank You!</h3>
              <p className="text-white/60 mb-6 font-medium">Your feedback has been successfully submitted.</p>
              <Loader />
            </div>
          ) : (
            <FeedbackForm outlet={outlet} deviceId={deviceId} onSuccess={handleSuccess} />
          )}
        </motion.div>
      </main>

      {(outlet.instagramUrl || outlet.facebookUrl) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="mt-auto relative z-10 w-full flex flex-col items-center gap-4 pb-8 pt-8"
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
          className="mt-auto relative z-10 w-full text-center pb-8 pt-8 text-white/30 text-[11px] tracking-wide font-medium"
        >
          © 2026 UniCord. All rights reserved.
        </motion.div>
      )}
    </div>
  )
}
