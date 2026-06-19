$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition

# Define target directory for data rail assets
$DataRailDir = Join-Path $ScriptRoot "data_rail"

# Create the data_rail directory if it does not exist
if (-not (Test-Path -Path $DataRailDir -PathType Container)) {
    Write-Host "Creating data_rail directory at $DataRailDir"
    New-Item -Path $DataRailDir -ItemType Directory -Force | Out-Null
} else {
    Write-Host "data_rail directory already exists at $DataRailDir"
}

# Define patterns for data-related files
$patterns = @('*.csv', '*.json', '*.db', '*.sqlite', '*.dat', '*.tsv', '*.xlsx')

# Find and move matching files from the repository root (excluding the data_rail folder itself)
Get-ChildItem -Path $ScriptRoot -Recurse -File -Include $patterns -Exclude "data_rail\*" | ForEach-Object {
    $destPath = Join-Path $DataRailDir $_.Name
    Write-Host "Moving $($_.FullName) to $destPath"
    Move-Item -Path $_.FullName -Destination $destPath -Force -ErrorAction SilentlyContinue
}

Write-Host "Data rail setup complete."
