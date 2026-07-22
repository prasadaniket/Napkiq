import { Router } from 'express'
import { prisma } from '../lib/prisma'

const router = Router()

// GET /menu/outlet/:code
router.get('/outlet/:code', async (req, res, next) => {
  try {
    const { code } = req.params

    const outlet = await prisma.outlet.findFirst({
      where: {
        OR: [{ slug: code.toLowerCase() }, { code: code.toUpperCase() }],
      },
    })

    if (!outlet) {
      res.status(404).json({ error: 'Outlet not found' })
      return
    }

    const categories = await prisma.menuCategory.findMany({
      where: { outletId: outlet.id, isActive: true },
      orderBy: { displayOrder: 'asc' },
      include: {
        items: {
          where: { isAvailable: true },
          orderBy: { displayOrder: 'asc' },
        },
      },
    })

    res.json(categories)
  } catch (err) {
    next(err)
  }
})

export default router
