import { Router } from 'express'
import { getPool } from '../db/pool'
import { getSqlite } from '../db/sqlite'

export const healthRouter = Router()

healthRouter.get('/health', async (_req, res) => {
  let db: 'up' | 'down' | 'skipped' = 'skipped'
  let driver: 'none' | 'sqlite' | 'mysql' = 'none'

  try {
    const sqlite = getSqlite()
    if (sqlite) {
      sqlite.prepare('SELECT 1 AS ok').get()
      db = 'up'
      driver = 'sqlite'
    } else {
      const pool = getPool()
      if (pool) {
        await pool.query('SELECT 1 AS ok')
        db = 'up'
        driver = 'mysql'
      }
    }
  } catch {
    db = 'down'
  }

  const message =
    db === 'up' && driver === 'sqlite'
      ? 'SQLite 连接正常'
      : db === 'up' && driver === 'mysql'
        ? 'MySQL 连接正常'
        : db === 'down'
          ? '数据库未连接（检查 .env 或库文件权限）'
          : '未配置数据库（仅 API）'

  res.json({
    ok: true,
    message,
    service: 'shoujiweixiu-backend',
    db,
    driver: driver === 'none' ? undefined : driver,
    /** 当前进程应已注册；若前端仍报 not_found，多为连到了其它旧进程或未重启 */
    repairRoutes: [
      'GET /api/backup/database',
      'POST /api/database/clear-kv',
      'POST /api/snapshot/browser',
      'GET /api/repair/orders',
      'GET /api/repair/orders/events',
      'PUT /api/repair/orders',
      'POST /api/repair/orders',
      'GET /api/repair/orders/:id',
      'PUT /api/repair/orders/:id',
      'PATCH /api/repair/orders/:id',
      'DELETE /api/repair/orders/:id',
      'POST /api/repair/orders/batch-delete',
      'POST /api/repair/orders/batch-patch',
      'POST /api/repair/orders/replace-staff',
      'POST /api/repair/orders/clear-all',
      'GET /api/repair/staff',
      'PUT /api/repair/staff',
      'POST /api/repair/staff/login',
      'GET /api/repair/branding',
      'PUT /api/repair/branding',
    ],
  })
})
