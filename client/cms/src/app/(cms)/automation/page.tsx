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
  birthday_whatsapp:     'Birthday · WhatsApp',
  birthday_email:        'Birthday · Email',
  anniversary_whatsapp:  'Anniversary · WhatsApp',
  anniversary_email:     'Anniversary · Email',
  reengagement_whatsapp: 'Re-engagement · WhatsApp',
  reengagement_email:    'Re-engagement · Email',
  welcome_whatsapp:      'Welcome · WhatsApp',
  welcome_email:         'Welcome · Email',
  promotional_whatsapp:  'Promotional · WhatsApp',
  promotional_email:     'Promotional · Email',
  announcement_whatsapp: 'Announcement · WhatsApp',
  announcement_email:    'Announcement · Email',
}

const GROUP_ORDER = [
  'Birthday', 'Anniversary', 'Re-engagement', 'Welcome', 'Promotional Offer', 'Product Announcement',
]

const TRIGGERS: { key: TriggerKey; emoji: string; label: string; desc: string; color: string }[] = [
  { key: 'reengagement', emoji: '⚡', label: 'Re-engagement', desc: '30d inactive',  color: '#f59e0b' },
  { key: 'welcome',      emoji: '👋', label: 'Welcome',       desc: 'First-timers',  color: '#3b82f6' },
  { key: 'promotional',  emoji: '🎉', label: 'Promotional',   desc: 'All active',    color: '#a855f7' },
  { key: 'announcement', emoji: '📢', label: 'Announcement',  desc: 'All customers', color: '#ec4899' },
]

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <div onClick={onChange} style={{
      width: 38, height: 20, borderRadius: 99, cursor: 'pointer', flexShrink: 0,
      background: on ? 'var(--color-success)' : 'rgba(255,255,255,0.12)',
      position: 'relative', transition: 'background 0.2s',
    }}>
      <div style={{
        position: 'absolute', top: 3,
        left: on ? 20 : 3,
        width: 14, height: 14, borderRadius: '50%',
        background: '#fff', transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
      }} />
    </div>
  )
}

// ─── Template Card ────────────────────────────────────────────────────────────

