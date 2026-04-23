'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react'
import { useRouter } from 'next/navigation'
import { getUser, clearSession, isAuthenticated } from '@/lib/auth'
import type { LoginResponse } from '@/types/api'

// ─── Types ────────────────────────────────────────────────────────────────────

export type CmsRole = 'admin' | 'owner' | 'franchise_owner'

interface AuthContextValue {
  user:        LoginResponse | null
  loading:     boolean
  logout:      () => void
  // Role helpers — use these everywhere in the UI
  isAdmin:     boolean   // unicord26 — full access + automation
  isOwner:     boolean   // niteshsve — all outlets, no automation
  isFranchise: boolean   // fbowner / fpowner / fviowner / fvaowner
  // Convenience: true for admin OR owner (can see all outlets)
  isOwnerOrAbove: boolean
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<LoginResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const router                = useRouter()

  useEffect(() => {
    if (isAuthenticated()) {
      setUser(getUser())
    }
    setLoading(false)
  }, [])

  const logout = useCallback(() => {
    clearSession()
    setUser(null)
    router.push('/login')
  }, [router])

  const role          = user?.role ?? null
  const isAdmin       = role === 'admin'
  const isOwner       = role === 'owner'
  const isFranchise   = role === 'franchise_owner'
  const isOwnerOrAbove = isAdmin || isOwner

  return (
    <AuthContext.Provider
      value={{ user, loading, logout, isAdmin, isOwner, isFranchise, isOwnerOrAbove }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
