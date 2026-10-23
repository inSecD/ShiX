#!/usr/bin/env pwsh
# ShiX Terminal - start script
# Build + serve + print the LAN URL so the iPhone can open it.

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

Write-Host ''
Write-Host '  ShiX Terminal' -ForegroundColor Cyan
Write-Host '  -------------' -ForegroundColor DarkCyan
Write-Host ''

if (-not (Test-Path 'node_modules')) {
  Write-Host '  Installing dependencies...' -ForegroundColor Yellow
  npm install
}

Write-Host '  Building...' -ForegroundColor Yellow
npm run build | Out-Null
Write-Host '  Build done.' -ForegroundColor Green

$route = Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue |
  Sort-Object RouteMetric | Select-Object -First 1
$ip = if ($route) {
  (Get-NetIPAddress -AddressFamily IPv4 -InterfaceIndex $route.InterfaceIndex -ErrorAction SilentlyContinue |
    Select-Object -First 1).IPAddress
}
if (-not $ip) {
  $ip = (Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254*' } |
    Select-Object -First 1).IPAddress
}

Write-Host ''
Write-Host '  Jalankan:' -ForegroundColor Cyan
Write-Host "    PC  : http://localhost:4173"
if ($ip) {
  Write-Host "    HP  : http://${ip}:4173" -ForegroundColor Green
  Write-Host "         (HP harus di Wi-Fi yang sama)" -ForegroundColor DarkGray
}
Write-Host ''
Write-Host '  Install ke iPhone: buka URL di Safari > Share > Add to Home Screen' -ForegroundColor Cyan
Write-Host '  (untuk offline penuh, deploy ke GitHub Pages - lihat README)' -ForegroundColor DarkGray
Write-Host ''
Write-Host '  Ctrl+C untuk stop.' -ForegroundColor DarkGray
Write-Host ''

npm run preview
