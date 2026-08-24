Write-Host "--- VPN Diagnostics ---"

$container = docker ps -a --format "{{.Status}}" --filter "name=mikrogestor_vpn"
if ($container -match "Up") {
    Write-Host "Container: UP"
}
else {
    Write-Host "Container: DOWN"
    exit 1
}

$wg = docker exec mikrogestor_vpn wg show wg0 2>&1
if ($wg -match "interface: wg0") {
    Write-Host "Interface: ACTIVE"
}
else {
    Write-Host "Interface: MISSING"
    exit 1
}

Write-Host "checking handshakes..."
$dump = docker exec mikrogestor_vpn wg show wg0 dump
$lines = $dump -split "`n"

foreach ($line in $lines) {
    if ($line.Length -lt 10) { continue }
    $parts = $line -split "\t"
    if ($parts.Count -lt 5) { continue }
    
    $ip = $parts[3]
    $handshake = [int64]$parts[4]
    
    if ($handshake -eq 0) {
        Write-Host "Peer $ip : NEVER CONNECTED (Blocked)"
    }
    else {
        Write-Host "Peer $ip : ONLINE (Handshake $handshake)"
    }
}
