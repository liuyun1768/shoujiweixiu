import fs from 'node:fs'
import path from 'node:path'
import type { Request, Response } from 'express'
import { closeSqlite, getSqlite } from '../db/sqlite'

function sqlitePathAbs(): string | null {
  const raw = process.env.SQLITE_PATH?.trim()
  if (!raw) return null
  return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw)
}

function isSqliteMagic(buf: Buffer): boolean {
  const head = buf.subarray(0, 16).toString('utf8')
  return head.startsWith('SQLite format 3')
}

/**
 * 用上传的整库文件替换当前 SQLITE_PATH（会先复制一份 .bak-*）。
 * body: raw application/octet-stream 或 SQLite 文件字节。
 */
export function restoreDatabaseHandler(req: Request, res: Response): void {
  const abs = sqlitePathAbs()
  if (!abs) {
    res.status(503).json({ ok: false, message: 'sqlite_not_configured' })
    return
  }

  const buf = req.body
  if (!Buffer.isBuffer(buf) || buf.length < 512) {
    res.status(400).json({ ok: false, message: 'bad_body' })
    return
  }
  if (buf.length > 80 * 1024 * 1024) {
    res.status(413).json({ ok: false, message: 'file_too_large' })
    return
  }
  if (!isSqliteMagic(buf)) {
    res.status(400).json({ ok: false, message: 'not_sqlite_file' })
    return
  }

  const dir = path.dirname(abs)
  try {
    fs.mkdirSync(dir, { recursive: true })
  } catch {
    res.status(500).json({ ok: false, message: 'mkdir_failed' })
    return
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  try {
    if (fs.existsSync(abs)) {
      const bak = `${abs}.bak-restore-${stamp}`
      fs.copyFileSync(abs, bak)
    }
  } catch (e) {
    res.status(500).json({ ok: false, message: e instanceof Error ? e.message : 'backup_failed' })
    return
  }

  closeSqlite()
  try {
    fs.writeFileSync(abs, buf)
  } catch (e) {
    res.status(500).json({ ok: false, message: e instanceof Error ? e.message : 'write_failed' })
    return
  }

  try {
    const db = getSqlite()
    db?.prepare('SELECT 1 AS ok').get()
  } catch (e) {
    res.status(400).json({
      ok: false,
      message: e instanceof Error ? e.message : 'opened_db_invalid',
      hint: '已写入的文件无法打开，请检查上传是否完整；必要时从服务器上 .bak-restore-* 手工恢复。',
    })
    return
  }

  res.json({ ok: true, message: 'restore_ok_refresh' })
}
