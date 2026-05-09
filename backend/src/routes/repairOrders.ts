import type { DatabaseSync } from 'node:sqlite'
import { Router } from 'express'
import { getSqlite } from '../db/sqlite'
import { bumpRepairDataEpoch, readRepairDataEpoch } from '../repairDataEpoch'
import {
  addRepairOrderSseClient,
  broadcastRepairOrderDelta,
  broadcastRepairOrdersResync,
  removeRepairOrderSseClient,
} from '../repairOrders/orderSseHub'

export const repairOrdersRouter = Router()

const PATCHABLE = new Set<string>([
  'orderNo',
  'reportDate',
  'contact',
  'model',
  'phone',
  'fault',
  'status',
  'statusType',
  'total',
  'prepaid',
  'repairStaff',
  'salesperson',
  'remark',
  'mailAddress',
  'settleStatus',
  'cost',
  'otherCostTotal',
  'otherCostLines',
  'customer',
  'arrears',
  'discount',
  'actual',
  'orderTime',
  'payMethod',
  'expressCompany',
  'trackingNo',
  'shippedAt',
  'operationLog',
])

type OrderRow = Record<string, unknown>

function noSqlite(res: import('express').Response): void {
  res.status(503).json({ ok: false, message: 'sqlite_not_configured' })
}

function allocateNextId(sqlite: DatabaseSync): number {
  const r = sqlite.prepare('SELECT IFNULL(MAX(id), 0) + 1 AS n FROM repair_orders').get() as {
    n: number
  }
  return r.n
}

function denormFromPayload(p: OrderRow): {
  order_no: string
  phone: string
  repair_staff: string
  report_date: string
} {
  return {
    order_no: String(p.orderNo ?? '').trim() || '—',
    phone: String(p.phone ?? '').trim(),
    repair_staff: String(p.repairStaff ?? '').trim(),
    report_date: String(p.reportDate ?? '').trim(),
  }
}

function readOrderById(sqlite: DatabaseSync, id: number): OrderRow | null {
  const row = sqlite
    .prepare('SELECT id, payload FROM repair_orders WHERE id = ?')
    .get(id) as { id: number; payload: string } | undefined
  if (!row) return null
  try {
    const p = JSON.parse(row.payload) as unknown
    if (!p || typeof p !== 'object') return null
    const o = p as OrderRow
    o.id = row.id
    return o
  } catch {
    return null
  }
}

function upsertRow(sqlite: DatabaseSync, full: OrderRow): void {
  const id = Number(full.id)
  if (!Number.isFinite(id) || id <= 0) throw new Error('bad_id')
  const d = denormFromPayload(full)
  const now = Math.floor(Date.now() / 1000)
  const payload = JSON.stringify(full)
  sqlite
    .prepare(
      `INSERT INTO repair_orders (id, order_no, phone, repair_staff, report_date, updated_at, payload)
       VALUES (?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET
         order_no = excluded.order_no,
         phone = excluded.phone,
         repair_staff = excluded.repair_staff,
         report_date = excluded.report_date,
         updated_at = excluded.updated_at,
         payload = excluded.payload`,
    )
    .run(id, d.order_no, d.phone, d.repair_staff, d.report_date, now, payload)
}

function listAllOrders(sqlite: DatabaseSync): OrderRow[] {
  const rows = sqlite
    .prepare(
      `SELECT id, payload FROM repair_orders ORDER BY id DESC`,
    )
    .all() as { id: number; payload: string }[]
  const out: OrderRow[] = []
  for (const row of rows) {
    try {
      const p = JSON.parse(row.payload) as unknown
      if (!p || typeof p !== 'object') continue
      const o = p as OrderRow
      o.id = row.id
      out.push(o)
    } catch {
      continue
    }
  }
  return out
}

/** GET /api/repair/orders — 列表（payload 为权威结构，含扩展字段） */
repairOrdersRouter.get('/repair/orders', (_req, res) => {
  const sqlite = getSqlite()
  if (!sqlite) {
    noSqlite(res)
    return
  }
  try {
    const orders = listAllOrders(sqlite)
    const dataEpoch = readRepairDataEpoch(sqlite)
    res.json({ ok: true, orders, dataEpoch, meta: { total: orders.length, dataEpoch } })
  } catch (e) {
    res.status(500).json({ ok: false, message: e instanceof Error ? e.message : 'list_failed' })
  }
})

/**
 * GET /api/repair/orders/events — SSE：订单变更时推送结构化增量（add/update/delete/resync），客户端本地合并。
 * 须注册在 `/repair/orders/:id` 之前，避免 `events` 被当成 id。
 */
