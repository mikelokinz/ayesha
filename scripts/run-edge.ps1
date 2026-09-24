# UrbanPulse — Edge AI Service (Port 8001)
$ErrorActionPreference = "Stop"
$ProjectRoot = Resolve-Path "$PSScriptRoot\.."
Set-Location $ProjectRoot

Write-Host "═══════════════════════════════════════════" -ForegroundColor Yellow
Write-Host " UrbanPulse EDGE AI WORKER — Port 8001" -ForegroundColor Yellow
Write-Host " Root: $ProjectRoot" -ForegroundColor Gray
Write-Host "═══════════════════════════════════════════" -ForegroundColor Yellow

$env:AI_DEVICE = "cpu"

if (-not (Test-Path "$ProjectRoot\.venv\Scripts\python.exe")) {
    Write-Host "[ERROR] .venv not found. Run: py -3.12 -m venv .venv" -ForegroundColor Red
    exit 1
}

& "$ProjectRoot\.venv\Scripts\python.exe" -m uvicorn edge.main:app --app-dir backend --host 127.0.0.1 --port 8001
