"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrateLegacyRepairOrdersKvIfNeeded = migrateLegacyRepairOrdersKvIfNeeded;
const repairDataEpoch_1 = require("../repairDataEpoch");
const legacyKvPath_1 = require("../repairOrders/legacyKvPath");
function coerceOrder(o) {
    if (!o || typeof o !== 'object')
        return null;
    const r = o;
    const id = Number(r.id);
    if (!Number.isFinite(id) || id <= 0)
        return null;
    return r;
}
function denormFromPayload(p) {
    return {
        order_no: String(p.orderNo ?? '').trim() || '—',
        phone: String(p.phone ?? '').trim(),
        repair_staff: String(p.repairStaff ?? '').trim(),
        report_date: String(p.reportDate ?? '').trim(),
    };
}
/**
 * 若 repair_orders 为空且 kv 中仍有旧版订单 JSON，则导入后删除该 kv 项。
 */
function migrateLegacyRepairOrdersKvIfNeeded(sqlite) {
    const cnt = sqlite.prepare('SELECT COUNT(*) AS c FROM repair_orders').get();
    if (cnt.c > 0)
        return;
    /** 已发生过业务清空（世代>1）时不再从旧 kv 复活订单，并扔掉陈旧 JSON，避免重启后表空又灌回 */
    if ((0, repairDataEpoch_1.readRepairDataEpoch)(sqlite) > 1) {
        try {
            sqlite.prepare('DELETE FROM kv_store WHERE path = ?').run(legacyKvPath_1.REPAIR_ORDERS_LEGACY_KV_PATH);
        }
        catch {
            // ignore
        }
        return;
    }
    const row = sqlite
        .prepare('SELECT value FROM kv_store WHERE path = ?')
        .get(legacyKvPath_1.REPAIR_ORDERS_LEGACY_KV_PATH);
    if (!row?.value?.trim())
        return;
    let arr;
    try {
        arr = JSON.parse(row.value);
    }
    catch {
        return;
    }
    if (!Array.isArray(arr) || arr.length === 0)
        return;
    const now = Math.floor(Date.now() / 1000);
    const ins = sqlite.prepare(`INSERT INTO repair_orders (id, order_no, phone, repair_staff, report_date, updated_at, payload)
     VALUES (?,?,?,?,?,?,?)`);
    sqlite.exec('BEGIN IMMEDIATE');
    try {
        for (const item of arr) {
            const p = coerceOrder(item);
            if (!p)
                continue;
            const d = denormFromPayload(p);
            ins.run(Number(p.id), d.order_no, d.phone, d.repair_staff, d.report_date, now, JSON.stringify({ ...p, id: Number(p.id) }));
        }
        sqlite.prepare('DELETE FROM kv_store WHERE path = ?').run(legacyKvPath_1.REPAIR_ORDERS_LEGACY_KV_PATH);
        sqlite.exec('COMMIT');
    }
    catch {
        try {
            sqlite.exec('ROLLBACK');
        }
        catch {
            // ignore
        }
    }
}
