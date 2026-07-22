import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import { prisma } from '../../lib/prisma'
import { supabaseAdmin } from '../../lib/supabase'
import crypto from 'crypto'

const router = Router()
router.use(requireAuth)

// GET /api/cms/profile - Fetch current authenticated staff member profile
router.get('/', async (req, res, next) => {
  try {
    const staffId = req.staff?.id
    if (!staffId) {
      res.status(401).json({ error: 'Unauthorized staff session' })
      return
    }

    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
      include: {
        assignedOutlet: {
          select: {
            id: true,
            name: true,
            address: true,
            location: true,
          },
        },
      },
    })

    if (!staff) {
      res.status(404).json({ error: 'Staff member profile not found' })
      return
    }

    res.json({
      success: true,
      data: {
        id: staff.id,
        fullName: staff.fullName,
        email: staff.email,
        phone: staff.phone || '',
        role: staff.role,
        isActive: staff.isActive,
        assignedOutlet: staff.assignedOutlet,
        createdAt: staff.createdAt,
      },
    })
  } catch (err) {
    next(err)
  }
})

// PATCH /api/cms/profile - Update staff member profile info
router.patch('/', async (req, res, next) => {
  try {
    const staffId = req.staff?.id
    if (!staffId) {
      res.status(401).json({ error: 'Unauthorized staff session' })
      return
    }

    const { fullName, phone, email, currentPassword, newPassword } = req.body

    const updateData: any = {}
    if (fullName) updateData.fullName = fullName.trim()
    if (phone !== undefined) updateData.phone = phone.trim()
    if (email) updateData.email = email.trim().toLowerCase()

    // Handle optional password change if provided
    if (newPassword) {
      if (newPassword.length < 6) {
        res.status(400).json({ error: 'New password must be at least 6 characters' })
        return
      }

      const { error: pwdError } = await supabaseAdmin.auth.admin.updateUserById(staffId, {
        password: newPassword,
      })

      if (pwdError) {
        console.error('Password update error:', pwdError)
        res.status(400).json({ error: pwdError.message || 'Could not update password' })
        return
      }
    }

    const updatedStaff = await prisma.staff.update({
      where: { id: staffId },
      data: updateData,
      include: {
        assignedOutlet: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        id: updatedStaff.id,
        fullName: updatedStaff.fullName,
        email: updatedStaff.email,
        phone: updatedStaff.phone || '',
        role: updatedStaff.role,
        assignedOutlet: updatedStaff.assignedOutlet,
      },
    })
  } catch (err) {
    next(err)
  }
})

export default router
