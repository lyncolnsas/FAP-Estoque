# 🖥️ Frontend Rule: ISP VPN View (Read-Only & Integration)

**Target Agent:** `frontend-specialist`
**Context:** ISP Panel -> Network Settings
**Critical Goal:** Display VPN integration secrets safely without allowing configuration changes.

## 1. The "Read-Only" Policy (Strict)
The ISP Client (Tenant) **CANNOT** create, delete, or modify VPN Tunnels.
-   **UI Restrictions:**
    -   ❌ No "Create VPN" button.
    -   ❌ No "Edit Endpoint" forms.
    -   ❌ No "Delete Tunnel" actions.
-   **Concept:** The VPN is a "Service Provided" by the SaaS, auto-provisioned upon subscription.

## 2. Integration Card ("Connect Your Router")
Create a dedicated component: `<VpnIntegrationCard />`.
-   **Purpose:** Deliver the configuration script to the ISP owner.
-   **Visuals:**
    -   **Status Indicator:** Large Badge (Green = Connected, Gray = Waiting for Connection).
    -   **Topology Info:** Display the assigned `Internal IP` (e.g., 10.8.0.5) clearly.
-   **The "Magic Script" Box:**
    -   Fetch the pre-generated RouterOS script from the API.
    -   Display inside a generic `<CodeBlock />` component with syntax highlighting.
    -   **Action:** "Copy to Clipboard" button (Primary CTA).
    -   **Security:** Mask the `Private Key` by default with a "Show" toggle button.

## 3. NAS Registry (MikroTik Management)
This is where the ISP *does* have write access. They register their routers here.
-   **Page:** `/network/nas/new`
-   **Form Fields:**
    -   `Name`: Friendly name (e.g., "Concentrador Centro").
    -   `Secret`: The Radius Secret (Auto-generated strong password recommended).
    -   **Connection Type (Crucial):**
        -   Radio Group: [ ] Direct Public IP | [x] SaaS VPN Tunnel.
        -   *Logic:* If "SaaS VPN" is selected, auto-fill the `NAS IP` field with the Tenant's VPN IP (`10.8.0.x`) and disable editing. This prevents misconfiguration.

## 4. Operational Dashboard (Standard ISP Tasks)
Ensure the standard operations remain accessible and distinct from the VPN settings.
-   **Users/Plans:** These forms operate normally, interacting with the Database/Radius.
-   **Connection Feedback:** In the Customer List, show if the command (Kick/Unlock) was sent successfully via the VPN Tunnel.
    -   *Success:* "Command sent via Tunnel 10.8.0.x".
    -   *Failure:* "VPN Tunnel Down - Check your MikroTik".