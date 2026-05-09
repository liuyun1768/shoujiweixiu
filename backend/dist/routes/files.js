"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.filesRouter = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const express_1 = require("express");
const paths_1 = require("../paths");
exports.filesRouter = (0, express_1.Router)();
const SAFE = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;
/** 读取已上传的留底图：/api/files/kuaidi/<filename> */
exports.filesRouter.get('/files/kuaidi/:name', (req, res) => {
    const name = String(req.params.name ?? '');
    if (!SAFE.test(name)) {
        res.status(400).end();
        return;
    }
    const fp = node_path_1.default.join((0, paths_1.getImagesDir)(), 'kuaidi', name);
    if (!fp.startsWith(node_path_1.default.join((0, paths_1.getImagesDir)(), 'kuaidi'))) {
        res.status(400).end();
        return;
    }
    try {
        if (!node_fs_1.default.existsSync(fp)) {
            res.status(404).end();
            return;
        }
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.sendFile(fp);
    }
    catch {
        res.status(500).end();
    }
});
