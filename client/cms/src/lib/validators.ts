import { z } from 'zod'

export const loginSchema = z.object({
  username: z.string().min(3, 'User ID is required'),
  password: z.string().min(1, 'Password is required'),
})

export type LoginFormData = z.infer<typeof loginSchema>
