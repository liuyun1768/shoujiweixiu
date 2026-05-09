# 一键生成宝塔部署包：shoujiweixiu/out/baota-deploy/
$ErrorActionPreference = 'Stop'
$Root = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $Root

Write-Host '== build frontend + backend ==' -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$Out = Join-Path $Root 'out\baota-deploy'
$Site = Join-Path $Out 'site'
$Api = Join-Path $Out 'api'

if (Test-Path $Out) { Remove-Item $Out -Recurse -Force }
New-Item -ItemType Directory -Path $Site -Force | Out-Null
New-Item -ItemType Directory -Path $Api -Force | Out-Null

$FeDist = Join-Path $Root 'frontend\dist'
$BeDist = Join-Path $Root 'backend\dist'
if (-not (Test-Path (Join-Path $FeDist 'index.html'))) {
  Write-Error '缺少 frontend/dist/index.html，请先成功执行 npm run build'
}
if (-not (Test-Path (Join-Path $BeDist 'index.js'))) {
  Write-Error '缺少 backend/dist/index.js，请先成功执行 npm run build'
}

Copy-Item (Join-Path $FeDist '*') $Site -Recurse -Force
Copy-Item $BeDist (Join-Path $Api 'dist') -Recurse -Force
Copy-Item (Join-Path $Root 'backend\package.json') $Api -Force
if (Test-Path (Join-Path $Root 'backend\package-lock.json')) {
  Copy-Item (Join-Path $Root 'backend\package-lock.json') $Api -Force
}
Copy-Item (Join-Path $Root 'backend\.env.example') $Api -Force
Copy-Item (Join-Path $Root 'sql\schema.sql') $Out -Force

$Nginx = @'
# 粘贴到宝塔：网站 → 设置 → 配置文件 → server { } 内（放在 location / 之前）
# 若站点根目录为 /www/wwwroot/192.168.1.198_8000 ，保持 root 不变即可

location /api/ {
    proxy_pass http://127.0.0.1:3001/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location / {
    try_files $uri $uri/ /index.html;
}
'@
$Nginx | Set-Content (Join-Path $Out 'nginx-api-snippet.conf') -Encoding UTF8

$Pm2 = @'
// 宝塔 PM2：启动文件填 dist/index.js，实例目录填本 API 目录；或在服务器上：
// cd /www/wwwroot/shoujiweixiu-api && npm install --omit=dev && pm2 start dist/index.js --name shoujiweixiu-api
module.exports = {
  apps: [
    {
      name: 'shoujiweixiu-api',
      cwd: '/www/wwwroot/shoujiweixiu-api',
      script: 'dist/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: { NODE_ENV: 'production' },
    },
  ],
}
'@
$Pm2 | Set-Content (Join-Path $Out 'pm2.ecosystem.cjs') -Encoding UTF8

$Help = @'
【上传】
1) 将 site/ 内全部文件 → 上传到宝塔网站根目录（例如 /www/wwwroot/192.168.1.198_8000/），覆盖旧文件。
2) 在服务器新建目录 /www/wwwroot/shoujiweixiu-api/ ，把 api/ 内全部内容上传进去。

【后端】
SSH 或宝塔终端执行：
  cd /www/wwwroot/shoujiweixiu-api
  npm install --omit=dev
  cp .env.example .env   # 再编辑 .env 填 MySQL
  node dist/index.js     # 测试；再用 PM2 常驻：pm2 start dist/index.js --name shoujiweixiu-api

【数据库】
宝塔 → 数据库 → 选中已有库 repair_system → 导入（phpMyAdmin）与本包同级的 schema.sql
  .env 中 MYSQL_DATABASE=repair_system，MYSQL_USER=repair_user，MYSQL_PASSWORD=仅写在服务器

【Nginx】
把 nginx-api-snippet.conf 里两段 location 合并进该站点 server{}，保存并重载 Nginx。

【验证】
浏览器打开 http://你的IP:端口/api/health 应返回 JSON。
'@
$Help | Set-Content (Join-Path $Out 'DEPLOY-STEPS.txt') -Encoding UTF8

Write-Host ''
Write-Host "Done. Bundle: $Out" -ForegroundColor Green
Write-Host '  site/ -> Baota web root (overwrite)' -ForegroundColor Gray
Write-Host '  api/  -> e.g. /www/wwwroot/shoujiweixiu-api + npm install --omit=dev' -ForegroundColor Gray
Write-Host '  Read DEPLOY-STEPS.txt (Chinese)' -ForegroundColor Gray
