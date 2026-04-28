'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { api } from '@/lib/api'
import type { MenuCategory, MenuItem, Outlet } from '@/types/api'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function vegColor(item: MenuItem) {
  const v = item.priceVariants
  if (v && ('nonVeg' in v || 'seafood' in v)) return 'var(--color-text-3)'
  return item.isVeg ? 'var(--color-success)' : '#ef4444'
}

function vegLabel(item: MenuItem) {
  const v = item.priceVariants
  if (!v) return item.isVeg ? 'Veg' : 'Non-Veg'
  const keys = Object.keys(v)
  return keys.map(k => k === 'veg' ? 'Veg' : k === 'nonVeg' ? 'Non-Veg' : k === 'seafood' ? 'Seafood' : k).join(' / ')
}

function priceDisplay(item: MenuItem): string {
  if (item.priceVariants) {
    return Object.entries(item.priceVariants)
      .map(([k, v]) => `${k === 'veg' ? 'Veg' : k === 'nonVeg' ? 'Non-Veg' : k === 'seafood' ? 'Seafood' : k} ₹${v}`)
      .join('  ·  ')
  }
  return item.price ? `₹${parseFloat(item.price).toFixed(0)}` : '—'
}

// ─── Inline text edit ─────────────────────────────────────────────────────────

function InlineEdit({ value, onSave, style }: { value: string; onSave: (v: string) => void; style?: React.CSSProperties }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editing) ref.current?.select() }, [editing])

  const commit = () => {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== value) onSave(trimmed)
    else setDraft(value)
    setEditing(false)
  }

  if (!editing) {
    return (
      <span
        onClick={() => { setDraft(value); setEditing(true) }}
        title="Click to edit"
        style={{ cursor: 'text', borderBottom: '1px dashed rgba(255,255,255,0.15)', paddingBottom: 1, ...style }}
      >{value}</span>
    )
  }

  return (
    <input
      ref={ref}
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false) } }}
      className="input"
      style={{ padding: '2px 6px', fontSize: 'inherit', width: '100%', ...style }}
    />
  )
}

// ─── Price edit modal ─────────────────────────────────────────────────────────

