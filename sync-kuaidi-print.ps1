# 将本机「快递打单系统」同步到本仓库 `kuaidi-print`（排除 node_modules / 构建产物）
$ErrorActionPreference = "Stop"
$src = "C:\Users\Administrator\kuaidi-dadan-ruanjian"
$dst = Join-Path $PSScriptRoot "kuaidi-print"
if (-not (Test-Path -LiteralPath $src)) {
  Write-Error "源目录不存在: $src"
}
New-Item -ItemType Directory -Force -Path $dst | Out-Null
robocopy $src $dst /E /R:1 /W:1 /XD node_modules dist release build-installer .git
if ($LASTEXITCODE -ge 8) { exit $LASTEXITCODE }
Write-Host "已同步到: $dst"
Write-Host "进入目录后执行: npm install && npm run dev:sf"
