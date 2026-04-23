import { Router } from 'express'
import { prisma } from '../../lib/prisma'
import { requireAuth, requireAdmin } from '../../middleware/auth'
import { stringify } from 'csv-stringify/sync'

const router = Router()

// Export: admin only
router.use(requireAuth, requireAdmin)

// GET /cms/export/customers
router.get('/customers', async (req, res, next) => {
  try {
    const customers = await prisma.customer.findMany({
      orderBy: { createdAt: 'desc' },
      include: { firstVisitOutlet: { select: { name: true } } },
    })

    const rows = customers.map((c) => ({
      ID: c.id,
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

    const csv = stringify(rows, { header: true })

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="customers.csv"'
    )
    res.send(csv)
  } catch (err) {
    next(err)
  }
})

export default router
