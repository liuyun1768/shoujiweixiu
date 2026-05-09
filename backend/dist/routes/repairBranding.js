"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.repairBrandingRouter = void 0;
const express_1 = require("express");
const sqlite_1 = require("../db/sqlite");
const repairKvPaths_1 = require("../repairKvPaths");
exports.repairBrandingRouter = (0, express_1.Router)();
const DEFAULTS = { appName: '简单管', logoDataUrl: null };
function parseBrandingJson(raw) {
    if (!raw?.trim())
        return { ...DEFAULTS };
    try {
        const j = JSON.parse(raw);
        const appName = typeof j.appName === 'string' && j.appName.trim() ? j.appName.trim() : DEFAULTS.appName;
        const logo = typeof j.logoDataUrl === 'string' && j.logoDataUrl.startsWith('data:') ? j.logoDataUrl : null;
        return { appName, logoDataUrl: logo };
    }
    catch {
        return { ...DEFAULTS };
    }
}
exports.repairBrandingRouter.get('/repair/branding', (_req, res) => {
    const sqlite = (0, sqlite_1.getSqlite)();
    if (!sqlite) {
        res.status(503).json({ ok: false, message: 'sqlite_not_configured' });
        return;
    }
    try {
        const row = sqlite
            .prepare('SELECT value FROM kv_store WHERE path = ?')
            .get(repairKvPaths_1.REPAIR_ENTERPRISE_BRANDING_KV_PATH);
        const hasCustom = !!row?.value?.trim();
        const branding = parseBrandingJson(row?.value);
        res.json({ ok: true, branding, hasCustom });
    }
    catch (e) {
        res.status(500).json({ ok: false, message: e instanceof Error ? e.message : 'read_failed' });
    }
});
exports.repairBrandingRouter.put('/repair/branding', (req, res) => {
    const sqlite = (0, sqlite_1.getSqlite)();
    if (!sqlite) {
        res.status(503).json({ ok: false, message: 'sqlite_not_configured' });
        return;
    }
    const body = req.body;
    if (!body || typeof body !== 'object') {
        res.status(400).json({ ok: false, message: 'bad_body' });
        return;
    }
    const appName = typeof body.appName === 'string' && body.appName.trim() ? body.appName.trim() : DEFAULTS.appName;
    const rawLogo = body.logoDataUrl;
    const logoDataUrl = typeof rawLogo === 'string' && rawLogo.startsWith('data:') ? rawLogo : null;
    const text = JSON.stringify({ appName, logoDataUrl });
    if (text.length > 8 * 1024 * 1024) {
        res.status(413).json({ ok: false, message: 'branding_too_large' });
        return;
    }
    try {
        sqlite
            .prepare(`INSERT INTO kv_store (path, value, updated_at) VALUES (?, ?, strftime('%s','now'))
         ON CONFLICT(path) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`)
            .run(repairKvPaths_1.REPAIR_ENTERPRISE_BRANDING_KV_PATH, text);
        res.json({ ok: true, branding: { appName, logoDataUrl }, hasCustom: true });
    }
    catch (e) {
        res.status(500).json({ ok: false, message: e instanceof Error ? e.message : 'write_failed' });
    }
});
