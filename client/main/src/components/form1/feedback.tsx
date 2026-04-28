'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import { api } from '@/lib/api'
import { copyToClipboard } from '@/lib/clipboard'
import { firstVisitFormSchema, type FirstVisitFormData } from '@/lib/validators'
import Modal from '@/components/ui/Modal'
import type { Outlet } from '@/types/outlet'

interface Props {
  outlet: Outlet
  deviceId: string
  onSuccess: () => void
}

export default function FeedbackForm({ outlet, deviceId, onSuccess }: Props) {
  const [submitting, setSubmitting] = useState(false)
  const [showGooglePopup, setShowGooglePopup] = useState(false)
  const [stars, setStars] = useState(0)
  const [hoveredStar, setHoveredStar] = useState(0)

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FirstVisitFormData>({
    resolver: zodResolver(firstVisitFormSchema),
    defaultValues: { maritalStatus: '' as any, gender: '' as any },
  })

  const maritalStatus = watch('maritalStatus')

  const onSubmit = async (data: FirstVisitFormData) => {
    setSubmitting(true)
    try {
      const customerRes = await api.post('/customers', {
        deviceId,
        fullName: data.fullName,
        phone: data.phone,
        email: data.email || null,
        birthDate: data.birthDate,
        anniversaryDate: data.anniversaryDate || null,
        gender: data.gender,
        maritalStatus: data.maritalStatus,
        firstVisitOutletId: outlet.id,
      })

      await api.post('/reviews', {
        customerId: customerRes.data.id,
        outletId: outlet.id,
        stars: data.stars,
        reviewText: data.reviewText || '',
        reviewType: 'first_visit',
      })

      if (data.reviewText) {
        await copyToClipboard(data.reviewText)
        toast.success('Review copied to clipboard!')
      }

      setShowGooglePopup(true)
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Submission failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleGoogleReview = () => {
    const reviewUrl = outlet.googleMapsUrl
    if (reviewUrl) {
      window.open(reviewUrl, '_blank', 'noopener,noreferrer')
    }
    setShowGooglePopup(false)
    onSuccess()
  }

  const inputStyles = "w-full bg-[#1A1A1A] border border-white/10 rounded-[12px] px-4 py-3 text-[14px] text-white placeholder-white/20 focus:outline-none focus:border-[#E88C3A] focus:ring-1 focus:ring-[#E88C3A]/50 transition-all shadow-inner"
  const labelStyles = "block text-[13px] font-medium text-white/70 mb-1.5 ml-1"
  const errorStyles = "mt-1 ml-1 text-[12px] text-red-400"

  return (
    <>
      <div className="bg-[#111111] rounded-[28px] shadow-[0_15px_40px_rgba(0,0,0,0.5)] p-6 border border-white/5 relative overflow-hidden">
        
        {/* Subtle internal gradient/glow for premium depth */}
        <div className="absolute top-0 left-0 w-full h-[200px] bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />

        <div className="relative z-10 text-center mb-8">
          <h2 className="text-[20px] font-bold text-white mb-1 tracking-wide">
            Share Your Experience
          </h2>
          <p className="text-[13px] text-white/50 font-medium tracking-wide">
            First visit? Tell us about yourself!
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="relative z-10 space-y-5">
          
          <div>
            <label className={labelStyles}>Full Name <span className="text-[#E88C3A]">*</span></label>
            <input {...register('fullName')} className={inputStyles} placeholder="Your full name" />
            {errors.fullName && <p className={errorStyles}>{errors.fullName.message}</p>}
          </div>

          <div>
            <label className={labelStyles}>Phone Number <span className="text-[#E88C3A]">*</span></label>
            <input
              type="tel"
              {...register('phone')}
              className={inputStyles}
              placeholder="10-digit mobile number"
              maxLength={10}
              onInput={(e) => {
                const input = e.currentTarget
                input.value = input.value.replace(/\D/g, '').slice(0, 10)
              }}
            />
            {errors.phone && <p className={errorStyles}>{errors.phone.message}</p>}
          </div>

          <div>
            <label className={labelStyles}>Email <span className="text-[#E88C3A]">*</span></label>
            <input type="email" {...register('email')} className={inputStyles} placeholder="your@email.com" />
            {errors.email && <p className={errorStyles}>{errors.email.message}</p>}
          </div>

          <div>
            <label className={labelStyles}>Date of Birth <span className="text-[#E88C3A]">*</span></label>
            <input type="date" {...register('birthDate')} className={inputStyles} style={{ colorScheme: 'dark' }} />
            {errors.birthDate && <p className={errorStyles}>{errors.birthDate.message}</p>}
          </div>

          <div>
            <label className={labelStyles}>Marital Status <span className="text-[#E88C3A]">*</span></label>
            <select {...register('maritalStatus')} className={`${inputStyles} appearance-none`}>
              <option value="" disabled>Select</option>
              <option value="Married" className="bg-[#1A1A1A]">Married</option>
              <option value="Unmarried" className="bg-[#1A1A1A]">Unmarried</option>
            </select>
            {errors.maritalStatus && <p className={errorStyles}>{errors.maritalStatus.message}</p>}
          </div>

          {maritalStatus === 'Married' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
              <label className={labelStyles}>Anniversary Date <span className="text-[#E88C3A]">*</span></label>
              <input type="date" {...register('anniversaryDate')} className={inputStyles} style={{ colorScheme: 'dark' }} />
              {errors.anniversaryDate && <p className={errorStyles}>{errors.anniversaryDate.message}</p>}
            </motion.div>
          )}

          <div>
            <label className={labelStyles}>Gender <span className="text-[#E88C3A]">*</span></label>
            <select {...register('gender')} className={`${inputStyles} appearance-none`}>
              <option value="" disabled>Select</option>
              <option value="Male" className="bg-[#1A1A1A]">Male</option>
              <option value="Female" className="bg-[#1A1A1A]">Female</option>
              <option value="Transgender" className="bg-[#1A1A1A]">Transgender</option>
              <option value="RatherNotSay" className="bg-[#1A1A1A]">Rather not say</option>
            </select>
            {errors.gender && <p className={errorStyles}>{errors.gender.message}</p>}
          </div>

          {/* STAR RATING */}
          <div className="flex flex-col items-center pt-4">
            <p className="text-[14px] font-medium text-white/80 mb-3">Rate Your Experience <span className="text-[#E88C3A]">*</span></p>
            <div className="flex gap-2 justify-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <motion.button
                  key={star}
                  type="button"
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => { setStars(star); setValue('stars', star) }}
                  onMouseEnter={() => setHoveredStar(star)}
                  onMouseLeave={() => setHoveredStar(0)}
                  className="relative p-1 focus:outline-none"
                >
                  <svg 
                    className={`w-9 h-9 transition-colors duration-200 ${
                      (hoveredStar || stars) >= star 
                        ? 'text-[#F2A65A] drop-shadow-[0_0_8px_rgba(232,140,58,0.5)]' 
                        : 'text-white/20'
                    }`} 
                    fill="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                  </svg>
                </motion.button>
              ))}
            </div>
            {errors.stars && <p className={errorStyles}>{errors.stars.message}</p>}
          </div>

          {/* REVIEW INPUT */}
          <div className="pt-2">
            <label className={labelStyles}>Share Your Experience <span className="text-white/30">(Optional)</span></label>
            <textarea
              {...register('reviewText')}
              rows={4}
              className={`${inputStyles} resize-none`}
              placeholder="Share your dining experience..."
            />
            {errors.reviewText && <p className={errorStyles}>{errors.reviewText.message}</p>}
          </div>

          {/* SUBMIT BUTTON */}
          <div className="pt-4">
            <motion.button
              type="submit"
              disabled={submitting}
              whileHover={{ y: -2, scale: 1.01 }}
              whileTap={{ scale: 0.97 }}
              className="w-full bg-gradient-to-b from-[#F2A65A] via-[#E88C3A] to-[#D96A1D] text-white font-bold text-[16px] py-4 rounded-[16px] shadow-[0_8px_20px_rgba(232,140,58,0.2)] hover:shadow-[0_12px_28px_rgba(232,140,58,0.35)] transition-shadow duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting...' : 'Submit Feedback'}
            </motion.button>
          </div>
        </form>
      </div>

      {/* GOOGLE POPUP MODAL */}
      <Modal isOpen={showGooglePopup} onClose={() => { setShowGooglePopup(false); onSuccess() }}>
        <div className="text-center p-2">
          <h3 className="text-2xl font-bold text-[#1A1A1A] mb-2">Thank you! 🎉</h3>
          <p className="text-[#1A1A1A]/70 text-[14px] mb-6 leading-relaxed">
            Your review has been copied to clipboard. Help us grow by posting it on Google!
          </p>
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleGoogleReview} 
            className="w-full bg-gradient-to-b from-[#F2A65A] to-[#D96A1D] text-white font-bold py-3.5 rounded-[16px] shadow-[0_8px_20px_rgba(232,140,58,0.3)] mb-4"
          >
            Open Google Reviews
          </motion.button>
          <button onClick={() => { setShowGooglePopup(false); onSuccess() }} className="text-[13px] font-medium text-[#1A1A1A]/50 hover:text-[#1A1A1A] transition-colors underline underline-offset-4">
            Skip for now
          </button>
        </div>
      </Modal>
    </>
  )
}
