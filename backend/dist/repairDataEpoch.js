"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REPAIR_DATA_EPOCH_KV_PATH = void 0;
exports.readRepairDataEpoch = readRepairDataEpoch;
exports.bumpRepairDataEpoch = bumpRepairDataEpoch;
/** 业务数据世代：清空库 / 清空订单表时递增；客户端据此丢弃陈旧本地缓存，避免把旧订单推回服务器 */
exports.REPAIR_DATA_EPOCH_KV_PATH = 'repair/data_epoch_v1';
function readRepairDataEpoch(sqlite) {
    const row = sqlite
        .prepare('SELECT value FROM kv_store WHERE path = ?')
        .get(exports.REPAIR_DATA_EPOCH_KV_PATH);
    if (!row?.value?.trim())
        return 1;
    try {
        const j = JSON.parse(row.value);
        const n = Number(j.epoch);
        return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
    }
    catch {
        return 1;
    }
}
/** 将世代 +1 并写入 kv（须在事务外或可独立提交） */
function bumpRepairDataEpoch(sqlite) {
    const next = readRepairDataEpoch(sqlite) + 1;
    const text = JSON.stringify({ epoch: next });
    sqlite
        .prepare(`INSERT INTO kv_store (path, value, updated_at) VALUES (?, ?, strftime('%s','now'))
       ON CONFLICT(path) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`)
        .run(exports.REPAIR_DATA_EPOCH_KV_PATH, text);
    return next;
}
