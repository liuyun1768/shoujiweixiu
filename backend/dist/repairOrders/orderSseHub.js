"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.broadcastRepairOrderDelta = broadcastRepairOrderDelta;
exports.broadcastRepairOrdersResync = broadcastRepairOrdersResync;
exports.addRepairOrderSseClient = addRepairOrderSseClient;
exports.removeRepairOrderSseClient = removeRepairOrderSseClient;
const clients = new Set();
function writeSseJson(res, payload) {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
}
/** 单条新增 / 修改：推送完整 order（须含 id） */
function broadcastRepairOrderDelta(op, id, order) {
    if (op === 'delete') {
        const msg = { type: 'repair-orders-delta', op: 'delete', id };
        const chunk = `data: ${JSON.stringify(msg)}\n\n`;
        for (const res of [...clients]) {
            try {
                res.write(chunk);
            }
            catch {
                clients.delete(res);
            }
        }
        return;
    }
    if (!order || typeof order !== 'object')
        return;
    const msg = { type: 'repair-orders-delta', op, id, order };
    const chunk = `data: ${JSON.stringify(msg)}\n\n`;
    for (const res of [...clients]) {
        try {
            res.write(chunk);
        }
        catch {
            clients.delete(res);
        }
    }
}
/**
 * 无法逐条表达的海量变更（空库整表导入、清空全表）：客户端仍走一次全量 GET。
 * dataEpoch 可选，便于客户端与 lastSeen 对齐（refresh 会写入）。
 */
function broadcastRepairOrdersResync(dataEpoch) {
    const msg = dataEpoch != null && Number.isFinite(dataEpoch)
        ? { type: 'repair-orders-delta', op: 'resync', dataEpoch: Math.floor(dataEpoch) }
        : { type: 'repair-orders-delta', op: 'resync' };
    const chunk = `data: ${JSON.stringify(msg)}\n\n`;
    for (const res of [...clients]) {
        try {
            res.write(chunk);
        }
        catch {
            clients.delete(res);
        }
    }
}
function addRepairOrderSseClient(res) {
    clients.add(res);
}
function removeRepairOrderSseClient(res) {
    clients.delete(res);
}
