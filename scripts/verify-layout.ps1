param(
  [switch]$Quiet
)

$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$allowedTopLevel = @(
  '.git',
  '.github',
  '.editorconfig',
  '.gitattributes',
  '.gitignore',
  '.npmrc',
  '.pytest_cache',
  '.smartroute',
  '.stale-node_modules-20260612153231',
  '.stale-node_modules-20260612153258',
  '.stale-node_modules-20260612153345',
  '.stale-node_modules-20260612153417',
  '.stale-node_modules-20260612153442',
  'desktop.ini',
  'README.md',
  'CONTRIBUTING.md',
  'archive',
  'docs',
  'gnostic-engine',
  'infrastructure',
  'monad-ecosystem',
  'node_modules',
  'notes',
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'scripts',
  'theo-techno-cosmo'
)

$requiredDocs = @(
  'docs/PROJECT_STATE.md',
  'docs/PROJECT_STATE.json',
  'docs/OPEN_FIRST.md',
  'docs/REPO_STRUCTURE_MAP.md',
  'docs/SOVEREIGN_MONAD_ECOSYSTEM_MASTER_OPERATING_FILE_v2.4.0.md'
)

$missingRequiredDocs = $requiredDocs | Where-Object { -not (Test-Path (Join-Path $root $_)) }

$unexpectedTopLevel = Get-ChildItem -LiteralPath $root -Force |
  Where-Object { $_.Name -notin $allowedTopLevel } |
  Select-Object -ExpandProperty Name

$activeScanRoots = @(
  'README.md',
  'docs',
  'gnostic-engine',
  'monad-ecosystem',
  'theo-techno-cosmo',
  'scripts',
  'package.json',
  'pnpm-workspace.yaml',
  '.gitignore',
  '.github'
)

$legacyPattern = 'Succor_Gnostic_Engine|Theo_Techno_Cosmo_Logically|Sovereign_Monad_Ecosystem|G:/My Drive/Succor_Gnostic_Engine|G:\\My Drive\\Succor_Gnostic_Engine|G:/My Drive/Theo_Techno_Cosmo_Logically|G:\\My Drive\\Theo_Techno_Cosmo_Logically|G:/My Drive/Sovereign_Monad_Ecosystem|G:\\My Drive\\Sovereign_Monad_Ecosystem'

 $patternHits = rg -n --hidden --glob '!archive/**' --glob '!**/node_modules/**' --glob '!**/.git/**' --glob '!**/.pytest_cache/**' --glob '!**/__pycache__/**' --glob '!**/.venv/**' --glob '!**/.venv2/**' --glob '!**/.venv.broken/**' --glob '!**/.stale-node_modules-*/**' --glob '!**/legacy/**' --glob '!**/out/**' --glob '!**/dist/**' --glob '!**/build/**' --glob '!**/coverage/**' --glob '!**/generated/**' --glob '!**/*.pdf' --glob '!**/*.png' --glob '!**/*.jpg' --glob '!**/*.jpeg' --glob '!**/*.gif' --glob '!**/*.mp4' --glob '!**/*.mov' --glob '!**/*.pptx' --glob '!**/*.xlsx' --glob '!**/*.csv' --glob '!**/*.jsonl' --glob '!**/*.db' --glob '!**/*.sqlite' --glob '!**/*.parquet' --glob '!**/*.zip' --glob '!**/*.7z' --glob '!**/*.tar.gz' --glob '!**/*.log' --glob '!**/*.bak' --glob '!**/*.tmp' --glob '!**/desktop.ini' --glob '!**/*.ico' --glob '!**/*.webp' --glob '!**/*.docx' --glob '!**/*.rtf' --glob '!**/*.mp3' --glob '!**/*.wav' --glob '!**/*.m4a' --glob '!**/*.avi' --glob '!**/*.mkv' --glob '!**/*.flac' --glob '!**/*.json.bak' --glob '!**/*.map' --glob '!**/*.lock' --glob '!**/*.min.*' --glob '!**/*.env' --glob '!**/*.pem' --glob '!**/*.key' --glob '!**/*.wasm' --glob '!**/*.did' --glob '!**/*.dll' --glob '!**/*.exe' --glob '!**/*.bin' --glob '!**/*.DS_Store' --glob '!**/*.swp' --glob '!**/*.swo' --glob '!**/*~' --glob '!scripts/verify-layout.ps1' -e $legacyPattern $activeScanRoots 2>$null

$errors = @()

if ($unexpectedTopLevel) {
  $errors += "Unexpected top-level entries:`n  - " + ($unexpectedTopLevel -join "`n  - ")
}

if ($missingRequiredDocs) {
  $errors += "Missing required project state docs:`n  - " + ($missingRequiredDocs -join "`n  - ")
}

if ($LASTEXITCODE -eq 0 -and $patternHits) {
  $filteredHits = $patternHits | Where-Object { $_ -notmatch 'scripts[\\/]+verify-layout\.ps1' }
  if ($filteredHits) {
    $errors += "Legacy path/name references found in active surfaces:`n  - " + (($filteredHits | Select-Object -Unique) -join "`n  - ")
  }
}

if ($errors.Count -gt 0) {
  $errors | ForEach-Object { Write-Host $_ -ForegroundColor Red }
  exit 1
}

if (-not $Quiet) {
  Write-Host "Layout check passed."
}
