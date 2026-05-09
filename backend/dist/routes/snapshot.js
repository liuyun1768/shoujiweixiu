"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.snapshotRouter = void 0;
const express_1 = require("express");
const sqlite_1 = require("../db/sqlite");
exports.snapshotRouter = (0, express_1.Router)();
const SNAPSHOT_PATH = 'repair/browser_localstorage_v1';
/**
 * 把浏览器 localStorage 快照写入当前 SQLite（kv_store），与业务数据同一文件。
 * body: { snapshot: Record<string, string> }
 */
exports.snapshotRouter.post('/snapshot/browser', (req, res) => {
    const sqlite = (0, sqlite_1.getSqlite)();
    if (!sqlite) {
        res.status(503).json({ ok: false, message: 'sqlite_not_configured' });
        return;
    }
    const snap = req.body?.snapshot;
    if (!snap || typeof snap !== 'object' || Array.isArray(snap)) {
        res.status(400).json({ ok: false, message: 'bad_snapshot' });
        return;
    }
    const text = JSON.stringify(snap);
    if (text.length > 10 * 1024 * 1024) {
        res.status(413).json({ ok: false, message: 'snapshot_too_large' });
        return;
    }
    try {
        sqlite
            .prepare(`INSERT INTO kv_store (path, value, updated_at) VALUES (?, ?, strftime('%s','now'))
         ON CONFLICT(path) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`)
            .run(SNAPSHOT_PATH, text);
        res.json({ ok: true, path: SNAPSHOT_PATH });
    }
    catch (e) {
        res.status(500).json({ ok: false, message: e instanceof Error ? e.message : 'write_failed' });
    }
});
