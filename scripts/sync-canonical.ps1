# The_Sovereign canonical sync check
# v2.4.0 is maintained directly in this workspace.

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$canonical = Join-Path $root "docs\SOVEREIGN_MONAD_ECOSYSTEM_MASTER_OPERATING_FILE_v2.5.2.md"

if (-not (Test-Path $canonical)) {
    throw "Canonical MOF not found: $canonical"
}

Write-Host "Canonical MOF:" -ForegroundColor Cyan
Get-Item $canonical | Select-Object FullName, Length, LastWriteTime | Format-List
Write-Host "No mirror sync required; this workspace is the canonical maintenance target." -ForegroundColor Green
