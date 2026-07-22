$ErrorActionPreference = "Stop"
$projectDir = "C:\Users\crisc\OneDrive - Southern Careers Institute\My Drive\The_Sovereign\monad-ecosystem"
$envFile = "$projectDir\.env.production"
Write-Host "=== Docker Compose Up (with-kafka profile) ==="
Write-Host "Project: $projectDir"

& docker compose --project-directory $projectDir --env-file $envFile --profile with-kafka up -d --build
