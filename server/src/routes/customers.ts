import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { z } from 'zod'
import { sendWhatsApp } from '../lib/notifications'
import { getTemplate } from '../lib/templateStore'
import { writeLimiter, readLimiter } from '../middleware/rateLimit'
import { emitCrmEvent } from '../lib/crmEvents'

const router = Router()

const CreateCustomerSchema = z.object({
  deviceId: z.string().min(1),
  fullName: z.string().min(1),
  phone: z.string().min(10).max(15),
  email: z.string().email().nullable().optional(),
  birthDate: z.string(),
  anniversaryDate: z.string().nullable().optional(),
  gender: z.enum(['Male', 'Female', 'RatherNotSay']),
  maritalStatus: z.enum(['Married', 'Unmarried']),
  firstVisitOutletId: z.string().uuid().nullable().optional(),
})

// GET /customers/by-device/:deviceId
// Device-keyed identity lookup (no customer login in this app). The deviceId
// fingerprint acts as the bearer secret; the global rate limiter throttles
// enumeration. The main app needs the full record to prefill the returning
// customer's own form, so the payload is intentionally complete.
router.get('/by-device/:deviceId', readLimiter, async (req, res, next) => {
  try {
    const deviceId = req.params.deviceId as string
    const customer = await prisma.customer.findUnique({
      where: { deviceId },
      include: { firstVisitOutlet: true },
    })

    if (!customer) {
      res.status(404).json({ error: 'Customer not found' })
      return
    }

    res.json(customer)
  } catch (err) {
    next(err)
  }
})

// POST /customers — upsert on deviceId so re-submission doesn't 500
router.post('/', writeLimiter, async (req, res, next) => {
  try {
    const body = CreateCustomerSchema.parse(req.body)

    const parsedBirth = new Date(body.birthDate)
    const parsedAnniversary = body.anniversaryDate ? new Date(body.anniversaryDate) : null

    try {
      const now = new Date()
      const isNew = !(await prisma.customer.findUnique({ where: { deviceId: body.deviceId }, select: { id: true } }))
      const customer = await prisma.customer.upsert({
        where: { deviceId: body.deviceId },
        create: {
          deviceId:           body.deviceId,
          fullName:           body.fullName,
          phone:              body.phone,
          email:              body.email ?? null,
          birthDate:          parsedBirth,
          anniversaryDate:    parsedAnniversary,
          gender:             body.gender,
          maritalStatus:      body.maritalStatus,
          firstVisitOutletId: body.firstVisitOutletId ?? null,
          lastVisitDate:      now,
          totalVisits:        1,
        },
        update: {
          fullName:        body.fullName,
          phone:           body.phone,
          email:           body.email ?? null,
          birthDate:       parsedBirth,
          anniversaryDate: parsedAnniversary,
          gender:          body.gender,
          maritalStatus:   body.maritalStatus,
          lastVisitDate:   now,
        },
      })

      // On first registration, ensure a CustomerVisit row exists so the Visits
      // page stays in sync with the totalVisits counter on the Customer model.
      if (isNew && body.firstVisitOutletId) {
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
        const existing = await prisma.customerVisit.findFirst({
          where: { deviceId: body.deviceId, outletId: body.firstVisitOutletId, visitedAt: { gte: oneHourAgo } },
        })
        if (!existing) {
          await prisma.customerVisit.create({
            data: {
              customerId: customer.id,
              deviceId:   body.deviceId,
              outletId:   body.firstVisitOutletId,
              visitType:  'qr_scan',
              visitedAt:  now,
            },
          })
          emitCrmEvent({ type: 'visit', outletId: body.firstVisitOutletId })
        } else if (!existing.customerId) {
          // Link the anonymous visit created by POST /visits to this customer
          await prisma.customerVisit.update({
            where: { id: existing.id },
            data:  { customerId: customer.id },
          })
        }
      }

      // Back-link this device's still-anonymous orders & visits to the customer, so
      // their spend (CLV / average) and history attribute correctly — e.g. someone who
      // placed an order and *then* filled the registration form. Runs on every
      // registration (new or returning); only touches rows with a null customerId.
      const [linkedOrders, linkedVisits] = await Promise.all([
        prisma.order.updateMany({ where: { deviceId: body.deviceId, customerId: null }, data: { customerId: customer.id } }),
        prisma.customerVisit.updateMany({ where: { deviceId: body.deviceId, customerId: null }, data: { customerId: customer.id } }),
      ])

      // Fire welcome WhatsApp on first registration — async, doesn't block response
      if (isNew) {
        void sendWelcomeWhatsApp(customer.id, customer.fullName, customer.phone)
        void scheduleBounceBackCampaign(customer.id, customer.fullName, customer.phone, body.firstVisitOutletId)
      }

      // Live CRM feed: a new customer, or newly-attributed spend/visits, just landed.
      if (isNew || linkedOrders.count > 0 || linkedVisits.count > 0) {
        emitCrmEvent({ type: 'customer', outletId: body.firstVisitOutletId ?? null })
      }
      if (linkedVisits.count > 0) emitCrmEvent({ type: 'visit', outletId: body.firstVisitOutletId ?? null })

      res.status(201).json(customer)
    } catch (prismaErr: any) {
      // P2002 = unique constraint violation
      // Check both code and message since meta.target format varies by Prisma version
      const isUniqueViolation = prismaErr?.code === 'P2002' ||
        prismaErr?.message?.includes('Unique constraint failed')

      if (isUniqueViolation) {
        // The phone is already registered to another device. This endpoint is
        // unauthenticated, so we must NOT re-link the device or echo the existing
        // record back: doing so let anyone who knows a phone number harvest that
        // customer's full PII and hijack their device association (account
        // takeover). Fail closed with a generic 409 that leaks nothing.
        //
        // A legitimate "same customer, new device" re-link belongs behind an
        // ownership proof (e.g. OTP to the phone) — tracked follow-up.
        res.status(409).json({ error: 'This phone number is already registered.' })
        return
      }
      throw prismaErr
    }
  } catch (err) {
    next(err)
  }
})

