# UrbanPulse — Central Backend (Port 8000)
$ErrorActionPreference = "Stop"
$ProjectRoot = Resolve-Path "$PSScriptRoot\.."
Set-Location $ProjectRoot

Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host " UrbanPulse CENTRAL BACKEND — Port 8000" -ForegroundColor Cyan
Write-Host " Root: $ProjectRoot" -ForegroundColor Gray
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan

if (-not (Test-Path "$ProjectRoot\.venv\Scripts\python.exe")) {
    Write-Host "[ERROR] .venv not found. Run: py -3.12 -m venv .venv" -ForegroundColor Red
    exit 1
}

& "$ProjectRoot\.venv\Scripts\python.exe" -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
