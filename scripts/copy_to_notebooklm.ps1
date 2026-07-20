$dest = 'g:\My Drive\The_Sovereign\notebooklm_manifest'
$files = @(
'g:\My Drive\The_Sovereign\docs\LOGOC_ASSESSMENT_HANDOFF.md',
'g:\My Drive\The_Sovereign\docs\LOGOC_DUAL_WHEEL_GNOSIS_ENGINE_SPEC_v5_1.md',
'g:\My Drive\The_Sovereign\docs\LOGOC_v5_TESTING_DIAGNOSTICS_ANALYSIS.md',
'g:\My Drive\The_Sovereign\docs\HEPAR_INTERNAL_ARCHITECTURE.md',
'g:\My Drive\The_Sovereign\docs\SOVEREIGN_MONAD_ECOSYSTEM_MASTER_OPERATING_FILE_v2.5.2.md',
'g:\My Drive\The_Sovereign\docs\WHAT_MAKES_GNOSIS_REAL.md',
'g:\My Drive\The_Sovereign\docs\PHASE2_MIGRATION_PLAN.md',
'g:\My Drive\The_Sovereign\gnostic-engine\notes\README.md',
'g:\My Drive\The_Sovereign\gnostic-engine\notes\Final System Manifest.txt',
'g:\My Drive\The_Sovereign\gnostic-engine\notes\Deployment-Ready Package Structure.txt',
'g:\My Drive\The_Sovereign\gnostic-engine\notes\SGE REST API Integration.txt',
'g:\My Drive\The_Sovereign\gnostic-engine\notes\User Manual Interpreting Resonance.txt',
'g:\My Drive\The_Sovereign\gnostic-engine\notes\The Pulfrich Implementation.txt',
'g:\My Drive\The_Sovereign\gnostic-engine\notes\The Inter-Node Handshake Logic.txt',
'g:\My Drive\The_Sovereign\gnostic-engine\notes\API Endpoints PBFP Pneumatic Intake.txt',
'g:\My Drive\The_Sovereign\gnostic-engine\notes\This is the binary foundation of yo.txt',
'g:\My Drive\The_Sovereign\gnostic-engine\notes\Updated Scaffold Logic.txt',
'g:\My Drive\The_Sovereign\gnostic-engine\notes\🧬 Python Math for the Polarization.txt',
'g:\My Drive\The_Sovereign\gnostic-engine\notes\1. Docker Compose API Orchestration.txt',
'g:\My Drive\The_Sovereign\gnostic-engine\notes\1. Documentation Header Volumetric.txt',
'g:\My Drive\The_Sovereign\gnostic-engine\notes\1. Lane B Bedrock Rules (The Verifi.txt',
'g:\My Drive\The_Sovereign\gnostic-engine\notes\1. The V4 Dimensional Scan Detectin.txt',
'g:\My Drive\The_Sovereign\gnostic-engine\notes\2. Lane C Magnitude Thresholds (The.txt',
'g:\My Drive\The_Sovereign\gnostic-engine\notes\3. Unit Test Supply Chain Attack (V.txt',
'g:\My Drive\The_Sovereign\gnostic-engine\notes\happening 3. the finaal results of.txt',
'g:\My Drive\The_Sovereign\monad-ecosystem\control-center\DESIGN.md',
'g:\My Drive\The_Sovereign\monad-ecosystem\control-center\control-center-plan.md',
'g:\My Drive\The_Sovereign\monad-ecosystem\control-center\control-center-walkthrough.md',
'g:\My Drive\The_Sovereign\monad-ecosystem\control-center\AGENTS.md',
'g:\My Drive\The_Sovereign\monad-ecosystem\control-center\Sovereign Monad Control Center',
'g:\My Drive\The_Sovereign\monad-ecosystem\packages\hepar-core\README.md',
'g:\My Drive\The_Sovereign\monad-ecosystem\packages\gnosis-core\README.md',
'g:\My Drive\The_Sovereign\monad-ecosystem\packages\gnosis-evaluator-core\README.md',
'g:\My Drive\The_Sovereign\monad-ecosystem\packages\lightverify-core\README.md',
'g:\My Drive\The_Sovereign\monad-ecosystem\packages\data-rail-core\README.md',
'g:\My Drive\The_Sovereign\monad-ecosystem\packages\data-rail-router\README.md',
'g:\My Drive\The_Sovereign\monad-ecosystem\packages\data-rail-governance\README.md',
'g:\My Drive\The_Sovereign\monad-ecosystem\packages\emergent-protocol-core\README.md',
'g:\My Drive\The_Sovereign\monad-ecosystem\packages\emergence-accumulator-core\README.md',
'g:\My Drive\The_Sovereign\monad-ecosystem\packages\emergence-baseline-core\README.md',
'g:\My Drive\The_Sovereign\monad-ecosystem\packages\emergence-claim-core\README.md',
'g:\My Drive\The_Sovereign\monad-ecosystem\packages\emergence-history-core\README.md',
'g:\My Drive\The_Sovereign\monad-ecosystem\packages\emergence-observer-core\README.md',
'g:\My Drive\The_Sovereign\monad-ecosystem\packages\execution-truth-core\README.md',
'g:\My Drive\The_Sovereign\monad-ecosystem\packages\population-expansion-core\README.md',
'g:\My Drive\The_Sovereign\monad-ecosystem\packages\population-growth-core\README.md',
'g:\My Drive\The_Sovereign\monad-ecosystem\packages\risk-engine\README.md',
'g:\My Drive\The_Sovereign\monad-ecosystem\packages\reward-ledger-core\README.md',
'g:\My Drive\The_Sovereign\README.md',
'g:\My Drive\The_Sovereign\gnostic-engine\README.md',
'g:\My Drive\The_Sovereign\theo-techno-cosmo\notes\The Model Designation.txt',
'g:\My Drive\The_Sovereign\theo-techno-cosmo\notes\Yes — combining Llull’s combinatori.txt',
'g:\My Drive\The_Sovereign\theo-techno-cosmo\notes\Below is a thorough, in-depth speci.txt'
)

