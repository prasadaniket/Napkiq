'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import type { AutomationTemplate, PageResponse } from '@/types/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AutomationLog {
  id:             string
  customer:       { fullName: string; phone: string }
  automationType: string
  messageStage:   string
  status:         'success' | 'failed'
  sentAt:         string
  errorMessage:   string | null
}

type TriggerKey = 'reengagement' | 'welcome' | 'promotional' | 'announcement'

const TYPE_LABEL: Record<string, string> = {
  birthday_whatsapp:     'Birthday WhatsApp',
  birthday_email:        'Birthday Email',
  anniversary_whatsapp:  'Anniversary WhatsApp',
  anniversary_email:     'Anniversary Email',
  reengagement_whatsapp: 'Re-engagement WhatsApp',
  reengagement_email:    'Re-engagement Email',
  welcome_whatsapp:      'Welcome WhatsApp',
  welcome_email:         'Welcome Email',
  promotional_whatsapp:  'Promotional WhatsApp',
  promotional_email:     'Promotional Email',
  announcement_whatsapp: 'Announcement WhatsApp',
  announcement_email:    'Announcement Email',
}

const GROUP_ORDER = [
  'Birthday', 'Anniversary', 'Re-engagement', 'Welcome', 'Promotional Offer', 'Product Announcement',
]

