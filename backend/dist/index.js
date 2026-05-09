"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const app_1 = require("./app");
const sqlite_1 = require("./db/sqlite");
const port = Number(process.env.PORT || 3001);
const sqlitePath = (0, sqlite_1.getConfiguredSqliteAbsPath)();
if (sqlitePath) {
    console.log('[shoujiweixiu-api] SQLITE_PATH ->', sqlitePath);
    const busy = process.env.SQLITE_BUSY_TIMEOUT_MS?.trim() || '15000(default)';
    console.log('[shoujiweixiu-api] SQLITE_BUSY_TIMEOUT_MS ->', busy);
}
else {
    console.warn('[shoujiweixiu-api] SQLITE_PATH not set; SQLite API routes return 503');
}
(0, app_1.createApp)().listen(port, '0.0.0.0', () => {
    console.log(`[shoujiweixiu-api] http://127.0.0.1:${port}`);
});
