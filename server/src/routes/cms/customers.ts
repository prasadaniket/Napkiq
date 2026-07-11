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

// Shared customer filter (list + summary use identical scoping so their numbers match).
function buildCustomerWhere(req: any): { where: any; outletId: string | null; thirtyDaysAgo: Date } {
  const outletId = resolveOutletFilter(req)
  const search = (req.query.search as string)?.trim() || ''
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const where: any = {}
  // Franchise owners see customers who have a review at their outlet
  // (visits have nullable customerId so can't be used for joining)
  if (outletId) where.reviews = { some: { outletId } }
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
  return { where, outletId, thirtyDaysAgo }
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
    const sortBy  = (['createdAt', 'lastVisitDate', 'totalVisits'].includes(req.query.sortBy as string)
      ? req.query.sortBy
      : 'createdAt') as string
    const sortDir = req.query.sortDir === 'asc' ? 'asc' : 'desc'

    const { where, outletId } = buildCustomerWhere(req)

    const [rawCustomers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip: page * size,
        take: size,
        orderBy: { [sortBy]: sortDir },
        include: {
          firstVisitOutlet: { select: { name: true, code: true } },
          _count: {
            select: {
              reviews: outletId ? { where: { outletId } } : true,
            },
          },
        },
      }),
      prisma.customer.count({ where }),
    ])

    // CLV — total served-order spend per customer on this page. Scoped to the
    // franchise's outlet when applicable; priced from server-side snapshots.
    const ids = rawCustomers.map(c => c.id)
    const clvMap = new Map<string, { clv: number; orderCount: number }>()
    if (ids.length) {
      const orders = await prisma.order.findMany({
        where: { customerId: { in: ids }, status: 'served', ...(outletId ? { outletId } : {}) },
        select: { customerId: true, items: { select: { quantity: true, priceSnapshot: true } } },
      })
      for (const o of orders) {
        if (!o.customerId) continue
        const agg = clvMap.get(o.customerId) ?? { clv: 0, orderCount: 0 }
        agg.orderCount += 1
        for (const it of o.items) agg.clv += it.priceSnapshot != null ? Number(it.priceSnapshot) * it.quantity : 0
        clvMap.set(o.customerId, agg)
      }
    }

    // Flatten _count.reviews → totalReviews, and attach CLV, for a clean API shape
    const customers = rawCustomers.map(({ _count, ...c }) => {
      const agg = clvMap.get(c.id) ?? { clv: 0, orderCount: 0 }
      return {
        ...c,
        totalReviews: _count.reviews,
        clv:          agg.clv,
        orderCount:   agg.orderCount,
      }
    })

    res.json(paginate(customers, total, page, size))
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/cms/customers/summary ────────────────────────────────────────────
// Aggregate KPIs across the ENTIRE filtered customer set (not just one page) so the
// dashboard cards — average spend, retention, review rate — are accurate and update
// on every (live) refresh. Uses the same filters as the list endpoint.
router.get('/summary', async (req, res, next) => {
  try {
    const { where, outletId, thirtyDaysAgo } = buildCustomerWhere(req)

    const [totalCustomers, activeGuests, reviewsSubmitted, idRows] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.count({ where: { ...where, lastVisitDate: { gte: thirtyDaysAgo } } }),
      prisma.customer.count({ where: { ...where, hasSubmittedFirstReview: true } }),
      prisma.customer.findMany({ where, select: { id: true } }),
    ])

    // Served-order spend across those customers (priced from server-side snapshots).
    let totalSpend = 0
    let spendingCustomers = 0
    const ids = idRows.map((c) => c.id)
    if (ids.length) {
      const orders = await prisma.order.findMany({
        where: { status: 'served', customerId: { in: ids }, ...(outletId ? { outletId } : {}) },
        select: { customerId: true, items: { select: { quantity: true, priceSnapshot: true } } },
      })
      const perCustomer = new Map<string, number>()
      for (const o of orders) {
        if (!o.customerId) continue
        let sum = perCustomer.get(o.customerId) ?? 0
        for (const it of o.items) sum += it.priceSnapshot != null ? Number(it.priceSnapshot) * it.quantity : 0
        perCustomer.set(o.customerId, sum)
      }
      for (const v of perCustomer.values()) {
        if (v > 0) { totalSpend += v; spendingCustomers += 1 }
      }
    }

    res.json({
      totalCustomers,
      totalSpend,
      spendingCustomers,
      avgSpend:      spendingCustomers > 0 ? Math.round(totalSpend / spendingCustomers) : 0,
      activeGuests,
      retentionRate: totalCustomers > 0 ? Math.round((activeGuests / totalCustomers) * 100) : 0,
      reviewRate:    totalCustomers > 0 ? Math.round((reviewsSubmitted / totalCustomers) * 100) : 0,
    })
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/cms/customers/birthdays ──────────────────────────────────────────
router.get('/birthdays', async (req, res, next) => {
  try {
    const outletId = resolveOutletFilter(req)
    const currentMonth = new Date().getMonth()
    const currentYear = new Date().getFullYear()
    const yearStart = new Date(currentYear, 0, 1)

    const where: any = {}
    if (outletId) {
      where.reviews = { some: { outletId } }
    }

    const customers = await prisma.customer.findMany({
      where,
      include: {
        firstVisitOutlet: { select: { name: true, code: true } },
        automationLogs: {
          where: {
            automationType: { in: ['birthday_whatsapp', 'birthday_email'] },
            status: 'success',
            sentAt: { gte: yearStart },
          },
          select: {
            messageStage: true,
          },
        },
      },
      orderBy: { fullName: 'asc' },
    })

    const matchingCustomers = customers.filter(c => {
      const d = new Date(c.birthDate)
      return d.getMonth() === currentMonth
    })

    const results = matchingCustomers.map(c => {
      const stages = c.automationLogs.map(l => l.messageStage)
      return {
        id: c.id,
        fullName: c.fullName,
        phone: c.phone,
        email: c.email,
        birthDate: c.birthDate,
        firstVisitOutlet: c.firstVisitOutlet,
        message5DaysStatus: stages.includes('five_days_before') ? 'send' : 'pending',
        message1DayStatus: stages.includes('one_day_before') ? 'send' : 'pending',
      }
    })

    res.json(results)
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/cms/customers/anniversaries ──────────────────────────────────────
router.get('/anniversaries', async (req, res, next) => {
  try {
    const outletId = resolveOutletFilter(req)
    const currentMonth = new Date().getMonth()
    const currentYear = new Date().getFullYear()
    const yearStart = new Date(currentYear, 0, 1)

    const where: any = {}
    if (outletId) {
      where.reviews = { some: { outletId } }
    }

    const customers = await prisma.customer.findMany({
      where: {
        ...where,
        anniversaryDate: { not: null },
      },
      include: {
        firstVisitOutlet: { select: { name: true, code: true } },
        automationLogs: {
          where: {
            automationType: { in: ['anniversary_whatsapp', 'anniversary_email'] },
            status: 'success',
            sentAt: { gte: yearStart },
          },
          select: {
            messageStage: true,
          },
        },
      },
      orderBy: { fullName: 'asc' },
    })

    const matchingCustomers = customers.filter(c => {
      if (!c.anniversaryDate) return false
      const d = new Date(c.anniversaryDate)
      return d.getMonth() === currentMonth
    })

    const results = matchingCustomers.map(c => {
      const stages = c.automationLogs.map(l => l.messageStage)
      return {
        id: c.id,
        fullName: c.fullName,
        phone: c.phone,
        email: c.email,
        anniversaryDate: c.anniversaryDate,
        firstVisitOutlet: c.firstVisitOutlet,
        message5DaysStatus: stages.includes('five_days_before') ? 'send' : 'pending',
        message1DayStatus: stages.includes('one_day_before') ? 'send' : 'pending',
      }
    })

    res.json(results)
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/cms/customers/:id ───────────────────────────────────────────────
// Full customer profile with visit history + reviews
router.get('/:id', async (req, res, next) => {
  try {
    const scopedOutletId = req.staff!.role === 'franchise_owner'
      ? req.staff!.assignedOutletId ?? undefined
      : undefined

    // For franchise owners: deny if this customer has no reviews at their outlet
    if (scopedOutletId) {
      const hasReview = await prisma.review.count({
        where: { customerId: req.params.id, outletId: scopedOutletId },
      })
      if (!hasReview) { res.status(403).json({ error: 'Access denied' }); return }
    }

    const customer = await prisma.customer.findUnique({
      where:   { id: req.params.id },
      include: {
        firstVisitOutlet: { select: { name: true, code: true } },
        visits: {
          where:   scopedOutletId ? { outletId: scopedOutletId } : {},
          orderBy: { visitedAt: 'desc' },
          take:    20,
          include: { outlet: { select: { name: true, code: true } } },
        },
        reviews: {
          where:   scopedOutletId ? { outletId: scopedOutletId } : {},
          orderBy: { createdAt: 'desc' },
          include: { outlet: { select: { name: true, code: true } } },
        },
      },
    })

    if (!customer) { res.status(404).json({ error: 'Customer not found' }); return }

    // CLV — total served-order spend (scoped to outlet for franchise owners).
    const clvOrders = await prisma.order.findMany({
      where: { customerId: req.params.id, status: 'served', ...(scopedOutletId ? { outletId: scopedOutletId } : {}) },
      select: { createdAt: true, items: { select: { quantity: true, priceSnapshot: true } } },
    })
    let clv = 0
    let lastOrderAt: Date | null = null
    for (const o of clvOrders) {
      for (const it of o.items) clv += it.priceSnapshot != null ? Number(it.priceSnapshot) * it.quantity : 0
      if (!lastOrderAt || o.createdAt > lastOrderAt) lastOrderAt = o.createdAt
    }

    res.json({ ...customer, clv, orderCount: clvOrders.length, lastOrderAt })
  } catch (err) {
    next(err)
  }
})

export default router
