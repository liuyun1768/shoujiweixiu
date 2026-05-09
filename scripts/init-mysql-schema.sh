#!/usr/bin/env bash
# 在已创建的 MySQL 库中执行 sql/schema.sql（需本机已安装 mysql 客户端，且 backend/.env 已配置）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/backend/.env"
SQL_FILE="$ROOT/sql/schema.sql"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "缺少 $ENV_FILE，请从 .env.example 复制并填写 MYSQL_* 后再执行。" >&2
  exit 1
fi
if [[ ! -f "$SQL_FILE" ]]; then
  echo "缺少 $SQL_FILE" >&2
  exit 1
fi
if ! command -v mysql >/dev/null 2>&1; then
  echo "未找到 mysql 命令。请在宝塔「数据库」中手工导入 sql/schema.sql，或安装 MariaDB/MySQL 客户端。" >&2
  exit 1
fi
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
: "${MYSQL_HOST:?}"
: "${MYSQL_USER:?}"
: "${MYSQL_DATABASE:?}"
export MYSQL_PWD="${MYSQL_PASSWORD:-}"
mysql -h"$MYSQL_HOST" -P"${MYSQL_PORT:-3306}" -u"$MYSQL_USER" "$MYSQL_DATABASE" <"$SQL_FILE"
unset MYSQL_PWD
echo "OK: schema applied to $MYSQL_DATABASE"
