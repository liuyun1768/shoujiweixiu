"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadRouter = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const express_1 = __importStar(require("express"));
const paths_1 = require("../paths");
exports.uploadRouter = (0, express_1.Router)();
exports.uploadRouter.use(express_1.default.json({ limit: '35mb' }));
function safeExt(mime) {
    if (mime.includes('png'))
        return '.png';
    if (mime.includes('webp'))
        return '.webp';
    return '.jpg';
}
/** 快递拍照留底：POST { fileName?, mimeType?, dataBase64 } → { ok, url } */
exports.uploadRouter.post('/upload/waybill-photo', (req, res) => {
    const mimeType = String(req.body?.mimeType ?? 'image/jpeg');
    const b64 = typeof req.body?.dataBase64 === 'string' ? req.body.dataBase64 : '';
    if (!b64) {
        res.status(400).json({ ok: false, message: 'missing_dataBase64' });
        return;
    }
    let buf;
    try {
        buf = Buffer.from(b64, 'base64');
    }
    catch {
        res.status(400).json({ ok: false, message: 'bad_base64' });
        return;
    }
    if (buf.length < 32 || buf.length > 30 * 1024 * 1024) {
        res.status(400).json({ ok: false, message: 'bad_size' });
        return;
    }
    const id = node_crypto_1.default.randomUUID().replace(/-/g, '');
    const ext = safeExt(mimeType);
    const diskName = `${id}${ext}`;
    const dir = node_path_1.default.join((0, paths_1.getImagesDir)(), 'kuaidi');
    node_fs_1.default.mkdirSync(dir, { recursive: true });
    const fp = node_path_1.default.join(dir, diskName);
    try {
        node_fs_1.default.writeFileSync(fp, buf);
        const url = `/api/files/kuaidi/${diskName}`;
        res.json({ ok: true, url });
    }
    catch (e) {
        res.status(500).json({ ok: false, message: e instanceof Error ? e.message : 'write_failed' });
    }
});
