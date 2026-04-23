'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { api } from '@/lib/api'
import toast from 'react-hot-toast'
import type { MenuCategory, MenuItem, Outlet } from '@/types/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ItemModalState {
  mode:       'add' | 'edit'
  categoryId: string
  item?:      MenuItem
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function VegBadge({ isVeg }: { isVeg: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '1px 6px', borderRadius: 99, fontSize: 10, fontWeight: 700,
      background: isVeg ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
      color:      isVeg ? 'var(--color-success)'  : 'var(--color-danger)',
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: isVeg ? 'var(--color-success)' : 'var(--color-danger)',
        display: 'inline-block',
      }} />
      {isVeg ? 'Veg' : 'Non-veg'}
    </span>
  )
}

// ─── Item card ────────────────────────────────────────────────────────────────

function ItemCard({
  item,
  onEdit,
  onDelete,
  onImageUpload,
  onImageRemove,
}: {
  item:          MenuItem
  onEdit:        (item: MenuItem) => void
  onDelete:      (item: MenuItem) => void
  onImageUpload: (item: MenuItem, file: File) => void
  onImageRemove: (item: MenuItem) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 10,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Image */}
      <div
        style={{
          height: 130, background: 'var(--color-surface-2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', cursor: 'pointer',
        }}
        onClick={() => fileRef.current?.click()}
        title="Click to upload image"
      >
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt={item.name}
            fill
            style={{ objectFit: 'cover' }}
            sizes="200px"
          />
        ) : (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-3)" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        )}
        {/* Upload overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: 0, transition: 'opacity 0.15s',
          fontSize: 11, color: '#fff', fontWeight: 600, gap: 4,
        }}
          className="img-hover-overlay"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          {item.imageUrl ? 'Replace' : 'Upload'}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={e => {
            const f = e.target.files?.[0]
            if (f) onImageUpload(item, f)
            e.target.value = ''
          }}
        />
      </div>

      {/* Info */}
      <div style={{ padding: '10px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text-1)', lineHeight: 1.3 }}>
            {item.name}
          </div>
          <VegBadge isVeg={item.isVeg} />
        </div>

        {item.description && (
          <div style={{ fontSize: 11, color: 'var(--color-text-3)', lineHeight: 1.4 }}>
            {item.description}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary)' }}>
            {item.price ? `₹${item.price}` : '—'}
          </div>
          {!item.isAvailable && (
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-danger)', background: 'rgba(239,68,68,0.1)', padding: '1px 6px', borderRadius: 99 }}>
              Unavailable
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{
        display: 'flex', borderTop: '1px solid var(--color-border)',
        padding: '6px 8px', gap: 4,
      }}>
        <button
          className="btn-ghost"
          style={{ fontSize: 11, flex: 1 }}
          onClick={() => onEdit(item)}
        >
          Edit
        </button>
        {item.imageUrl && (
          <button
            className="btn-ghost"
            style={{ fontSize: 11, color: 'var(--color-text-3)' }}
            onClick={() => onImageRemove(item)}
            title="Remove image"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}
        <button
          className="btn-ghost"
          style={{ fontSize: 11, color: 'var(--color-danger)' }}
          onClick={() => onDelete(item)}
          title="Delete item"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6"/><path d="M14 11v6"/>
          </svg>
        </button>
      </div>

      <style>{`.img-hover-overlay:hover { opacity: 1 !important; }`}</style>
    </div>
  )
}

// ─── Item Modal ───────────────────────────────────────────────────────────────

