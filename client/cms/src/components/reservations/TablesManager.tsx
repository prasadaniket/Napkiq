'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import type { RestaurantTable, TableZone, Outlet, ReservationSettings } from '@/types/api'
import toast from 'react-hot-toast'
import GSAPDropdown from '@/components/ui/GSAPDropdown'
import FloorPlanEditor from '@/components/reservations/FloorPlanEditor'
import { Store, Plus, Trash2, Armchair, Activity, Check, X, Power, List, LayoutGrid } from 'lucide-react'

const ZONES: { value: TableZone; label: string }[] = [
  { value: 'ac',      label: 'AC' },
  { value: 'non_ac',  label: 'Non-AC' },
  { value: 'outdoor', label: 'Outdoor' },
]
const ZONE_LABEL: Record<TableZone, string> = { ac: 'AC', non_ac: 'Non-AC', outdoor: 'Outdoor' }

export default function TablesManager() {
  const { isFranchise } = useAuth()
  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [outletId, setOutletId] = useState('')
  const [tables, setTables] = useState<RestaurantTable[]>([])
  const [settings, setSettings] = useState<ReservationSettings | null>(null)
  const [loading, setLoading] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [view, setView] = useState<'list' | 'layout'>('list')

  // New-table form (supports bulk)
  const [name, setName] = useState('')
  const [capacity, setCapacity] = useState(2)
  const [zone, setZone] = useState<TableZone>('non_ac')
  const [quantity, setQuantity] = useState(1)
  const [adding, setAdding] = useState(false)

  // Default name prefix per zone when adding several at once (A1, N1, O1…).
  const ZONE_PREFIX: Record<TableZone, string> = { ac: 'A', non_ac: 'N', outdoor: 'O' }

  useEffect(() => {
    api.get<Outlet[]>('/cms/outlets').then(r => {
      setOutlets(r.data)
      if (r.data.length > 0) setOutletId(r.data[0].id)
    }).catch(() => {})
  }, [])

  const load = useCallback(async (oid: string) => {
    setLoading(true)
    try {
      const [t, s] = await Promise.all([
        api.get<RestaurantTable[]>(`/cms/tables?outletId=${oid}`),
        api.get<ReservationSettings>(`/cms/reservations/settings?outletId=${oid}`),
      ])
      setTables(t.data)
      setSettings(s.data)
    } catch {
      toast.error('Failed to load tables')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (outletId) load(outletId) }, [outletId, load])

  const patchSettings = async (patch: Partial<ReservationSettings>) => {
    if (!settings) return
    setSettings({ ...settings, ...patch }) // optimistic
    setSavingSettings(true)
    try {
      const res = await api.patch<ReservationSettings>('/cms/reservations/settings', { outletId, ...patch })
      setSettings(res.data)
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save settings')
      load(outletId)
    } finally {
      setSavingSettings(false)
    }
  }

  const addTable = async () => {
    const qty = Math.max(1, quantity)
    const prefix = (name.trim() || ZONE_PREFIX[zone])
    setAdding(true)
    try {
      // One custom-named table → single create; otherwise bulk with auto-numbered names.
      if (qty === 1 && name.trim()) {
        const res = await api.post<RestaurantTable>('/cms/tables', { outletId, name: name.trim(), capacity, zone })
        setTables(prev => [...prev, res.data])
        toast.success('Table added')
      } else {
        const res = await api.post<{ created: number; from: string; to: string }>(
          '/cms/tables/bulk', { outletId, namePrefix: prefix, capacity, zone, count: qty }
        )
        await load(outletId)
        toast.success(`Added ${res.data.created} table${res.data.created > 1 ? 's' : ''} (${res.data.from}–${res.data.to})`)
      }
      setName(''); setCapacity(2); setQuantity(1)
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Could not add tables')
    } finally {
      setAdding(false)
    }
  }

  const toggleActive = async (t: RestaurantTable) => {
    setTables(prev => prev.map(x => x.id === t.id ? { ...x, isActive: !x.isActive } : x))
    try {
      await api.patch(`/cms/tables/${t.id}`, { isActive: !t.isActive })
    } catch {
      toast.error('Failed to update table')
      load(outletId)
    }
  }

  const removeTable = async (t: RestaurantTable) => {
    if (!confirm(`Delete table "${t.name}" permanently? This cannot be undone.`)) return
    try {
      const res = await api.delete<{ ok: boolean; deleted?: boolean; message?: string }>(`/cms/tables/${t.id}`)
      if (res.data.deleted === false) {
        // Had reservation history — server deactivated it instead of hard-deleting.
        setTables(prev => prev.map(x => x.id === t.id ? { ...x, isActive: false } : x))
        toast(res.data.message || 'Table has bookings, so it was deactivated instead.')
      } else {
        setTables(prev => prev.filter(x => x.id !== t.id))
        toast.success('Table deleted')
      }
    } catch {
      toast.error('Failed to delete table')
    }
  }

  const grouped = ZONES.map(z => ({ zone: z, items: tables.filter(t => t.zone === z.value) }))

  return (
    <div className="tbl-page">
      <div className="tbl-header">
        <div>
          <h1 className="tbl-title">Tables & Settings</h1>
          <p className="tbl-subtitle">Define your tables and control reservation availability</p>
        </div>
        {!isFranchise && (
          <GSAPDropdown
            value={outletId}
            onChange={setOutletId}
            options={outlets.map(o => ({ value: o.id, label: o.name }))}
            icon={<Store size={14} />}
            width="190px"
          />
        )}
      </div>

      {/* ── Reservation settings ── */}
      {settings && (
        <div className="tbl-settings-card">
          <div className="tbl-toggle-row">
            <div>
              <div className="tbl-toggle-label"><Power size={15} />Table reservations</div>
              <div className="tbl-toggle-desc">
                {settings.reservationsEnabled
                  ? 'Guests can book a table from the customer app.'
                  : 'Hidden from the customer app — bookings only via staff.'}
              </div>
            </div>
            <button
              className={`tbl-switch ${settings.reservationsEnabled ? 'on' : ''}`}
              disabled={savingSettings}
              onClick={() => patchSettings({ reservationsEnabled: !settings.reservationsEnabled })}
              aria-label="Toggle reservations"
            >
              <span className="tbl-switch-knob" />
            </button>
          </div>

          <div className="tbl-settings-grid">
            <label className="tbl-field"><span>Opens</span>
              <input type="time" className="tbl-input" value={settings.reservationOpenTime ?? '11:00'}
                onChange={e => setSettings({ ...settings, reservationOpenTime: e.target.value })}
                onBlur={e => patchSettings({ reservationOpenTime: e.target.value })} />
            </label>
            <label className="tbl-field"><span>Closes</span>
              <input type="time" className="tbl-input" value={settings.reservationCloseTime ?? '23:00'}
                onChange={e => setSettings({ ...settings, reservationCloseTime: e.target.value })}
                onBlur={e => patchSettings({ reservationCloseTime: e.target.value })} />
            </label>
            <label className="tbl-field"><span>Slot gap (min)</span>
              <input type="number" min={15} max={240} step={15} className="tbl-input" value={settings.reservationSlotMinutes}
                onChange={e => setSettings({ ...settings, reservationSlotMinutes: parseInt(e.target.value) || 60 })}
                onBlur={e => patchSettings({ reservationSlotMinutes: parseInt(e.target.value) || 60 })} />
            </label>
            <label className="tbl-field"><span>Duration (min)</span>
              <input type="number" min={15} max={480} step={15} className="tbl-input" value={settings.reservationDurationMinutes}
                onChange={e => setSettings({ ...settings, reservationDurationMinutes: parseInt(e.target.value) || 90 })}
                onBlur={e => patchSettings({ reservationDurationMinutes: parseInt(e.target.value) || 90 })} />
            </label>
            <label className="tbl-field"><span>Hold (min)</span>
              <input type="number" min={2} max={60} className="tbl-input" value={settings.reservationHoldMinutes}
                onChange={e => setSettings({ ...settings, reservationHoldMinutes: parseInt(e.target.value) || 10 })}
                onBlur={e => patchSettings({ reservationHoldMinutes: parseInt(e.target.value) || 10 })} />
            </label>
          </div>
        </div>
      )}

      {/* ── Add table(s) ── */}
      <div className="tbl-add-card">
        <div className="tbl-add-row">
          <div className="tbl-field" style={{ width: 120 }}><span>How many</span>
            <input type="number" min={1} max={100} className="tbl-input" value={quantity}
              onChange={e => setQuantity(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))} />
          </div>
          <div className="tbl-field" style={{ width: 110 }}><span>Seats each</span>
            <input type="number" min={1} max={50} className="tbl-input" value={capacity}
              onChange={e => setCapacity(Math.max(1, parseInt(e.target.value) || 1))} />
          </div>
          <div className="tbl-field" style={{ width: 150 }}><span>Zone</span>
            <GSAPDropdown value={zone} onChange={v => setZone(v as TableZone)} options={ZONES} width="150px" />
          </div>
          <div className="tbl-field" style={{ flex: 1, minWidth: 150 }}>
            <span>{quantity > 1 ? 'Name prefix (optional)' : 'Table name (optional)'}</span>
            <input className="tbl-input" style={{ width: '100%' }} value={name} onChange={e => setName(e.target.value)}
              placeholder={quantity > 1 ? `e.g. ${ZONE_PREFIX[zone]} → ${ZONE_PREFIX[zone]}1, ${ZONE_PREFIX[zone]}2…` : 'e.g. Window 4 (auto if blank)'} />
          </div>
          <button className="tbl-btn-primary" disabled={adding} onClick={addTable}>
            <Plus size={14} strokeWidth={2.5} />{adding ? 'Adding…' : quantity > 1 ? `Add ${quantity} tables` : 'Add table'}
          </button>
        </div>
        <div className="tbl-add-hint">
          {quantity > 1
            ? `Creates ${quantity} × ${capacity}-seat ${ZONES.find(z => z.value === zone)?.label} tables named ${(name.trim() || ZONE_PREFIX[zone])}1, ${(name.trim() || ZONE_PREFIX[zone])}2, … (continues after existing numbers).`
            : `Tip: set "How many" above 1 to add several tables at once.`}
        </div>
      </div>

      {/* ── View toggle: list vs floor layout ── */}
      {tables.length > 0 && (
        <div className="tbl-viewtoggle">
          <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}><List size={14} />Tables</button>
          <button className={view === 'layout' ? 'on' : ''} onClick={() => setView('layout')}><LayoutGrid size={14} />Arrange floor</button>
        </div>
      )}

      {/* ── Tables list / floor layout ── */}
      {loading ? (
        <div className="tbl-empty"><Activity className="animate-spin" size={22} />Loading tables…</div>
      ) : tables.length === 0 ? (
        <div className="tbl-empty"><Armchair size={30} strokeWidth={1.3} />No tables yet. Add your first table above.</div>
      ) : view === 'layout' ? (
        <FloorPlanEditor outletId={outletId} tables={tables} onSaved={() => load(outletId)} />
      ) : (
        <div className="tbl-zones">
          {grouped.filter(g => g.items.length > 0).map(g => (
            <div key={g.zone.value} className="tbl-zone-block">
              <div className="tbl-zone-title">{g.zone.label} <span>{g.items.length}</span></div>
              <div className="tbl-grid">
                {g.items.map(t => (
                  <div key={t.id} className={`tbl-chip ${t.isActive ? '' : 'inactive'}`}>
                    <div className="tbl-chip-main">
                      <strong>{t.name}</strong>
                      <span>{t.capacity} seats · {ZONE_LABEL[t.zone]}</span>
                    </div>
                    <div className="tbl-chip-actions">
                      <button className="tbl-icon-btn" title={t.isActive ? 'Active — click to disable' : 'Disabled — click to enable'}
                        onClick={() => toggleActive(t)}>
                        {t.isActive ? <Check size={13} /> : <X size={13} />}
                      </button>
                      <button className="tbl-icon-btn danger" title="Remove" onClick={() => removeTable(t)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .tbl-page { background:#fafaf9; min-height:calc(100vh - 40px); border-radius:var(--radius-xl); padding:1.5rem; margin:1.5rem; border:1px solid var(--color-border); display:flex; flex-direction:column; gap:1.25rem; }
        .tbl-header { display:flex; align-items:center; justify-content:space-between; padding:1.25rem 1.5rem; background:#fff; border:1px solid var(--color-border); border-radius:var(--radius-xl); flex-wrap:wrap; gap:12px; }
        .tbl-title { font-size:1.4rem; font-weight:800; color:var(--color-text-1); letter-spacing:-0.02em; margin:0; }
        .tbl-subtitle { font-size:13px; color:var(--color-text-3); margin:2px 0 0; }

        .tbl-settings-card, .tbl-add-card { background:#fff; border:1px solid var(--color-border); border-radius:var(--radius-xl); padding:1.25rem 1.5rem; }
        .tbl-add-card { display:flex; flex-direction:column; gap:12px; }
        .tbl-add-row { display:flex; align-items:flex-end; gap:12px; flex-wrap:wrap; }
        .tbl-add-hint { font-size:12px; color:var(--color-text-3); line-height:1.5; }
        .tbl-toggle-row { display:flex; align-items:center; justify-content:space-between; gap:16px; padding-bottom:1rem; border-bottom:1px solid var(--color-border); margin-bottom:1rem; }
        .tbl-toggle-label { display:flex; align-items:center; gap:8px; font-size:14px; font-weight:800; color:var(--color-text-1); }
        .tbl-toggle-desc { font-size:12px; color:var(--color-text-3); margin-top:3px; }
        .tbl-switch { width:46px; height:26px; border-radius:99px; border:none; background:rgba(0,2,29,0.12); position:relative; cursor:pointer; transition:background .2s; flex-shrink:0; }
        .tbl-switch.on { background:var(--color-success); }
        .tbl-switch-knob { position:absolute; top:3px; left:3px; width:20px; height:20px; border-radius:50%; background:#fff; box-shadow:0 1px 3px rgba(0,0,0,0.2); transition:transform .2s; }
        .tbl-switch.on .tbl-switch-knob { transform:translateX(20px); }
        .tbl-switch:disabled { opacity:.6; cursor:not-allowed; }
        .tbl-settings-grid { display:flex; gap:12px; flex-wrap:wrap; }

        .tbl-field { display:flex; flex-direction:column; gap:5px; }
        .tbl-field > span { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:var(--color-text-3); }
        .tbl-input { background:#fff; border:1px solid var(--color-border-strong); border-radius:8px; padding:9px 12px; font-size:13px; font-weight:500; color:var(--color-text-1); width:120px; transition:all .2s; }
        .tbl-input:focus { outline:none; border-color:var(--color-primary); box-shadow:0 0 0 3px var(--color-primary-border); }

        .tbl-btn-primary { display:inline-flex; align-items:center; gap:6px; background:var(--color-primary); color:#fff; font-weight:700; font-size:13px; border:none; padding:0 16px; height:40px; border-radius:var(--radius-md); cursor:pointer; transition:all .2s; }
        .tbl-btn-primary:hover:not(:disabled){ background:var(--color-primary-hover); transform:translateY(-1px); }
        .tbl-btn-primary:disabled{ opacity:.5; cursor:not-allowed; }

        .tbl-viewtoggle { display:inline-flex; background:#fff; border:1px solid var(--color-border); border-radius:10px; padding:3px; gap:2px; width:fit-content; }
        .tbl-viewtoggle button { display:inline-flex; align-items:center; gap:6px; border:none; background:transparent; font-size:12.5px; font-weight:700; color:var(--color-text-3); padding:7px 14px; border-radius:7px; cursor:pointer; transition:all .15s; }
        .tbl-viewtoggle button.on { background:var(--color-primary); color:#fff; }
        .tbl-zones { display:flex; flex-direction:column; gap:1.25rem; }
        .tbl-zone-block { background:#fff; border:1px solid var(--color-border); border-radius:var(--radius-xl); padding:1.25rem 1.5rem; }
        .tbl-zone-title { font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:0.06em; color:var(--color-text-2); margin-bottom:1rem; display:flex; align-items:center; gap:8px; }
        .tbl-zone-title span { font-size:11px; background:rgba(0,2,29,0.04); color:var(--color-text-3); padding:1px 7px; border-radius:99px; }
        .tbl-grid { display:flex; flex-wrap:wrap; gap:10px; }
        .tbl-chip { display:flex; align-items:center; gap:12px; padding:10px 12px; border:1px solid var(--color-border-strong); border-radius:10px; background:#fff; }
        .tbl-chip.inactive { opacity:.5; background:rgba(0,2,29,0.02); }
        .tbl-chip-main { display:flex; flex-direction:column; gap:1px; }
        .tbl-chip-main strong { font-size:14px; color:var(--color-text-1); }
        .tbl-chip-main span { font-size:11px; color:var(--color-text-3); }
        .tbl-chip-actions { display:flex; gap:4px; }
        .tbl-icon-btn { width:28px; height:28px; border-radius:6px; border:1px solid var(--color-border); background:#fff; color:var(--color-text-2); display:flex; align-items:center; justify-content:center; cursor:pointer; transition:all .2s; }
        .tbl-icon-btn:hover { border-color:var(--color-border-strong); color:var(--color-text-1); }
        .tbl-icon-btn.danger:hover { color:var(--color-danger); border-color:rgba(220,38,38,0.2); background:rgba(220,38,38,0.05); }
        .tbl-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; min-height:220px; color:var(--color-text-3); font-size:13px; background:#fff; border:1px solid var(--color-border); border-radius:var(--radius-xl); }
      `}</style>
    </div>
  )
}
