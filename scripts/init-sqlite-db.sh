#!/usr/bin/env bash
# 初始化 SQLite 库文件（不依赖 MySQL 客户端）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB="$ROOT/var/lib/shoujiweixiu/repair_system.sqlite"
SQL="$ROOT/sql/schema.sqlite.sql"
mkdir -p "$(dirname "$DB")"
sqlite3 "$DB" <"$SQL"
echo "OK: SQLite -> $DB"
