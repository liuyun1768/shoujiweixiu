"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeSqlite = closeSqlite;
exports.applySqlitePragmas = applySqlitePragmas;
exports.ensureSqliteSchema = ensureSqliteSchema;
exports.getConfiguredSqliteAbsPath = getConfiguredSqliteAbsPath;
exports.getSqlite = getSqlite;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const node_sqlite_1 = require("node:sqlite");
const repairOrdersMigrate_1 = require("./repairOrdersMigrate");
let db = null;
let loggedSqlitePath = false;
function closeSqlite() {
    if (!db)
        return;
    try {
        db.close();
    }
    catch {
        // ignore
    }
    db = null;
}
/** 连接参数：缓解锁竞争；可通过环境变量调节 */
function applySqlitePragmas(sqlite) {
    const raw = process.env.SQLITE_BUSY_TIMEOUT_MS?.trim();
    const parsed = raw ? Number(raw) : NaN;
    const ms = Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 15_000;
    try {
        sqlite.prepare(`PRAGMA busy_timeout = ${ms}`).run();
    }
    catch {
        // ignore
    }
    try {
        sqlite.prepare('PRAGMA foreign_keys = ON').run();
    }
    catch {
        // ignore
    }
    try {
        sqlite.prepare('PRAGMA synchronous = NORMAL').run();
    }
    catch {
        // ignore
    }
    try {
        sqlite.prepare('PRAGMA journal_mode = WAL').run();
    }
    catch {
        // 网络盘 / 部分环境不支持 WAL，忽略
    }
}
/** 幂等：确保 kv_store、repair_orders 存在（任意路径打开库后都可调用） */
function ensureSqliteSchema(sqlite) {
    sqlite.exec(`
    CREATE TABLE IF NOT EXISTS kv_store (
      path TEXT NOT NULL PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );
    CREATE INDEX IF NOT EXISTS idx_kv_store_updated ON kv_store (updated_at);

    CREATE TABLE IF NOT EXISTS repair_orders (
      id INTEGER PRIMARY KEY,
      order_no TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      repair_staff TEXT NOT NULL DEFAULT '',
      report_date TEXT NOT NULL DEFAULT '',
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      payload TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_repair_orders_order_no ON repair_orders (order_no);
    CREATE INDEX IF NOT EXISTS idx_repair_orders_phone ON repair_orders (phone);
    CREATE INDEX IF NOT EXISTS idx_repair_orders_repair_staff ON repair_orders (repair_staff);
    CREATE INDEX IF NOT EXISTS idx_repair_orders_report_date ON repair_orders (report_date);
    CREATE INDEX IF NOT EXISTS idx_repair_orders_updated ON repair_orders (updated_at);
  `);
}
function resolveSqliteAbsPath() {
    const raw = process.env.SQLITE_PATH?.trim();
    if (!raw)
        return null;
    return node_path_1.default.isAbsolute(raw) ? raw : node_path_1.default.resolve(process.cwd(), raw);
}
/** 日志用：当前配置的绝对路径（不打开文件） */
function getConfiguredSqliteAbsPath() {
    return resolveSqliteAbsPath();
}
/** 配置了 SQLITE_PATH 时使用本机 SQLite（无需 MySQL 账号与远程主机放行） */
function getSqlite() {
    if (db)
        return db;
    const abs = resolveSqliteAbsPath();
    if (!abs)
        return null;
    try {
        node_fs_1.default.mkdirSync(node_path_1.default.dirname(abs), { recursive: true });
    }
    catch (e) {
        console.error('[sqlite] mkdir failed:', node_path_1.default.dirname(abs), e);
        return null;
    }
    try {
        db = new node_sqlite_1.DatabaseSync(abs);
    }
    catch (e) {
        console.error('[sqlite] open failed:', abs, e);
        db = null;
        return null;
    }
    if (!loggedSqlitePath) {
        loggedSqlitePath = true;
        console.log('[sqlite] database file:', abs);
    }
    try {
        applySqlitePragmas(db);
        ensureSqliteSchema(db);
        (0, repairOrdersMigrate_1.migrateLegacyRepairOrdersKvIfNeeded)(db);
    }
    catch (e) {
        console.error('[sqlite] init schema/migrate failed:', abs, e);
        try {
            db.close();
        }
        catch {
            // ignore
        }
        db = null;
        return null;
    }
    return db;
}
