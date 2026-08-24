#!/bin/bash
# VPN Health Check Diagnostic Script
# Usage: ./diagnose.sh

echo "🛡️  Mikrogestor VPN Diagnostics"
echo "================================="

# 1. Check if Container is Running
CONTAINER_STATUS=$(docker ps -a --format '{{.Status}}' --filter "name=mikrogestor_vpn")
if [[ $CONTAINER_STATUS == *"Up"* ]]; then
    echo "✅ Container [mikrogestor_vpn] is UP ($CONTAINER_STATUS)"
else
    echo "❌ Container [mikrogestor_vpn] is DOWN or Missing!"
    echo "   -> Run: docker-compose up -d"
    exit 1
fi

# 2. Check Interface Status
WG_SHOW=$(docker exec mikrogestor_vpn wg show wg0 2>&1)
if [[ $WG_SHOW == *"interface: wg0"* ]]; then
    echo "✅ Interface [wg0] is ACTIVE"
else
    echo "❌ Interface [wg0] is MISSING inside container!"
    exit 1
fi

# 3. Check Handshakes (The Real Test)
echo "📡 Checking Peer Connectivity..."
docker exec mikrogestor_vpn wg show wg0 dump | tail -n +2 | while read -r line; do
    PUBKEY=$(echo "$line" | awk '{print $1}')
    IP=$(echo "$line" | awk '{print $4}')
    HANDSHAKE=$(echo "$line" | awk '{print $5}')
    
    NOW=$(date +%s)
    DIFF=$((NOW - HANDSHAKE))
    
    if [ "$HANDSHAKE" -eq "0" ]; then
        STATUS="❌ NEVER CONNECTED (Blocked?)"
    elif [ "$DIFF" -lt "180" ]; then
        STATUS="✅ ONLINE (Last seen ${DIFF}s ago)"
    else
        STATUS="⚠️  OFFLINE (Last seen ${DIFF}s ago)"
    fi
    
    echo "   -> Peer [$IP] : $STATUS"
    echo "      Key: ${PUBKEY:0:10}..."
done

# 4. Check IP Forwarding
IP_FWD=$(docker exec mikrogestor_vpn sysctl net.ipv4.ip_forward)
if [[ $IP_FWD == *"= 1"* ]]; then
    echo "✅ IP Forwarding is ENABLED"
else
    echo "❌ IP Forwarding is DISABLED! (Clients can't reach internet)"
    echo "   -> Fix: sysctl -w net.ipv4.ip_forward=1"
fi

echo "================================="
echo "Diagnostics Complete."
