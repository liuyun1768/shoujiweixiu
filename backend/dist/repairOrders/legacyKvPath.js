"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REPAIR_ORDERS_LEGACY_KV_PATH = void 0;
/** 旧版整表 JSON 在 kv_store 中的 path；启动时若表为空则迁移至 repair_orders */
exports.REPAIR_ORDERS_LEGACY_KV_PATH = 'repair/orders_list_v1';
