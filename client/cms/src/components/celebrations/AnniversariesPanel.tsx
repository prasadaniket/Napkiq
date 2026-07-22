'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { format } from 'date-fns'
import { Search, Heart, MessageSquare, Calendar, ChevronRight, Sparkles, Clock, CheckCircle, AlertTriangle } from 'lucide-react'

interface AnniversaryCustomer {
  id: string
  fullName: string
  phone: string
  email: string | null
  anniversaryDate: string
  firstVisitOutlet: { name: string; code: string } | null
  message5DaysStatus: 'send' | 'pending'
  message1DayStatus: 'send' | 'pending'
}

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(' ')
  const ini = (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-xs font-black uppercase text-rose-500 border border-rose-100 shadow-sm transition-transform duration-300 group-hover:scale-105">
      {ini.toUpperCase()}
    </div>
  )
}

function StatusBadge({ status, label }: { status: 'send' | 'pending'; label: string }) {
  const isSend = status === 'send'
  return (
    <div className={`flex flex-col gap-1 p-2.5 rounded-xl border ${
      isSend ? 'bg-emerald-50/40 border-emerald-100/60' : 'bg-amber-50/30 border-amber-100/40'
    }`}>
      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
      <div className="flex items-center gap-1.5 mt-0.5">
        <span className={`h-1.5 w-1.5 rounded-full ${isSend ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
        <span className={`text-xs font-bold ${isSend ? 'text-emerald-700' : 'text-amber-700'}`}>
          {isSend ? 'Delivered' : 'Pending'}
        </span>
      </div>
    </div>
  )
}

export default function AnniversariesPage() {
  const { user, isOwnerOrAbove } = useAuth()
  const searchParams = useSearchParams()
  const router = useRouter()

  const [customers, setCustomers] = useState<AnniversaryCustomer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'sent' | 'pending'>('all')

  const outletId = searchParams.get('outletId') ?? ''

  const fetchAnniversaries = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(false)
    try {
      const q = new URLSearchParams()
      if (outletId) q.append('outletId', outletId)
      const res = await api.get<AnniversaryCustomer[]>(`/cms/customers/anniversaries?${q.toString()}`)
      setCustomers(res.data)
    } catch {
      setError(true)
      setCustomers([])
    } finally {
      setLoading(false)
    }
  }, [user, outletId])

  useEffect(() => {
    fetchAnniversaries()
  }, [fetchAnniversaries])

  // Filter logic
  const filteredCustomers = customers.filter(c => {
    const matchesSearch = c.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c.phone.includes(searchTerm) || 
                          (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const sentCount = (c.message5DaysStatus === 'send' ? 1 : 0) + (c.message1DayStatus === 'send' ? 1 : 0);
    const matchesFilter = 
      statusFilter === 'all' ? true :
      statusFilter === 'sent' ? sentCount > 0 :
      sentCount === 0;
      
    return matchesSearch && matchesFilter;
  });

  // Calculate metrics
  const sentCount5d = customers.filter(c => c.message5DaysStatus === 'send').length
  const sentCount1d = customers.filter(c => c.message1DayStatus === 'send').length
  const totalSent = sentCount5d + sentCount1d
  const totalPending = (customers.length * 2) - totalSent

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-100 bg-white/80 backdrop-blur-md p-6 shadow-[0_8px_30px_rgb(0,0,0,0.015)] group">
        <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-rose-500/5 blur-2xl transition-opacity duration-300 group-hover:opacity-100 pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <button
              onClick={() => router.back()}
              className="group flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors bg-transparent border-none cursor-pointer mb-2 p-0 outline-none"
            >
              <span className="transition-transform group-hover:-translate-x-0.5">←</span> Go Back
            </button>
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-500">
                <Heart className="h-5.5 w-5.5 text-rose-500 fill-rose-500/20 animate-pulse" />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">Anniversaries This Month</h1>
            </div>
            <p className="text-xs font-medium text-slate-400 mt-1">
              {outletId ? 'Filtered by outlet · ' : ''}
              {!loading ? `${filteredCustomers.length} customer${filteredCustomers.length !== 1 ? 's' : ''} celebrating` : 'Loading anniversaries…'}
            </p>
          </div>
          
          <button 
            onClick={fetchAnniversaries} 
            className="self-start md:self-auto rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100 text-xs font-bold text-slate-700 px-4 py-2 transition-all cursor-pointer"
          >
            Refresh Campaigns
          </button>
        </div>
      </div>

      {/* KPI metrics row */}
      {!loading && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/80 backdrop-blur-sm border border-slate-100 p-4 rounded-2xl flex flex-col justify-between hover:shadow-sm transition-all">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Celebrating Total</span>
            <div className="text-2xl font-black text-slate-900 mt-2">{customers.length}</div>
            <p className="text-[10px] font-medium text-slate-400 mt-1">Customers with anniversary in current month</p>
          </div>

          <div className="bg-white/80 backdrop-blur-sm border border-slate-100 p-4 rounded-2xl flex flex-col justify-between hover:shadow-sm transition-all">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Vouchers Triggered</span>
            <div className="text-2xl font-black text-emerald-600 mt-2">{totalSent}</div>
            <p className="text-[10px] font-medium text-slate-400 mt-1">Delivered automated campaign messages</p>
          </div>

          <div className="bg-white/80 backdrop-blur-sm border border-slate-100 p-4 rounded-2xl flex flex-col justify-between hover:shadow-sm transition-all">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pending Deliveries</span>
            <div className="text-2xl font-black text-amber-500 mt-2">{totalPending}</div>
            <p className="text-[10px] font-medium text-slate-400 mt-1">Vouchers scheduled for delivery</p>
          </div>

          <div className="bg-rose-50/30 border border-rose-100/50 p-4 rounded-2xl flex flex-col justify-between hover:bg-rose-50/50 transition-colors">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 fill-rose-500/10" /> Marketing Insight
            </span>
            <p className="text-[10px] font-semibold text-rose-700 mt-2 leading-relaxed">
              Anniversary campaigns offer a <strong>31% higher order value</strong> when targeted to couples with custom promo packages.
            </p>
          </div>
        </div>
      )}

      {/* Filter and Search Section */}
      {!error && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/70 backdrop-blur-sm border border-slate-100 p-4 rounded-2xl">
          {/* Search bar */}
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by customer name or phone..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs border border-slate-100 rounded-xl bg-slate-50/50 focus:bg-white focus:border-rose-300/40 outline-none transition-all placeholder:text-slate-400 font-medium"
            />
          </div>

          {/* Status selector tabs */}
          <div className="flex p-0.5 bg-slate-50 border border-slate-100 rounded-xl select-none w-full sm:w-auto">
            <button
              onClick={() => setStatusFilter('all')}
              className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-800 shadow-sm border border-slate-200/10'
                  : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('sent')}
              className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer ${
                statusFilter === 'sent'
                  ? 'bg-white text-emerald-600 shadow-sm border border-slate-200/10'
                  : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              Delivered
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer ${
                statusFilter === 'pending'
                  ? 'bg-white text-amber-500 shadow-sm border border-slate-200/10'
                  : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              Pending
            </button>
          </div>
        </div>
      )}

      {/* Main content list */}
      <div className="bg-white/80 backdrop-blur-md border border-slate-100 rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.015)]">
        {loading && (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse h-16 bg-slate-50 border border-slate-100 rounded-2xl" />
            ))}
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-rose-500 mb-3">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h4 className="text-sm font-extrabold text-slate-800">Failed to Load Anniversaries</h4>
            <span className="text-xs font-semibold text-slate-400 mt-1">There was a database error connection. Please refresh.</span>
          </div>
        )}

        {!loading && !error && filteredCustomers.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 mb-3">
              <Heart className="h-6 w-6" />
            </div>
            <h4 className="text-sm font-extrabold text-slate-800">No Anniversaries Found</h4>
            <span className="text-xs font-semibold text-slate-400 mt-1">
              {searchTerm || statusFilter !== 'all' 
                ? 'No celebrating customers match your active search filters.'
                : 'No anniversaries registered in the system for this month.'
              }
            </span>
          </div>
        )}

        {!loading && !error && filteredCustomers.length > 0 && (
          <div className="space-y-3">
            {filteredCustomers.map(c => (
              <div 
                key={c.id} 
                className="group flex flex-col md:flex-row md:items-center justify-between gap-4 p-4.5 rounded-2xl border border-slate-100 bg-white hover:bg-slate-50/45 hover:shadow-md hover:border-slate-200/80 transition-all duration-300"
              >
                {/* Profile column */}
                <div className="flex items-center gap-3.5 md:w-[30%] min-w-0">
                  <Initials name={c.fullName} />
                  <div className="min-w-0">
                    <Link href={`/customers/${c.id}`} className="block truncate text-sm font-black text-rose-500 hover:text-rose-600 hover:underline no-underline">
                      {c.fullName}
                    </Link>
                    <div className="text-[11px] font-semibold text-slate-400 mt-0.5">{c.phone}</div>
                    {c.email && (
                      <div className="text-[10px] font-medium text-slate-400 truncate max-w-[200px]" title={c.email}>
                        {c.email}
                      </div>
                    )}
                  </div>
                </div>

                {/* Celebration date column */}
                <div className="flex items-center gap-2 md:w-[20%]">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-500 border border-rose-100/60">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="block text-[9px] font-extrabold uppercase tracking-wider text-slate-400">Celebration Date</span>
                    <span className="block text-xs font-black text-slate-700 mt-0.5">
                      {format(new Date(c.anniversaryDate), 'dd MMMM')}
                    </span>
                  </div>
                </div>

                {/* Campaign progress columns */}
                <div className="grid grid-cols-2 gap-3 md:w-[32%] py-2 md:py-0 border-t border-b md:border-none border-slate-100/60">
                  <StatusBadge status={c.message5DaysStatus} label="5 Days Promo" />
                  <StatusBadge status={c.message1DayStatus} label="1 Day Promo" />
                </div>

                {/* First visit outlet column */}
                {isOwnerOrAbove && (
                  <div className="flex flex-col items-start md:items-end justify-center shrink-0 md:w-[15%]">
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">Acquisition Outlet</span>
                    <span className="inline-flex items-center rounded-full bg-slate-50 border border-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600 mt-1">
                      {c.firstVisitOutlet?.name ?? '—'}
                    </span>
                  </div>
                )}

                {/* Details link arrow */}
                <div className="hidden md:flex items-center justify-end shrink-0">
                  <Link 
                    href={`/customers/${c.id}`}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-all"
                  >
                    <ChevronRight className="h-4.5 w-4.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
