# One-shot local setup + full quality gate for Windows (PowerShell 5.1+ / 7).
# Runs every step even if one fails, and writes logs to .\harness-reports\ so they can be reviewed.
# Usage: double-click run-bootstrap.cmd   (or: powershell -ExecutionPolicy Bypass -File scripts\bootstrap.ps1)
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$reports = Join-Path $root 'harness-reports'
New-Item -ItemType Directory -Force -Path $reports | Out-Null
$summary = Join-Path $reports 'summary.txt'
"bootstrap started $(Get-Date -Format o) on $env:COMPUTERNAME" | Set-Content $summary -Encoding utf8

function Step([string]$name, [string]$cmd) {
  $log = Join-Path $reports (($name -replace '[^A-Za-z0-9]+', '-').Trim('-').ToLower() + '.log')
  Write-Host "`n=== $name ===" -ForegroundColor Cyan
  $sw = [Diagnostics.Stopwatch]::StartNew()
  $out = cmd /c "$cmd 2>&1"
  $code = $LASTEXITCODE
  $out | Out-File -FilePath $log -Encoding utf8
  $out | Out-Host
  $status = if ($code -eq 0) { 'PASS' } else { "FAIL($code)" }
  "{0,-40} {1,-10} {2,6:N0}s  {3}" -f $name, $status, $sw.Elapsed.TotalSeconds, (Split-Path $log -Leaf) | Add-Content $summary -Encoding utf8
  Write-Host "--> $name : $status" -ForegroundColor ($(if ($code -eq 0) { 'Green' } else { 'Red' }))
  return $code
}

# --- prerequisites ---------------------------------------------------------
[void](Step 'node version' 'node -v')
[void](Step 'git version' 'git --version')
[void](Step 'docker version (optional)' 'docker version --format "{{.Server.Version}}"')
if ((Step 'corepack enable' 'corepack enable') -ne 0) { Step 'install pnpm via npm' 'npm install -g pnpm@9.15.0' }
[void](Step 'pnpm version' 'pnpm -v')
if (-not (Test-Path (Join-Path $root '.git'))) { Step 'git init' 'git init -b main' }

# --- install & generate ----------------------------------------------------
if ((Step 'pnpm install' 'pnpm install') -ne 0) {
  'STOPPED: pnpm install failed - remaining steps skipped' | Add-Content $summary -Encoding utf8
  Get-Content $summary
  exit 1
}
[void](Step 'prisma generate' 'pnpm --dir cms-api prisma:generate')
[void](Step 'openapi generate' 'pnpm --dir cms-api openapi:generate')

# --- gates -----------------------------------------------------------------
[void](Step 'harness architecture' 'node harness/check-architecture.mjs')
[void](Step 'harness debt' 'node harness/check-debt.mjs')
[void](Step 'harness traceability' 'node harness/trace-requirements.mjs --check')
[void](Step 'api typecheck' 'pnpm --dir cms-api typecheck')
[void](Step 'web typecheck' 'pnpm --dir cms-web typecheck')
[void](Step 'api lint' 'pnpm --dir cms-api lint')
[void](Step 'web lint' 'pnpm --dir cms-web lint')
[void](Step 'api depcruise' 'pnpm --dir cms-api depcruise')
[void](Step 'web depcruise' 'pnpm --dir cms-web depcruise')
[void](Step 'api tests + coverage' 'pnpm --dir cms-api test:cov')
[void](Step 'web tests + coverage' 'pnpm --dir cms-web test:cov')
[void](Step 'api build' 'pnpm --dir cms-api build')
[void](Step 'web build' 'pnpm --dir cms-web build')
[void](Step 'web bundle budget' 'pnpm --dir cms-web bundle:check')
if ((Get-Command docker -ErrorAction SilentlyContinue) -and ((docker info 2>$null) -ne $null)) {
  [void](Step 'api integration (Docker)' 'pnpm --dir cms-api test:integration')
} else {
  'api integration (Docker)                 SKIPPED    Docker not running' | Add-Content $summary -Encoding utf8
}

"bootstrap finished $(Get-Date -Format o)" | Add-Content $summary -Encoding utf8
Write-Host "`nSummary:" -ForegroundColor Cyan
Get-Content $summary
Write-Host "`nLogs are in $reports - tell Claude 'bootstrap done' so it can read them and fix failures." -ForegroundColor Yellow
