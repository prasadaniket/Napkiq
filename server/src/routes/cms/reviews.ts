import { Router } from 'express'
import { prisma } from '../../lib/prisma'
import { paginate } from '../../lib/paginate'
import { requireAuth } from '../../middleware/auth'

const router = Router()
router.use(requireAuth)

// ─── GET /api/cms/reviews ─────────────────────────────────────────────────────
// Query params:
//   page, size              — pagination
//   outletId                — filter by outlet (admin/owner only)
//   stars                   — 1-5 exact match
//   type                    — first_visit | repeat
//   dateFrom, dateTo        — ISO date range (createdAt)
//   search                  — fuzzy search on customer name/phone
//   sortDir                 — asc | desc (default: desc)
router.get('/', async (req, res, next) => {
  try {
    const page    = Math.max(0, parseInt(req.query.page as string) || 0)
    const size    = Math.min(100, Math.max(1, parseInt(req.query.size as string) || 20))
    const sortDir = req.query.sortDir === 'asc' ? 'asc' : 'desc'
    const search  = (req.query.search as string)?.trim() || ''

    // Outlet scoping
    let outletId: string | undefined
    if (req.staff!.role === 'franchise_owner') {
      outletId = req.staff!.assignedOutletId ?? undefined
    } else if (req.query.outletId) {
      outletId = req.query.outletId as string
    }

    const where: any = {}
    if (outletId) where.outletId = outletId
    if (req.query.stars) where.stars = parseInt(req.query.stars as string)
    if (req.query.type && ['first_visit', 'repeat'].includes(req.query.type as string)) {
      where.reviewType = req.query.type
    }

    // Date range
    if (req.query.dateFrom || req.query.dateTo) {
      where.createdAt = {}
      if (req.query.dateFrom) where.createdAt.gte = new Date(req.query.dateFrom as string)
      if (req.query.dateTo)   where.createdAt.lte = new Date(req.query.dateTo as string)
    }

    // Customer search
    if (search) {
      where.customer = {
        OR: [
          { fullName: { contains: search, mode: 'insensitive' } },
          { phone:    { contains: search } },
        ],
      }
    }

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        skip: page * size,
        take: size,
        orderBy: { createdAt: sortDir },
        include: {
          customer: { select: { fullName: true, phone: true, email: true, gender: true } },
          outlet:   { select: { name: true, code: true, googleMapsUrl: true } },
        },
      }),
      prisma.review.count({ where }),
    ])

    res.json(paginate(reviews, total, page, size))
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/cms/reviews/summary ─────────────────────────────────────────────
// Returns star distribution — mirrors same filters as GET /
router.get('/summary', async (req, res, next) => {
  try {
    const search = (req.query.search as string)?.trim() || ''

    let outletId: string | undefined
    if (req.staff!.role === 'franchise_owner') {
      outletId = req.staff!.assignedOutletId ?? undefined
    } else if (req.query.outletId) {
      outletId = req.query.outletId as string
    }

    const where: any = {}
    if (outletId) where.outletId = outletId
    if (req.query.stars) where.stars = parseInt(req.query.stars as string)
    if (req.query.type && ['first_visit', 'repeat'].includes(req.query.type as string)) {
      where.reviewType = req.query.type
    }
    if (req.query.dateFrom || req.query.dateTo) {
      where.createdAt = {}
      if (req.query.dateFrom) where.createdAt.gte = new Date(req.query.dateFrom as string)
      if (req.query.dateTo)   where.createdAt.lte = new Date(req.query.dateTo as string)
    }
    if (search) {
      where.customer = {
        OR: [
          { fullName: { contains: search, mode: 'insensitive' } },
          { phone:    { contains: search } },
        ],
      }
    }

    const [distribution, aggregate] = await Promise.all([
      prisma.review.groupBy({
        by: ['stars'],
        where,
        _count: { stars: true },
        orderBy: { stars: 'desc' },
      }),
      prisma.review.aggregate({ where, _avg: { stars: true }, _count: { id: true } }),
    ])

    res.json({
      averageRating: aggregate._avg.stars ?? null,
      totalReviews:  aggregate._count.id,
      distribution:  distribution.map(d => ({ stars: d.stars, count: d._count.stars })),
    })
  } catch (err) {
    next(err)
  }
})

export default router
