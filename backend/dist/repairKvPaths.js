"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REPAIR_ENTERPRISE_BRANDING_KV_PATH = exports.PRESERVED_KV_PATHS_ON_CLEAR = void 0;
/** 清空业务数据时仍保留的 kv_store.path（企业名称与 Logo、数据世代计数） */
exports.PRESERVED_KV_PATHS_ON_CLEAR = [
    'repair/enterprise_branding_v1',
    'repair/data_epoch_v1',
];
exports.REPAIR_ENTERPRISE_BRANDING_KV_PATH = 'repair/enterprise_branding_v1';