// ─── Template Card ────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  isAdmin,
  onSave,
}: {
  template: AutomationTemplate
  isAdmin:  boolean
  onSave:   (key: string, patch: Partial<AutomationTemplate>) => Promise<void>
}) {
  const [draft, setDraft]     = useState({ ...template })
  const [saving, setSaving]   = useState(false)
  const [dirty, setDirty]     = useState(false)

  // Reset draft if template prop changes (after save)
  useEffect(() => { setDraft({ ...template }); setDirty(false) }, [template])

  const set = <K extends keyof AutomationTemplate>(k: K, v: AutomationTemplate[K]) => {
    setDraft(d => ({ ...d, [k]: v }))
    setDirty(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(template.key, {
        subject:  draft.subject,
        body:     draft.body,
        linkUrl:  draft.linkUrl,
        isActive: draft.isActive,
      })
      setDirty(false)
    } finally {
      setSaving(false)
    }
  }

  const isWA     = template.channel === 'whatsapp'
  const chanColor = isWA ? '#22c55e' : '#3b82f6'
  const isManual  = template.trigger === 'manual'

  return (
    <div style={{
      background:   'var(--color-surface)',
      border:       `1px solid ${dirty ? 'var(--color-primary-border)' : 'var(--color-border)'}`,
      borderRadius: 'var(--radius-lg)',
      display:      'flex',
      flexDirection: 'column',
      gap:          0,
      transition:   'border-color 0.2s',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={chanColor} strokeWidth="2">
          {isWA
            ? <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            : <><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></>
          }
        </svg>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-1)', flex: 1 }}>
          {isWA ? 'WhatsApp' : 'Email'}
        </span>

        {/* isActive toggle — admin only */}
        {isAdmin ? (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <span style={{ fontSize: 11, color: draft.isActive ? 'var(--color-success)' : 'var(--color-text-3)', fontWeight: 600 }}>
              {draft.isActive ? 'Active' : 'Inactive'}
            </span>
            <div
              onClick={() => set('isActive', !draft.isActive)}
              style={{
                width: 34, height: 18, borderRadius: 99, cursor: 'pointer',
                background: draft.isActive ? 'var(--color-success)' : 'rgba(255,255,255,0.12)',
                position: 'relative', transition: 'background 0.2s', flexShrink: 0,
              }}
            >
              <div style={{
                position: 'absolute', top: 2,
                left: draft.isActive ? 18 : 2,
                width: 14, height: 14, borderRadius: '50%',
                background: '#fff', transition: 'left 0.2s',
              }} />
            </div>
          </label>
        ) : (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 99,
            background: template.isActive ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.06)',
            color: template.isActive ? 'var(--color-success)' : 'var(--color-text-3)',
          }}>
            {template.isActive ? 'Active' : 'Inactive'}
          </span>
        )}

        {isManual && (
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 99,
            background: 'rgba(242,101,34,0.12)', color: 'var(--color-primary)',
            letterSpacing: '0.04em', textTransform: 'uppercase',
          }}>Manual</span>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
        {/* Trigger timing */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-3)" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          <span style={{ fontSize: 11, color: 'var(--color-text-3)' }}>{template.triggerDesc}</span>
        </div>

        {/* Subject — email only */}
        {!isWA && (
          <div>
            <div style={{ fontSize: 10, color: 'var(--color-text-3)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Subject</div>
            {isAdmin ? (
              <input
                className="input"
                value={draft.subject ?? ''}
                onChange={e => set('subject', e.target.value || null)}
                placeholder="Email subject…"
                style={{ width: '100%', fontSize: 12, padding: '6px 10px' }}
              />
            ) : (
              <div style={{ fontSize: 12, color: 'var(--color-text-2)', fontStyle: 'italic' }}>{template.subject ?? '—'}</div>
            )}
          </div>
        )}

        {/* Body */}
        <div>
          <div style={{ fontSize: 10, color: 'var(--color-text-3)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Message</div>
          {isAdmin ? (
            <textarea
              className="input"
              value={draft.body}
              onChange={e => set('body', e.target.value)}
              rows={4}
              placeholder="Message body…"
              style={{ width: '100%', fontSize: 12, padding: '8px 10px', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
            />
          ) : (
            <div style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)', padding: '8px 10px',
              fontSize: 12, color: 'var(--color-text-2)', lineHeight: 1.6, fontStyle: 'italic',
            }}>
              "{template.body}"
            </div>
          )}
        </div>

        {/* Link URL — admin only field */}
        {isAdmin && (
          <div>
            <div style={{ fontSize: 10, color: 'var(--color-text-3)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Link URL (optional)</div>
            <input
              className="input"
              value={draft.linkUrl ?? ''}
              onChange={e => set('linkUrl', e.target.value || null)}
              placeholder="https://…"
              style={{ width: '100%', fontSize: 12, padding: '6px 10px' }}
            />
          </div>
        )}

        {/* Read-only link for non-admin */}
        {!isAdmin && template.linkUrl && (
          <div style={{ fontSize: 11, color: 'var(--color-info)' }}>
            🔗 {template.linkUrl}
          </div>
        )}
      </div>

      {/* Save footer — admin only */}
      {isAdmin && (
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className="btn-primary"
            style={{ fontSize: 12, padding: '6px 16px', opacity: dirty ? 1 : 0.4, cursor: dirty ? 'pointer' : 'default' }}
            onClick={handleSave}
            disabled={saving || !dirty}
          >
            {saving ? 'Saving…' : dirty ? 'Save Changes' : 'Saved'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AutomationPage() {
  const { isAdmin } = useAuth()

  const [templates, setTemplates]   = useState<AutomationTemplate[]>([])
  const [logs, setLogs]             = useState<AutomationLog[]>([])
  const [loadingT, setLoadingT]     = useState(true)
  const [loadingL, setLoadingL]     = useState(true)
  const [activeTab, setActiveTab]   = useState<'templates' | 'logs'>('templates')
  const [triggering, setTriggering] = useState<TriggerKey | null>(null)

  const fetchTemplates = useCallback(() =>
    api.get<AutomationTemplate[]>('/cms/automation-templates')
      .then(r => setTemplates(r.data))
      .catch(() => toast.error('Failed to load templates'))
      .finally(() => setLoadingT(false))
  , [])

  const fetchLogs = useCallback(() =>
    api.get<PageResponse<AutomationLog>>('/cms/automation-logs?page=0&size=50')
      .then(r => setLogs(r.data.content))
      .catch(() => setLogs([]))
      .finally(() => setLoadingL(false))
  , [])

  useEffect(() => { fetchTemplates(); fetchLogs() }, [fetchTemplates, fetchLogs])

  const handleSave = async (key: string, patch: Partial<AutomationTemplate>) => {
    try {
      const res = await api.put<AutomationTemplate>(`/cms/automation-templates/${key}`, patch)
      setTemplates(prev => prev.map(t => t.key === key ? res.data : t))
      toast.success('Template saved')
    } catch {
      toast.error('Failed to save template')
      throw new Error('save failed')
    }
  }

  const trigger = async (type: TriggerKey) => {
    setTriggering(type)
    try {
      const res = await api.post<{ customers: number; sent: number; skipped: number; failed: number }>(
        `/automation/${type}`
      )
      const { customers, sent, skipped, failed } = res.data
      toast.success(`Done: ${sent} sent · ${skipped} skipped · ${failed} failed (${customers} customers)`)
      await fetchLogs()
      setActiveTab('logs')
    } catch {
      toast.error(`Failed to trigger ${type} campaign`)
    } finally {
      setTriggering(null)
    }
  }

  // Group templates by label preserving GROUP_ORDER
  const grouped: Record<string, AutomationTemplate[]> = {}
  for (const g of GROUP_ORDER) grouped[g] = []
  for (const t of templates) {
    if (!grouped[t.label]) grouped[t.label] = []
    grouped[t.label].push(t)
  }

  const TRIGGERS: { key: TriggerKey; label: string; desc: string }[] = [
    { key: 'reengagement', label: '⚡ Re-engagement',       desc: '30d inactive' },
    { key: 'welcome',      label: '👋 Welcome',             desc: 'First-timers' },
    { key: 'promotional',  label: '🎉 Promotional',         desc: 'All active' },
    { key: 'announcement', label: '📢 Announcement',        desc: 'All customers' },
  ]

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="page-title">Automation</h1>
            <p className="page-subtitle">Message templates · Birthday, anniversary, re-engagement & campaigns</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="role-badge role-badge-admin">ADMIN ONLY</span>
          </div>
        </div>

        {/* Manual trigger buttons — admin only */}
        {isAdmin && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
            {TRIGGERS.map(t => (
              <button
                key={t.key}
                className="btn-ghost"
                style={{ fontSize: 12, gap: 6, display: 'flex', alignItems: 'center' }}
                onClick={() => trigger(t.key)}
                disabled={triggering !== null}
              >
                {triggering === t.key ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                      style={{ animation: 'spin 1s linear infinite' }}>
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                    Triggering…
                  </>
                ) : (
                  <>
                    {t.label}
                    <span style={{ fontSize: 10, color: 'var(--color-text-3)', fontWeight: 400 }}>{t.desc}</span>
                  </>
                )}
              </button>
            ))}
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        )}
      </div>

      <div className="page-content">

        {/* Schedule banner */}
        <div style={{
          background: 'rgba(242,101,34,0.06)', border: '1px solid var(--color-primary-border)',
          borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: 20,
          display: 'flex', gap: 10, alignItems: 'flex-start',
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#F26522" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
          </svg>
          <div style={{ fontSize: 12.5, color: 'var(--color-text-2)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--color-text-1)' }}>Automatic triggers</strong> run daily via Cloudflare Worker cron.
            {' '}<strong style={{ color: 'var(--color-text-1)' }}>Manual triggers</strong> above send campaigns immediately to matching customers.
            WhatsApp templates require Meta approval before going live — toggle <em>Active</em> once approved.
            {isAdmin && <> Use <code style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: 4 }}>{'{customer_name}'}</code>, <code style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: 4 }}>{'{name}'}</code> as placeholders in message bodies.</>}
          </div>
        </div>

        {/* Tab bar */}
        <div style={{
          display: 'flex', gap: 2, background: 'var(--color-surface)',
          border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
          padding: 3, width: 'fit-content', marginBottom: 20,
        }}>
          {(['templates', 'logs'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: '7px 18px', fontSize: 13, fontWeight: 500,
              border: 'none', cursor: 'pointer', borderRadius: 8,
              background: activeTab === tab ? 'rgba(255,255,255,0.08)' : 'transparent',
              color: activeTab === tab ? 'var(--color-text-1)' : 'var(--color-text-3)',
              transition: 'all 0.15s', textTransform: 'capitalize',
            }}>
              {tab === 'templates' ? '📋 Templates' : `📜 Logs${logs.length ? ` (${logs.length})` : ''}`}
            </button>
          ))}
        </div>

        {/* ── Templates tab ──────────────────────────────────────────────────── */}
        {activeTab === 'templates' && (
          <>
            {loadingT && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                {[...Array(6)].map((_, i) => (
                  <div key={i} style={{ height: 220, background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', opacity: 0.4, animation: 'pulse 1.5s ease-in-out infinite' }} />
                ))}
                <style>{`@keyframes pulse{0%,100%{opacity:0.3}50%{opacity:0.7}}`}</style>
              </div>
            )}

            {!loadingT && GROUP_ORDER.map(group => {
              const cards = grouped[group]
              if (!cards?.length) return null
              return (
                <div key={group} style={{ marginBottom: 28 }}>
                  <div className="section-title" style={{ marginBottom: 12 }}>{group}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
                    {cards.map(t => (
                      <TemplateCard
                        key={t.key}
                        template={t}
                        isAdmin={isAdmin}
                        onSave={handleSave}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </>
        )}

        {/* ── Logs tab ───────────────────────────────────────────────────────── */}
        {activeTab === 'logs' && (
          <>
            {loadingL && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[...Array(5)].map((_, i) => (
                  <div key={i} style={{ height: 52, background: 'var(--color-surface)', borderRadius: 8, opacity: 0.4, animation: 'pulse 1.5s ease-in-out infinite' }} />
                ))}
              </div>
            )}

            {!loadingL && logs.length === 0 && (
              <div className="empty-state">
                <div className="empty-state-icon">⚡</div>
                <div className="empty-state-title">No automation logs yet</div>
                <div className="empty-state-desc">Logs appear here when the cron runs or you trigger a campaign manually.</div>
              </div>
            )}

            {!loadingL && logs.length > 0 && (
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
                          <div style={{ fontSize: 11, color: 'var(--color-text-3)' }}>{log.customer?.phone}</div>
                        </td>
                        <td style={{ fontSize: 13 }}>{TYPE_LABEL[log.automationType] ?? log.automationType}</td>
                        <td style={{ fontSize: 12, color: 'var(--color-text-2)' }}>{log.messageStage}</td>
                        <td>
                          <span style={{
                            display: 'inline-flex', padding: '2px 8px', borderRadius: 99,
                            fontSize: 11, fontWeight: 600,
                            background: log.status === 'success' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                            color:      log.status === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
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
