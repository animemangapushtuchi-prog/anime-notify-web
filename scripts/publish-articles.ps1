# Publish staged articles from content/osusume-stock to content/osusume
#
# Usage (PowerShell):
#   cd $env:USERPROFILE\dev\anime-notify-web
#   .\scripts\publish-articles.ps1              # publish 3 articles and push
#   .\scripts\publish-articles.ps1 -Count 1     # publish only 1
#   .\scripts\publish-articles.ps1 -List        # list the stock, publish nothing
#   .\scripts\publish-articles.ps1 -NoPush      # commit but do not push
#   .\scripts\publish-articles.ps1 -NoBuild     # skip npm run build
#
# What it does:
#   moves content/osusume-stock/NN_name.json -> content/osusume/name.json,
#   rewrites updatedAt to today, runs the build, then commits and pushes.
#
# NOTE: keep this file ASCII-only. Windows PowerShell 5.1 reads .ps1 as ANSI
#       unless the file has a UTF-8 BOM, so non-ASCII source breaks parsing.
#       Article titles are read from JSON at runtime and print fine.

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
  Write-Host "Stock folder not found: $stock" -ForegroundColor Yellow
  exit 1
}

$files = @(Get-ChildItem -Path $stock -Filter *.json | Sort-Object Name)

if ($files.Count -eq 0) {
  Write-Host "Stock is empty. Nothing to publish." -ForegroundColor Yellow
  exit 0
}

if ($List) {
  Write-Host ""
  Write-Host "=== Articles waiting in stock: $($files.Count) ===" -ForegroundColor Cyan
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

$take = @($files | Select-Object -First $Count)
$rest = $files.Count - $take.Count

Write-Host ""
Write-Host "=== Publishing $($take.Count) article(s), $rest left in stock ===" -ForegroundColor Cyan

$today  = Get-Date -Format "yyyy-MM-dd"
$titles = @()

foreach ($f in $take) {
  $json = Get-Content $f.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
  $json.updatedAt = $today
  $titles += $json.title
  Write-Host "  + $($json.title)"

  # strip the numeric prefix so the slug stays clean
  $name = $f.Name -replace '^\d+_', ''
  $dest = Join-Path $live $name

  if (Test-Path $dest) {
    Write-Host "    ! Already exists, skipped: $name" -ForegroundColor Yellow
    continue
  }

  # write as UTF-8 without BOM (Next.js reads these JSON files)
  $out = $json | ConvertTo-Json -Depth 30
  [System.IO.File]::WriteAllText($dest, $out, (New-Object System.Text.UTF8Encoding($false)))
  Remove-Item $f.FullName
}

Write-Host ""

if (-not $NoBuild) {
  Write-Host "Running build..." -ForegroundColor Cyan
  npm run build
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed. Stopping before commit." -ForegroundColor Red
    Write-Host "The files were already moved, so fix the content and run again." -ForegroundColor Red
    exit 1
  }
}

$msg = "Add articles: " + ($titles -join " / ")
if ($msg.Length -gt 180) { $msg = $msg.Substring(0, 180) + "..." }

git add -A
git commit -m $msg

if (-not $NoPush) {
  git push
  Write-Host ""
  Write-Host "Published. Vercel will deploy shortly." -ForegroundColor Green
  Write-Host "Check: https://www.animiru.com/osusume" -ForegroundColor Green
} else {
  Write-Host ""
  Write-Host "Committed (not pushed)." -ForegroundColor Green
}

$left = @(Get-ChildItem -Path $stock -Filter *.json).Count
Write-Host "Stock remaining: $left"
Write-Host ""
