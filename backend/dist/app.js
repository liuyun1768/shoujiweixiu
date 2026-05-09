"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const sfPreviewProxy_1 = require("./sfPreviewProxy");
const backup_1 = require("./routes/backup");
const files_1 = require("./routes/files");
const health_1 = require("./routes/health");
const kv_1 = require("./routes/kv");
const repairOrders_1 = require("./routes/repairOrders");
const repairBranding_1 = require("./routes/repairBranding");
const repairStaff_1 = require("./routes/repairStaff");
const restore_1 = require("./routes/restore");
const snapshot_1 = require("./routes/snapshot");
const upload_1 = require("./routes/upload");
function createApp() {
    const app = (0, express_1.default)();
    app.use((0, cors_1.default)({ origin: true, credentials: true }));
    app.post('/api/restore/database', express_1.default.raw({ limit: '80mb', type: '*/*' }), restore_1.restoreDatabaseHandler);
    /** 须在 express.json 之前：顺丰 POST 需流式转发到 Vite preview */
    (0, sfPreviewProxy_1.mountSfPreviewProxy)(app);
    app.use(express_1.default.json({ limit: '12mb' }));
    app.use('/api', health_1.healthRouter);
    app.use('/api', kv_1.kvRouter);
    app.use('/api', repairOrders_1.repairOrdersRouter);
    app.use('/api', repairStaff_1.repairStaffRouter);
    app.use('/api', repairBranding_1.repairBrandingRouter);
    app.use('/api', files_1.filesRouter);
    app.use('/api', backup_1.backupRouter);
    app.use('/api', upload_1.uploadRouter);
    app.use('/api', snapshot_1.snapshotRouter);
    app.use((_req, res) => {
        res.status(404).json({ ok: false, message: 'not_found' });
    });
    return app;
}
