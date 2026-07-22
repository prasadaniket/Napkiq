'use client'

// Small "Live" pill shown on auto-updating pages (fed by the CRM SSE stream).
export default function LiveBadge({ live }: { live: boolean }) {
  return (
    <span
      title={live ? 'Live — updates automatically' : 'Reconnecting…'}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '3px 9px', borderRadius: 99, fontSize: 10, fontWeight: 800,
        textTransform: 'uppercase', letterSpacing: '0.04em',
        background: live ? 'rgba(22,163,74,0.08)' : 'rgba(148,163,184,0.12)',
        color: live ? '#16a34a' : '#94a3b8',
        border: `1px solid ${live ? 'rgba(22,163,74,0.2)' : 'rgba(148,163,184,0.25)'}`,
      }}
    >
      <span className={live ? 'animate-pulse' : ''} style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
      {live ? 'Live' : 'Sync'}
    </span>
  )
}
