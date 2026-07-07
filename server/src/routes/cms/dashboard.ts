import { Router } from 'express'
import { prisma } from '../../lib/prisma'
import { requireAuth } from '../../middleware/auth'

const router = Router()
router.use(requireAuth)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - n)
  return d
}

function startOf(unit: 'week' | 'month' | 'year'): Date {
  const now = new Date()
  if (unit === 'week')  { const d = new Date(now); d.setDate(d.getDate() - 7); d.setHours(0,0,0,0); return d }
  if (unit === 'month') return new Date(now.getFullYear(), now.getMonth(), 1)
  return new Date(now.getFullYear(), 0, 1)
}

function monthRange(): { start: Date; end: Date } {
  const now = new Date()
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1),
    end:   new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

/**
 * GET /api/cms/dashboard/stats
 *
 * Query params:
 *   ?outletId=uuid   — scope to a single outlet (admin/owner may pass this)
 *   (no param)       — admin & owner see all outlets combined
 *
 * Scoping rules:
 *   admin / owner      — all outlets (or filtered by ?outletId)
 *   franchise_owner    — always scoped to assignedOutletId (query param ignored)
 */
router.get('/stats', async (req, res, next) => {
  try {
    const role            = req.staff!.role
    const assignedOutlet  = req.staff!.assignedOutletId
    const isFranchise     = role === 'franchise_owner'

    // Determine which outlets to aggregate
    let outletIds: string[]

    if (isFranchise) {
      // Franchise owner is always locked to their outlet
      if (!assignedOutlet) { res.status(403).json({ error: 'No outlet assigned' }); return }
      outletIds = [assignedOutlet]
    } else if (req.query.outletId) {
      // Admin / owner filtering to a specific outlet
      outletIds = [req.query.outletId as string]
    } else {
      // Admin / owner — all active outlets
      const outlets = await prisma.outlet.findMany({
        where: { isActive: true },
        select: { id: true },
      })
      outletIds = outlets.map(o => o.id)
    }

    const thirtyDaysAgo = daysAgo(30)
    const { start: monthStart, end: monthEnd } = monthRange()

    const reviewWhere = { outletId: { in: outletIds } }
    const visitWhere  = { outletId: { in: outletIds } }

    // Customer counts: outlet-scoped roles count customers who have a review at their outlet(s).
    // Admin/owner viewing all outlets count unique customers directly (no double-counting).
    const isScoped = isFranchise || !!req.query.outletId
    const customerWhere: any = isScoped
      ? { reviews: { some: { outletId: { in: outletIds } } } }
      : {}

    const [
      totalCustomers,
      totalReviews,
      totalVisits,
      avgStarsResult,
      inactiveCustomers,
      newCustomersThisWeek,
      newCustomersThisMonth,
      newCustomersThisYear,
      newReviewsThisWeek,
      totalVisitsThisMonth,
      totalVisitsThisYear,
      birthdaysThisMonthRaw,
      anniversariesThisMonthRaw,
    ] = await Promise.all([
      prisma.customer.count({ where: customerWhere }),
      prisma.review.count({ where: reviewWhere }),
      prisma.customerVisit.count({ where: visitWhere }),

      prisma.review.aggregate({ where: reviewWhere, _avg: { stars: true } }),

      // Inactive: no visit in 30+ days
      prisma.customer.count({
        where: { ...customerWhere, lastVisitDate: { lt: thirtyDaysAgo } },
      }),

      // New customers — week / month / year
      prisma.customer.count({ where: { ...customerWhere, createdAt: { gte: startOf('week') } } }),
      prisma.customer.count({ where: { ...customerWhere, createdAt: { gte: startOf('month') } } }),
      prisma.customer.count({ where: { ...customerWhere, createdAt: { gte: startOf('year') } } }),

      // Reviews this week
      prisma.review.count({ where: { ...reviewWhere, createdAt: { gte: startOf('week') } } }),

      // Visits — month / year
      prisma.customerVisit.count({ where: { ...visitWhere, visitedAt: { gte: startOf('month') } } }),
      prisma.customerVisit.count({ where: { ...visitWhere, visitedAt: { gte: startOf('year') } } }),

      // Birthdays & anniversaries this calendar month
      prisma.customer.findMany({
        where: customerWhere,
        select: { birthDate: true },
      }),
      prisma.customer.findMany({
        where: { ...customerWhere, anniversaryDate: { not: null } },
        select: { anniversaryDate: true },
      }),
    ])

    const currentMonth = new Date().getMonth()
    const birthdaysThisMonth = (birthdaysThisMonthRaw as any[]).filter(c => new Date(c.birthDate).getMonth() === currentMonth).length
    const anniversariesThisMonth = (anniversariesThisMonthRaw as any[]).filter(c => c.anniversaryDate && new Date(c.anniversaryDate).getMonth() === currentMonth).length

    res.json({
      totalCustomers,
      totalReviews,
      totalVisits,
      averageRating:         avgStarsResult._avg.stars ?? null,
      inactiveCustomers,
      newCustomersThisWeek,
      newCustomersThisMonth,
      newCustomersThisYear,
      newReviewsThisWeek,
      totalVisitsThisMonth,
      totalVisitsThisYear,
      birthdaysThisMonth,
      anniversariesThisMonth,
    })
  } catch (err) {
    next(err)
  }
})

