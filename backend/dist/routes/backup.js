"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.backupRouter = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const express_1 = require("express");
const sqlite_1 = require("../db/sqlite");
const databaseClear_1 = require("./databaseClear");
exports.backupRouter = (0, express_1.Router)();
/** 与下载备份同属「数据库维护」，挂在 /api 下避免独立注册顺序导致 404 */
exports.backupRouter.post('/database/clear-kv', databaseClear_1.clearKvDatabaseHandler);
/** 下载整库 SQLite 文件，便于保存到本机 D 盘等目录 */
exports.backupRouter.get('/backup/database', (_req, res) => {
    const raw = process.env.SQLITE_PATH?.trim();
    if (!raw) {
        res.status(503).json({ ok: false, message: 'sqlite_not_configured' });
        return;
    }
    const abs = node_path_1.default.isAbsolute(raw) ? raw : node_path_1.default.resolve(process.cwd(), raw);
    if (!node_fs_1.default.existsSync(abs)) {
        res.status(404).json({ ok: false, message: 'db_missing' });
        return;
    }
    const sqlite = (0, sqlite_1.getSqlite)();
    try {
        sqlite?.prepare('PRAGMA wal_checkpoint(FULL)').run();
    }
    catch {
        // ignore
    }
    let buf;
    try {
        buf = node_fs_1.default.readFileSync(abs);
    }
    catch (e) {
        res.status(500).json({ ok: false, message: e instanceof Error ? e.message : 'read_failed' });
        return;
    }
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="repair-backup-${stamp}.sqlite"`);
    res.send(buf);
});
