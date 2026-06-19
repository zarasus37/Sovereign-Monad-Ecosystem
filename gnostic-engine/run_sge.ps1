# run_sge.ps1
# Ensure required packages are installed
python -m pip install --quiet uvicorn fastapi

# Navigate to the API directory relative to this script
Set-Location (Join-Path $PSScriptRoot 'api')

# Start uvicorn as a persistent background service using python -m uvicorn
Start-Process -FilePath "python" -ArgumentList "-m", "uvicorn", "gnostic_api:app", "--host", "0.0.0.0", "--port", "800" -NoNewWindow -RedirectStandardOutput "gnostic_sge.log" -RedirectStandardError "gnostic_sge_error.log"
