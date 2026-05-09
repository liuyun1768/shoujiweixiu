import cors from 'cors'
import express from 'express'
import { mountSfPreviewProxy } from './sfPreviewProxy'
import { backupRouter } from './routes/backup'
import { filesRouter } from './routes/files'
import { healthRouter } from './routes/health'
import { kvRouter } from './routes/kv'
import { repairOrdersRouter } from './routes/repairOrders'
import { repairBrandingRouter } from './routes/repairBranding'
import { repairStaffRouter } from './routes/repairStaff'
import { restoreDatabaseHandler } from './routes/restore'
import { snapshotRouter } from './routes/snapshot'
import { uploadRouter } from './routes/upload'
export function createApp() {
  const app = express()
  app.use(cors({ origin: true, credentials: true }))

  app.post(
    '/api/restore/database',
    express.raw({ limit: '80mb', type: '*/*' }),
    restoreDatabaseHandler,
  )

  /** 须在 express.json 之前：顺丰 POST 需流式转发到 Vite preview */
  mountSfPreviewProxy(app)

  app.use(express.json({ limit: '12mb' }))

  app.use('/api', healthRouter)
  app.use('/api', kvRouter)
  app.use('/api', repairOrdersRouter)
  app.use('/api', repairStaffRouter)
  app.use('/api', repairBrandingRouter)
  app.use('/api', filesRouter)
  app.use('/api', backupRouter)
  app.use('/api', uploadRouter)
  app.use('/api', snapshotRouter)

  app.use((_req, res) => {
    res.status(404).json({ ok: false, message: 'not_found' })
  })

  return app
}
