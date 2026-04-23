import 'dotenv/config'
import express from 'express'
import cors from 'cors'

import outletsRouter from './routes/outlets'
import customersRouter from './routes/customers'
import reviewsRouter from './routes/reviews'
import visitsRouter from './routes/visits'
import menuRouter from './routes/menu'
import authRouter from './routes/auth'
import dashboardRouter from './routes/cms/dashboard'
import cmsCustomersRouter from './routes/cms/customers'
import cmsReviewsRouter from './routes/cms/reviews'
import cmsOutletsRouter from './routes/cms/outlets'
import cmsVisitsRouter from './routes/cms/visits'
import automationLogsRouter from './routes/cms/automationLogs'
import exportRouter from './routes/cms/export'
import { errorHandler } from './middleware/errorHandler'

export function createApp() {
  const app = express()

  const allowedOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true)
        } else {
          callback(new Error(`CORS: origin ${origin} not allowed`))
        }
      },
      credentials: true,
    })
  )

  app.use(express.json())

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  })

  // Public routes
  app.use('/api/outlets', outletsRouter)
  app.use('/api/customers', customersRouter)
  app.use('/api/reviews', reviewsRouter)
  app.use('/api/visits', visitsRouter)
  app.use('/api/menu', menuRouter)

  // Auth
  app.use('/api/auth', authRouter)  // POST /api/auth/login, GET /api/auth/me

  // CMS (protected)
  app.use('/api/cms/dashboard',       dashboardRouter)
  app.use('/api/cms/customers',       cmsCustomersRouter)
  app.use('/api/cms/reviews',         cmsReviewsRouter)
  app.use('/api/cms/outlets',         cmsOutletsRouter)
  app.use('/api/cms/visits',          cmsVisitsRouter)
  app.use('/api/cms/automation-logs', automationLogsRouter)
  app.use('/api/cms/export',          exportRouter)

  // Automation trigger — stub until Task 8 (Cloudflare Worker)
  app.post('/api/cms/reengagement/trigger', (_req, res) => {
    res.status(501).json({ message: 'Automation worker not yet configured (Task 8)' })
  })

  app.use(errorHandler)

  return app
}
