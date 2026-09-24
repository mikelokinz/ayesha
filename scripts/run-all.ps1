# UrbanPulse — Launch All 3 Services in separate PowerShell windows
$ProjectRoot = Resolve-Path "$PSScriptRoot\.."

Write-Host "Starting UrbanPulse Backend (Port 8000)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", "$PSScriptRoot\run-backend.ps1"

Start-Sleep -Seconds 2

Write-Host "Starting UrbanPulse Edge AI (Port 8001)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", "$PSScriptRoot\run-edge.ps1"

Start-Sleep -Seconds 2

Write-Host "Starting UrbanPulse Frontend (Port 5173)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", "$PSScriptRoot\run-frontend.ps1"

Write-Host "`nAll 3 services launched! Dashboard will be at: http://127.0.0.1:5173" -ForegroundColor Magenta
