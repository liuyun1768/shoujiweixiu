import type { Request, Response } from 'express'
import { ensureSqliteSchema, getConfiguredSqliteAbsPath, getSqlite } from '../db/sqlite'
import { bumpRepairDataEpoch } from '../repairDataEpoch'
import { PRESERVED_KV_PATHS_ON_CLEAR } from '../repairKvPaths'

/**
 * 清空业务数据：订单表 + kv_store（保留企业名称与 Logo 等白名单 path）。
 * 不删除数据库文件本身；不关闭全局连接（避免与其它并发请求抢连接 / 锁）。
 *
 * 依赖：`getSqlite()` 已设置 busy_timeout、且先 `ensureSqliteSchema` 保证表存在。
 */
export function clearKvDatabaseHandler(_req: Request, res: Response): void {
  const sqlite = getSqlite()
  if (!sqlite) {
    const p = getConfiguredSqliteAbsPath()
    res.status(503).json({
      ok: false,
      message: p
        ? `sqlite_open_failed_or_not_initialized (path: ${p}). Check permissions, disk, SQLITE_PATH, and stop duplicate node processes.`
        : 'sqlite_not_configured',
    })
    return
  }

  try {
    ensureSqliteSchema(sqlite)
  } catch (e) {
    res.status(500).json({
      ok: false,
      message: e instanceof Error ? `ensure_schema_failed: ${e.message}` : 'ensure_schema_failed',
    })
    return
  }

  try {
    try {
      sqlite.prepare('DELETE FROM repair_orders').run()
    } catch (e) {
      // 极少数损坏库：订单表不可删时仍尝试清空 kv（业务要求）
      console.warn('[clear-kv] delete repair_orders skipped:', e instanceof Error ? e.message : e)
    }

    const preserved = [...PRESERVED_KV_PATHS_ON_CLEAR]
    if (preserved.length) {
      const ph = preserved.map(() => '?').join(', ')
      sqlite.prepare(`DELETE FROM kv_store WHERE path NOT IN (${ph})`).run(...preserved)
    } else {
      sqlite.prepare('DELETE FROM kv_store').run()
    }

    /** 递增世代，通知其它终端：不得以本地备份覆盖当前服务器快照 */
    bumpRepairDataEpoch(sqlite)

    res.json({ ok: true, message: 'cleared' })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'clear_failed'
    const hint =
      /locked|LOCK/i.test(msg) || /busy/i.test(msg)
        ? 'database may be locked: stop all other node processes using this SQLITE_PATH, or increase SQLITE_BUSY_TIMEOUT_MS.'
        : ''
    res.status(500).json({
      ok: false,
      message: hint ? `${msg}. ${hint}` : msg,
    })
  }
}