if (-not (Test-Path -LiteralPath $dest)) { New-Item -ItemType Directory -Path $dest -Force | Out-Null }
$copied = 0
$skipped = 0
$missing = 0
foreach ($f in $files) {
    try {
        if (Test-Path -LiteralPath $f -PathType Leaf) {
            $base = [System.IO.Path]::GetFileName($f)
            $destPath = Join-Path -Path $dest -ChildPath $base
            $i = 1
            while (Test-Path -LiteralPath $destPath) {
                $nameOnly = [System.IO.Path]::GetFileNameWithoutExtension($base)
                $ext = [System.IO.Path]::GetExtension($base)
                $destPath = Join-Path -Path $dest -ChildPath ($nameOnly + "_" + $i + $ext)
                $i++
            }
            Copy-Item -LiteralPath $f -Destination $destPath -Force
            Write-Output "Copied: $f -> $destPath"
            $copied++
        } elseif (Test-Path -LiteralPath $f -PathType Container) {
            $readme = Join-Path -Path $f -ChildPath 'README.md'
            if (Test-Path -LiteralPath $readme) {
                $base=[System.IO.Path]::GetFileName($readme)
                $destPath = Join-Path -Path $dest -ChildPath $base
                $i=1
                while (Test-Path -LiteralPath $destPath) {
                    $nameOnly = [System.IO.Path]::GetFileNameWithoutExtension($base)
                    $ext = [System.IO.Path]::GetExtension($base)
                    $destPath = Join-Path -Path $dest -ChildPath ($nameOnly + "_" + $i + $ext)
                    $i++
                }
                Copy-Item -LiteralPath $readme -Destination $destPath -Force
                Write-Output "Copied README from dir: $readme -> $destPath"
                $copied++
            } else {
                Write-Output "Skipped directory (no README): $f"
                $skipped++
            }
        } else {
            Write-Output "Missing: $f"
            $missing++
        }
    } catch {
        Write-Output "Error copying $f : $_"
    }
}
Write-Output "Summary: Copied=$copied, SkippedDirs=$skipped, Missing=$missing"

