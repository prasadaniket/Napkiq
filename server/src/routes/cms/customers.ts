import { Router } from 'express'
import { prisma } from '../../lib/prisma'
import { paginate } from '../../lib/paginate'
import { requireAuth } from '../../middleware/auth'

const router = Router()
router.use(requireAuth)

// ─── Scope helper ─────────────────────────────────────────────────────────────
// Returns the outlet ID to filter by, based on role + optional ?outletId query.
// franchise_owner is always locked to their assignedOutletId.
function resolveOutletFilter(req: any): string | null {
  if (req.staff!.role === 'franchise_owner') {
    return req.staff!.assignedOutletId
  }
  return (req.query.outletId as string) || null
}

// ─── GET /api/cms/customers ───────────────────────────────────────────────────
// Query params:
//   page, size              — pagination (default 0, 20)
//   outletId                — filter by first-visit outlet (admin/owner only)
//   search                  — fuzzy search on name/phone/email
//   inactive                — "true" → only customers inactive 30+ days
//   gender                  — Male | Female | Transgender | RatherNotSay
//   hasReview               — "true" | "false"
//   sortBy                  — createdAt | lastVisitDate | totalVisits (default: createdAt)
//   sortDir                 — asc | desc (default: desc)
router.get('/', async (req, res, next) => {
  try {
    const page    = Math.max(0, parseInt(req.query.page as string) || 0)
    const size    = Math.min(100, Math.max(1, parseInt(req.query.size as string) || 20))
    const search  = (req.query.search as string)?.trim() || ''
    const sortBy  = (['createdAt', 'lastVisitDate', 'totalVisits'].includes(req.query.sortBy as string)
      ? req.query.sortBy
      : 'createdAt') as string
    const sortDir = req.query.sortDir === 'asc' ? 'asc' : 'desc'

    const outletId = resolveOutletFilter(req)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const where: any = {}
    if (outletId) where.firstVisitOutletId = outletId
    if (req.query.inactive === 'true') where.lastVisitDate = { lt: thirtyDaysAgo }
    if (req.query.gender)              where.gender = req.query.gender
    if (req.query.hasReview === 'true')  where.hasSubmittedFirstReview = true
    if (req.query.hasReview === 'false') where.hasSubmittedFirstReview = false
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { phone:    { contains: search } },
        { email:    { contains: search, mode: 'insensitive' } },
      ]
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip: page * size,
        take: size,
        orderBy: { [sortBy]: sortDir },
        include: { firstVisitOutlet: { select: { name: true, code: true } } },
      }),
      prisma.customer.count({ where }),
    ])

    res.json(paginate(customers, total, page, size))
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/cms/customers/:id ───────────────────────────────────────────────
// Full customer profile with visit history + reviews
router.get('/:id', async (req, res, next) => {
  try {
    const customer = await prisma.customer.findUnique({
      where:   { id: req.params.id },
      include: {
        firstVisitOutlet: { select: { name: true, code: true } },
        visits: {
          orderBy: { visitedAt: 'desc' },
          take:    20,
          include: { outlet: { select: { name: true, code: true } } },
        },
        reviews: {
          orderBy: { createdAt: 'desc' },
          include: { outlet: { select: { name: true, code: true } } },
        },
      },
    })

    if (!customer) { res.status(404).json({ error: 'Customer not found' }); return }

    // Franchise owners can only see customers from their outlet
    if (
      req.staff!.role === 'franchise_owner' &&
      customer.firstVisitOutletId !== req.staff!.assignedOutletId
    ) {
      res.status(403).json({ error: 'Access denied' })
      return
    }

    res.json(customer)
  } catch (err) {
    next(err)
  }
})

export default router
