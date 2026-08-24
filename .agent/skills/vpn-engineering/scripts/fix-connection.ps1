# fix-connection.ps1
# 🛠️ Fixes Windows Network & Firewall Blocking for WireGuard
# MUST BE RUN AS ADMINISTRATOR

Write-Host "🛡️  Mikrogestor VPN Network Fixer" -ForegroundColor Cyan
Write-Host "=================================="

# 1. Detect Admin Privileges
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "❌ ERROR: This script requires ADMINISTRATOR privileges." -ForegroundColor Red
    Write-Host "   -> Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    exit 1
}

# 2. Fix Network Profile (Public -> Private)
Write-Host "1️⃣  Checking Network Profiles..."
$profiles = Get-NetConnectionProfile
foreach ($p in $profiles) {
    if ($p.NetworkCategory -eq "Public") {
        Write-Host "   ⚠️  Found Public Network: $($p.Name)" -ForegroundColor Yellow
        try {
            Set-NetConnectionProfile -InputObject $p -NetworkCategory Private -ErrorAction Stop
            Write-Host "   ✅ Changed to PRIVATE." -ForegroundColor Green
        }
        catch {
            Write-Host "   ❌ Failed to change profile. (Group Policy?)" -ForegroundColor Red
        }
    }
    else {
        Write-Host "   ✅ Network '$($p.Name)' is already $($p.NetworkCategory)" -ForegroundColor Gray
    }
}

# 3. Force Firewall Rule (UDP 51820)
Write-Host "`n2️⃣  Updating Firewall Rules..."
$ruleName = "Mikrogestor WireGuard Inbound"

# Remove old/conflicting rules
Remove-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue

# Create new permissive rule
try {
    New-NetFirewallRule -DisplayName $ruleName `
        -Direction Inbound `
        -LocalPort 51820 `
        -Protocol UDP `
        -Action Allow `
        -Profile Any `
        -Description "Allow WireGuard VPN Traffic for Docker" `
        -ErrorAction Stop
        
    Write-Host "   ✅ Firewall Rule Created: Allow UDP 51820 (Any Profile)" -ForegroundColor Green
}
catch {
    Write-Host "   ❌ Failed to create firewall rule: $_" -ForegroundColor Red
}

# 4. Verify Listener
Write-Host "`n3️⃣  Verifying Port Listener..."
$listener = Get-NetTCPConnection -LocalPort 51820 -ErrorAction SilentlyContinue 
# Note: Get-NetTCPConnection works for TCP, for UDP we use legacy netstat or different cmdlet
# Using netstat for reliability with UDP
$netstat = netstat -ano | findstr "51820"
if ($netstat) {
    Write-Host "   ✅ Port 51820 is LISTENING (Docker is bound)" -ForegroundColor Green
}
else {
    Write-Host "   ❌ No process listening on 51820! Is Docker running?" -ForegroundColor Red
}

Write-Host "`n=================================="
Write-Host "🎉 Fix Complete. Try connecting your VPN now." -ForegroundColor Cyan
Write-Host "   - PC Endpoint: 127.0.0.1:51820"
Write-Host "   - Mobile Endpoint: Public_IP:51820"
Write-Host "=================================="
