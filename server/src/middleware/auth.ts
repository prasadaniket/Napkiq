import { Request, Response, NextFunction } from 'express'
import { supabaseAdmin } from '../lib/supabase'
import { prisma } from '../lib/prisma'

export interface StaffPayload {
  id: string
  fullName: string
  email: string
  role: 'admin' | 'owner' | 'franchise_owner'
  assignedOutletId: string | null
}

declare global {
  namespace Express {
    interface Request {
      staff?: StaffPayload
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' })
    return
  }

  const token = authHeader.split(' ')[1]

  try {
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token)

    if (error || !user) {
      res.status(401).json({ error: 'Invalid or expired token' })
      return
    }

    const staff = await prisma.staff.findUnique({ where: { id: user.id } })

    if (!staff || !staff.isActive) {
      res.status(403).json({ error: 'Staff account not found or inactive' })
      return
    }

    // Map deprecated main_owner → admin (backward compat during migration)
    const role: StaffPayload['role'] =
      staff.role === 'admin' || staff.role === 'main_owner'
        ? 'admin'
        : staff.role === 'owner'
        ? 'owner'
        : 'franchise_owner'

    req.staff = {
      id:               staff.id,
      fullName:         staff.fullName,
      email:            staff.email,
      role,
      assignedOutletId: staff.assignedOutletId,
    }

    next()
  } catch (err) {
    res.status(500).json({ error: 'Authentication error' })
  }
}

// ─── Role Guards ──────────────────────────────────────────────────────────────

/** Admin only (UniCord) */
export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (req.staff?.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' })
    return
  }
  next()
}

/** Owner or Admin (anyone except franchise_owner) */
export function requireOwnerOrAbove(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!['admin', 'owner'].includes(req.staff?.role ?? '')) {
    res.status(403).json({ error: 'Owner access required' })
    return
  }
  next()
}

/** @deprecated use requireAdmin instead */
export function requireMainOwner(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  requireAdmin(req, res, next)
}
