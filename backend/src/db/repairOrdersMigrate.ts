import type { DatabaseSync } from 'node:sqlite'
import { readRepairDataEpoch } from '../repairDataEpoch'
import { REPAIR_ORDERS_LEGACY_KV_PATH } from '../repairOrders/legacyKvPath'

type OrderRow = Record<string, unknown>

function coerceOrder(o: unknown): OrderRow | null {
  if (!o || typeof o !== 'object') return null
  const r = o as Record<string, unknown>
  const id = Number(r.id)
  if (!Number.isFinite(id) || id <= 0) return null
  return r
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

/**
 * 若 repair_orders 为空且 kv 中仍有旧版订单 JSON，则导入后删除该 kv 项。
 */
export function migrateLegacyRepairOrdersKvIfNeeded(sqlite: DatabaseSync): void {
  const cnt = sqlite.prepare('SELECT COUNT(*) AS c FROM repair_orders').get() as { c: number }
  if (cnt.c > 0) return

  /** 已发生过业务清空（世代>1）时不再从旧 kv 复活订单，并扔掉陈旧 JSON，避免重启后表空又灌回 */
  if (readRepairDataEpoch(sqlite) > 1) {
    try {
      sqlite.prepare('DELETE FROM kv_store WHERE path = ?').run(REPAIR_ORDERS_LEGACY_KV_PATH)
    } catch {
      // ignore
    }
    return
  }

  const row = sqlite
    .prepare('SELECT value FROM kv_store WHERE path = ?')
    .get(REPAIR_ORDERS_LEGACY_KV_PATH) as { value: string } | undefined
  if (!row?.value?.trim()) return

  let arr: unknown
  try {
    arr = JSON.parse(row.value) as unknown
  } catch {
    return
  }
  if (!Array.isArray(arr) || arr.length === 0) return

  const now = Math.floor(Date.now() / 1000)
  const ins = sqlite.prepare(
    `INSERT INTO repair_orders (id, order_no, phone, repair_staff, report_date, updated_at, payload)
     VALUES (?,?,?,?,?,?,?)`,
  )

  sqlite.exec('BEGIN IMMEDIATE')
  try {
    for (const item of arr) {
      const p = coerceOrder(item)
      if (!p) continue
      const d = denormFromPayload(p)
      ins.run(
        Number(p.id),
        d.order_no,
        d.phone,
        d.repair_staff,
        d.report_date,
        now,
        JSON.stringify({ ...p, id: Number(p.id) }),
      )
    }
    sqlite.prepare('DELETE FROM kv_store WHERE path = ?').run(REPAIR_ORDERS_LEGACY_KV_PATH)
    sqlite.exec('COMMIT')
  } catch {
    try {
      sqlite.exec('ROLLBACK')
    } catch {
      // ignore
    }
  }
}
