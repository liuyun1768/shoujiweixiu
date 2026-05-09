/** 清空业务数据时仍保留的 kv_store.path（企业名称与 Logo、数据世代计数） */
export const PRESERVED_KV_PATHS_ON_CLEAR = [
  'repair/enterprise_branding_v1',
  'repair/data_epoch_v1',
] as const

export const REPAIR_ENTERPRISE_BRANDING_KV_PATH = 'repair/enterprise_branding_v1'
