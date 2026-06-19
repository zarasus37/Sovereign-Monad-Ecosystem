param(
    [string]$Destination = "C:\Users\crisc\Dev\agents\the-sovereign-local"
)

$ErrorActionPreference = "Stop"

$source = Split-Path -Parent $PSScriptRoot
New-Item -ItemType Directory -Force -Path $Destination | Out-Null

$files = @(
    ".gitignore",
    ".npmrc",
    "README.md",
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml"
)

foreach ($file in $files) {
    Copy-Item -LiteralPath (Join-Path $source $file) -Destination (Join-Path $Destination $file) -Force
}

$dirs = @("docs", "scripts", "gnostic-engine", "monad-ecosystem")
$exclude = @("node_modules", ".venv", "__pycache__", ".pytest_cache", ".stale-node_modules-*", ".git")

foreach ($dir in $dirs) {
    robocopy (Join-Path $source $dir) (Join-Path $Destination $dir) /MIR /XD $exclude /NFL /NDL /NJH /NJS /NP | Out-Null
}

Push-Location $Destination
try {
    pnpm install
} finally {
    Pop-Location
}
