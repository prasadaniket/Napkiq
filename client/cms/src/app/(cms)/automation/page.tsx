'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import type { PageResponse } from '@/types/api'

interface AutomationLog {
  id:            string
  customer:      { fullName: string; phone: string }
  automationType: string
  messageStage:  string
  status:        'success' | 'failed'
  sentAt:        string
  errorMessage:  string | null
}

const typeLabel: Record<string, string> = {
  birthday_whatsapp:    'Birthday WhatsApp',
  birthday_email:       'Birthday Email',
  anniversary_whatsapp: 'Anniversary WhatsApp',
  anniversary_email:    'Anniversary Email',
  reengagement_whatsapp:'Re-engagement WhatsApp',
  reengagement_email:   'Re-engagement Email',
}

export default function AutomationPage() {
  const { isAdmin } = useAuth()
  const [logs, setLogs]         = useState<AutomationLog[]>([])
  const [loading, setLoading]   = useState(true)
  const [triggering, setTriggering] = useState(false)

  useEffect(() => {
    api.get<PageResponse<AutomationLog>>('/cms/automation-logs?page=0&size=50')
      .then(res => setLogs(res.data.content))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false))
  }, [])

  const triggerReengagement = async () => {
    setTriggering(true)
    try {
      await api.post('/cms/reengagement/trigger')
      toast.success('Re-engagement campaign triggered!')
    } catch {
      toast.error('Automation worker not configured yet (Task 8)')
    } finally {
      setTriggering(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 className="page-title">Automation</h1>
            <p className="page-subtitle">Birthday, anniversary & re-engagement logs</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="role-badge role-badge-admin">ADMIN ONLY</span>
            {isAdmin && (
              <button className="btn-primary" onClick={triggerReengagement} disabled={triggering}>
                {triggering ? 'Triggering…' : '⚡ Trigger Re-engagement'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="page-content">

        {loading && (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--color-text-3)' }}>
            Loading…
          </div>
        )}

        {!loading && logs.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">⚡</div>
            <div className="empty-state-title">No automation logs yet</div>
            <div className="empty-state-desc">Logs will appear here when automation runs.</div>
          </div>
        )}

        {!loading && logs.length > 0 && (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Type</th>
                  <th>Stage</th>
                  <th>Status</th>
                  <th>Sent At</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--color-text-1)' }}>{log.customer?.fullName}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-3)' }}>{log.customer?.phone}</div>
                    </td>
                    <td>{typeLabel[log.automationType] || log.automationType}</td>
                    <td style={{ fontSize: 12 }}>{log.messageStage}</td>
                    <td>
                      <span style={{
                        display: 'inline-flex',
                        padding: '2px 8px',
                        borderRadius: 99,
                        fontSize: 11,
                        fontWeight: 600,
                        background: log.status === 'success' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                        color:      log.status === 'success' ? 'var(--color-success)'  : 'var(--color-danger)',
                      }}>
                        {log.status}
                      </span>
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {format(new Date(log.sentAt), 'dd MMM yy, HH:mm')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
