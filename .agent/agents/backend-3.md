# 💰 Backend Rule: Financial & Job Queues (Stage 3)

**Target Agent:** `backend-specialist`
**Stack:** BullMQ, Factory Pattern
**Context:** Mikrogestor SaaS - Billing Engine
**Critical Goal:** Reliable billing and automated blocking.

## 1. Payment Gateway Factory
ISPs use different banks. We need a unified interface.
-   **Interface:** `PaymentGatewayInterface` (methods: `createPix`, `getWebhook`, `refund`).
-   **Adapters:** `MercadoPagoAdapter`, `AsaasAdapter`, `GerencianetAdapter`.
-   **Selection:** Based on `tenant.financial_configs`.

## 2. The Interest Engine (Juros e Multa)
Logic for calculating next month's invoice additions.
-   **Job:** `CalculatePendingInterests`.
-   **Logic:**
    1.  Find invoices paid *after* `due_date`.
    2.  Calculate: `(Amount * Fine%) + (Amount * DailyInterest% * DaysLate)`.
    3.  Store result in a `pending_debits` table to be added as an `invoice_item` in the *next* generated invoice.
    4.  **Constraint:** NEVER modify a closed invoice.

## 3. Webhook Processor (Queue)
Webhooks are spiky. Don't process synchronously.
-   **Queue:** `webhook-processing-queue`.
-   **Worker:**
    1.  Receive payload -> Verify Signature.
    2.  Identify Tenant & Invoice.
    3.  Update Invoice Status -> 'PAID'.
    4.  **Trigger:** `UnlockCustomerEvent` (which calls MikroTik Wrapper to enable internet).

## 4. Daily Jobs (Cron)
-   `BlockOverdueJob` (00:01 AM):
    -   Query `invoices` where `due_date < NOW() - tolerance_days`.
    -   Update `customer.status` -> 'BLOCKED'.
    -   Sync to Radius/MikroTik.