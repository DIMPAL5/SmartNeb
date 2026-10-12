# SmartNeb Windows Firewall Port Opening Script
# MUST BE RUN AS ADMINISTRATOR in PowerShell

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "🛡️ Configuring Windows Firewall Rules for SmartNeb LAN Access" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan

$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "❌ ERROR: This script must be executed as Administrator!" -ForegroundColor Red
    Write-Host "   Please right-click PowerShell -> 'Run as administrator' and re-run:" -ForegroundColor Yellow
    Write-Host "   powershell -ExecutionPolicy Bypass -File .\scripts\open-firewall.ps1" -ForegroundColor White
    exit 1
}

# Rule 1: HTTP API Port 5000
New-NetFirewallRule -DisplayName "SmartNeb Backend API (TCP 5000)" `
                    -Direction Inbound `
                    -LocalPort 5000 `
                    -Protocol TCP `
                    -Action Allow `
                    -Profile Private `
                    -ErrorAction SilentlyContinue

# Rule 2: MQTT Broker Port 1883
New-NetFirewallRule -DisplayName "SmartNeb Mosquitto MQTT (TCP 1883)" `
                    -Direction Inbound `
                    -LocalPort 1883 `
                    -Protocol TCP `
                    -Action Allow `
                    -Profile Private `
                    -ErrorAction SilentlyContinue

Write-Host "✅ Firewall Inbound Rules Added Successfully!" -ForegroundColor Green
Write-Host "   • TCP Port 5000 (Backend HTTP/WSS) -> ALLOWED (Private Profile)" -ForegroundColor White
Write-Host "   • TCP Port 1883 (Mosquitto MQTT)   -> ALLOWED (Private Profile)" -ForegroundColor White
