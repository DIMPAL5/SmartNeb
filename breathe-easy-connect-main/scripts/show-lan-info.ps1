# SmartNeb LAN Configuration Assistant
$wifiAdapter = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } | Select-Object -First 1

if (-not $wifiAdapter) {
    $lanIP = "192.168.x.x"
} else {
    $lanIP = $wifiAdapter.IPAddress
}

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "SmartNeb Local Network (LAN) Configuration Info" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "Laptop Wi-Fi IPv4 Address: $lanIP" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Mobile App (.env.development in mobile/):" -ForegroundColor Cyan
Write-Host "   EXPO_PUBLIC_DEV_API_URL=http://$($lanIP):5000/api/v1" -ForegroundColor White
Write-Host ""
Write-Host "2. ESP32 Firmware Config (in firmware / NVS):" -ForegroundColor Cyan
Write-Host "   MQTT Broker Host : $lanIP" -ForegroundColor White
Write-Host "   MQTT Port        : 1883 (TCP) or 8883 (TLS)" -ForegroundColor White
Write-Host "   Device Telemetry : hospitals/{hospitalId}/devices/{deviceId}/telemetry/health" -ForegroundColor White
Write-Host "==================================================" -ForegroundColor Cyan
