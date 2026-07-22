'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '@/lib/api'
import type { RestaurantTable, TableShape } from '@/types/api'
import toast from 'react-hot-toast'
import { Save, Grid3x3, Square, Circle, RectangleHorizontal, Users, MousePointer2 } from 'lucide-react'

const ZONE_ACCENT: Record<string, string> = { ac: '#F0A500', outdoor: '#10b981', non_ac: '#94a3b8' }
const SHAPES: { value: TableShape; icon: typeof Square }[] = [
  { value: 'square', icon: Square },
  { value: 'round',  icon: Circle },
  { value: 'rect',   icon: RectangleHorizontal },
]

interface Pos { x: number; y: number; shape: TableShape }

// Auto-flow tables that have no saved position into a tidy grid.
function autoLayout(tables: RestaurantTable[]): Record<string, Pos> {
  const cols = Math.min(7, Math.max(3, Math.ceil(Math.sqrt(tables.length * 1.6))))
  const rows = Math.max(1, Math.ceil(tables.length / cols))
  const out: Record<string, Pos> = {}
  tables.forEach((t, i) => {
    const col = i % cols, row = Math.floor(i / cols)
    out[t.id] = {
      x: cols === 1 ? 50 : 10 + col * (80 / (cols - 1)),
      y: rows === 1 ? 45 : 12 + row * (66 / (rows - 1)),
      shape: t.shape,
    }
  })
  return out
}

