# Sync kuaidi print sources into frontend/src/repair-kuaidi-vendor (for NAS without sibling repo)
$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Dst = Join-Path $Root "frontend\src\repair-kuaidi-vendor"
$candidates = @(
  (Join-Path $Root "..\kuaidi-dadan-ruanjian-stdmd5\src"),
  "C:\Users\Administrator\kuaidi-dadan-ruanjian-stdmd5\src",
  (Join-Path $Root "..\1000\相册备份\kuaidi-dadan-ruanjian - 参照\src"),
  "/vol1/1000/相册备份/kuaidi-dadan-ruanjian - 参照/src"
)
$src = $null
foreach ($p in $candidates) {
  if (Test-Path -LiteralPath (Join-Path $p "App.tsx")) { $src = $p; break }
}
if (-not $src) {
  Write-Error "Source not found: need kuaidi-dadan-ruanjian src with App.tsx near shoujiweixiu or under /vol1/1000/相册备份."
}
New-Item -ItemType Directory -Force -Path $Dst | Out-Null
Copy-Item (Join-Path $src "App.tsx"), (Join-Path $src "db.ts"), (Join-Path $src "index.css"), (Join-Path $src "vite-env.d.ts") -Destination $Dst -Force
Write-Host "Synced to $Dst" -ForegroundColor Green
