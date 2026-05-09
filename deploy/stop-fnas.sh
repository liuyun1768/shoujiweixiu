#!/usr/bin/env bash
# 停止本仓库记录的 PID；并对 3001 / 4173 做兜底清理（防止 vite preview 崩溃后端口仍被占用）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUN="$ROOT/deploy/run"

kill_port_tcp () {
  local port="$1"
  local pids
  set +o pipefail
  pids=$(ss -tlnp 2>/dev/null | grep ":${port} " | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u)
  set -o pipefail
  if [[ -n "${pids:-}" ]]; then
    for p in $pids; do
      kill "$p" 2>/dev/null && echo "已结束占用 :${port} 的进程 PID $p" || true
    done
  fi
}

for name in backend vite-preview; do
  f="$RUN/${name}.pid"
  if [[ -f "$f" ]]; then
    pid="$(cat "$f")"
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null && echo "已停止 $name (PID $pid)" || true
    fi
    rm -f "$f"
  fi
done

kill_port_tcp 4173
kill_port_tcp 3001
