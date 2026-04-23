import { Router } from 'express'
import { supabaseAdmin } from '../lib/supabase'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'
import { z } from 'zod'

const router = Router()

const LoginSchema = z.object({
  username: z.string().min(3).max(32),
  password: z.string().min(6),
})

// POST /auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = LoginSchema.parse(req.body)

    // Step 1: Look up staff email by username
    const staffByUsername = await prisma.staff.findUnique({
      where: { username },
      select: { email: true, isActive: true },
    })

    if (!staffByUsername) {
      res.status(401).json({ error: 'Invalid username or password' })
      return
    }

    if (!staffByUsername.isActive) {
      res.status(403).json({ error: 'Account is inactive' })
      return
    }

    // Step 2: Authenticate with Supabase using the resolved email
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email: staffByUsername.email,
      password,
    })

    if (error || !data.user || !data.session) {
      res.status(401).json({ error: 'Invalid username or password' })
      return
    }

    const staff = await prisma.staff.findUnique({
      where: { id: data.user.id },
      include: { assignedOutlet: { select: { name: true } } },
    })

    if (!staff || !staff.isActive) {
      res.status(403).json({ error: 'Staff account not found or inactive' })
      return
    }

    res.json({
      token:              data.session.access_token,
      refreshToken:       data.session.refresh_token,
      userId:             staff.id,
      username:           staff.username,
      fullName:           staff.fullName,
      email:              staff.email,
      role:               staff.role,
      assignedOutletId:   staff.assignedOutletId,
      assignedOutletName: staff.assignedOutlet?.name ?? null,
    })
  } catch (err) {
    next(err)
  }
})

// POST /auth/refresh — exchange refresh token for a new access token
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body
    if (!refreshToken) {
      res.status(401).json({ error: 'No refresh token provided' })
      return
    }

    const { data, error } = await supabaseAdmin.auth.refreshSession({
      refresh_token: refreshToken,
    })

    if (error || !data.session) {
      res.status(401).json({ error: 'Session refresh failed — please log in again' })
      return
    }

    res.json({
      token:        data.session.access_token,
      refreshToken: data.session.refresh_token,
    })
  } catch (err) {
    next(err)
  }
})

// GET /cms/me — session restoration
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const staff = await prisma.staff.findUnique({
      where: { id: req.staff!.id },
      include: { assignedOutlet: { select: { name: true } } },
    })

    if (!staff) {
      res.status(404).json({ error: 'Staff not found' })
      return
    }

    res.json({
      token: '',
      refreshToken: '',
      userId: staff.id,
      fullName: staff.fullName,
      email: staff.email,
      role: staff.role,
      assignedOutletId: staff.assignedOutletId,
      assignedOutletName: staff.assignedOutlet?.name ?? null,
    })
  } catch (err) {
    next(err)
  }
})

export default router
