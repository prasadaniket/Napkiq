import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { writeLimiter } from '../middleware/rateLimit'
import { z } from 'zod'

const router = Router()

const CreateVisitSchema = z.object({
  customerId: z.string().uuid().nullable().optional(),
  deviceId: z.string().min(1),
  outletId: z.string().uuid(),
  visitType: z.enum(['qr_scan', 'payment']).default('qr_scan'),
})

// POST /visits
router.post('/', writeLimiter, async (req, res, next) => {
  try {
    const body = CreateVisitSchema.parse(req.body)

    // Public endpoint — verify the outlet exists before recording a visit,
    // so a caller can't inflate analytics against arbitrary outlet IDs.
    const outlet = await prisma.outlet.findUnique({
      where: { id: body.outletId }, select: { id: true },
    })
    if (!outlet) { res.status(400).json({ error: 'Unknown outlet' }); return }

    // Dedup: one visit per device per outlet per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    const existing = await prisma.customerVisit.findFirst({
      where: {
        deviceId: body.deviceId,
        outletId: body.outletId,
        visitedAt: { gte: oneHourAgo },
      },
    })
    if (existing) {
      res.status(200).json(existing)
      return
    }

    // Resolve customerId from deviceId if not explicitly provided
    let resolvedCustomerId = body.customerId ?? null
    if (!resolvedCustomerId && body.deviceId) {
      const byDevice = await prisma.customer.findUnique({
        where: { deviceId: body.deviceId },
        select: { id: true },
      })
      resolvedCustomerId = byDevice?.id ?? null
    }

    const visit = await prisma.customerVisit.create({
      data: { ...body, customerId: resolvedCustomerId },
    })

    // Update customer's lastVisitDate and totalVisits
    if (resolvedCustomerId) {
      await prisma.customer.update({
        where: { id: resolvedCustomerId },
        data: {
          lastVisitDate: new Date(),
          totalVisits: { increment: 1 },
        },
      })
    }

    res.status(201).json(visit)
  } catch (err) {
    next(err)
  }
})

export default router
