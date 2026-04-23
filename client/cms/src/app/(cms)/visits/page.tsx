'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { format } from 'date-fns'
import type { PageResponse, Visit } from '@/types/api'

export default function VisitsPage() {
  const { user, isOwnerOrAbove } = useAuth()
  const [visits, setVisits]     = useState<Visit[]>([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(true)
  const [page, setPage]         = useState(0)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    api.get<PageResponse<Visit>>(`/cms/visits?page=${page}&size=20`)
      .then(res => { setVisits(res.data.content); setTotal(res.data.totalElements) })
      .catch(() => setVisits([]))
      .finally(() => setLoading(false))
  }, [user, page])

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Visits</h1>
        <p className="page-subtitle">
          {isOwnerOrAbove ? 'All outlet visit activity' : `Visits · ${user?.assignedOutletName}`}
        </p>
      </div>

      <div className="page-content">
        {loading && (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--color-text-3)' }}>
            Loading…
          </div>
        )}

        {!loading && visits.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">📅</div>
            <div className="empty-state-title">No visits recorded</div>
            <div className="empty-state-desc">Visits from QR scans and payments will appear here.</div>
          </div>
        )}

        {!loading && visits.length > 0 && (
          <>
            <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--color-text-3)' }}>
              {total.toLocaleString()} total visits
            </div>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    {isOwnerOrAbove && <th>Outlet</th>}
                    <th>Type</th>
                    <th>Visited At</th>
                  </tr>
                </thead>
                <tbody>
                  {visits.map((v) => (
                    <tr key={v.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--color-text-1)' }}>
                          {v.customer?.fullName ?? '—'}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-3)' }}>
                          {v.customer?.phone}
                        </div>
                      </td>
                      {isOwnerOrAbove && (
                        <td>
                          <span style={{
                            display: 'inline-flex',
                            padding: '2px 8px',
                            borderRadius: 99,
                            fontSize: 11,
                            fontWeight: 600,
                            background: 'rgba(255,255,255,0.05)',
                            color: 'var(--color-text-2)',
                          }}>
                            {v.outlet?.code}
                          </span>
                        </td>
                      )}
                      <td>
                        <span style={{
                          display: 'inline-flex',
                          padding: '2px 8px',
                          borderRadius: 99,
                          fontSize: 11,
                          fontWeight: 600,
                          background: v.visitType === 'qr_scan'
                            ? 'rgba(59,130,246,0.12)' : 'rgba(34,197,94,0.12)',
                          color: v.visitType === 'qr_scan'
                            ? 'var(--color-info)' : 'var(--color-success)',
                        }}>
                          {v.visitType === 'qr_scan' ? 'QR Scan' : 'Payment'}
                        </span>
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {format(new Date(v.visitedAt), 'dd MMM yy, HH:mm')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, justifyContent: 'flex-end' }}>
              <button
                className="btn-ghost"
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
              >
                ← Prev
              </button>
              <span style={{ fontSize: 13, color: 'var(--color-text-3)' }}>
                Page {page + 1}
              </span>
              <button
                className="btn-ghost"
                disabled={(page + 1) * 20 >= total}
                onClick={() => setPage(p => p + 1)}
              >
                Next →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
