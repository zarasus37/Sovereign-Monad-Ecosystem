# The_Sovereign Bootstrap Script
# Phase 1 - Root Foundation (2026-06-01)
# Sets up the unified monorepo environment

Write-Host "🜁 The Sovereign — Unified Monorepo Bootstrap" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray

# 1. Python environment (uv recommended)
Write-Host "`n[1/5] Checking Python toolchain (uv)..." -ForegroundColor Yellow
if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
    Write-Host "  → uv not found. Installing via pip..." -ForegroundColor DarkYellow
    pip install uv
}
uv --version

# 2. Node / pnpm
Write-Host "`n[2/5] Checking Node & pnpm..." -ForegroundColor Yellow
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Host "  → pnpm not found. Installing..." -ForegroundColor DarkYellow
    npm install -g pnpm@latest
}
pnpm --version

# 3. Install root dependencies + workspace packages
Write-Host "`n[3/5] Installing root + workspace dependencies..." -ForegroundColor Yellow
pnpm install

# 4. Python virtual environment for gnostic-engine
Write-Host "`n[4/5] Setting up gnostic-engine Python environment..." -ForegroundColor Yellow
Push-Location gnostic-engine
if (Test-Path ".venv") {
    Write-Host "  → Existing .venv detected. Skipping creation." -ForegroundColor DarkGray
} else {
    Write-Host "  → Creating .venv with uv..." -ForegroundColor DarkYellow
    uv venv
}
Write-Host "  → Installing gnostic-engine dependencies..." -ForegroundColor DarkYellow
uv pip install -e . --quiet
Write-Host "  ✓ gnostic-engine ready" -ForegroundColor Green
Pop-Location

# 5. Final instructions
Write-Host "`n[5/5] Bootstrap complete." -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host @"
Next steps:
  • pnpm dev          → Start workspace development
  • pnpm bootstrap    → Re-run this script
  • code .            → Open in VS Code (single root recommended)

The three pillars are now ready:
  1. theo-techno-cosmo/   (philosophy)
  2. gnostic-engine/      (runtime)
  3. monad-ecosystem/     (agents & economics)

See updated README.md for full onboarding.
"@ -ForegroundColor White