function PriceEditModal({ item, onClose, onSave }: {
  item: MenuItem
  onClose: () => void
  onSave: (price: number | null, variants: Record<string, number> | null) => void
}) {
  const hasVariants = !!item.priceVariants
  const [mode, setMode] = useState<'single' | 'variants'>(hasVariants ? 'variants' : 'single')
  const [single, setSingle] = useState(item.price ? parseFloat(item.price).toFixed(0) : '')
  const [variants, setVariants] = useState<{ key: string; val: string }[]>(
    hasVariants
      ? Object.entries(item.priceVariants!).map(([k, v]) => ({ key: k, val: String(v) }))
      : [{ key: 'veg', val: '' }, { key: 'nonVeg', val: '' }]
  )

  const handleSave = () => {
    if (mode === 'single') {
      const p = parseFloat(single)
      if (isNaN(p) || p <= 0) return
      onSave(p, null)
    } else {
      const obj: Record<string, number> = {}
      for (const { key, val } of variants) {
        const n = parseFloat(val)
        if (!key.trim() || isNaN(n)) return
        obj[key.trim()] = n
      }
      onSave(null, obj)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={onClose}>
      <div style={{
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)', padding: 24, width: 380, maxWidth: '90vw',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: 'var(--color-text-1)' }}>
          Edit Price — {item.name}
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {(['single', 'variants'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)} className={mode === m ? 'btn-primary' : 'btn-ghost'}
              style={{ fontSize: 12, padding: '4px 12px' }}>
              {m === 'single' ? 'Single Price' : 'Multiple Variants'}
            </button>
          ))}
        </div>

        {mode === 'single' ? (
          <div>
            <label style={{ fontSize: 12, color: 'var(--color-text-3)', display: 'block', marginBottom: 4 }}>Price (₹)</label>
            <input className="input" type="number" min="1" value={single} onChange={e => setSingle(e.target.value)}
              style={{ width: '100%' }} placeholder="e.g. 249" />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {variants.map((v, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input className="input" value={v.key} onChange={e => setVariants(vs => vs.map((x, j) => j === i ? { ...x, key: e.target.value } : x))}
                  style={{ width: 110, fontSize: 12 }} placeholder="veg / nonVeg" />
                <input className="input" type="number" min="1" value={v.val} onChange={e => setVariants(vs => vs.map((x, j) => j === i ? { ...x, val: e.target.value } : x))}
                  style={{ flex: 1, fontSize: 12 }} placeholder="₹" />
                <button onClick={() => setVariants(vs => vs.filter((_, j) => j !== i))} className="btn-ghost"
                  style={{ padding: '4px 8px', fontSize: 12, color: '#ef4444' }}>✕</button>
              </div>
            ))}
            <button onClick={() => setVariants(vs => [...vs, { key: '', val: '' }])} className="btn-ghost"
              style={{ fontSize: 12, alignSelf: 'flex-start' }}>+ Add Variant</button>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
          <button className="btn-ghost" onClick={onClose} style={{ fontSize: 13 }}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} style={{ fontSize: 13 }}>Save Price</button>
        </div>
      </div>
    </div>
  )
}

// ─── Add Item form ────────────────────────────────────────────────────────────

function AddItemForm({ categoryId, onAdded, onCancel }: {
  categoryId: string
  onAdded: (item: MenuItem) => void
  onCancel: () => void
}) {
  const [name, setName]     = useState('')
  const [price, setPrice]   = useState('')
  const [isVeg, setIsVeg]   = useState(true)
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!name.trim() || !price.trim()) return
    setSaving(true)
    try {
      const res = await api.post<MenuItem>('/cms/menu/items', {
        categoryId, name: name.trim(),
        price: parseFloat(price), isVeg,
      })
      onAdded(res.data)
    } finally { setSaving(false) }
  }

  return (
    <div style={{
      display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
      padding: '10px 14px', background: 'rgba(255,255,255,0.03)',
      borderTop: '1px solid var(--color-border)', borderRadius: '0 0 8px 8px',
    }}>
      <input className="input" placeholder="Item name" value={name} onChange={e => setName(e.target.value)}
        style={{ flex: 1, minWidth: 160, fontSize: 13 }} autoFocus />
      <input className="input" type="number" placeholder="Price ₹" value={price} onChange={e => setPrice(e.target.value)}
        style={{ width: 100, fontSize: 13 }} />
      <select className="input" value={isVeg ? 'veg' : 'nonveg'} onChange={e => setIsVeg(e.target.value === 'veg')}
        style={{ width: 'auto', fontSize: 13, padding: '6px 10px' }}>
        <option value="veg">Veg</option>
        <option value="nonveg">Non-Veg</option>
      </select>
      <button className="btn-primary" onClick={submit} disabled={saving || !name.trim() || !price.trim()}
        style={{ fontSize: 13 }}>{saving ? 'Adding…' : 'Add'}</button>
      <button className="btn-ghost" onClick={onCancel} style={{ fontSize: 13 }}>Cancel</button>
    </div>
  )
}

// ─── Category card ────────────────────────────────────────────────────────────

