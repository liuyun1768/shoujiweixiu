import fs from 'node:fs'
import path from 'node:path'
import { Router } from 'express'
import { getSqlite } from '../db/sqlite'
import { clearKvDatabaseHandler } from './databaseClear'

export const backupRouter = Router()

/** 与下载备份同属「数据库维护」，挂在 /api 下避免独立注册顺序导致 404 */
backupRouter.post('/database/clear-kv', clearKvDatabaseHandler)

/** 下载整库 SQLite 文件，便于保存到本机 D 盘等目录 */
backupRouter.get('/backup/database', (_req, res) => {
  const raw = process.env.SQLITE_PATH?.trim()
  if (!raw) {
    res.status(503).json({ ok: false, message: 'sqlite_not_configured' })
    return
  }
  const abs = path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw)
  if (!fs.existsSync(abs)) {
    res.status(404).json({ ok: false, message: 'db_missing' })
    return
  }
  const sqlite = getSqlite()
  try {
    sqlite?.prepare('PRAGMA wal_checkpoint(FULL)').run()
  } catch {
    // ignore
  }
  let buf: Buffer
  try {
    buf = fs.readFileSync(abs)
  } catch (e) {
    res.status(500).json({ ok: false, message: e instanceof Error ? e.message : 'read_failed' })
    return
  }
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  res.setHeader('Content-Type', 'application/octet-stream')
  res.setHeader('Content-Disposition', `attachment; filename="repair-backup-${stamp}.sqlite"`)
  res.send(buf)
})
