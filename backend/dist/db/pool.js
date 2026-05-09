"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPool = getPool;
const promise_1 = __importDefault(require("mysql2/promise"));
let pool = null;
function getPool() {
    if (pool)
        return pool;
    const host = process.env.MYSQL_HOST;
    const user = process.env.MYSQL_USER;
    const database = process.env.MYSQL_DATABASE;
    if (!host || !user || !database) {
        return null;
    }
    pool = promise_1.default.createPool({
        host,
        port: Number(process.env.MYSQL_PORT || 3306),
        user,
        password: process.env.MYSQL_PASSWORD ?? '',
        database,
        waitForConnections: true,
        connectionLimit: 10,
        enableKeepAlive: true,
    });
    return pool;
}
