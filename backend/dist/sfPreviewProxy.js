"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mountSfPreviewProxy = mountSfPreviewProxy;
const node_http_1 = __importDefault(require("node:http"));
/**
 * 将 /api/sf/* 原样转发到本机 Vite preview（顺丰逻辑仍在 sfDevPlugin，未迁入 Express）。
 * 解决 Nginx 误把整段 /api 反代到 3001 时，浏览器访问 /api/sf/health 得到 not_found、无法下单的问题。
 */
function mountSfPreviewProxy(app) {
    const previewPort = Number(process.env.SF_VITE_PREVIEW_PORT || 4173);
    app.use('/api/sf', (req, res) => {
        const suffix = req.url === '/' || req.url === '' ? '' : req.url;
        const path = `/api/sf${suffix}`;
        const headers = { ...req.headers };
        headers.host = `127.0.0.1:${previewPort}`;
        const upstream = node_http_1.default.request({
            hostname: '127.0.0.1',
            port: previewPort,
            path,
            method: req.method,
            headers,
        }, (pRes) => {
            res.writeHead(pRes.statusCode || 502, pRes.headers);
            pRes.pipe(res);
        });
        upstream.on('error', (err) => {
            if (res.headersSent)
                return;
            res.status(502).json({
                ok: false,
                message: 'sf_preview_unreachable',
                hint: `无法连接 127.0.0.1:${previewPort}，请先启动顺丰载体：cd frontend && npx vite preview --host 0.0.0.0 --port ${previewPort}`,
                error: String(err?.message || err),
            });
        });
        req.pipe(upstream);
    });
}