function CategoryCard({ cat, onUpdate, onDelete }: {
  cat: MenuCategory
  onUpdate: (updated: MenuCategory) => void
  onDelete: (id: string) => void
}) {
  const [collapsed, setCollapsed]   = useState(false)
  const [addingItem, setAddingItem] = useState(false)
  const [priceItem, setPriceItem]   = useState<MenuItem | null>(null)
  const [deleting, setDeleting]     = useState(false)

  const updateItemName = async (item: MenuItem, name: string) => {
    const res = await api.put<MenuItem>(`/cms/menu/items/${item.id}`, { name })
    onUpdate({ ...cat, items: cat.items.map(i => i.id === item.id ? res.data : i) })
  }

  const updateItemPrice = async (item: MenuItem, price: number | null, variants: Record<string, number> | null) => {
    const res = await api.put<MenuItem>(`/cms/menu/items/${item.id}`, { price, priceVariants: variants })
    onUpdate({ ...cat, items: cat.items.map(i => i.id === item.id ? res.data : i) })
    setPriceItem(null)
  }

  const toggleAvailable = async (item: MenuItem) => {
    const res = await api.put<MenuItem>(`/cms/menu/items/${item.id}`, { isAvailable: !item.isAvailable })
    onUpdate({ ...cat, items: cat.items.map(i => i.id === item.id ? res.data : i) })
  }

  const deleteItem = async (item: MenuItem) => {
    await api.delete(`/cms/menu/items/${item.id}`)
    onUpdate({ ...cat, items: cat.items.filter(i => i.id !== item.id) })
  }

  const updateCatName = async (name: string) => {
    const res = await api.put<MenuCategory>(`/cms/menu/categories/${cat.id}`, { name })
    onUpdate({ ...cat, name: res.data.name })
  }

  const handleDelete = async () => {
    if (!confirm(`Delete category "${cat.name}" and all its items?`)) return
    setDeleting(true)
    try {
      await Promise.all(cat.items.map(i => api.delete(`/cms/menu/items/${i.id}`)))
      await api.delete(`/cms/menu/categories/${cat.id}`)
      onDelete(cat.id)
    } finally { setDeleting(false) }
  }

  return (
    <div style={{
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 16,
    }}>
      {/* Category header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 16px', borderBottom: collapsed ? 'none' : '1px solid var(--color-border)',
        background: 'rgba(255,255,255,0.02)',
      }}>
        <button onClick={() => setCollapsed(c => !c)} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--color-text-3)', fontSize: 12, padding: 0, flexShrink: 0,
          transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.15s',
        }}>▼</button>

        <InlineEdit
          value={cat.name}
          onSave={updateCatName}
          style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-text-1)', flex: 1 }}
        />

        <span style={{ fontSize: 11, color: 'var(--color-text-3)', flexShrink: 0 }}>
          {cat.items.length} item{cat.items.length !== 1 ? 's' : ''}
        </span>

        <button
          onClick={() => setAddingItem(a => !a)}
          className="btn-ghost"
          style={{ fontSize: 12, padding: '3px 10px', flexShrink: 0 }}
        >+ Item</button>

        <button onClick={handleDelete} disabled={deleting} className="btn-ghost"
          style={{ fontSize: 12, padding: '3px 8px', color: '#ef4444', flexShrink: 0 }}>
          {deleting ? '…' : 'Delete'}
        </button>
      </div>

      {/* Items */}
      {!collapsed && (
        <>
          {cat.items.length === 0 && !addingItem && (
            <div style={{ padding: '20px 16px', textAlign: 'center', fontSize: 13, color: 'var(--color-text-3)' }}>
              No items — click "+ Item" to add one
            </div>
          )}

          {cat.items.map((item, idx) => (
            <div key={item.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
              borderBottom: idx < cat.items.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              opacity: item.isAvailable ? 1 : 0.45,
            }}>
              {/* Veg dot */}
              <div style={{
                width: 10, height: 10, borderRadius: 2, flexShrink: 0,
                background: vegColor(item),
                border: `1px solid ${vegColor(item)}`,
              }} title={vegLabel(item)} />

              {/* Name */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <InlineEdit
                  value={item.name}
                  onSave={name => updateItemName(item, name)}
                  style={{ fontSize: 13, color: 'var(--color-text-1)', fontWeight: 500 }}
                />
                {item.description && (
                  <div style={{ fontSize: 11, color: 'var(--color-text-3)', marginTop: 2 }}>{item.description}</div>
                )}
              </div>

              {/* Price */}
              <button
                onClick={() => setPriceItem(item)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 600, color: 'var(--color-primary)',
                  padding: '2px 6px', borderRadius: 4,
                  borderBottom: '1px dashed rgba(255,255,255,0.15)',
                  whiteSpace: 'nowrap', flexShrink: 0,
                }}
                title="Click to edit price"
              >{priceDisplay(item)}</button>

              {/* Available toggle */}
              <button
                onClick={() => toggleAvailable(item)}
                className="btn-ghost"
                style={{ fontSize: 11, padding: '2px 8px', flexShrink: 0,
                  color: item.isAvailable ? 'var(--color-success)' : 'var(--color-text-3)' }}
                title={item.isAvailable ? 'Mark unavailable' : 'Mark available'}
              >{item.isAvailable ? 'Available' : 'Hidden'}</button>

              {/* Delete item */}
              <button
                onClick={() => { if (confirm(`Delete "${item.name}"?`)) deleteItem(item) }}
                className="btn-ghost"
                style={{ fontSize: 12, padding: '2px 6px', color: '#ef4444', flexShrink: 0 }}
              >✕</button>
            </div>
          ))}

          {addingItem && (
            <AddItemForm
              categoryId={cat.id}
              onAdded={item => { onUpdate({ ...cat, items: [...cat.items, item] }); setAddingItem(false) }}
              onCancel={() => setAddingItem(false)}
            />
          )}
        </>
      )}

      {/* Price edit modal */}
      {priceItem && (
        <PriceEditModal
          item={priceItem}
          onClose={() => setPriceItem(null)}
          onSave={(price, variants) => updateItemPrice(priceItem, price, variants)}
        />
      )}
    </div>
  )
}

