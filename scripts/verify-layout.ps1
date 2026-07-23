param(
  [switch]$Quiet
)

<#
  .SYNOPSIS
    Repo layout verifier — delegates to the cross-platform Node implementation.

  .DESCRIPTION
    This script is a thin PowerShell wrapper around scripts/verify-layout.mjs.
    The Node script is the source of truth and runs on Windows, macOS, and
    Linux (including WSL). The .ps1 wrapper exists so that PowerShell-first
    workflows and CI runs on `windows-latest` can still call a single entry
    point (e.g. `pwsh scripts/verify-layout.ps1`).

    All three layout checks are performed by the Node script:
      1. Unexpected top-level entries
      2. Missing required project-state docs
      3. Legacy path/name references in active surfaces (skipped with a warning
         if ripgrep is not on PATH)

  .PARAMETER Quiet
    Suppress the "Layout check passed." success line.

  .EXAMPLE
    pwsh scripts/verify-layout.ps1
    node scripts/verify-layout.mjs
#>

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$mjs = Join-Path $scriptDir 'verify-layout.mjs'

if (-not (Test-Path $mjs)) {
  Write-Host "verify-layout.mjs not found next to this script: $mjs" -ForegroundColor Red
  exit 1
}

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Write-Host "node not found in PATH. Install Node.js >= 20 to run the layout check." -ForegroundColor Red
  exit 1
}

$args = @($mjs)
if ($Quiet) { $args += '--quiet' }

& node @args
exit $LASTEXITCODE
