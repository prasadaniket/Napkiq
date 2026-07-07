import { Router } from 'express'
import { prisma } from '../../lib/prisma'
import { requireAuth, requireAdmin } from '../../middleware/auth'
import { stringify } from 'csv-stringify/sync'
import ExcelJS from 'exceljs'

const router = Router()

// Export: admin only
router.use(requireAuth, requireAdmin)

type Row = Record<string, string | number>

// Max rows returned for the live preview (download always returns everything).
const PREVIEW_LIMIT = 50

// ─── Row builders (single source of truth for columns) ────────────────────────

async function customerRows(): Promise<Row[]> {
  const customers = await prisma.customer.findMany({
    orderBy: { createdAt: 'desc' },
    include: { firstVisitOutlet: { select: { name: true } } },
  })

  return customers.map((c, i) => ({
    'S. No.': i + 1,
    Name: c.fullName,
    Phone: c.phone,
    Email: c.email ?? '',
    Gender: c.gender,
    'Marital Status': c.maritalStatus,
    'Birth Date': c.birthDate?.toISOString().split('T')[0] ?? '',
    'Anniversary Date': c.anniversaryDate?.toISOString().split('T')[0] ?? '',
    'First Visit Outlet': c.firstVisitOutlet?.name ?? '',
    'Total Visits': c.totalVisits,
    'Last Visit': c.lastVisitDate?.toISOString().split('T')[0] ?? '',
    'First Review Submitted': c.hasSubmittedFirstReview ? 'Yes' : 'No',
    'Created At': c.createdAt.toISOString(),
  }))
}

async function visitRows(): Promise<Row[]> {
  const visits = await prisma.customerVisit.findMany({
    orderBy: { visitedAt: 'desc' },
    include: {
      customer: { select: { fullName: true, phone: true } },
      outlet: { select: { name: true, code: true } },
    },
  })

  return visits.map((v, i) => ({
    'S. No.': i + 1,
    'Customer Name': v.customer?.fullName ?? 'Unknown',
    'Customer Phone': v.customer?.phone ?? 'Unknown',
    'Visit Type': v.visitType === 'qr_scan' ? 'QR Scan' : 'Payment',
    Outlet: v.outlet?.name ?? 'Unknown',
    'Outlet Code': v.outlet?.code ?? 'Unknown',
    'Visited At': v.visitedAt.toISOString(),
  }))
}

// ─── Format dispatch ──────────────────────────────────────────────────────────

async function respond(
  req: import('express').Request,
  res: import('express').Response,
  rows: Row[],
  baseName: string,
  sheetName: string
) {
  const format = String(req.query.format ?? 'csv').toLowerCase()
  const columns = rows.length ? Object.keys(rows[0]) : []

  // Preview — JSON with a capped number of rows + the full total.
  if (format === 'json') {
    const limit = Math.min(Number(req.query.limit) || PREVIEW_LIMIT, 200)
    res.json({ columns, rows: rows.slice(0, limit), total: rows.length })
    return
  }

  // Excel — real .xlsx via exceljs.
  if (format === 'xlsx' || format === 'excel') {
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet(sheetName)
    if (columns.length) {
      ws.columns = columns.map((key) => ({
        header: key,
        key,
        width: Math.min(Math.max(key.length + 4, 14), 40),
      }))
      ws.addRows(rows)
      
      // Style headers and data cells
      ws.eachRow((row, rowNumber) => {
        row.height = rowNumber === 1 ? 26 : 20
        row.eachCell({ includeEmpty: true }, (cell) => {
          // General font & border for all cells
          cell.font = {
            name: 'Segoe UI',
            size: 10,
            color: { argb: 'FF00021D' }
          }
          cell.alignment = {
            vertical: 'middle',
            horizontal: cell.value && typeof cell.value === 'number' ? 'right' : 'left'
          }
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE8E8E8' } },
            left: { style: 'thin', color: { argb: 'FFE8E8E8' } },
            bottom: { style: 'thin', color: { argb: 'FFE8E8E8' } },
            right: { style: 'thin', color: { argb: 'FFE8E8E8' } }
          }

          if (rowNumber === 1) {
            // Header cell styling
            cell.font = {
              name: 'Segoe UI',
              size: 11,
              bold: true,
              color: { argb: 'FFFFFFFF' }
            }
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFD64238' } // Napkiq Primary Red
            }
          } else if (rowNumber % 2 === 0) {
            // Alternating even rows with light brand tint
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFFDF8F7' } // Light brand red-orange tint
            }
          }
        })
      })
    }
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    res.setHeader('Content-Disposition', `attachment; filename="${baseName}.xlsx"`)
    await wb.xlsx.write(res)
    res.end()
    return
  }

  // Default — CSV.
  const csv = stringify(rows, { header: true })
  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', `attachment; filename="${baseName}.csv"`)
  res.send(csv)
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /cms/export/customers?format=json|csv|xlsx
router.get('/customers', async (req, res, next) => {
  try {
    await respond(req, res, await customerRows(), 'customers', 'Customers')
  } catch (err) {
    next(err)
  }
})

// GET /cms/export/visits?format=json|csv|xlsx
router.get('/visits', async (req, res, next) => {
  try {
    await respond(req, res, await visitRows(), 'visits', 'Visits')
  } catch (err) {
    next(err)
  }
})

export default router