// ─── Add Category modal ───────────────────────────────────────────────────────

function AddCategoryModal({ outletId, onAdded, onClose }: {
  outletId: string
  onAdded: (cat: MenuCategory) => void
  onClose: () => void
}) {
  const [name, setName]     = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      const res = await api.post<MenuCategory>('/cms/menu/categories', { name: name.trim(), outletId })
      onAdded({ ...res.data, items: [] })
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={onClose}>
      <div style={{
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)', padding: 24, width: 360, maxWidth: '90vw',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>New Category</div>
        <input className="input" placeholder="Category name" value={name} onChange={e => setName(e.target.value)}
          style={{ width: '100%', marginBottom: 16 }} autoFocus
          onKeyDown={e => e.key === 'Enter' && submit()} />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn-ghost" onClick={onClose} style={{ fontSize: 13 }}>Cancel</button>
          <button className="btn-primary" onClick={submit} disabled={saving || !name.trim()}
            style={{ fontSize: 13 }}>{saving ? 'Creating…' : 'Create'}</button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MenuPage() {
  const [outlets, setOutlets]       = useState<Outlet[]>([])
  const [outletId, setOutletId]     = useState('')
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [loading, setLoading]       = useState(false)
  const [showAdd, setShowAdd]       = useState(false)

  useEffect(() => {
    api.get<Outlet[]>('/cms/outlets').then(r => {
      setOutlets(r.data)
      if (r.data.length > 0) setOutletId(r.data[0].id)
    }).catch(() => {})
  }, [])

  const fetchMenu = useCallback(async () => {
    if (!outletId) return
    setLoading(true)
    try {
      const res = await api.get<MenuCategory[]>(`/cms/menu?outletId=${outletId}`)
      setCategories(res.data)
    } finally { setLoading(false) }
  }, [outletId])

  useEffect(() => { fetchMenu() }, [fetchMenu])

  const selectedOutlet = outlets.find(o => o.id === outletId)
  const totalItems = categories.reduce((n, c) => n + c.items.length, 0)

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 className="page-title">Menu</h1>
            <p className="page-subtitle">
              {selectedOutlet
                ? `${categories.length} categories · ${totalItems} items · ${selectedOutlet.name}`
                : 'Select an outlet to manage its menu'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <select className="input" value={outletId} onChange={e => setOutletId(e.target.value)}
              style={{ width: 'auto', padding: '6px 12px', fontSize: 13 }}>
              {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            {outletId && (
              <button className="btn-primary" onClick={() => setShowAdd(true)} style={{ fontSize: 13 }}>
                + Category
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="page-content">
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} style={{ height: 60, background: 'var(--color-surface)', borderRadius: 8, opacity: 0.5, animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
            <style>{`@keyframes pulse{0%,100%{opacity:0.4}50%{opacity:0.8}}`}</style>
          </div>
        )}

        {!loading && categories.length === 0 && outletId && (
          <div className="empty-state">
            <div className="empty-state-icon">🍽️</div>
            <div className="empty-state-title">No menu categories yet</div>
            <div className="empty-state-desc">Add a category to start building your menu.</div>
            <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => setShowAdd(true)}>+ Add Category</button>
          </div>
        )}

        {!loading && categories.map(cat => (
          <CategoryCard
            key={cat.id}
            cat={cat}
            onUpdate={updated => setCategories(cs => cs.map(c => c.id === updated.id ? updated : c))}
            onDelete={id => setCategories(cs => cs.filter(c => c.id !== id))}
          />
        ))}
      </div>

      {showAdd && outletId && (
        <AddCategoryModal
          outletId={outletId}
          onAdded={cat => setCategories(cs => [...cs, cat])}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  )
}