// ─── Welcome notification (fires async on first registration) ─────────────────

async function sendWelcomeWhatsApp(customerId: string, fullName: string, phone: string) {
  try {
    const tmpl = getTemplate('welcome_whatsapp')
    if (!tmpl?.isActive) return

    // Deduplicate across all time — welcome is sent once per customer ever
    const already = await prisma.automationLog.findFirst({
      where: {
        customerId,
        automationType: 'welcome_whatsapp' as any,
        messageStage:   'on_registration' as any,
      },
    })
    if (already) return

    const digits = phone.replace(/\D/g, '')
    const to     = digits.startsWith('91') ? `+${digits}` : `+91${digits}`

    const ok = await sendWhatsApp({
      to,
      templateName: 'napkiq_welcome',
      variables:    { customer_name: fullName, restaurant: 'Napkiq' },
    })

    await prisma.automationLog.create({
      data: {
        customerId,
        automationType: 'welcome_whatsapp' as any,
        messageStage:   'on_registration' as any,
        status:          ok ? 'success' : 'failed',
        errorMessage:    null,
      },
    })

    console.log(`[REGISTRATION] Welcome WhatsApp ${ok ? 'sent' : 'failed'} → ${to}`)
  } catch (err) {
    console.error('[REGISTRATION] Welcome WhatsApp error:', err)
  }
}

async function scheduleBounceBackCampaign(customerId: string, fullName: string, phone: string, outletId: string | null | undefined) {
  if (!outletId) return

  // Delay 2 hours in production, but 10 seconds in development for easy real-time testing
  const delayMs = process.env.NODE_ENV === 'production' ? 2 * 60 * 60 * 1000 : 10 * 1000

  console.log(`[BOUNCE-BACK] Scheduled bounce-back campaign for customer ${fullName} in ${delayMs / 1000}s`)

  setTimeout(async () => {
    try {
      // Check if they've already received it to prevent duplicate runs
      const already = await prisma.automationLog.findFirst({
        where: {
          customerId,
          automationType: 'bounceback_whatsapp' as any,
        }
      })
      if (already) {
        console.log(`[BOUNCE-BACK] Skip sending to ${fullName} - already sent.`)
        return
      }

      // Fetch the template and outlet details
      const tmpl = getTemplate('bounceback_whatsapp')
      if (!tmpl || !tmpl.isActive) {
        console.log(`[BOUNCE-BACK] Skip sending - template bounceback_whatsapp is inactive or missing.`)
        return
      }

      const outlet = await prisma.outlet.findUnique({ where: { id: outletId } })
      if (!outlet) {
        console.log(`[BOUNCE-BACK] Skip sending - outlet ${outletId} not found.`)
        return
      }

      const digits = phone.replace(/\D/g, '')
      const to     = digits.startsWith('91') ? `+${digits}` : `+91${digits}`

      console.log(`[BOUNCE-BACK] Triggering WhatsApp message to ${to}`)
      
      const ok = await sendWhatsApp({
        to,
        templateName: 'napkiq_bounceback',
        variables: {
          customer_name: fullName,
          outlet_name:   outlet.name,
          outlet_code:   outlet.code.toUpperCase()
        }
      })

      await prisma.automationLog.create({
        data: {
          customerId,
          automationType: 'bounceback_whatsapp' as any,
          messageStage:   'on_day' as any,
          status:          ok ? 'success' : 'failed',
          errorMessage:    null,
        }
      })

      console.log(`[BOUNCE-BACK] WhatsApp message ${ok ? 'sent' : 'failed'} to ${to}`)
    } catch (err) {
      console.error('[BOUNCE-BACK] Error sending bounce-back campaign:', err)
    }
  }, delayMs)
}

export default router
