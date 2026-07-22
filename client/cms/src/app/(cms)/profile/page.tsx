'use client'

import React, { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import {
  User,
  Phone,
  Mail,
  Shield,
  Building2,
  Lock,
  Save,
  KeyRound,
  CheckCircle2,
  Sparkles,
  MapPin,
  Clock,
  Laptop,
  Check,
  ShieldCheck,
  BadgeCheck,
} from 'lucide-react'

interface StaffProfileData {
  id: string
  fullName: string
  email: string
  phone: string
  role: string
  isActive: boolean
  createdAt: string
  assignedOutlet?: {
    id: string
    name: string
    address?: string
    location?: string
  }
}

export default function ProfilePage() {
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState<'personal' | 'security' | 'permissions' | 'outlet'>('personal')

  const [profile, setProfile] = useState<StaffProfileData>({
    id: '',
    fullName: '',
    email: '',
    phone: '',
    role: 'owner',
    isActive: true,
    createdAt: new Date().toISOString(),
  })

  // Editable Form Inputs
  const [fullNameInput, setFullNameInput] = useState('')
  const [phoneInput, setPhoneInput] = useState('')
  const [emailInput, setEmailInput] = useState('')
  const [newPasswordInput, setNewPasswordInput] = useState('')
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('')

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      setLoading(true)
      const res = await api.get('/cms/profile')
      if (res.data.success) {
        const d = res.data.data
        setProfile(d)
        setFullNameInput(d.fullName || '')
        setPhoneInput(d.phone || '')
        setEmailInput(d.email || '')
      }
    } catch (err) {
      console.error('Failed to load staff profile:', err)
      toast.error('Could not load profile information')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!fullNameInput.trim()) {
      toast.error('Full Name is required')
      return
    }

    if (!emailInput.trim()) {
      toast.error('Email address is required')
      return
    }

    if (newPasswordInput && newPasswordInput !== confirmPasswordInput) {
      toast.error('New Password and Confirm Password do not match')
      return
    }

    try {
      setSubmitting(true)
      const res = await api.patch('/cms/profile', {
        fullName: fullNameInput.trim(),
        phone: phoneInput.trim(),
        email: emailInput.trim(),
        newPassword: newPasswordInput || undefined,
      })

      if (res.data.success) {
        toast.success('Account profile updated successfully!')
        setNewPasswordInput('')
        setConfirmPasswordInput('')
        fetchProfile()
      }
    } catch (err: any) {
      console.error('Profile update error:', err)
      toast.error(err.response?.data?.error || 'Failed to update profile')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] p-8 flex items-center justify-center">
        <div className="text-slate-400 font-medium text-xs animate-pulse">Loading Account Profile...</div>
      </div>
    )
  }

  const roleLabelFormatted =
    profile.role === 'admin'
      ? 'Admin · UniCord'
      : profile.role === 'owner'
      ? 'Restaurant Owner'
      : profile.role === 'franchise_owner'
      ? 'Franchise Owner'
      : profile.role

  return (
    <div className="min-h-screen bg-[#FAF9F6] p-6 lg:p-8 space-y-6 text-slate-800">
      
      {/* ── Hero Profile Overview Banner ────────────────────────────────────── */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#D64238]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-5">
            {/* Avatar Circle */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-[#D64238] to-[#B82E25] text-white font-extrabold text-2xl sm:text-3xl flex items-center justify-center shadow-md shrink-0">
              {profile.fullName.charAt(0) || 'U'}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                  {profile.fullName}
                </h1>
                <span className="px-3 py-0.5 text-[11px] font-extrabold tracking-wider uppercase rounded-full bg-[#D64238]/10 text-[#D64238] border border-[#D64238]/20 flex items-center gap-1">
                  <BadgeCheck className="w-3.5 h-3.5" />
                  {roleLabelFormatted}
                </span>
              </div>

              <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                <span className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-slate-400" /> {profile.email}
                </span>
                {profile.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400" /> {profile.phone}
                  </span>
                )}
                {profile.assignedOutlet && (
                  <span className="flex items-center gap-1 font-semibold text-slate-700">
                    <Building2 className="w-3.5 h-3.5 text-[#D64238]" /> {profile.assignedOutlet.name}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="px-3 py-1 text-xs font-semibold rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Account Active
            </span>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex items-center gap-2 border-t border-slate-100 pt-4 overflow-x-auto">
          <button
            onClick={() => setActiveTab('personal')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'personal'
                ? 'bg-[#D64238] text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <User className="w-3.5 h-3.5" /> Personal Details
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'security'
                ? 'bg-[#D64238] text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" /> Security & Password
          </button>

          <button
            onClick={() => setActiveTab('permissions')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'permissions'
                ? 'bg-[#D64238] text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" /> Role Permissions
          </button>

          <button
            onClick={() => setActiveTab('outlet')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'outlet'
                ? 'bg-[#D64238] text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" /> Assigned Outlet
          </button>
        </div>
      </div>

      {/* ── Main Tab Content ────────────────────────────────────────────────── */}
      <form onSubmit={handleSaveProfile}>
        
        {/* TAB 1: PERSONAL DETAILS */}
        {activeTab === 'personal' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-xs space-y-6">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <User className="w-4 h-4 text-[#D64238]" /> Personal Information
                </h2>
                <p className="text-xs text-slate-500 mt-1">Update your primary contact credentials and account details.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Full Name <span className="text-[#D64238]">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      value={fullNameInput}
                      onChange={(e) => setFullNameInput(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-[#D64238]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Phone Number <span className="text-[#D64238]">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="tel"
                      required
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-[#D64238]"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Email Address <span className="text-[#D64238]">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="email"
                      required
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-[#D64238]"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-[#D64238] hover:bg-[#B82E25] text-white text-xs font-bold shadow-xs transition-all flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {submitting ? 'Saving Profile...' : 'Save Changes'}
                </button>
              </div>
            </div>

            {/* Side Card */}
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">Account Overview</h3>
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Staff ID</span>
                    <span className="font-mono text-slate-900 font-bold">{profile.id.slice(0, 8)}...</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Role Title</span>
                    <span className="font-bold text-slate-900 capitalize">{profile.role.replace('_', ' ')}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Member Since</span>
                    <span className="font-semibold text-slate-700">
                      {profile.createdAt ? format(new Date(profile.createdAt), 'MMM dd, yyyy') : 'Recently'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xs space-y-2 text-center">
                <div className="text-xs font-bold tracking-widest text-[#D64238] uppercase">NAPKIQ ENTERPRISE</div>
                <div className="text-xs text-slate-300 font-medium">Powered by UniCord Tech</div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SECURITY & PASSWORD */}
        {activeTab === 'security' && (
          <div className="max-w-2xl bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-xs space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#D64238]" /> Authentication & Password
              </h2>
              <p className="text-xs text-slate-500 mt-1">Change your Supabase-authenticated login password.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-[#D64238]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    value={confirmPasswordInput}
                    onChange={(e) => setConfirmPasswordInput(e.target.value)}
                    placeholder="Repeat new password"
                    className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-[#D64238]"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 rounded-xl bg-[#D64238] hover:bg-[#B82E25] text-white text-xs font-bold shadow-xs transition-all flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {submitting ? 'Updating Password...' : 'Update Password'}
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: ROLE PERMISSIONS */}
        {activeTab === 'permissions' && (
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-xs space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#D64238]" /> Role Privilege Breakdown
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Your account is registered as <strong className="text-slate-800 capitalize">{roleLabelFormatted}</strong>.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/60 space-y-1">
                <div className="flex items-center gap-2 font-bold text-xs text-slate-900">
                  <Check className="w-4 h-4 text-emerald-600" /> Full CMS Analytics
                </div>
                <p className="text-[11px] text-slate-500">Access revenue graphs, visit counts, and review metrics.</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/60 space-y-1">
                <div className="flex items-center gap-2 font-bold text-xs text-slate-900">
                  <Check className="w-4 h-4 text-emerald-600" /> Menu & KDS Operations
                </div>
                <p className="text-[11px] text-slate-500">Manage menu pricing, category availability, and KDS orders.</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/60 space-y-1">
                <div className="flex items-center gap-2 font-bold text-xs text-slate-900">
                  <Check className="w-4 h-4 text-emerald-600" /> Restaurant Vault Storage
                </div>
                <p className="text-[11px] text-slate-500">Full upload and document encryption PIN management.</p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: ASSIGNED OUTLET */}
        {activeTab === 'outlet' && (
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-xs space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#D64238]" /> Assigned Restaurant Outlet
              </h2>
              <p className="text-xs text-slate-500 mt-1">Primary restaurant branch associated with your staff account.</p>
            </div>

            {profile.assignedOutlet ? (
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="text-lg font-bold text-slate-900">{profile.assignedOutlet.name}</div>
                {profile.assignedOutlet.address && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <MapPin className="w-4 h-4 text-[#D64238]" /> {profile.assignedOutlet.address}
                  </div>
                )}
                {profile.assignedOutlet.location && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <MapPin className="w-4 h-4 text-[#D64238]" /> {profile.assignedOutlet.location}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-500 text-center">
                All Outlets Master Access (Global Administrator)
              </div>
            )}
          </div>
        )}

      </form>

    </div>
  )
}
