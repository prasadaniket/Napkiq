import { Router } from 'express'
import { prisma } from '../../lib/prisma'
import { paginate } from '../../lib/paginate'
import { requireAuth } from '../../middleware/auth'

const router = Router()
router.use(requireAuth)

// ─── GET /api/cms/visits ──────────────────────────────────────────────────────
// Query params:
//   page, size              — pagination
//   outletId                — filter by outlet (admin/owner only)
//   customerId              — filter to a single customer's visits
//   dateFrom, dateTo        — ISO date range
//   type                    — qr_scan | payment
//   sortDir                 — asc | desc (default: desc)
router.get('/', async (req, res, next) => {
  try {
    const page    = Math.max(0, parseInt(req.query.page as string) || 0)
    const size    = Math.min(100, Math.max(1, parseInt(req.query.size as string) || 20))
    const sortDir = req.query.sortDir === 'asc' ? 'asc' : 'desc'

    // Outlet scoping
    let outletId: string | undefined
    if (req.staff!.role === 'franchise_owner') {
      outletId = req.staff!.assignedOutletId ?? undefined
    } else if (req.query.outletId) {
      outletId = req.query.outletId as string
    }

    const where: any = {}
    if (outletId)             where.outletId   = outletId
    if (req.query.customerId) where.customerId = req.query.customerId
    if (req.query.type && ['qr_scan', 'payment'].includes(req.query.type as string)) {
      where.visitType = req.query.type
    }
    if (req.query.dateFrom || req.query.dateTo) {
      where.visitedAt = {}
      if (req.query.dateFrom) where.visitedAt.gte = new Date(req.query.dateFrom as string)
      if (req.query.dateTo)   where.visitedAt.lte = new Date(req.query.dateTo as string)
    }

    const [visits, total] = await Promise.all([
      prisma.customerVisit.findMany({
        where,
        skip: page * size,
        take: size,
        orderBy: { visitedAt: sortDir },
        include: {
          customer: { select: { fullName: true, phone: true } },
          outlet:   { select: { name: true, code: true } },
        },
      }),
      prisma.customerVisit.count({ where }),
    ])

    res.json(paginate(visits, total, page, size))
  } catch (err) {
    next(err)
  }
})

export default router
