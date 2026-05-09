import { Router } from 'express'
import { getSqlite } from '../db/sqlite'
import { REPAIR_ORDERS_LEGACY_KV_PATH } from '../repairOrders/legacyKvPath'

export const kvRouter = Router()

/** 读 KV（快递打单等大 JSON），path 为逻辑键如 repair-kuaidi/state.json */
kvRouter.get('/kv/read', (req, res) => {
  const sqlite = getSqlite()
  if (!sqlite) {
    res.status(503).json({ ok: false, message: 'sqlite_not_configured' })
    return
  }
  const pathKey = String(req.query.path ?? '').trim()
  if (!pathKey || pathKey.length > 512) {
    res.status(400).json({ ok: false, message: 'bad_path' })
    return
  }
  try {
    const row = sqlite
      .prepare('SELECT value FROM kv_store WHERE path = ?')
      .get(pathKey) as { value: string } | undefined
    if (!row) {
      res.json({ ok: true, text: null })
      return
    }
    res.json({ ok: true, text: row.value })
  } catch (e) {
    res.status(500).json({ ok: false, message: e instanceof Error ? e.message : 'read_failed' })
  }
})

kvRouter.post('/kv/write', (req, res) => {
  const sqlite = getSqlite()
  if (!sqlite) {
    res.status(503).json({ ok: false, message: 'sqlite_not_configured' })
    return
  }
  const pathKey = String(req.body?.path ?? '').trim()
  const text = typeof req.body?.text === 'string' ? req.body.text : ''
  if (!pathKey || pathKey.length > 512) {
    res.status(400).json({ ok: false, message: 'bad_path' })
    return
  }
  if (text.length > 50 * 1024 * 1024) {
    res.status(413).json({ ok: false, message: 'payload_too_large' })
    return
  }
  /** 订单只走 repair_orders 表 API，禁止再写入旧版整表 kv（否则可能与迁移逻辑叠加造成「清空后又出现」） */
  if (pathKey === REPAIR_ORDERS_LEGACY_KV_PATH) {
    res.status(403).json({ ok: false, message: 'kv_path_reserved_use_repair_orders_api' })
    return
  }
  try {
    sqlite
      .prepare(
        `INSERT INTO kv_store (path, value, updated_at) VALUES (?, ?, strftime('%s','now'))
         ON CONFLICT(path) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      )
      .run(pathKey, text)
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ ok: false, message: e instanceof Error ? e.message : 'write_failed' })
  }
})