function ItemModal({
  state,
  onClose,
  onSaved,
}: {
  state:   ItemModalState
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = state.mode === 'edit'
  const [form, setForm] = useState({
    name:        state.item?.name        ?? '',
    description: state.item?.description ?? '',
    price:       state.item?.price       ?? '',
    isVeg:       state.item?.isVeg       ?? true,
    isAvailable: state.item?.isAvailable ?? true,
    displayOrder: state.item?.displayOrder?.toString() ?? '0',
  })
  const [saving, setSaving] = useState(false)

  const set = (k: keyof typeof form, v: string | boolean) =>
    setForm(f => ({ ...f, [k]: v }))

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Name is required'); return }
    setSaving(true)
    try {
      const body = {
        name:        form.name.trim(),
        description: form.description.trim() || null,
        price:       form.price ? parseFloat(form.price) : null,
        isVeg:       form.isVeg,
        isAvailable: form.isAvailable,
        displayOrder: parseInt(form.displayOrder) || 0,
        categoryId:  state.categoryId,
      }
      if (isEdit && state.item) {
        await api.put(`/cms/menu/items/${state.item.id}`, body)
        toast.success('Item updated')
      } else {
        await api.post('/cms/menu/items', body)
        toast.success('Item added')
      }
      onSaved()
    } catch {
      toast.error('Failed to save item')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 14, width: '100%', maxWidth: 440,
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700 }}>{isEdit ? 'Edit Item' : 'Add Item'}</h3>
          <button className="btn-ghost" style={{ padding: '4px 8px' }} onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--color-text-2)', display: 'block', marginBottom: 4 }}>Name *</label>
            <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Butter Chicken" style={{ width: '100%' }} />
          </div>

          <div>
            <label style={{ fontSize: 12, color: 'var(--color-text-2)', display: 'block', marginBottom: 4 }}>Description</label>
            <textarea className="input" value={form.description} onChange={e => set('description', e.target.value)}
              placeholder="Short description…" rows={2}
              style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }} />
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, color: 'var(--color-text-2)', display: 'block', marginBottom: 4 }}>Price (₹)</label>
              <input className="input" type="number" min="0" step="0.50" value={form.price}
                onChange={e => set('price', e.target.value)} placeholder="0" style={{ width: '100%' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, color: 'var(--color-text-2)', display: 'block', marginBottom: 4 }}>Display Order</label>
              <input className="input" type="number" min="0" value={form.displayOrder}
                onChange={e => set('displayOrder', e.target.value)} style={{ width: '100%' }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <label style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
              background: form.isVeg ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
              border: `1px solid ${form.isVeg ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
              borderRadius: 8, padding: '8px 12px', transition: 'all 0.2s',
            }}>
              <input type="checkbox" checked={form.isVeg} onChange={e => set('isVeg', e.target.checked)}
                style={{ accentColor: form.isVeg ? 'var(--color-success)' : 'var(--color-danger)' }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: form.isVeg ? 'var(--color-success)' : 'var(--color-danger)' }}>
                {form.isVeg ? 'Veg' : 'Non-veg'}
              </span>
            </label>

            <label style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
              background: form.isAvailable ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
              border: `1px solid ${form.isAvailable ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
              borderRadius: 8, padding: '8px 12px', transition: 'all 0.2s',
            }}>
              <input type="checkbox" checked={form.isAvailable} onChange={e => set('isAvailable', e.target.checked)}
                style={{ accentColor: 'var(--color-success)' }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: form.isAvailable ? 'var(--color-success)' : 'var(--color-danger)' }}>
                {form.isAvailable ? 'Available' : 'Unavailable'}
              </span>
            </label>
          </div>
        </div>

        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--color-border)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Item'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Category section ─────────────────────────────────────────────────────────

