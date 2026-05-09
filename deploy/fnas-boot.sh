#!/usr/bin/env bash
# 飞牛 NAS 开机自启用：在 crontab 加一行
#   @reboot sleep 15 && /vol1/shoujiweixiu/deploy/fnas-boot.sh >>/vol1/shoujiweixiu/deploy/run/boot.log 2>&1
set -euo pipefail
exec "$(cd "$(dirname "$0")" && pwd)/start-fnas.sh"