repairOrdersRouter.get('/repair/orders/events', (req, res) => {
  const sqlite = getSqlite()
  if (!sqlite) {
    noSqlite(res)
    return
  }
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  if (typeof res.flushHeaders === 'function') res.flushHeaders()
  addRepairOrderSseClient(res)
  let heartbeat: ReturnType<typeof setInterval> | undefined
  let cleaned = false
  const cleanup = () => {
    if (cleaned) return
    cleaned = true
    if (heartbeat) clearInterval(heartbeat)
    heartbeat = undefined
    removeRepairOrderSseClient(res)
  }
  req.on('close', cleanup)
  req.on('aborted', cleanup)
  res.on('close', cleanup)
  try {
    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`)
  } catch {
    cleanup()
    return
  }
  heartbeat = setInterval(() => {
    try {
      res.write(': ping\n\n')
    } catch {
      cleanup()
    }
  }, 25_000)
})

/** PUT /api/repair/orders — 仅当库中无订单时整表导入（迁移 / 首台同步）；有数据时返回 409 */
repairOrdersRouter.put('/repair/orders', (req, res) => {
  const sqlite = getSqlite()
  if (!sqlite) {
    noSqlite(res)
    return
  }
  const orders = req.body?.orders
  if (!Array.isArray(orders)) {
    res.status(400).json({ ok: false, message: 'orders_must_be_array' })
    return
  }
  const cnt = sqlite.prepare('SELECT COUNT(*) AS c FROM repair_orders').get() as { c: number }
  if (cnt.c > 0) {
    res.status(409).json({ ok: false, message: 'repair_orders_not_empty_use_granular_api' })
    return
  }
  /** 发生过清空（世代>1）后禁止整表 PUT，杜绝任意旧前端 / localStorage 把订单灌回 SQLite */
  const epochPre = readRepairDataEpoch(sqlite)
  if (epochPre > 1) {
    res.status(403).json({
      ok: false,
      message: 'bulk_order_import_disabled_after_server_reset_use_post_per_order',
      dataEpoch: epochPre,
    })
    return
  }
  try {
    sqlite.exec('BEGIN IMMEDIATE')
    try {
      for (const item of orders) {
        if (!item || typeof item !== 'object') continue
        const raw = item as OrderRow
        const id = Number(raw.id)
        const useId = Number.isFinite(id) && id > 0 ? Math.floor(id) : allocateNextId(sqlite)
        const full = { ...raw, id: useId }
        upsertRow(sqlite, full)
      }
      sqlite.exec('COMMIT')
    } catch (e) {
      try {
        sqlite.exec('ROLLBACK')
      } catch {
        // ignore
      }
      throw e
    }
    broadcastRepairOrdersResync(readRepairDataEpoch(sqlite))
    const dataEpoch = readRepairDataEpoch(sqlite)
    res.json({ ok: true, imported: orders.length, dataEpoch })
  } catch (e) {
    res.status(500).json({ ok: false, message: e instanceof Error ? e.message : 'import_failed' })
  }
})

/** POST /api/repair/orders — 新建（服务端分配 id，忽略 body.id） */
repairOrdersRouter.post('/repair/orders', (req, res) => {
  const sqlite = getSqlite()
  if (!sqlite) {
    noSqlite(res)
    return
  }
  const body = req.body
  if (!body || typeof body !== 'object') {
    res.status(400).json({ ok: false, message: 'bad_body' })
    return
  }
  try {
    sqlite.exec('BEGIN IMMEDIATE')
    const id = allocateNextId(sqlite)
    const { id: _ignore, ...rest } = body as OrderRow & { id?: unknown }
    const full: OrderRow = { ...rest, id }
    const orderNo = String(full.orderNo ?? '').trim()
    if (!orderNo) {
      sqlite.exec('ROLLBACK')
      res.status(400).json({ ok: false, message: 'order_no_required' })
      return
    }
    const dup = sqlite.prepare('SELECT id FROM repair_orders WHERE order_no = ?').get(orderNo) as
      | { id: number }
      | undefined
    if (dup) {
      sqlite.exec('ROLLBACK')
      res.status(409).json({ ok: false, message: 'order_no_conflict' })
      return
    }
    upsertRow(sqlite, full)
    sqlite.exec('COMMIT')
    broadcastRepairOrderDelta('add', id, full)
    res.status(201).json({ ok: true, order: full })
  } catch (e) {
    try {
      sqlite.exec('ROLLBACK')
    } catch {
      // ignore
    }
    res.status(500).json({ ok: false, message: e instanceof Error ? e.message : 'create_failed' })
  }
})

/** GET /api/repair/orders/:id */
repairOrdersRouter.get('/repair/orders/:id', (req, res) => {
  const sqlite = getSqlite()
  if (!sqlite) {
    noSqlite(res)
    return
  }
  const id = Number(req.params.id)
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ ok: false, message: 'bad_id' })
    return
  }
  try {
    const order = readOrderById(sqlite, id)
    if (!order) {
      res.status(404).json({ ok: false, message: 'not_found' })
      return
    }
    res.json({ ok: true, order })
  } catch (e) {
    res.status(500).json({ ok: false, message: e instanceof Error ? e.message : 'read_failed' })
  }
})

/** PUT /api/repair/orders/:id — 整单覆盖 */
repairOrdersRouter.put('/repair/orders/:id', (req, res) => {
  const sqlite = getSqlite()
  if (!sqlite) {
    noSqlite(res)
    return
  }
  const id = Number(req.params.id)
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ ok: false, message: 'bad_id' })
    return
  }
  const body = req.body
  if (!body || typeof body !== 'object') {
    res.status(400).json({ ok: false, message: 'bad_body' })
    return
  }
  try {
    const existing = readOrderById(sqlite, id)
    if (!existing) {
      res.status(404).json({ ok: false, message: 'not_found' })
      return
    }
    const full: OrderRow = { ...(body as OrderRow), id }
    const orderNo = String(full.orderNo ?? '').trim()
    if (!orderNo) {
      res.status(400).json({ ok: false, message: 'order_no_required' })
      return
    }
    const dup = sqlite.prepare('SELECT id FROM repair_orders WHERE order_no = ? AND id != ?').get(orderNo, id) as
      | { id: number }
      | undefined
    if (dup) {
      res.status(409).json({ ok: false, message: 'order_no_conflict' })
      return
    }
    upsertRow(sqlite, full)
    broadcastRepairOrderDelta('update', id, full)
    res.json({ ok: true, order: full })
  } catch (e) {
    res.status(500).json({ ok: false, message: e instanceof Error ? e.message : 'update_failed' })
  }
})

/** PATCH /api/repair/orders/:id — 浅合并可写字段 */
repairOrdersRouter.patch('/repair/orders/:id', (req, res) => {
  const sqlite = getSqlite()
  if (!sqlite) {
    noSqlite(res)
    return
  }
  const id = Number(req.params.id)
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ ok: false, message: 'bad_id' })
    return
  }
  const patch = req.body
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    res.status(400).json({ ok: false, message: 'bad_patch' })
    return
  }
  try {
    const existing = readOrderById(sqlite, id)
    if (!existing) {
      res.status(404).json({ ok: false, message: 'not_found' })
      return
    }
    const next: OrderRow = { ...existing }
    for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
      if (k === 'id') continue
      if (!PATCHABLE.has(k)) continue
      next[k] = v
    }
    if (patch.orderNo != null) {
      const orderNo = String(next.orderNo ?? '').trim()
      const dup = sqlite.prepare('SELECT id FROM repair_orders WHERE order_no = ? AND id != ?').get(orderNo, id) as
        | { id: number }
        | undefined
      if (dup) {
        res.status(409).json({ ok: false, message: 'order_no_conflict' })
        return
      }
    }
    upsertRow(sqlite, next)
    broadcastRepairOrderDelta('update', id, next)
    res.json({ ok: true, order: next })
  } catch (e) {
    res.status(500).json({ ok: false, message: e instanceof Error ? e.message : 'patch_failed' })
  }
})

/** DELETE /api/repair/orders/:id */
repairOrdersRouter.delete('/repair/orders/:id', (req, res) => {
  const sqlite = getSqlite()
  if (!sqlite) {
    noSqlite(res)
    return
  }
  const id = Number(req.params.id)
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ ok: false, message: 'bad_id' })
    return
  }
  try {
    const r = sqlite.prepare('DELETE FROM repair_orders WHERE id = ?').run(id)
    if (!r.changes) {
      res.status(404).json({ ok: false, message: 'not_found' })
      return
    }
    broadcastRepairOrderDelta('delete', id)
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ ok: false, message: e instanceof Error ? e.message : 'delete_failed' })
  }
})

/** POST /api/repair/orders/batch-delete */
repairOrdersRouter.post('/repair/orders/batch-delete', (req, res) => {
  const sqlite = getSqlite()
  if (!sqlite) {
    noSqlite(res)
    return
  }
  const ids = req.body?.ids
  if (!Array.isArray(ids) || !ids.every((x) => typeof x === 'number' && Number.isFinite(x))) {
    res.status(400).json({ ok: false, message: 'ids_must_be_number_array' })
    return
  }
  const del = sqlite.prepare('DELETE FROM repair_orders WHERE id = ?')
  try {
    sqlite.exec('BEGIN IMMEDIATE')
    let n = 0
    const deletedIds: number[] = []
    for (const raw of ids) {
      const id = Math.floor(Number(raw))
      if (id <= 0) continue
      const r = del.run(id)
      if (r.changes) {
        n++
        deletedIds.push(id)
      }
    }
    sqlite.exec('COMMIT')
    for (const id of deletedIds) {
      broadcastRepairOrderDelta('delete', id)
    }
    res.json({ ok: true, deleted: n })
  } catch (e) {
    try {
      sqlite.exec('ROLLBACK')
    } catch {
      // ignore
    }
    res.status(500).json({ ok: false, message: e instanceof Error ? e.message : 'batch_delete_failed' })
  }
})

/** POST /api/repair/orders/batch-patch */
repairOrdersRouter.post('/repair/orders/batch-patch', (req, res) => {
  const sqlite = getSqlite()
  if (!sqlite) {
    noSqlite(res)
    return
  }
  const ids = req.body?.ids
  const patch = req.body?.patch
  if (!Array.isArray(ids) || !ids.length) {
    res.status(400).json({ ok: false, message: 'ids_required' })
    return
  }
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    res.status(400).json({ ok: false, message: 'bad_patch' })
    return
  }
  try {
    sqlite.exec('BEGIN IMMEDIATE')
    let updated = 0
    const toBroadcast: OrderRow[] = []
    for (const raw of ids) {
      const id = Math.floor(Number(raw))
      if (id <= 0) continue
      const existing = readOrderById(sqlite, id)
      if (!existing) continue
      const next: OrderRow = { ...existing }
      for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
        if (k === 'id') continue
        if (!PATCHABLE.has(k)) continue
        next[k] = v
      }
      upsertRow(sqlite, next)
      toBroadcast.push({ ...next })
      updated++
    }
    sqlite.exec('COMMIT')
    for (const row of toBroadcast) {
      const rid = Number(row.id)
      if (Number.isFinite(rid) && rid > 0) broadcastRepairOrderDelta('update', rid, row)
    }
    res.json({ ok: true, updated })
  } catch (e) {
    try {
      sqlite.exec('ROLLBACK')
    } catch {
      // ignore
    }
    res.status(500).json({ ok: false, message: e instanceof Error ? e.message : 'batch_patch_failed' })
  }
})

/** POST /api/repair/orders/replace-staff */
repairOrdersRouter.post('/repair/orders/replace-staff', (req, res) => {
  const sqlite = getSqlite()
  if (!sqlite) {
    noSqlite(res)
    return
  }
  const oldName = String(req.body?.oldName ?? '').trim()
  const newName = String(req.body?.newName ?? '').trim()
  if (!oldName || !newName || oldName === newName) {
    res.status(400).json({ ok: false, message: 'bad_names' })
    return
  }
  try {
    const rows = sqlite.prepare('SELECT id, payload FROM repair_orders').all() as {
      id: number
      payload: string
    }[]
    let changed = 0
    const toBroadcast: OrderRow[] = []
    sqlite.exec('BEGIN IMMEDIATE')
    for (const row of rows) {
      let p: OrderRow
      try {
        p = JSON.parse(row.payload) as OrderRow
      } catch {
        continue
      }
      if (String(p.repairStaff ?? '') !== oldName) continue
      p.repairStaff = newName
      p.id = row.id
      upsertRow(sqlite, p)
      toBroadcast.push({ ...p })
      changed++
    }
    sqlite.exec('COMMIT')
    for (const o of toBroadcast) {
      const rid = Number(o.id)
      if (Number.isFinite(rid) && rid > 0) broadcastRepairOrderDelta('update', rid, o)
    }
    res.json({ ok: true, changed })
  } catch (e) {
    try {
      sqlite.exec('ROLLBACK')
    } catch {
      // ignore
    }
    res.status(500).json({ ok: false, message: e instanceof Error ? e.message : 'replace_staff_failed' })
  }
})

/** POST /api/repair/orders/clear-all */
repairOrdersRouter.post('/repair/orders/clear-all', (_req, res) => {
  const sqlite = getSqlite()
  if (!sqlite) {
    noSqlite(res)
    return
  }
  try {
    sqlite.exec('DELETE FROM repair_orders')
    bumpRepairDataEpoch(sqlite)
    const dataEpoch = readRepairDataEpoch(sqlite)
    broadcastRepairOrdersResync(dataEpoch)
    res.json({ ok: true, dataEpoch })
  } catch (e) {
    res.status(500).json({ ok: false, message: e instanceof Error ? e.message : 'clear_failed' })
  }
})