function CategorySection({
  category,
  onItemEdit,
  onItemDelete,
  onItemAdd,
  onImageUpload,
  onImageRemove,
  onCategoryEdit,
  onCategoryDelete,
}: {
  category:         MenuCategory
  onItemEdit:       (item: MenuItem, catId: string) => void
  onItemDelete:     (item: MenuItem) => void
  onItemAdd:        (catId: string) => void
  onImageUpload:    (item: MenuItem, file: File) => void
  onImageRemove:    (item: MenuItem) => void
  onCategoryEdit:   (cat: MenuCategory) => void
  onCategoryDelete: (cat: MenuCategory) => void
}) {
  const [open, setOpen] = useState(true)

  return (
    <div style={{
      border: '1px solid var(--color-border)',
      borderRadius: 12,
      overflow: 'hidden',
      marginBottom: 12,
    }}>
      {/* Category header */}
      <div style={{
        background: 'var(--color-surface)',
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 10,
        cursor: 'pointer',
      }}
        onClick={() => setOpen(o => !o)}
      >
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-3)" strokeWidth="2"
          style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}
        >
          <polyline points="9 18 15 12 9 6"/>
        </svg>
        <span style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>{category.name}</span>
        <span style={{ fontSize: 12, color: 'var(--color-text-3)' }}>
          {category.items.length} item{category.items.length !== 1 ? 's' : ''}
        </span>
        {category.outlet && (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 99,
            background: 'rgba(255,255,255,0.05)', color: 'var(--color-text-3)',
          }}>
            {category.outlet.code}
          </span>
        )}
        {/* Category actions */}
        <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
          <button
            className="btn-ghost"
            style={{ fontSize: 11, padding: '3px 8px' }}
            onClick={() => onItemAdd(category.id)}
          >
            + Item
          </button>
          <button
            className="btn-ghost"
            style={{ fontSize: 11, padding: '3px 8px' }}
            onClick={() => onCategoryEdit(category)}
          >
            Edit
          </button>
          <button
            className="btn-ghost"
            style={{ fontSize: 11, padding: '3px 8px', color: 'var(--color-danger)' }}
            onClick={() => onCategoryDelete(category)}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Items grid */}
      {open && (
        <div style={{
          padding: 16,
          background: 'var(--color-surface-2)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
          gap: 12,
        }}>
          {category.items.length === 0 && (
            <div style={{
              gridColumn: '1 / -1', textAlign: 'center', padding: '24px 0',
              color: 'var(--color-text-3)', fontSize: 13,
            }}>
              No items yet —{' '}
              <button
                className="btn-ghost"
                style={{ fontSize: 13, display: 'inline', padding: '0 4px' }}
                onClick={() => onItemAdd(category.id)}
              >
                add one
              </button>
            </div>
          )}
          {category.items.map(item => (
            <ItemCard
              key={item.id}
              item={item}
              onEdit={i => onItemEdit(i, category.id)}
              onDelete={onItemDelete}
              onImageUpload={onImageUpload}
              onImageRemove={onImageRemove}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Category Modal ───────────────────────────────────────────────────────────

function CategoryModal({
  category,
  outlets,
  onClose,
  onSaved,
}: {
  category?: MenuCategory
  outlets:   Outlet[]
  onClose:   () => void
  onSaved:   () => void
}) {
  const isEdit = !!category
  const [name, setName]             = useState(category?.name ?? '')
  const [outletId, setOutletId]     = useState(category?.outletId ?? '')
  const [displayOrder, setOrder]    = useState(category?.displayOrder?.toString() ?? '0')
  const [saving, setSaving]         = useState(false)

  async function handleSave() {
    if (!name.trim()) { toast.error('Category name is required'); return }
    setSaving(true)
    try {
      const body = {
        name: name.trim(),
        outletId: outletId || null,
        displayOrder: parseInt(displayOrder) || 0,
      }
      if (isEdit && category) {
        await api.put(`/cms/menu/categories/${category.id}`, body)
        toast.success('Category updated')
      } else {
        await api.post('/cms/menu/categories', body)
        toast.success('Category added')
      }
      onSaved()
    } catch {
      toast.error('Failed to save category')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 14, width: '100%', maxWidth: 380,
      }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700 }}>{isEdit ? 'Edit Category' : 'Add Category'}</h3>
          <button className="btn-ghost" style={{ padding: '4px 8px' }} onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--color-text-2)', display: 'block', marginBottom: 4 }}>Name *</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Starters" style={{ width: '100%' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--color-text-2)', display: 'block', marginBottom: 4 }}>Outlet (leave blank = all outlets)</label>
            <select className="input" value={outletId} onChange={e => setOutletId(e.target.value)} style={{ width: '100%' }}>
              <option value="">All outlets</option>
              {outlets.map(o => (
                <option key={o.id} value={o.id}>{o.name} ({o.code})</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--color-text-2)', display: 'block', marginBottom: 4 }}>Display Order</label>
            <input className="input" type="number" min="0" value={displayOrder}
              onChange={e => setOrder(e.target.value)} style={{ width: '100%' }} />
          </div>
        </div>

        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--color-border)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Category'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MenuPage() {
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [outlets, setOutlets]       = useState<Outlet[]>([])
  const [loading, setLoading]       = useState(true)
  const [filterOutlet, setFilter]   = useState('')

  const [itemModal, setItemModal]         = useState<ItemModalState | null>(null)
  const [catModal, setCatModal]           = useState<{ open: boolean; category?: MenuCategory }>({ open: false })
  const [uploadingId, setUploadingId]     = useState<string | null>(null)

  async function fetchData() {
    setLoading(true)
    try {
      const [catRes, outletRes] = await Promise.all([
        api.get<MenuCategory[]>('/cms/menu' + (filterOutlet ? `?outletId=${filterOutlet}` : '')),
        api.get<Outlet[]>('/cms/outlets'),
      ])
      setCategories(catRes.data)
      setOutlets(outletRes.data)
    } catch {
      toast.error('Failed to load menu')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [filterOutlet]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDeleteItem(item: MenuItem) {
    if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return
    try {
      await api.delete(`/cms/menu/items/${item.id}`)
      toast.success('Item deleted')
      fetchData()
    } catch {
      toast.error('Failed to delete item')
    }
  }

  async function handleDeleteCategory(cat: MenuCategory) {
    if (!confirm(`Archive category "${cat.name}"? Items will be preserved.`)) return
    try {
      await api.delete(`/cms/menu/categories/${cat.id}`)
      toast.success('Category archived')
      fetchData()
    } catch {
      toast.error('Failed to archive category')
    }
  }

  async function handleImageUpload(item: MenuItem, file: File) {
    setUploadingId(item.id)
    try {
      const fd = new FormData()
      fd.append('image', file)
      await api.post(`/cms/menu/items/${item.id}/image`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      toast.success('Image uploaded')
      fetchData()
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploadingId(null)
    }
  }

  async function handleImageRemove(item: MenuItem) {
    if (!confirm('Remove this image?')) return
    try {
      await api.delete(`/cms/menu/items/${item.id}/image`)
      toast.success('Image removed')
      fetchData()
    } catch {
      toast.error('Failed to remove image')
    }
  }

  const filtered = filterOutlet
    ? categories.filter(c => !c.outletId || c.outletId === filterOutlet)
    : categories

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="page-title">Menu</h1>
            <p className="page-subtitle">
              {categories.length} categor{categories.length !== 1 ? 'ies' : 'y'} ·{' '}
              {categories.reduce((n, c) => n + c.items.length, 0)} items
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <select
              className="input"
              value={filterOutlet}
              onChange={e => setFilter(e.target.value)}
              style={{ padding: '6px 10px', fontSize: 13, width: 'auto' }}
            >
              <option value="">All Outlets</option>
              {outlets.map(o => (
                <option key={o.id} value={o.id}>{o.name} ({o.code})</option>
              ))}
            </select>
            <button className="btn-primary" onClick={() => setCatModal({ open: true })}>
              + Category
            </button>
          </div>
        </div>
      </div>

      <div className="page-content">
        {/* Upload indicator */}
        {uploadingId && (
          <div style={{
            background: 'var(--color-primary-dim)', border: '1px solid var(--color-primary-border)',
            borderRadius: 8, padding: '8px 14px', marginBottom: 16,
            fontSize: 13, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              style={{ animation: 'spin 1s linear infinite' }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            Uploading image to Cloudinary…
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        )}

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[...Array(3)].map((_, i) => (
              <div key={i} style={{ height: 60, background: 'var(--color-surface)', borderRadius: 10, opacity: 0.5, animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
            <style>{`@keyframes pulse { 0%,100%{opacity:0.4}50%{opacity:0.8} }`}</style>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">🍽️</div>
            <div className="empty-state-title">No menu categories yet</div>
            <div className="empty-state-desc">Add a category to start building your menu.</div>
            <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => setCatModal({ open: true })}>
              + Add Category
            </button>
          </div>
        )}

        {!loading && filtered.map(cat => (
          <CategorySection
            key={cat.id}
            category={cat}
            onItemAdd={catId => setItemModal({ mode: 'add', categoryId: catId })}
            onItemEdit={(item, catId) => setItemModal({ mode: 'edit', categoryId: catId, item })}
            onItemDelete={handleDeleteItem}
            onImageUpload={handleImageUpload}
            onImageRemove={handleImageRemove}
            onCategoryEdit={c => setCatModal({ open: true, category: c })}
            onCategoryDelete={handleDeleteCategory}
          />
        ))}
      </div>

      {/* Modals */}
      {itemModal && (
        <ItemModal
          state={itemModal}
          onClose={() => setItemModal(null)}
          onSaved={() => { setItemModal(null); fetchData() }}
        />
      )}
      {catModal.open && (
        <CategoryModal
          category={catModal.category}
          outlets={outlets}
          onClose={() => setCatModal({ open: false })}
          onSaved={() => { setCatModal({ open: false }); fetchData() }}
        />
      )}
    </div>
  )
}
