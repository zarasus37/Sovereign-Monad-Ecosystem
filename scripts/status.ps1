param(
  [switch]$Quiet
)

$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$checkpoint = Join-Path $root 'docs\PROJECT_STATE.md'

if (-not (Test-Path -LiteralPath $checkpoint)) {
  throw "Missing checkpoint file: $checkpoint"
}

if (-not $Quiet) {
  Write-Host "Opening project checkpoint:"
  Write-Host $checkpoint
}

Start-Process -FilePath $checkpoint
