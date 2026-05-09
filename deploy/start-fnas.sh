#!/usr/bin/env bash
# 飞牛 NAS：同时启动 Express(3001) + Vite preview(4173)，供 Nginx 分流 /api 与 /api/sf
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUN="$ROOT/deploy/run"
mkdir -p "$RUN"

# 若上次 vite 因「端口占用」启动失败，PID 文件可能指向已死进程，但旧 node 仍占 4173
free_port_or_warn () {
  local port="$1"
  local pids
  set +o pipefail
  pids=$(ss -tlnp 2>/dev/null | grep ":${port} " | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u)
  set -o pipefail
  if [[ -n "${pids:-}" ]]; then
    echo "[端口 ${port}] 已被占用 ($pids)，正在释放以便本次启动 …"
    for p in $pids; do kill "$p" 2>/dev/null || true; done
    sleep 1
  fi
}

need_build_frontend=false
if [[ ! -d "$ROOT/frontend/dist" ]] || [[ -z "$(ls -A "$ROOT/frontend/dist" 2>/dev/null || true)" ]]; then
  need_build_frontend=true
fi
if [[ "$need_build_frontend" == true ]]; then
  echo "frontend/dist 不存在或为空，正在执行 npm run build …"
  (cd "$ROOT/frontend" && npm run build)
fi

if [[ ! -f "$ROOT/backend/dist/index.js" ]]; then
  echo "正在编译 backend …"
  (cd "$ROOT/backend" && npm run build)
fi

start_one () {
  local name="$1"
  local pidfile="$RUN/${name}.pid"
  local logfile="$RUN/${name}.log"
  shift
  if [[ -f "$pidfile" ]] && kill -0 "$(cat "$pidfile")" 2>/dev/null; then
    echo "[${name}] 已在运行 PID $(cat "$pidfile")"
    return 0
  fi
  nohup "$@" >>"$logfile" 2>&1 &
  echo $! >"$pidfile"
  echo "[${name}] 已启动 PID $(cat "$pidfile")，日志 $logfile"
}

export PORT="${PORT:-3001}"
free_port_or_warn 3001
start_one "backend" bash -lc "cd '$ROOT/backend' && exec node dist/index.js"
free_port_or_warn 4173
start_one "vite-preview" bash -lc "cd '$ROOT/frontend' && exec npx vite preview --host 0.0.0.0 --port 4173"

sleep 1
echo "--- 本机自检（应返回 200 或 JSON）---"
curl -sS -o /dev/null -w "backend :3001  HTTP %{http_code}\n" http://127.0.0.1:3001/api/health 2>/dev/null || echo "backend :3001  无法连接（若未挂 /api/health 可忽略）"
curl -sS -o /dev/null -w "preview :4173 /api/sf/health HTTP %{http_code}\n" http://127.0.0.1:4173/api/sf/health || true
curl -sS -o /dev/null -w "backend 转发顺丰 :3001/api/sf/health HTTP %{http_code}\n" http://127.0.0.1:3001/api/sf/health || true
echo "完成。Nginx 建议加载 deploy/nginx-shoujiweixiu-fnas.conf；未配时也可依赖后端对 /api/sf 的转发。"
