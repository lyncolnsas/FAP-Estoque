# 🏗️ Backend Rule: Core Architecture & Multi-tenancy (Stage 1)

**Target Agent:** `backend-specialist`
**Stack:** NestJS, TypeORM/Prisma, Passport (JWT)
**Context:** Mikrogestor SaaS - Foundation
**Critical Goal:** Implement secure request isolation per tenant.

## 1. Modular Architecture
Organize the `src` folder by Domain, not technical type.
-   `src/modules/iam` (Identity & Access: Auth, Users, Roles)
-   `src/modules/saas` (Tenant Management, Subscription)
-   `src/shared/tenancy` (The isolation engine)

## 2. The Tenancy Middleware (CRITICAL)
You must implement a robust **Tenant Context** mechanism.
1.  **Extraction:** Read `x-tenant-slug` header from incoming requests.
2.  **Resolution:** Look up the Tenant UUID and Schema Name in Redis (Cache First).
3.  **Context Store:** Use `AsyncLocalStorage` (ALS) to store the current `tenantId` for the duration of the request.
4.  **Database Connection:**
    -   If using Postgres Schemas: Set `search_path` to `tenant_schema, public` at the start of the transaction.
    -   **NEVER** leak data between schemas.

## 3. Authentication & Guards
-   **Strategies:** Implement `JwtStrategy` and `TenantApiKeyStrategy` (for remote scripts).
-   **Guards:**
    -   `@Roles('SUPER_ADMIN')` -> Access to Global SaaS config.
    -   `@Roles('ISP_ADMIN')` -> Access to Tenant specific data.
    -   `@Roles('TECHNICIAN')` -> Restricted mobile app access.

## 4. VPN Provisioning Trigger
-   **Event:** On `TenantCreated` event.
-   **Action:** Call `VpnKeyService` to generate WireGuard Public/Private keys.
-   **Store:** Save keys in `public.tenants` table immediately. Do not wait for the router to connect.