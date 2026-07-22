'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getUser, clearSession, isAuthenticated } from '@/lib/auth'
import type { LoginResponse } from '@/types/api'

export const useAuth = (requireAuth = true) => {
  const [user, setUser] = useState<LoginResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const currentUser = getUser()
    if (requireAuth && !isAuthenticated()) {
      router.push('/cms/login')
      return
    }
    setUser(currentUser)
    setLoading(false)
  }, [requireAuth, router])

  const logout = () => {
    clearSession()
    router.push('/cms/login')
  }

  return { user, loading, logout }
}
