'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import type { PageResponse } from '@/types/api'

interface AutomationLog {
  id:             string
  customer:       { fullName: string; phone: string }
  automationType: string
  messageStage:   string
  status:         'success' | 'failed'
  sentAt:         string
  errorMessage:   string | null
}

const typeLabel: Record<string, string> = {
  birthday_whatsapp:     'Birthday WhatsApp',
  birthday_email:        'Birthday Email',
  anniversary_whatsapp:  'Anniversary WhatsApp',
  anniversary_email:     'Anniversary Email',
  reengagement_whatsapp: 'Re-engagement WhatsApp',
  reengagement_email:    'Re-engagement Email',
}

// ─── Static template definitions ─────────────────────────────────────────────
// WhatsApp bodies require Meta-approved templates; email bodies are hardcoded
// in notifications.ts. These cards show admins exactly what will be sent.

interface TemplateDef {
  key:      string
  label:    string
  channel:  'whatsapp' | 'email'
  trigger:  string
  subject?: string
  preview:  string
}

const TEMPLATES: TemplateDef[] = [
  {
    key:     'birthday_whatsapp',
    label:   'Birthday',
    channel: 'whatsapp',
    trigger: '5 days before & 1 day before birthday',
    preview: 'Hey {customer_name}, your birthday is coming up! 🎂 Celebrate with us at StoneOven — we have something special waiting for you.',
  },
  {
    key:     'birthday_email',
    label:   'Birthday',
    channel: 'email',
    trigger: '5 days before & 1 day before birthday',
    subject: 'Your birthday is coming up, {name}!',
    preview: "We'd love to celebrate your special day with you at StoneOven. Visit any outlet and enjoy a complimentary treat. Show this email to our team.",
  },
  {
    key:     'anniversary_whatsapp',
    label:   'Anniversary',
    channel: 'whatsapp',
    trigger: '5 days before & 1 day before anniversary',
    preview: 'Hey {customer_name}, your anniversary is almost here! 💑 Come celebrate at StoneOven with a romantic dining experience.',
  },
  {
    key:     'anniversary_email',
    label:   'Anniversary',
    channel: 'email',
    trigger: '5 days before & 1 day before anniversary',
    subject: 'Your anniversary is coming up, {name}!',
    preview: 'Celebrate your love at StoneOven. Book a table for two and enjoy a romantic dining experience curated just for you.',
  },
  {
    key:     'reengagement_whatsapp',
    label:   'Re-engagement',
    channel: 'whatsapp',
    trigger: '30 days since last visit',
    preview: "Hey {customer_name}, we miss you! 👋 It's been a while since your last visit — come back to StoneOven, your favourite table is waiting.",
  },
  {
    key:     'reengagement_email',
    label:   'Re-engagement',
    channel: 'email',
    trigger: '30 days since last visit',
    subject: 'We miss you, {name}!',
    preview: "It's been {days} days since your last visit and we'd love to have you back. Our kitchen is ready and your favourite table is waiting.",
  },
]

// ─── Template Card ────────────────────────────────────────────────────────────

