# 🏢 Database Rule: Tenant & Financial Engine (Stage 2)

**Target Agent:** `database-architect`
**Context:** Mikrogestor SaaS - Tenant Isolation Strategy
**Critical Goal:** Secure data isolation and immutable financial records.

## 1. Isolation Strategy: Schema-per-Tenant
We will use logical separation via schemas (e.g., `tenant_{uuid}`).
*Note: Do not use a single giant table with tenant_id for high-volume data like logs.*

### Template Schema (`tenant_template`)
Create a standard set of tables to be cloned for new ISPs.

## 2. Financial Modeling (The "No-Delete" Rule)
The financial system must be an "Append-Only" ledger for invoices.

-   **Table `invoices`**:
    -   `status`: 'draft' -> 'open' -> 'paid' | 'overdue' -> 'cancelled'.
    -   **Constraint:** If `status` IN ('paid', 'cancelled'), the row is **IMMUTABLE**.
-   **Table `invoice_items`**:
    -   Detail line items (Plan Service, Installation Fee, Late Fee).
-   **Table `financial_configs`**:
    -   `gateway_credentials` (JSONB): Store tokens for MercadoPago/Asaas securely (encrypted at app level).
    -   `interest_rate` (Decimal): Daily % for delays.

## 3. Customer CRM
-   **Table `customers`**:
    -   `cpf_cnpj` (Unique per tenant).
    -   `address` (JSONB): Flexible structure for geolocation.

## 4. Performance Indexes
-   Index `invoices(customer_id, status)` for fast dashboard lookups.
-   Index `customers(name gin_trgm_ops)` for fuzzy search (PostgreSQL `pg_trgm`).