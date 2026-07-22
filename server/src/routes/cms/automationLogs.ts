import { Router } from 'express'
import { prisma } from '../../lib/prisma'
import { paginate } from '../../lib/paginate'
import { requireAuth, requireAdmin } from '../../middleware/auth'

const router = Router()

// Automation logs: admin only
router.use(requireAuth, requireAdmin)

// GET /cms/automation-logs
router.get('/', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 0
    const size = parseInt(req.query.size as string) || 20

    const [logs, total] = await Promise.all([
      prisma.automationLog.findMany({
        skip: page * size,
        take: size,
        orderBy: { sentAt: 'desc' },
        include: {
          customer: { select: { fullName: true, phone: true } },
        },
      }),
      prisma.automationLog.count(),
    ])

    res.json(paginate(logs, total, page, size))
  } catch (err) {
    next(err)
  }
})

export default router
