'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import type { Outlet } from '@/types/outlet'

export const useOutlet = (code: string) => {
  const [outlet, setOutlet] = useState<Outlet | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!code) return

    api.get<Outlet>(`/outlets/${code}`)
      .then((res) => setOutlet(res.data))
      .catch(() => setError('Outlet not found'))
      .finally(() => setLoading(false))
  }, [code])

  return { outlet, loading, error }
}
