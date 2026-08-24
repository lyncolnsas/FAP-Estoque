---
name: vpn-engineering
description: Rules and procedures for managing WireGuard VPN infrastructure in Docker environments.
---

# 🛡️ VPN Engineering (Skill)

This skill provides specialized knowledge and procedures for deploying, maintaining, and troubleshooting WireGuard VPN services within the containerized Mikrogestor.com infrastructure.

## 1. Core Principles (The "Law")

### 🌐 UDP Port Forwarding is Non-Negotiable

- **Rule:** WireGuard relies exclusively on UDP.
- **Port:** Default is `51820`.
- **Requirement:** The host firewall (Windows/Linux) MUST allow inbound UDP traffic on this port.
- **Docker:** The container MUST bind the port to the host (`-p 51820:51820/udp`).

### 🔑 Key Management is Critical

- **Rule:** Public Keys are public, Private Keys are secret.
- **Sync:** The database (`VpnTunnel`) is the Source of Truth.
- **Behavior:** The runtime configuration (`wg0.conf`) is ephemeral and managed by scripts. Do NOT edit it manually.
- **Rotation:** If a server key is compromised, ALL client configurations must be regenerated.

### 🌍 Endpoint Accessibility

- **Rule:** Clients must connect to a reachable Public IP or DDNS.
- **Exception:** Local testing (LAN) works only if:
  - The client is on the same subnet.
  - No "AP Isolation" or "Mobile Data Preference" interferes.
  - **Loopback:** Testing from the Host to the Container requires `127.0.0.1` or the Docker Gateway IP, NOT the LAN IP.

## 2. Troubleshooting Procedures

### 🛑 procedure: check-connectivity

Use this when a user reports "I can't connect".

1. **Check Container Status:**

    ```bash
    docker ps | grep vpn
    ```

    *Must be Up.*

2. **Check Interface Status:**

    ```bash
    docker exec mikrogestor_vpn wg show wg0
    ```

    *Must show active interface.*

3. **Check Handshake (The Truth):**

    ```bash
    docker exec mikrogestor_vpn wg show wg0 dump
    ```

    - Look for the peer's Public Key.
    - Check the `latest-handshake` timestamp (Unix Epoch).
    - **If 0:** Packets are blocked before reaching the container (Firewall/NAT).
    - **If recent:** Handshake OK, but traffic dropping (Check MTU/Forwarding).

4. **Listen for Traffic (Snoop):**

    ```bash
    docker exec -u 0 mikrogestor_vpn tcpdump -i wg0 -n -v udp port 51820
    ```

    *If silent during connection attempt -> Host Firewall or Router NAT issue.*

### 🔄 procedure: sync-peers

Use this to force the database state into the runtime.

1. **Run Sync Script:**

    ```bash
    docker exec mikrogestor_app node /app/scripts/sync-wireguard.js
    ```

    *Logs will show added/removed/updated peers.*

2. **Verify Result:**

    ```bash
    docker exec mikrogestor_vpn wg show wg0
    ```

### 📝 procedure: generate-config

Use this to inspect or regenerate a client configuration.

1. **Query Database:**

    ```bash
    docker exec mikrogestor_app node -e "const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); run().catch(console.error); async function run() { const t = await prisma.vpnTunnel.findMany({ include: { server: true } }); console.log(JSON.stringify(t, null, 2)); }"
    ```

2. **Verify Keys:**
    - Ensure `clientPrivateKey` matches what is on the user's device.
    - Ensure `serverPublicKey` matches the server's actuan key.
    - Ensure `Endpoint` resolves to the correct IP.

## 3. Common Pitfalls & Solutions

| Symptom | Probable Cause | Solution |
| :--- | :--- | :--- |
| **Handshake: 0** | UDP blocked by Host Firewall | Allow UDP 51820 inbound. |
| **Handshake: 0 (Mobile)** | Mobile Data priority / AP Isolation | Test with Public IP + NAT. |
| **Handshake OK, No Ping** | IP Forwarding disabled | `sysctl -w net.ipv4.ip_forward=1` |
| **Handshake OK, Bad Speed** | MTU Mismatch (PPPoE/4G) | Lower MTU to 1280 or 1360 in Client Config. |
| **Crash Loop** | Kernel Module missing | Use `sysctls` or `cap_add: NET_ADMIN`. |
