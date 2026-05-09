"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveProjectPath = resolveProjectPath;
exports.getImagesDir = getImagesDir;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
function resolveProjectPath(relOrAbs, fallbackRel) {
    const raw = (relOrAbs ?? '').trim();
    if (!raw)
        return node_path_1.default.resolve(process.cwd(), fallbackRel);
    if (node_path_1.default.isAbsolute(raw))
        return raw;
    return node_path_1.default.resolve(process.cwd(), raw);
}
function getImagesDir() {
    const dir = resolveProjectPath(process.env.IMAGES_ROOT, '../images');
    node_fs_1.default.mkdirSync(node_path_1.default.join(dir, 'kuaidi'), { recursive: true });
    return dir;
}
