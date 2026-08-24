# 🕵️ Master Audit: Mikrogestor Functionality Check

**Target Agents:** `orchestrator`, `test-engineer`, `debugger`
**Scope:** Full System (DB + Backend + Frontend + Network)
**Goal:** Verify if the SaaS works as a cohesive unit.

## 🔴 CRITICAL PATH: The VPN "Heartbeat"
*If this fails, the product doesn't exist.*

1.  **Provisioning (Backend -> DB):**
    -   [ ] When a Tenant is created, is a `vpn_server` assigned?
    -   [ ] Is the `internal_ip` (e.g., 10.8.0.5) unique within that Server ID? (`db-vpn-manager.md`)
    -   [ ] Are keys (Public/Private/PSK) generated and saved?
2.  **OS Integration (Backend -> WireGuard):**
    -   [ ] Does the Backend execute `wg set` (Hot-add) without restarting the interface?
    -   [ ] Is the "Magic Script" generated correctly matching the stored keys?
3.  **Connectivity (Backend -> MikroTik):**
    -   [ ] Can the Backend ping the `internal_ip`?
    -   [ ] Does the `MikrotikProxy` service respect the timeout (5s) if the tunnel is down?
    -   [ ] **Fail-Safe:** Does the UI show "Router Offline" instead of crashing if the ping fails?

## 💰 FINANCIAL PATH: The "Wallet"
*Money must never be lost or calculated wrong.*

1.  **Invoice Generation:**
    -   [ ] Is the PDF generated with the correct Pix Copy/Paste code?
    -   [ ] Does the "Append-Only" rule apply? (Paid invoices CANNOT be edited).
2.  **Interest Engine (Juros):**
    -   [ ] Simulate a payment 5 days late.
    -   [ ] Verify: Is the interest calculated and added to a `pending_debits` queue for the *next* month? (`be-stage3-financial.md`)
3.  **Webhook & Unlock:**
    -   [ ] Simulate a Webhook `PAYMENT_RECEIVED`.
    -   [ ] Verify: Invoice Status -> `PAID`.
    -   [ ] Verify: Customer Status -> `ACTIVE`.
    -   [ ] Verify: Radius Attribute `Mikrotik-Address-List` removed/updated.

## 🏢 MULTI-TENANCY: The "Walls"
*Data leakage is fatal.*

1.  **Isolation:**
    -   [ ] Login as Tenant A. Try to access Tenant B's customer ID via API URL manipulation. (Expect 403/404).
    -   [ ] Verify Redis Cache: Are session keys prefixed with `tenant_id`?
2.  **Role Guards:**
    -   [ ] Can a `TECHNICIAN` user access the "Financial Settings" page? (Expect 403).
    -   [ ] Can an `ISP_ADMIN` access the `(saas-admin)` route group? (Expect Redirect).

## 📡 NETWORK INTEGRATION: The "Brain"
*Radius and MikroTik synchronization.*

1.  **Radius Sync:**
    -   [ ] Create a Customer. Check `radius.radcheck` table. Is the username there?
    -   [ ] Change Plan Speed. Check `radius.radreply`. Did `Mikrotik-Rate-Limit` update?
2.  **NAS Registry:**
    -   [ ] Register a NAS. Select "Via VPN".
    -   [ ] Verify: Is the IP field disabled and auto-filled with `10.8.0.x`? (`fe-vpn-readonly.md`)

## 📱 USER EXPERIENCE: The "Face"
*Usability for Power Users.*

1.  **Technician App:**
    -   [ ] Does the "Mac Scanner" open the camera on mobile?
    -   [ ] Does Geolocation capture accurate lat/long?
2.  **ISP Panel:**
    -   [ ] Do tables support "Dense Mode" (High information density)?
    -   [ ] Is Dark Mode functional on all screens?