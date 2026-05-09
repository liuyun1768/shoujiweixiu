import type { Response } from 'express'

const clients = new Set<Response>()

/** 与前端 `repairOrderStore` 约定的增量消息（JSON 一行） */
export type RepairOrderSsePayload =
  | { type: 'repair-orders-delta'; op: 'add'; id: number; order: Record<string, unknown> }
  | { type: 'repair-orders-delta'; op: 'update'; id: number; order: Record<string, unknown> }
  | { type: 'repair-orders-delta'; op: 'delete'; id: number }
  | { type: 'repair-orders-delta'; op: 'resync'; dataEpoch?: number }

function writeSseJson(res: Response, payload: unknown): void {
  res.write(`data: ${JSON.stringify(payload)}\n\n`)
}

/** 单条新增 / 修改：推送完整 order（须含 id） */
export function broadcastRepairOrderDelta(
  op: 'add' | 'update' | 'delete',
  id: number,
  order?: Record<string, unknown>,
): void {
  if (op === 'delete') {
    const msg: RepairOrderSsePayload = { type: 'repair-orders-delta', op: 'delete', id }
    const chunk = `data: ${JSON.stringify(msg)}\n\n`
    for (const res of [...clients]) {
      try {
        res.write(chunk)
      } catch {
        clients.delete(res)
      }
    }
    return
  }
  if (!order || typeof order !== 'object') return
  const msg: RepairOrderSsePayload = { type: 'repair-orders-delta', op, id, order }
  const chunk = `data: ${JSON.stringify(msg)}\n\n`
  for (const res of [...clients]) {
    try {
      res.write(chunk)
    } catch {
      clients.delete(res)
    }
  }
}

/**
 * 无法逐条表达的海量变更（空库整表导入、清空全表）：客户端仍走一次全量 GET。
 * dataEpoch 可选，便于客户端与 lastSeen 对齐（refresh 会写入）。
 */
export function broadcastRepairOrdersResync(dataEpoch?: number): void {
  const msg: RepairOrderSsePayload =
    dataEpoch != null && Number.isFinite(dataEpoch)
      ? { type: 'repair-orders-delta', op: 'resync', dataEpoch: Math.floor(dataEpoch) }
      : { type: 'repair-orders-delta', op: 'resync' }
  const chunk = `data: ${JSON.stringify(msg)}\n\n`
  for (const res of [...clients]) {
    try {
      res.write(chunk)
    } catch {
      clients.delete(res)
    }
  }
}

export function addRepairOrderSseClient(res: Response): void {
  clients.add(res)
}

export function removeRepairOrderSseClient(res: Response): void {
  clients.delete(res)
}
