import { Router } from 'express'
import { prisma } from '../lib/prisma'

const router = Router()

// GET /outlets — list all active outlets
router.get('/', async (_req, res, next) => {
  try {
    const outlets = await prisma.outlet.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    })
    res.json(outlets)
  } catch (err) {
    next(err)
  }
})

// GET /outlets/:code — accepts both slug (mumbai) and code (MUM)
router.get('/:code', async (req, res, next) => {
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

    res.json(outlet)
  } catch (err) {
    next(err)
  }
})

export default router