function TemplateCard({ t }: { t: TemplateDef }) {
  const isWA = t.channel === 'whatsapp'
  const channelColor = isWA ? '#22c55e' : '#3b82f6'
  const channelBg    = isWA ? 'rgba(34,197,94,0.1)' : 'rgba(59,130,246,0.1)'

  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)',
      padding: '16px 18px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-1)' }}>{t.label}</span>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 99,
            background: channelBg, color: channelColor, textTransform: 'uppercase', letterSpacing: '0.04em',
          }}>
            {isWA ? 'WhatsApp' : 'Email'}
          </span>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={channelColor} strokeWidth="2">
          {isWA
            ? <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            : <><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></>
          }
        </svg>
      </div>

      {/* Trigger */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-3)" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
        <span style={{ fontSize: 11, color: 'var(--color-text-3)' }}>{t.trigger}</span>
      </div>

      {/* Subject (email only) */}
      {t.subject && (
        <div style={{ fontSize: 11, color: 'var(--color-text-2)' }}>
          <span style={{ color: 'var(--color-text-3)' }}>Subject: </span>
          <em>{t.subject}</em>
        </div>
      )}

      {/* Preview body */}
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-sm)',
        padding: '10px 12px',
        fontSize: 12,
        color: 'var(--color-text-2)',
        lineHeight: 1.6,
        fontStyle: 'italic',
      }}>
        "{t.preview}"
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AutomationPage() {
  const { isAdmin } = useAuth()
  const [logs, setLogs]             = useState<AutomationLog[]>([])
  const [loading, setLoading]       = useState(true)
  const [triggering, setTriggering] = useState(false)
  const [activeTab, setActiveTab]   = useState<'templates' | 'logs'>('templates')

  const refreshLogs = () =>
    api.get<PageResponse<AutomationLog>>('/cms/automation-logs?page=0&size=50')
      .then(res => setLogs(res.data.content))
      .catch(() => setLogs([]))

  useEffect(() => {
    refreshLogs().finally(() => setLoading(false))
  }, [])

  const triggerReengagement = async () => {
    setTriggering(true)
    try {
      const res = await api.post<{ customers: number; sent: number; skipped: number }>('/automation/reengagement')
      const { customers, sent, skipped } = res.data
      toast.success(`Campaign sent: ${sent} messages to ${customers} customers (${skipped} skipped)`)
      await refreshLogs()
      setActiveTab('logs')
    } catch {
      toast.error('Failed to trigger re-engagement campaign')
    } finally {
      setTriggering(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="page-title">Automation</h1>
            <p className="page-subtitle">Message templates · Birthday, anniversary & re-engagement</p>
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

        {/* Schedule info banner */}
        <div style={{
          background: 'rgba(242,101,34,0.06)',
          border: '1px solid var(--color-primary-border)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 16px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F26522" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
          </svg>
          <div style={{ fontSize: 12.5, color: 'var(--color-text-2)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--color-text-1)' }}>Automation schedule:</strong>{' '}
            Birthday & anniversary messages run daily via Cloudflare Worker cron — sent 5 days before and again 1 day before.
            Re-engagement targets customers with no visit in 30+ days.
            WhatsApp templates require Meta approval before going live.
          </div>
        </div>

        {/* Tab bar */}
        <div style={{
          display: 'flex',
          gap: 2,
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          padding: 3,
          width: 'fit-content',
          marginBottom: 20,
        }}>
          {(['templates', 'logs'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: '7px 18px',
              fontSize: 13,
              fontWeight: 500,
              border: 'none',
              cursor: 'pointer',
              borderRadius: 8,
              background: activeTab === tab ? 'rgba(255,255,255,0.08)' : 'transparent',
              color: activeTab === tab ? 'var(--color-text-1)' : 'var(--color-text-3)',
              transition: 'all 0.15s',
              textTransform: 'capitalize',
            }}>
              {tab === 'templates' ? '📋 Templates' : `📜 Logs${logs.length > 0 ? ` (${logs.length})` : ''}`}
            </button>
          ))}
        </div>

        {/* Templates tab */}
        {activeTab === 'templates' && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 16,
          }}>
            {TEMPLATES.map(t => <TemplateCard key={t.key} t={t} />)}
          </div>
        )}

        {/* Logs tab */}
        {activeTab === 'logs' && (
          <>
            {loading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[...Array(5)].map((_, i) => (
                  <div key={i} style={{ height: 52, background: 'var(--color-surface)', borderRadius: 8, opacity: 0.5, animation: 'pulse 1.5s ease-in-out infinite' }} />
                ))}
                <style>{`@keyframes pulse{0%,100%{opacity:0.4}50%{opacity:0.8}}`}</style>
              </div>
            )}

            {!loading && logs.length === 0 && (
              <div className="empty-state">
                <div className="empty-state-icon">⚡</div>
                <div className="empty-state-title">No automation logs yet</div>
                <div className="empty-state-desc">Logs appear here when the cron runs or you trigger manually.</div>
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
                    {logs.map(log => (
                      <tr key={log.id}>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--color-text-1)' }}>{log.customer?.fullName}</div>
                          <div style={{ fontSize: 12, color: 'var(--color-text-3)' }}>{log.customer?.phone}</div>
                        </td>
                        <td style={{ fontSize: 13 }}>{typeLabel[log.automationType] || log.automationType}</td>
                        <td style={{ fontSize: 12, color: 'var(--color-text-2)' }}>{log.messageStage}</td>
                        <td>
                          <span style={{
                            display: 'inline-flex', padding: '2px 8px', borderRadius: 99,
                            fontSize: 11, fontWeight: 600,
                            background: log.status === 'success' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                            color:      log.status === 'success' ? 'var(--color-success)'  : 'var(--color-danger)',
                          }}>
                            {log.status}
                          </span>
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--color-text-2)' }}>
                          {format(new Date(log.sentAt), 'dd MMM yy, HH:mm')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