// ─── Revenue & menu intelligence ──────────────────────────────────────────────

/** Shift a Date into IST and read its calendar date (YYYY-MM-DD) and hour (0-23). */
function istParts(d: Date): { date: string; hour: number } {
  const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000)
  return { date: ist.toISOString().slice(0, 10), hour: ist.getUTCHours() }
}

/** IST calendar date (YYYY-MM-DD) `n` days before today. */
function istDateNDaysAgo(n: number): string {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
  ist.setUTCDate(ist.getUTCDate() - n)
  return ist.toISOString().slice(0, 10)
}

/**
 * GET /api/cms/dashboard/insights
 *
 * Revenue + menu intelligence over the last N days (default 30, max 90).
 * Same scoping as /stats: franchise → own outlet; admin/owner → all outlets
 * (or ?outletId=). Revenue is realized revenue from *served* orders, priced
 * from server-side snapshots (never client-supplied). Cancelled orders excluded.
 */
router.get('/insights', async (req, res, next) => {
  try {
    const role           = req.staff!.role
    const assignedOutlet = req.staff!.assignedOutletId
    const isFranchise    = role === 'franchise_owner'

    let outletIds: string[]
    if (isFranchise) {
      if (!assignedOutlet) { res.status(403).json({ error: 'No outlet assigned' }); return }
      outletIds = [assignedOutlet]
    } else if (req.query.outletId) {
      outletIds = [req.query.outletId as string]
    } else {
      const outlets = await prisma.outlet.findMany({ where: { isActive: true }, select: { id: true } })
      outletIds = outlets.map(o => o.id)
    }

    const days            = Math.min(Math.max(Number(req.query.days) || 30, 1), 90)
    const windowStart     = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    const startBusinessDate = new Date(`${istDateNDaysAgo(days - 1)}T00:00:00.000Z`)
    const todayIST        = istParts(new Date()).date

    const outlets = await prisma.outlet.findMany({
      where: { id: { in: outletIds } },
      select: { id: true, name: true },
    })
    const nameById = new Map(outlets.map(o => [o.id, o.name]))

    // Customer/review scoping mirrors /stats: outlet-scoped roles count customers
    // who have a review at their outlet(s); admin/owner (all outlets) count directly.
    const isScoped = isFranchise || !!req.query.outletId
    const customerWhere: any = isScoped ? { reviews: { some: { outletId: { in: outletIds } } } } : {}
    const reviewWhere = { outletId: { in: outletIds } }

    const [servedOrders, visits, newCustomerRows, newReviewRows] = await Promise.all([
      prisma.order.findMany({
        where: { outletId: { in: outletIds }, status: 'served', businessDate: { gte: startBusinessDate } },
        select: {
          outletId:     true,
          businessDate: true,
          createdAt:    true,
          items: { select: { nameSnapshot: true, quantity: true, priceSnapshot: true } },
        },
      }),
      prisma.customerVisit.findMany({
        where: { outletId: { in: outletIds }, visitedAt: { gte: windowStart } },
        select: { visitedAt: true },
      }),
      prisma.customer.findMany({
        where: { ...customerWhere, createdAt: { gte: windowStart } },
        select: { createdAt: true },
      }),
      prisma.review.findMany({
        where: { ...reviewWhere, createdAt: { gte: windowStart } },
        select: { createdAt: true },
      }),
    ])

    let revenue   = 0
    let itemsSold = 0
    const topMap    = new Map<string, { quantity: number; revenue: number }>()
    const outletAgg = new Map<string, { revenue: number; orders: number }>()
    outletIds.forEach(id => outletAgg.set(id, { revenue: 0, orders: 0 }))

    // Daily buckets seeded with every day in the window (so the chart has no gaps).
    const daily = new Map<string, { revenue: number; orders: number; visits: number; newCustomers: number; newReviews: number }>()
    for (let i = days - 1; i >= 0; i--) daily.set(istDateNDaysAgo(i), { revenue: 0, orders: 0, visits: 0, newCustomers: 0, newReviews: 0 })
    // Today's hourly buckets (0-23).
    const hourly = Array.from({ length: 24 }, () => ({ revenue: 0, orders: 0, visits: 0 }))

    for (const o of servedOrders) {
      let orderRevenue = 0
      for (const it of o.items) {
        itemsSold += it.quantity
        const line = it.priceSnapshot != null ? Number(it.priceSnapshot) * it.quantity : 0
        orderRevenue += line
        const t = topMap.get(it.nameSnapshot) ?? { quantity: 0, revenue: 0 }
        t.quantity += it.quantity
        t.revenue  += line
        topMap.set(it.nameSnapshot, t)
      }
      revenue += orderRevenue

      const oa = outletAgg.get(o.outletId)
      if (oa) { oa.revenue += orderRevenue; oa.orders += 1 }

      const dayKey = o.businessDate ? o.businessDate.toISOString().slice(0, 10) : istParts(o.createdAt).date
      const db = daily.get(dayKey)
      if (db) { db.revenue += orderRevenue; db.orders += 1 }

      const { date: cDate, hour } = istParts(o.createdAt)
      if (cDate === todayIST) { hourly[hour].revenue += orderRevenue; hourly[hour].orders += 1 }
    }

    for (const v of visits) {
      const { date, hour } = istParts(v.visitedAt)
      const db = daily.get(date)
      if (db) db.visits += 1
      if (date === todayIST) hourly[hour].visits += 1
    }

    for (const c of newCustomerRows) {
      const db = daily.get(istParts(c.createdAt).date)
      if (db) db.newCustomers += 1
    }

    for (const r of newReviewRows) {
      const db = daily.get(istParts(r.createdAt).date)
      if (db) db.newReviews += 1
    }

    const topItems = [...topMap.entries()]
      .map(([name, v]) => ({ name, quantity: v.quantity, revenue: v.revenue }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5)

    const byOutlet = [...outletAgg.entries()]
      .map(([outletId, v]) => ({ outletId, name: nameById.get(outletId) ?? 'Unknown', revenue: v.revenue, orders: v.orders }))
      .sort((a, b) => b.revenue - a.revenue)

    res.json({
      days,
      totals:      { revenue, orders: servedOrders.length, itemsSold },
      topItems,
      byOutlet,
      daily:       [...daily.entries()].map(([date, v]) => ({ date, ...v })),
      hourlyToday: hourly.map((v, hour) => ({ hour, ...v })),
    })
  } catch (err) {
    next(err)
  }
})

export default router
