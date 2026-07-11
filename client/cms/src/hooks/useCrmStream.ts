'use client'

import { useEffect, useRef } from 'react'
import { getToken } from '@/lib/auth'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.napkiq.in/api'

export type CrmEventType = 'customer' | 'visit' | 'review'
export interface CrmEvent { type: CrmEventType; outletId: string | null }

/**
 * Subscribe to the live CRM SSE feed (/cms/crm/stream) and fire `onEvent` whenever a
 * relevant customer/visit/review change arrives — so the Customers / Visits / Reviews
 * pages refresh themselves without a reload. Bursts (e.g. a registration emits both a
 * 'customer' and a 'visit') are debounced into a single callback. Auto-reconnects on
 * drop and reports connection state through `onLive`.
 */
export function useCrmStream(
  types: CrmEventType[],
  onEvent: (event: CrmEvent) => void,
  opts?: { outletId?: string; onLive?: (live: boolean) => void; debounceMs?: number }
) {
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent
  const onLiveRef = useRef(opts?.onLive)
  onLiveRef.current = opts?.onLive

  const typesKey = types.join(',')
  const outletId = opts?.outletId ?? ''
  const debounceMs = opts?.debounceMs ?? 400

  useEffect(() => {
    let cancelled = false
    let es: EventSource | null = null
    let reconnect: ReturnType<typeof setTimeout> | null = null
    let debounce: ReturnType<typeof setTimeout> | null = null
    const wanted = new Set(typesKey.split(',').filter(Boolean))

    const connect = () => {
      const token = getToken() ?? ''
      const url = `${BASE_URL}/cms/crm/stream?token=${encodeURIComponent(token)}${outletId ? `&outletId=${encodeURIComponent(outletId)}` : ''}`
      es = new EventSource(url)

      es.onopen = () => { if (!cancelled) onLiveRef.current?.(true) }
      es.onmessage = (m) => {
        if (cancelled) return
        let data: CrmEvent
        try { data = JSON.parse(m.data) } catch { return }
        if (!wanted.has(data.type)) return
        if (debounce) clearTimeout(debounce)
        debounce = setTimeout(() => { if (!cancelled) onEventRef.current(data) }, debounceMs)
      }
      es.onerror = () => {
        if (cancelled) return
        onLiveRef.current?.(false)
        es?.close()
        reconnect = setTimeout(connect, 3000)
      }
    }
    connect()

    return () => {
      cancelled = true
      es?.close()
      if (reconnect) clearTimeout(reconnect)
      if (debounce) clearTimeout(debounce)
      onLiveRef.current?.(false)
    }
  }, [typesKey, outletId, debounceMs])
}