export default function FloorPlanEditor({
  outletId, tables, onSaved,
}: {
  outletId: string; tables: RestaurantTable[]; onSaved?: () => void
}) {
  const active = useMemo(() => tables.filter(t => t.isActive), [tables])

  const [pos, setPos] = useState<Record<string, Pos>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  const canvasRef = useRef<HTMLDivElement>(null)
  const dragId = useRef<string | null>(null)

  // Seed positions from saved coords, filling any gaps with an auto grid.
  useEffect(() => {
    const auto = autoLayout(active)
    const seeded: Record<string, Pos> = {}
    for (const t of active) {
      seeded[t.id] = (t.posX != null && t.posY != null)
        ? { x: t.posX, y: t.posY, shape: t.shape }
        : auto[t.id]
    }
    setPos(seeded)
    setDirty(false)
    setSelectedId(null)
  }, [active])

  const pointFromEvent = (e: PointerEvent | React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    return { x: Math.min(96, Math.max(4, x)), y: Math.min(94, Math.max(5, y)) }
  }

  const onPointerDownToken = (e: React.PointerEvent, id: string) => {
    e.preventDefault()
    dragId.current = id
    setSelectedId(id)
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragId.current) return
    const p = pointFromEvent(e)
    const id = dragId.current
    setPos(prev => ({ ...prev, [id]: { ...prev[id], x: p.x, y: p.y } }))
    setDirty(true)
  }

  const onPointerUp = () => { dragId.current = null }

  const setShape = (shape: TableShape) => {
    if (!selectedId) return
    setPos(prev => ({ ...prev, [selectedId]: { ...prev[selectedId], shape } }))
    setDirty(true)
  }

  const autoArrange = () => {
    const auto = autoLayout(active)
    setPos(prev => {
      const next: Record<string, Pos> = {}
      for (const t of active) next[t.id] = { ...auto[t.id], shape: prev[t.id]?.shape ?? t.shape }
      return next
    })
    setDirty(true)
  }

  const save = async () => {
    setSaving(true)
    try {
      await api.patch('/cms/tables/layout', {
        outletId,
        tables: active.map(t => ({ id: t.id, posX: Math.round(pos[t.id].x * 10) / 10, posY: Math.round(pos[t.id].y * 10) / 10, shape: pos[t.id].shape })),
      })
      toast.success('Floor layout saved')
      setDirty(false)
      onSaved?.()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Could not save layout')
    } finally {
      setSaving(false)
    }
  }

  const selected = selectedId ? active.find(t => t.id === selectedId) : null

  if (active.length === 0) {
    return <div className="fpe-empty"><Grid3x3 size={28} strokeWidth={1.3} />No active tables to arrange. Add tables first.</div>
  }

  return (
    <div className="fpe-wrap">
      <div className="fpe-bar">
        <div className="fpe-hint"><MousePointer2 size={13} />Drag tables to arrange your floor. Tap a table to change its shape.</div>
        <div className="fpe-bar-actions">
          <button className="fpe-btn ghost" onClick={autoArrange}><Grid3x3 size={14} />Auto-arrange</button>
          <button className="fpe-btn primary" onClick={save} disabled={saving || !dirty}>
            <Save size={14} />{saving ? 'Saving…' : dirty ? 'Save layout' : 'Saved'}
          </button>
        </div>
      </div>

      {selected && (
        <div className="fpe-toolbar">
          <span className="fpe-toolbar-label">{selected.name} · shape</span>
          {SHAPES.map(s => {
            const Icon = s.icon
            const on = pos[selected.id]?.shape === s.value
            return (
              <button key={s.value} className={`fpe-shape ${on ? 'on' : ''}`} onClick={() => setShape(s.value)} title={s.value}>
                <Icon size={15} />
              </button>
            )
          })}
        </div>
      )}

      <div ref={canvasRef} className="fpe-canvas" style={{ height: 500 }}
        onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}
        onClick={(e) => { if (e.target === canvasRef.current) setSelectedId(null) }}>
        <div className="fpe-grid" />
        {active.map(t => {
          const p = pos[t.id]
          if (!p) return null
          const size = Math.min(80, 54 + Math.max(0, t.capacity - 2) * 3)
          const width = p.shape === 'rect' ? size * 1.5 : size
          const radius = p.shape === 'round' ? '50%' : p.shape === 'rect' ? '12px' : '14px'
          const accent = ZONE_ACCENT[t.zone] ?? ZONE_ACCENT.non_ac
          const isSel = t.id === selectedId
          return (
            <button key={t.id} className={`fpe-token ${isSel ? 'sel' : ''}`}
              onPointerDown={(e) => onPointerDownToken(e, t.id)}
              style={{
                left: `${p.x}%`, top: `${p.y}%`, width, height: size, borderRadius: radius,
                borderColor: accent, boxShadow: isSel ? `0 0 0 3px ${accent}55, 0 8px 20px rgba(0,2,29,0.15)` : '0 3px 10px rgba(0,2,29,0.08)',
              }}>
              <span className="fpe-token-name">{t.name}</span>
              <span className="fpe-token-cap"><Users size={9} />{t.capacity}</span>
            </button>
          )
        })}
        <div className="fpe-entrance"><span className="fpe-entrance-line" /><span className="fpe-entrance-label">Entrance</span></div>
      </div>

      <style>{`
        .fpe-wrap { display:flex; flex-direction:column; gap:12px; }
        .fpe-bar { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; }
        .fpe-hint { display:flex; align-items:center; gap:7px; font-size:12.5px; color:var(--color-text-3); font-weight:500; }
        .fpe-bar-actions { display:flex; gap:8px; }
        .fpe-btn { display:inline-flex; align-items:center; gap:6px; height:38px; padding:0 14px; border-radius:9px; font-size:13px; font-weight:700; cursor:pointer; transition:all .15s; border:1px solid var(--color-border-strong); background:#fff; color:var(--color-text-2); }
        .fpe-btn.ghost:hover { border-color:var(--color-text-2); color:var(--color-text-1); }
        .fpe-btn.primary { background:var(--color-primary); color:#fff; border:none; box-shadow:0 2px 10px rgba(214,66,56,0.18); }
        .fpe-btn.primary:hover:not(:disabled) { background:var(--color-primary-hover); }
        .fpe-btn:disabled { opacity:.5; cursor:not-allowed; }

        .fpe-toolbar { display:flex; align-items:center; gap:8px; padding:8px 12px; background:#fff; border:1px solid var(--color-border); border-radius:10px; width:fit-content; }
        .fpe-toolbar-label { font-size:12px; font-weight:700; color:var(--color-text-2); margin-right:4px; }
        .fpe-shape { width:32px; height:32px; border-radius:7px; border:1px solid var(--color-border-strong); background:#fff; color:var(--color-text-3); display:flex; align-items:center; justify-content:center; cursor:pointer; transition:all .15s; }
        .fpe-shape.on { background:var(--color-primary); color:#fff; border-color:var(--color-primary); }

        .fpe-canvas { position:relative; width:100%; border-radius:16px; background:linear-gradient(160deg,#fbfbfa,#f2f3f6); border:1px solid var(--color-border-strong); overflow:hidden; touch-action:none; user-select:none; }
        .fpe-grid { position:absolute; inset:0; opacity:0.6; background-image:linear-gradient(rgba(0,2,29,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(0,2,29,0.04) 1px,transparent 1px); background-size:32px 32px; pointer-events:none; }
        .fpe-token { position:absolute; transform:translate(-50%,-50%); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:1px; background:#fff; border:2px solid; cursor:grab; transition:box-shadow .15s; padding:2px; color:var(--color-text-1); }
        .fpe-token:active { cursor:grabbing; }
        .fpe-token-name { font-size:13px; font-weight:800; line-height:1; }
        .fpe-token-cap { font-size:9px; font-weight:700; opacity:0.55; display:inline-flex; align-items:center; gap:1px; line-height:1; }
        .fpe-entrance { position:absolute; bottom:12px; left:50%; transform:translateX(-50%); width:64%; display:flex; flex-direction:column; align-items:center; gap:4px; pointer-events:none; }
        .fpe-entrance-line { width:100%; height:3px; border-radius:99px; background:linear-gradient(90deg,transparent,rgba(214,66,56,0.5),transparent); }
        .fpe-entrance-label { font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:0.32em; color:var(--color-text-3); }
        .fpe-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; min-height:220px; color:var(--color-text-3); font-size:13px; }
      `}</style>
    </div>
  )
}
