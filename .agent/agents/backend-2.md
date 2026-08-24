# 📡 Backend Rule: Network & VPN Engine (Stage 2)

**Target Agent:** `backend-specialist`
**Context:** Mikrogestor SaaS - Reverse VPN Logic
**Critical Goal:** Communicate with ISPs behind CGNAT via WireGuard.

## 1. The VPN Tunnel Manager
This module manages the local WireGuard interface on the Docker container.
-   **Service:** `WireGuardService`.
-   **Logic:**
    -   When a tenant is active, add their Peer (PublicKey + AllowedIPs) to the interface.
    -   **IP Scheme:** Use the `10.8.x.x` allocated in the DB.
    -   **Keep-Alive:** Monitor handshake times to detect offline ISPs.

## 2. MikroTik API Wrapper (The Proxy)
We cannot connect to the ISP's Public IP. We must route through the Tunnel.
-   **Library:** Use a robust RouterOS client (e.g., `node-routeros` or raw socket).
-   **Routing Logic:**
    -   Input: `tenantId`, `command` (e.g., `/interface/print`).
    -   Resolution: Fetch `assigned_internal_ip` from DB (e.g., `10.8.0.5`).
    -   Execution: Connect to `10.8.0.5:8728`.
-   **Timeout Handling:** ISPs have unstable connections. Implement aggressive timeouts (5s) and retries (3x).

## 3. Radius Integration (Direct DB Mode)
Do not create an API for Radius. Radius reads the DB directly.
-   **Service:** `RadiusSyncService`.
-   **Trigger:** When a Plan is updated or Customer is blocked.
-   **Action:** Perform atomic writes to `radius.radcheck` and `radius.radreply`.
-   **Kick User:** Upon blocking, immediately send a CoA (Change of Authorization) or Disconnect Request to the NAS IP (`10.8.0.5`).