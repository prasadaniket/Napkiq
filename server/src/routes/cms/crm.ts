import { Router } from 'express'
import { resolveStaffFromToken } from '../../middleware/auth'
import { onCrmEvent } from '../../lib/crmEvents'

const router = Router()

// ─── GET /cms/crm/stream ────────────────────────────────────────────────────────
// Live CRM feed via SSE — powers the auto-updating Customers / Visits / Reviews
// pages. Authenticates via ?token= because EventSource cannot send an Authorization
// header (same pattern as the reservations/KDS streams). Franchise owners only
// receive events for their assigned outlet; admins/owners receive every outlet's.
router.get('/stream', async (req, res, next) => {
  try {
    const token = (req.query.token as string) || ''
    if (!token) { res.status(401).json({ error: 'Missing token' }); return }

    const staff = await resolveStaffFromToken(token)
    if (!staff) { res.status(401).json({ error: 'Invalid or expired token' }); return }

    const scopeOutletId = staff.role === 'franchise_owner' ? (staff.assignedOutletId ?? null) : null

    res.writeHead(200, {
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache, no-transform',
      Connection:          'keep-alive',
      'X-Accel-Buffering': 'no',
    })
    res.write(': connected\n\n')

    const unsubscribe = onCrmEvent((event) => {
      // Drop events for other outlets when the viewer is pinned to one.
      if (scopeOutletId && event.outletId && event.outletId !== scopeOutletId) return
      res.write(`data: ${JSON.stringify(event)}\n\n`)
    })
    const heartbeat = setInterval(() => res.write(': ping\n\n'), 25_000)

    req.on('close', () => {
      clearInterval(heartbeat)
      unsubscribe()
      res.end()
    })
  } catch (err) {
    next(err)
  }
})

export default router
