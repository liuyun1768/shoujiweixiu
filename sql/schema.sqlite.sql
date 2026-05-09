-- SQLite：维修订单表 + 键值存储（快递打单 JSON 等，与主库同一文件）
CREATE TABLE IF NOT EXISTS kv_store (
  path TEXT NOT NULL PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_kv_store_updated ON kv_store (updated_at);

-- SQLite · 与 sql/schema.sql 字段对齐（NAS 本机未放行 MySQL 远程主机时使用）
CREATE TABLE IF NOT EXISTS repair_order (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  device_model TEXT NOT NULL DEFAULT '',
  fault_desc TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_repair_order_phone ON repair_order (phone);
CREATE INDEX IF NOT EXISTS idx_repair_order_created ON repair_order (created_at);
