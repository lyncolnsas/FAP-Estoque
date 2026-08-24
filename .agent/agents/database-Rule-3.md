# 📡 Database Rule: Network Integration (Stage 3)

**Target Agent:** `database-architect`
**Context:** Mikrogestor SaaS - Radius & VPN Schemas
**Critical Goal:** Compatibility with FreeRADIUS and high-performance auth.

## 1. The `radius` Schema
This schema acts as the interface for the FreeRADIUS server. It must be strictly compatible with standard dictionary.

### Standard Tables (FreeRADIUS)
1.  **`radcheck`**:
    -   Auth credentials (PPPoE User/Pass).
    -   **Rule:** Create a TRIGGER that updates this table when `tenant_schema.customers` changes.
2.  **`radreply`**:
    -   Response attributes (Framed-IP-Address, Mikrotik-Rate-Limit).
    -   **Rule:** Rate limits must be synced from `tenant_schema.plans`.
3.  **`radacct`** (Accounting):
    -   **Partitioning:** PARTITION BY RANGE (acctstarttime) - Monthly partitions. This table grows very fast.

## 2. NAS (Network Access Server) Registry
The `nas` table allows the Radius server to trust the ISP's MikroTik.

-   **Columns:**
    -   `nasname`: The VPN IP (e.g., `10.8.0.5`) - **NOT** the public IP (since ISP is CGNAT).
    -   `shortname`: Router ID.
    -   `secret`: Shared secret for Radius packet encryption.

## 3. View Abstractions
Do NOT let the Backend write directly to `radcheck` via simple INSERTs if possible.

-   Create **Views/Functions** in the `public` schema that abstract the tenant logic:
    -   `fn_provision_customer(tenant_id, customer_data)` -> Updates `radius.radcheck`.
    -   `fn_disconnect_user(username)` -> Inserts into `radius.radpostauth` (Disconnect Request).

## 4. Optimization
-   `radcheck` MUST have a covering index on `(username, attribute)`.
-   Auth queries must execute in < 10ms.