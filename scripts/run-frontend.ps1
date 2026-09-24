# UrbanPulse — Frontend Vite App (Port 5173)
$ErrorActionPreference = "Stop"
$ProjectRoot = Resolve-Path "$PSScriptRoot\.."
Set-Location $ProjectRoot

Write-Host "═══════════════════════════════════════════" -ForegroundColor Green
Write-Host " UrbanPulse FRONTEND — Port 5173" -ForegroundColor Green
Write-Host " Root: $ProjectRoot" -ForegroundColor Gray
Write-Host "═══════════════════════════════════════════" -ForegroundColor Green

if (-not (Test-Path "$ProjectRoot\node_modules")) {
    Write-Host "[INFO] node_modules missing — running npm install..." -ForegroundColor Yellow
    npm install
}

npm run dev -- --host 127.0.0.1 --port 5173
