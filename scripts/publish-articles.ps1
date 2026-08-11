# 記事ストックから指定本数を公開する（既定3本）
#
# 使い方（PowerShell）:
#   cd $env:USERPROFILE\dev\anime-notify-web
#   .\scripts\publish-articles.ps1              # 3本公開してpush
#   .\scripts\publish-articles.ps1 -Count 1     # 1本だけ
#   .\scripts\publish-articles.ps1 -List        # ストック一覧を見るだけ
#   .\scripts\publish-articles.ps1 -NoPush      # commitまで（pushしない）
#
# 仕組み: content/osusume-stock/*.json を content/osusume/ へ移動し、
#         公開日(updatedAt)を実行日に書き換えてから commit / push する。

param(
  [int]$Count = 3,
  [switch]$List,
  [switch]$NoPush,
  [switch]$NoBuild
)

$ErrorActionPreference = "Stop"
$root  = Split-Path -Parent $PSScriptRoot
$stock = Join-Path $root "content\osusume-stock"
$live  = Join-Path $root "content\osusume"

if (-not (Test-Path $stock)) {
  Write-Host "ストックフォルダがありません: $stock" -ForegroundColor Yellow
  exit 1
}

# 公開順は数字プレフィックス（01_, 02_ ...）の昇順
$files = Get-ChildItem -Path $stock -Filter *.json | Sort-Object Name

if ($files.Count -eq 0) {
  Write-Host "ストックが空です。公開できる記事はありません。" -ForegroundColor Yellow
  exit 0
}

if ($List) {
  Write-Host "`n=== 公開待ちのストック ($($files.Count)本) ===" -ForegroundColor Cyan
  $i = 1
  foreach ($f in $files) {
    $t = (Get-Content $f.FullName -Raw -Encoding UTF8 | ConvertFrom-Json).title
    Write-Host ("{0,2}. {1}" -f $i, $t)
    Write-Host ("    {0}" -f $f.Name) -ForegroundColor DarkGray
    $i++
  }
  Write-Host ""
  exit 0
}

$take = $files | Select-Object -First $Count
Write-Host "`n=== 公開する記事 ($($take.Count)本 / 残り $($files.Count - $take.Count)本) ===" -ForegroundColor Cyan

$today = Get-Date -Format "yyyy-MM-dd"
$titles = @()

foreach ($f in $take) {
  # 公開日を今日に更新
  $json = Get-Content $f.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
  $json.updatedAt = $today
  $titles += $json.title
  Write-Host "  + $($json.title)"

  # 数字プレフィックスを外してslugを整える
  $name = $f.Name -replace '^\d+_', ''
  $dest = Join-Path $live $name

  if (Test-Path $dest) {
    Write-Host "    ! 同名の記事が既にあります。スキップします: $name" -ForegroundColor Yellow
    continue
  }

  # UTF-8(BOMなし)で書き出し
  $out = $json | ConvertTo-Json -Depth 20
  [System.IO.File]::WriteAllText($dest, $out, (New-Object System.Text.UTF8Encoding($false)))
  Remove-Item $f.FullName
}

Write-Host ""

if (-not $NoBuild) {
  Write-Host "ビルドを確認しています..." -ForegroundColor Cyan
  npm run build
  if ($LASTEXITCODE -ne 0) {
    Write-Host "ビルドに失敗しました。公開を中止します（ファイルは移動済みなので、内容を直して再実行してください）" -ForegroundColor Red
    exit 1
  }
}

$msg = "記事を追加: " + ($titles -join " / ")
if ($msg.Length -gt 180) { $msg = $msg.Substring(0, 180) + "..." }

git add -A
git commit -m $msg

if (-not $NoPush) {
  git push
  Write-Host "`n公開しました。Vercelのデプロイ完了後に反映されます。" -ForegroundColor Green
  Write-Host "確認: https://www.animiru.com/osusume" -ForegroundColor Green
} else {
  Write-Host "`ncommitまで完了しました（pushしていません）。" -ForegroundColor Green
}

$left = (Get-ChildItem -Path $stock -Filter *.json).Count
Write-Host "残りストック: $left 本`n"
