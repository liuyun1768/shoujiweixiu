#!/usr/bin/env bash
# 在服务器上创建目录：项目根 images/（便于查看）、var/lib（非图片上传）、var/cache、var/log
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP=shoujiweixiu
mkdir -p "$ROOT/images" \
         "$ROOT/var/lib/$APP/uploads/files" \
         "$ROOT/var/cache/$APP" \
         "$ROOT/var/log/$APP"
touch "$ROOT/images/.gitkeep" "$ROOT/var/cache/$APP/.gitkeep" "$ROOT/var/log/$APP/.gitkeep" 2>/dev/null || true
chmod -R u+rwX "$ROOT/images" "$ROOT/var" || true
if command -v sqlite3 >/dev/null 2>&1; then
  "$ROOT/scripts/init-sqlite-db.sh"
fi
echo "OK: images -> $ROOT/images/ ; SQLite (若已装 sqlite3)已就绪；其它见 $ROOT/var/"
