'use client'

import { useState, useEffect } from 'react'
import { getDeviceFingerprint } from '@/lib/fingerprint'

export const useDeviceFingerprint = () => {
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDeviceFingerprint().then((id) => {
      setDeviceId(id)
      setLoading(false)
    })
  }, [])

  return { deviceId, loading }
}
