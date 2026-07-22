'use client'

import { useEffect, useState } from 'react'
import { format as formatDate } from 'date-fns'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import {
  Lock,
  FileSpreadsheet, 
  X, 
  FileDown, 
  AlertCircle, 
  Database,
  Info 
} from 'lucide-react'

type PreviewResponse = {
  columns: string[]
  rows: Record<string, string | number>[]
  total: number
}

type ExportFormat = 'csv' | 'xlsx'

export default function ExportModal({
  endpoint,
  filenameBase,
  title,
  onClose,
}: {
  /** API path, e.g. '/cms/export/customers' */
  endpoint: string
  /** Base name for the downloaded file, e.g. 'customers' */
  filenameBase: string
  /** Modal heading */
  title: string
  onClose: () => void
}) {
  const { user } = useAuth()
  const [preview, setPreview]       = useState<PreviewResponse | null>(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(false)
  const [fmt, setFmt]               = useState<ExportFormat>('csv')
  const [downloading, setDownloading] = useState(false)

  // Fetch a capped JSON preview when the modal opens.
  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(false)
    api.get<PreviewResponse>(`${endpoint}?format=json&limit=50`)
      .then(res => { if (alive) setPreview(res.data) })
      .catch(() => { if (alive) setError(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [endpoint])

  // Esc closes the modal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const download = async () => {
    if (downloading) return
    setDownloading(true)
    try {
      const res = await api.get(`${endpoint}?format=${fmt}`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data as Blob)
      const a = document.createElement('a')
      a.href = url
      // File name: "<Outlet> Napkiq <Type> <Month DD YYYY>".
      // Outlet names already start with "Napkiq " (e.g. "Napkiq Mumbai") — strip
      // that so we don't repeat the brand. Admin/owner have no outlet → just brand.
      const outletShort = user?.assignedOutletName
        ? user.assignedOutletName.replace(/^Napkiq\s+/i, '').trim()
        : ''
      const dataLabel = title.replace(/^Export\s+/i, '').trim() || filenameBase
      const datePart = formatDate(new Date(), 'MMMM dd yyyy')
      const fileName = [outletShort, 'Napkiq', dataLabel, datePart]
        .filter(Boolean)
        .join(' ')
      a.download = `${fileName}.${fmt}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success(`Downloaded ${fmt === 'csv' ? 'CSV' : 'Excel'} file successfully!`)
      onClose()
    } catch {
      toast.error('Download failed — please try again')
    } finally {
      setDownloading(false)
    }
  }

  const handleCellDoubleClick = () => {
    toast.error('Preview is read-only. Download the file to edit.', {
      id: 'readonly-warn',
      icon: '🔒'
    })
  }

  const columns = preview?.columns ?? []
  const rows    = preview?.rows ?? []
  const total   = preview?.total ?? 0
  const canDownload = !loading && !error && total > 0

  // Excel column letters mapping (A, B, C...)
  const getColLetter = (index: number) => {
    return String.fromCharCode(65 + index)
  }

  return (
    <div className="export-backdrop" onClick={onClose}>
      <div className="export-card animate-appear" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="export-head">
          <div className="export-head-left">
            <div className="export-icon-frame">
              <Database size={18} className="export-icon-db" />
            </div>
            <div>
              <h3 className="export-title">{title}</h3>
              <p className="export-sub">
                {loading  ? 'Gathering database records…'
                  : error ? 'Connection error'
                  : total === 0 ? 'No data records found'
                  : `Previewing first ${rows.length} of ${total.toLocaleString()} total rows`}
              </p>
            </div>
          </div>
          <button className="export-x" onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>

        {/* Lock Banner indicating read-only nature */}
        <div className="export-lock-banner">
          <Lock size={12} className="lock-icon" />
          <span><strong>Non-Editable Preview.</strong> Double-click any cell or choose formatting to preview before download.</span>
        </div>

        {/* Live preview grid mock spreadsheet */}
        <div className="export-preview">
          {loading ? (
            <div className="export-msg-state">
              <div className="spinner" />
              <span>Generating real-time data preview...</span>
            </div>
          ) : error ? (
            <div className="export-msg-state error">
              <AlertCircle size={24} className="err-icon" />
              <span>Failed to load preview data. Please try again.</span>
            </div>
          ) : total === 0 ? (
            <div className="export-msg-state empty">
              <Info size={24} className="info-icon" />
              <span>No matching records found to export.</span>
            </div>
          ) : (
            <div className="export-grid-viewport">
              <table className={`export-table format-${fmt}`}>
                <thead>
                  {/* Excel Col Letters Row (A, B, C...) */}
                  <tr className="excel-cols-row">
                    <th className="excel-col-index-head"></th>
                    {columns.map((_, i) => (
                      <th key={i} className="excel-col-letter">
                        {getColLetter(i)}
                      </th>
                    ))}
                  </tr>
                  
                  {/* Database Headers Row */}
                  <tr className="db-headers-row">
                    <th className="excel-row-num-head">
                      <Lock size={10} style={{ opacity: 0.6 }} />
                    </th>
                    {columns.map(c => (
                      <th key={c} className="db-header-cell">
                        <div className="header-cell-content">
                          <span>{c}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="data-row">
                      {/* Row numbering column */}
                      <td className="row-num-cell">
                        {i + 1}
                      </td>
                      {/* Cell values */}
                      {columns.map(c => (
                        <td 
                          key={c} 
                          title={`${c}: ${String(r[c] ?? '')}`}
                          onDoubleClick={handleCellDoubleClick}
                          className="data-cell"
                        >
                          {String(r[c] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer: format toggle + info + download */}
        <div className="export-foot">
          <div className="export-formats">
            <span className="export-foot-label">Target Format</span>
            <div className="export-toggle">
              <button
                className={`export-toggle-btn ${fmt === 'csv' ? 'active' : ''}`}
                onClick={() => setFmt('csv')}
              >
                <div className="toggle-btn-inner">
                  <span className="dot" />
                  <span>CSV (Raw Data)</span>
                </div>
              </button>
              <button
                className={`export-toggle-btn ${fmt === 'xlsx' ? 'active' : ''}`}
                onClick={() => setFmt('xlsx')}
              >
                <div className="toggle-btn-inner">
                  <span className="dot" />
                  <span>Excel (Styled)</span>
                </div>
              </button>
            </div>
          </div>
          
          <div className="export-actions">
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
            <button 
              className="btn-primary-custom" 
              onClick={download} 
              disabled={!canDownload || downloading}
            >
              <FileDown size={14} />
              <span>{downloading ? 'Exporting…' : `Download ${fmt === 'csv' ? 'CSV' : 'Excel'}`}</span>
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .export-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 2, 29, 0.4);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
          animation: fade-backdrop 0.2s ease-out forwards;
        }

        @keyframes fade-backdrop {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        .export-card {
          background: #ffffff;
          border: 1px solid var(--color-border-strong);
          border-radius: 20px;
          width: 900px;
          max-width: 96vw;
          max-height: 85vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: 0 30px 70px -10px rgba(0, 2, 29, 0.15);
        }

        .animate-appear {
          animation: export-appear 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes export-appear {
          from { opacity: 0; transform: scale(0.96) translateY(12px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }

        .export-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 24px;
          border-bottom: 1px solid var(--color-border);
          background: #ffffff;
        }

        .export-head-left {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .export-icon-frame {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: var(--color-primary-dim);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .export-icon-db {
          color: var(--color-primary);
        }

        .export-title {
          font-size: 15px;
          font-weight: 750;
          color: var(--color-text-1);
          margin: 0;
        }

        .export-sub {
          font-size: 12px;
          color: var(--color-text-3);
          margin: 3px 0 0;
          font-weight: 550;
        }

        .export-x {
          background: var(--color-surface-2);
          border: none;
          cursor: pointer;
          color: var(--color-text-2);
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .export-x:hover {
          background: var(--color-primary-dim);
          color: var(--color-primary);
          transform: rotate(90deg);
        }

        .export-lock-banner {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #FFFBEB;
          border-bottom: 1px solid #FDE68A;
          color: #B45309;
          font-size: 11px;
          padding: 8px 24px;
          font-weight: 500;
        }

        .lock-icon {
          flex-shrink: 0;
        }

        .export-preview {
          flex: 1;
          min-height: 240px;
          background: #FAF9F6;
          display: flex;
          overflow: hidden;
          position: relative;
        }

        .export-msg-state {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: var(--color-text-3);
          font-size: 13px;
          padding: 40px;
          gap: 12px;
          font-weight: 550;
        }

        .spinner {
          width: 24px;
          height: 24px;
          border: 2px solid var(--color-border-strong);
          border-top-color: var(--color-primary);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .export-msg-state.error {
          color: var(--color-danger);
        }

        .err-icon {
          margin-bottom: 4px;
        }

        .export-grid-viewport {
          flex: 1;
          overflow: auto;
          position: relative;
          padding: 0;
        }

        /* Spreadsheet mock styling */
        .export-table {
          border-collapse: separate;
          border-spacing: 0;
          width: 100%;
          font-size: 12px;
          background: #ffffff;
        }

        /* Column Letters & Indexing */
        .excel-cols-row th {
          background: #F3F2EE;
          color: var(--color-text-3);
          font-weight: 500;
          font-size: 10px;
          text-align: center;
          padding: 4px 10px;
          border-bottom: 1px solid #E6E4DD;
          border-right: 1px solid #E6E4DD;
          user-select: none;
          position: sticky;
          top: 0;
          z-index: 20;
        }

        .excel-col-index-head {
          background: #E6E4DD !important;
          width: 45px;
          min-width: 45px;
          position: sticky;
          left: 0;
          z-index: 30 !important;
        }

        .excel-col-letter {
          min-width: 110px;
        }

        /* Database Headers Row */
        .db-headers-row th {
          position: sticky;
          top: 23px;
          z-index: 20;
          padding: 8px 12px;
          border-bottom: 2px solid #E6E4DD;
          border-right: 1px solid #E6E4DD;
          text-align: left;
          user-select: none;
          transition: background-color 0.25s, color 0.25s;
        }

        .excel-row-num-head {
          background: #F3F2EE;
          left: 0;
          z-index: 25 !important;
          text-align: center !important;
          border-right: 1px solid #E6E4DD;
        }

        .db-header-cell {
          font-weight: 600;
          font-family: var(--font-sans);
        }

        /* Data Rows */
        .data-row {
          height: 25px;
        }

        .row-num-cell {
          position: sticky;
          left: 0;
          background: #F3F2EE;
          color: var(--color-text-3);
          font-weight: 550;
          font-size: 10.5px;
          text-align: center;
          border-right: 1px solid #E6E4DD;
          border-bottom: 1px solid #E6E4DD;
          user-select: none;
          z-index: 10;
        }

        .data-cell {
          padding: 6px 12px;
          border-right: 1px solid #EFEFEF;
          border-bottom: 1px solid #EFEFEF;
          color: var(--color-text-1);
          white-space: nowrap;
          max-width: 250px;
          overflow: hidden;
          text-overflow: ellipsis;
          font-family: inherit;
          cursor: not-allowed;
          user-select: none;
          transition: background-color 0.15s;
        }

        /* Format specific rendering classes */
        /* CSV styling: normal/plain table */
        .export-table.format-csv .db-header-cell {
          background: #F3F2EE;
          color: var(--color-text-1);
        }

        .export-table.format-csv .data-row:hover td.data-cell {
          background: rgba(0, 2, 29, 0.02);
        }

        /* XLSX styling: brand colored header, zebra rows */
        .export-table.format-xlsx .db-header-cell {
          background: var(--color-primary);
          color: #ffffff;
          border-bottom: 2px solid var(--color-primary-hover);
        }

        .export-table.format-xlsx .data-row:nth-child(even) td.data-cell {
          background: #FDF8F7; /* soft brand tint */
        }

        .export-table.format-xlsx .data-row:hover td.data-cell {
          background: var(--color-primary-dim) !important;
        }

        /* Footer styling */
        .export-foot {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 16px 24px;
          border-top: 1px solid var(--color-border);
          background: #ffffff;
          flex-wrap: wrap;
        }

        .export-formats {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .export-foot-label {
          font-size: 11px;
          font-weight: 700;
          color: var(--color-text-2);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .export-toggle {
          display: flex;
          background: #F3F2EE;
          padding: 3px;
          border-radius: 12px;
          border: 1px solid var(--color-border);
        }

        .export-toggle-btn {
          border: none;
          background: none;
          cursor: pointer;
          padding: 6px 14px;
          font-size: 12px;
          font-weight: 600;
          color: var(--color-text-3);
          border-radius: 9px;
          font-family: inherit;
          transition: all 0.2s ease;
        }

        .toggle-btn-inner {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .export-toggle-btn .dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: transparent;
          transition: background-color 0.2s;
        }

        .export-toggle-btn.active {
          background: #ffffff;
          color: var(--color-text-1);
          box-shadow: 0 3px 10px rgba(0, 0, 0, 0.05);
        }

        .export-toggle-btn.active .dot {
          background: var(--color-primary);
        }

        .export-actions {
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .btn-primary-custom {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          background: var(--color-primary);
          border: none;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          color: #ffffff;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.2s ease;
          box-shadow: 0 4px 12px rgba(214, 66, 56, 0.2);
        }

        .btn-primary-custom:hover:not(:disabled) {
          background: var(--color-primary-hover);
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(214, 66, 56, 0.3);
        }

        .btn-primary-custom:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          box-shadow: none;
        }
      `}</style>
    </div>
  )
}
