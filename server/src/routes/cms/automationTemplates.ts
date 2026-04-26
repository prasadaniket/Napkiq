import { Router } from 'express'
import { requireAuth, requireAdmin } from '../../middleware/auth'
import { readTemplates, updateTemplate } from '../../lib/templateStore'

const router = Router()
router.use(requireAuth)

// GET /api/cms/automation-templates
// Any authenticated role can read templates
router.get('/', (_req, res) => {
  res.json(Object.values(readTemplates()))
})

// PUT /api/cms/automation-templates/:key
// Admin only — update subject, body, linkUrl, isActive
router.put('/:key', requireAdmin, (req, res, next) => {
  try {
    const key = req.params.key as string
    const { subject, body, linkUrl, isActive } = req.body

    const updates: Parameters<typeof updateTemplate>[1] = {}
    if (subject  !== undefined) updates.subject  = subject
    if (body     !== undefined) updates.body     = body
    if (linkUrl  !== undefined) updates.linkUrl  = linkUrl
    if (isActive !== undefined) updates.isActive = isActive

    const updated = updateTemplate(key, updates)
    res.json(updated)
  } catch (err: any) {
    if (err.message?.startsWith('Unknown template')) {
      res.status(404).json({ error: err.message })
      return
    }
    next(err)
  }
})

export default router