function TemplateCard({ template, isAdmin, onSave }: {
  template: AutomationTemplate
  isAdmin:  boolean
  onSave:   (key: string, patch: Partial<AutomationTemplate>) => Promise<void>
}) {
  const [draft, setDraft]   = useState({ ...template })
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty]   = useState(false)

  useEffect(() => { setDraft({ ...template }); setDirty(false) }, [template])

  const set = <K extends keyof AutomationTemplate>(k: K, v: AutomationTemplate[K]) => {
    setDraft(d => ({ ...d, [k]: v }))
    setDirty(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(template.key, { subject: draft.subject, body: draft.body, linkUrl: draft.linkUrl, isActive: draft.isActive })
      setDirty(false)
    } finally { setSaving(false) }
  }

  const isWA      = template.channel === 'whatsapp'
  const isManual  = template.trigger === 'manual'
  const chanColor = isWA ? '#25d366' : '#3b82f6'
  const chanBg    = isWA ? 'rgba(37,211,102,0.1)' : 'rgba(59,130,246,0.1)'

  return (
    <div style={{
      background:    'var(--color-surface)',
      border:        `1px solid ${dirty ? 'rgba(242,101,34,0.5)' : 'var(--color-border)'}`,
      borderLeft:    `3px solid ${dirty ? 'var(--color-primary)' : chanColor}`,
      borderRadius:  'var(--radius-lg)',
      display:       'flex',
      flexDirection: 'column',
      transition:    'border-color 0.2s',
      overflow:      'hidden',
    }}>
      {/* ── Header ── */}
      <div style={{
        padding: '12px 16px',
        background: chanBg,
        borderBottom: '1px solid var(--color-border)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        {/* Channel icon */}
        <div style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
          background: isWA ? 'rgba(37,211,102,0.15)' : 'rgba(59,130,246,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={chanColor} strokeWidth="2">
            {isWA
              ? <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              : <><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></>
            }
          </svg>
        </div>

        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-1)', flex: 1 }}>
          {isWA ? 'WhatsApp' : 'Email'}
        </span>

        {isManual && (
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 99,
            background: 'rgba(242,101,34,0.15)', color: 'var(--color-primary)',
            letterSpacing: '0.05em', textTransform: 'uppercase',
          }}>Manual</span>
        )}

        {isAdmin ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: draft.isActive ? 'var(--color-success)' : 'var(--color-text-3)' }}>
              {draft.isActive ? 'Active' : 'Inactive'}
            </span>
            <Toggle on={draft.isActive} onChange={() => set('isActive', !draft.isActive)} />
          </div>
        ) : (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
            background: template.isActive ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.06)',
            color: template.isActive ? 'var(--color-success)' : 'var(--color-text-3)',
          }}>
            {template.isActive ? 'Active' : 'Inactive'}
          </span>
        )}
      </div>

      {/* ── Body ── */}
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
        {/* Trigger timing */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
          padding: '3px 10px', borderRadius: 99,
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
        }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-3)" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          <span style={{ fontSize: 11, color: 'var(--color-text-3)' }}>{template.triggerDesc}</span>
        </div>

        {/* Subject — email only */}
        {!isWA && (
          <div>
            <div style={{ fontSize: 10, color: 'var(--color-text-3)', marginBottom: 5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Subject</div>
            {isAdmin ? (
              <input className="input" value={draft.subject ?? ''} onChange={e => set('subject', e.target.value || null)}
                placeholder="Email subject…" style={{ width: '100%', fontSize: 12, padding: '7px 10px' }} />
            ) : (
              <div style={{ fontSize: 12, color: 'var(--color-text-2)', fontStyle: 'italic', padding: '6px 0' }}>{template.subject ?? '—'}</div>
            )}
          </div>
        )}

        {/* Message body */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: 'var(--color-text-3)', marginBottom: 5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Message</div>
          {isAdmin ? (
            <textarea className="input" value={draft.body} onChange={e => set('body', e.target.value)}
              rows={4} placeholder="Message body…"
              style={{ width: '100%', fontSize: 12, padding: '8px 10px', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.65 }} />
          ) : (
            <div style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)', padding: '8px 10px',
              fontSize: 12, color: 'var(--color-text-2)', lineHeight: 1.65,
            }}>"{template.body}"</div>
          )}
        </div>

        {/* Link URL */}
        {isAdmin && (
          <div>
            <div style={{ fontSize: 10, color: 'var(--color-text-3)', marginBottom: 5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Link URL (optional)</div>
            <input className="input" value={draft.linkUrl ?? ''} onChange={e => set('linkUrl', e.target.value || null)}
              placeholder="https://…" style={{ width: '100%', fontSize: 12, padding: '7px 10px' }} />
          </div>
        )}
        {!isAdmin && template.linkUrl && (
          <div style={{ fontSize: 11, color: 'var(--color-info)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
            {template.linkUrl}
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      {isAdmin && (
        <div style={{
          padding: '10px 16px', borderTop: '1px solid var(--color-border)',
          display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10,
          background: dirty ? 'rgba(242,101,34,0.04)' : 'transparent',
        }}>
          {dirty && (
            <span style={{ fontSize: 11, color: 'var(--color-text-3)' }}>Unsaved changes</span>
          )}
          <button className="btn-primary" style={{
            fontSize: 12, padding: '6px 18px',
            opacity: dirty ? 1 : 0.35, cursor: dirty ? 'pointer' : 'default',
            transition: 'opacity 0.2s',
          }} onClick={handleSave} disabled={saving || !dirty}>
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
      const res = await api.post<{ customers: number; sent: number; skipped: number; failed: number }>(`/automation/${type}`)
      const { customers, sent, skipped, failed } = res.data
      toast.success(`Done — ${sent} sent · ${skipped} skipped · ${failed} failed (${customers} matched)`)
      await fetchLogs()
      setActiveTab('logs')
    } catch {
      toast.error(`Failed to trigger ${type} campaign`)
    } finally { setTriggering(null) }
  }

  const grouped: Record<string, AutomationTemplate[]> = {}
  for (const g of GROUP_ORDER) grouped[g] = []
  for (const t of templates) {
    if (!grouped[t.label]) grouped[t.label] = []
    grouped[t.label].push(t)
  }

  return (
    <div>
      {/* ── Page header ── */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="page-title">Automation</h1>
            <p className="page-subtitle">Message templates · Birthday, anniversary, re-engagement &amp; campaigns</p>
          </div>
          <span className="role-badge role-badge-admin">ADMIN ONLY</span>
        </div>

        {/* ── Manual trigger strip ── */}
        {isAdmin && (
          <div style={{ marginTop: 20, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {TRIGGERS.map(t => {
              const busy = triggering === t.key
              return (
                <button key={t.key} onClick={() => trigger(t.key)} disabled={triggering !== null}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 16px', borderRadius: 'var(--radius-md)',
                    background: 'var(--color-surface)',
                    border: `1px solid ${busy ? t.color : 'var(--color-border)'}`,
                    cursor: triggering ? 'not-allowed' : 'pointer',
                    opacity: triggering && !busy ? 0.45 : 1,
                    transition: 'all 0.15s',
                  }}>
                  {busy ? (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={t.color} strokeWidth="2.5"
                      style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }}>
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                  ) : (
                    <span style={{ fontSize: 14, lineHeight: 1 }}>{t.emoji}</span>
                  )}
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: busy ? t.color : 'var(--color-text-1)', lineHeight: 1.2 }}>
                      {busy ? 'Sending…' : t.label}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--color-text-3)', marginTop: 2 }}>{t.desc}</div>
                  </div>
                </button>
              )
            })}
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        )}
      </div>

      <div className="page-content">

        {/* ── Info banner ── */}
        <div style={{
          display: 'flex', gap: 12, alignItems: 'flex-start',
          padding: '12px 16px', marginBottom: 24,
          background: 'rgba(242,101,34,0.05)',
          border: '1px solid rgba(242,101,34,0.2)',
          borderRadius: 'var(--radius-md)',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F26522" strokeWidth="2.5"
            style={{ flexShrink: 0, marginTop: 2 }}>
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
          </svg>
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--color-text-2)', lineHeight: 1.65 }}>
            <strong style={{ color: 'var(--color-text-1)' }}>Automatic triggers</strong> run daily via Cloudflare Worker cron.{' '}
            <strong style={{ color: 'var(--color-text-1)' }}>Manual triggers</strong> send campaigns immediately to matching customers.
            {' '}WhatsApp templates require Meta approval — toggle <em>Active</em> once approved.
            {isAdmin && <>{' '}Use{' '}
              <code style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: 4, fontSize: 11 }}>{'{customer_name}'}</code>
              {', '}
              <code style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: 4, fontSize: 11 }}>{'{name}'}</code>
              {' '}as placeholders.
            </>}
          </p>
        </div>

        {/* ── Tab bar ── */}
        <div style={{
          display: 'flex', gap: 2, marginBottom: 24,
          borderBottom: '1px solid var(--color-border)',
        }}>
          {([
            { id: 'templates', label: 'Templates', icon: '📋' },
            { id: 'logs',      label: `Logs${logs.length ? ` (${logs.length})` : ''}`, icon: '📜' },
          ] as const).map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as 'templates' | 'logs')} style={{
              padding: '9px 20px', fontSize: 13, fontWeight: 600,
              border: 'none', cursor: 'pointer', background: 'transparent',
              color: activeTab === tab.id ? 'var(--color-text-1)' : 'var(--color-text-3)',
              borderBottom: `2px solid ${activeTab === tab.id ? 'var(--color-primary)' : 'transparent'}`,
              marginBottom: -1, transition: 'all 0.15s',
            }}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* ── Templates tab ── */}
        {activeTab === 'templates' && (
          <>
            {loadingT && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {[...Array(3)].map((_, i) => (
                  <div key={i}>
                    <div style={{ height: 16, width: 120, background: 'var(--color-surface)', borderRadius: 4, marginBottom: 12, opacity: 0.4 }} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                      {[0, 1].map(j => (
                        <div key={j} style={{ height: 240, background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', opacity: 0.4, animation: 'pulse 1.5s ease-in-out infinite' }} />
                      ))}
                    </div>
                  </div>
                ))}
                <style>{`@keyframes pulse{0%,100%{opacity:0.3}50%{opacity:0.7}}`}</style>
              </div>
            )}

            {!loadingT && GROUP_ORDER.map(group => {
              const cards = grouped[group]
              if (!cards?.length) return null
              return (
                <div key={group} style={{ marginBottom: 32 }}>
                  {/* Group label */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
                  }}>
                    <span style={{
                      fontSize: 13, fontWeight: 700, color: 'var(--color-text-1)',
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}>{group}</span>
                    <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
                    <span style={{ fontSize: 11, color: 'var(--color-text-3)' }}>
                      {cards.filter(c => c.isActive).length}/{cards.length} active
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    {cards.map(t => (
                      <TemplateCard key={t.key} template={t} isAdmin={isAdmin} onSave={handleSave} />
                    ))}
                  </div>
                </div>
              )
            })}
          </>
        )}

        {/* ── Logs tab ── */}
        {activeTab === 'logs' && (
          <>
            {loadingL && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[...Array(6)].map((_, i) => (
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
                          <div style={{ fontWeight: 600, color: 'var(--color-text-1)', fontSize: 13 }}>{log.customer?.fullName}</div>
                          <div style={{ fontSize: 11, color: 'var(--color-text-3)' }}>{log.customer?.phone}</div>
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--color-text-2)' }}>
                          {TYPE_LABEL[log.automationType] ?? log.automationType}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--color-text-2)' }}>{log.messageStage}</td>
                        <td>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            padding: '3px 9px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                            background: log.status === 'success' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                            color:      log.status === 'success' ? 'var(--color-success)' : '#ef4444',
                          }}>
                            <span style={{
                              width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                              background: log.status === 'success' ? 'var(--color-success)' : '#ef4444',
                            }} />
                            {log.status === 'success' ? 'Sent' : 'Failed'}
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
