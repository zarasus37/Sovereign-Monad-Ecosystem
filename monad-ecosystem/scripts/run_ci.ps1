param(
    [string]$TestPath = "$PSScriptRoot\..\tests"
)

# Ensure python is available
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Error "Python is not installed. Install Python and ensure it is in PATH."
    exit 1
}

# Resolve repository root (parent of scripts folder) and change directory
$RepoRoot = Resolve-Path "$PSScriptRoot\.."
Set-Location $RepoRoot

# Add repo root to PYTHONPATH so that score_utils can be imported
$env:PYTHONPATH = "$($RepoRoot.Path);$env:PYTHONPATH"

# Run tests using python -m pytest to respect PYTHONPATH
Write-Host "RepoRoot: $($RepoRoot.Path)"
Write-Host "PYTHONPATH: $env:PYTHONPATH"

    Write-Error "Test suite failed. See above for details."
    exit $LASTEXITCODE
} else {
    Write-Host "All tests passed."
    exit 0
}
