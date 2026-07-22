'use client'

import React, { useState } from 'react'
import { Shield, Lock, ShieldCheck, FileText, Sparkles, KeyRound, Bell, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'

export default function VaultPage() {
  const [notified, setNotified] = useState(false)
  const [emailInput, setEmailInput] = useState('')

  const handleNotifyMe = (e: React.FormEvent) => {
    e.preventDefault()
    if (!emailInput.trim()) {
      toast.error('Please enter your email address')
      return
    }
    setNotified(true)
    toast.success('You will be notified as soon as Vault launches!')
  }

  return (
    <div className="min-h-[85vh] bg-[#FAF9F6] p-6 lg:p-8 flex flex-col justify-center items-center text-slate-800">
      <div className="max-w-2xl w-full bg-white rounded-3xl p-8 sm:p-12 border border-slate-200/80 shadow-xl text-center space-y-8 relative overflow-hidden">
        
        {/* Decorative background glow */}
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-[#D64238]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-slate-900/5 rounded-full blur-3xl pointer-events-none" />

        {/* Lock Badge */}
        <div className="relative inline-block">
          <div className="w-20 h-20 rounded-3xl bg-[#D64238]/10 text-[#D64238] border border-[#D64238]/20 flex items-center justify-center mx-auto shadow-xs">
            <Lock className="w-10 h-10" />
          </div>
          <span className="absolute -bottom-2 -right-2 bg-slate-900 text-white text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm border border-white">
            Locked
          </span>
        </div>

        {/* Title & Description */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200/80 text-amber-800 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Feature In Active Development
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Restaurant Vault is Coming Soon
          </h1>

          <p className="text-sm text-slate-500 max-w-lg mx-auto leading-relaxed">
            We are engineering a zero-knowledge encrypted repository for your restaurant legal licenses, GST filings, trade agreements, and direct MeitY DigiLocker government integration.
          </p>
        </div>

        {/* Feature Teasers */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left border-t border-b border-slate-100 py-6">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/60 space-y-1.5">
            <ShieldCheck className="w-5 h-5 text-[#D64238]" />
            <div className="text-xs font-bold text-slate-900">DigiLocker Direct API</div>
            <div className="text-[11px] text-slate-500 leading-snug">Sync FSSAI & GST certificates automatically from government portals.</div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/60 space-y-1.5">
            <KeyRound className="w-5 h-5 text-[#D64238]" />
            <div className="text-xs font-bold text-slate-900">Owner PIN Security</div>
            <div className="text-[11px] text-slate-500 leading-snug">Isolated PIN password protection with OTP phone verification.</div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/60 space-y-1.5">
            <FileText className="w-5 h-5 text-[#D64238]" />
            <div className="text-xs font-bold text-slate-900">Expiry Tracking</div>
            <div className="text-[11px] text-slate-500 leading-snug">Automated alerts before health, fire, and municipal licenses lapse.</div>
          </div>
        </div>

        {/* Early Access Notification Form */}
        <div className="bg-slate-900 text-white p-6 rounded-2xl space-y-3">
          <div className="flex items-center justify-center gap-2 text-xs font-bold tracking-wider uppercase text-slate-300">
            <Bell className="w-4 h-4 text-[#D64238]" /> Get Early Access Notification
          </div>

          {notified ? (
            <div className="p-3 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs font-bold">
              ✓ You're on the early access list! We'll notify you when Vault unlocks.
            </div>
          ) : (
            <form onSubmit={handleNotifyMe} className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
              <input
                type="email"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="Enter your work email address"
                className="flex-1 px-3.5 py-2.5 bg-slate-800 text-white text-xs rounded-xl border border-slate-700 focus:outline-hidden focus:border-[#D64238]"
              />
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-[#D64238] hover:bg-[#B82E25] text-white text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1.5"
              >
                Notify Me <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          )}

          <div className="text-[10px] text-slate-400 font-medium pt-1">
            Napkiq • <span className="text-slate-300 font-normal">Powered by UniCord Tech</span>
          </div>
        </div>

      </div>
    </div>
  )
}
