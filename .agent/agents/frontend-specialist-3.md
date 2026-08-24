# 📱 Frontend Rule: Technician & Financial Tools (Stage 3)

**Target Agent:** `frontend-specialist`
**Context:** Mobile App (PWA) and Advanced features.
**Critical Goal:** Simplify complex tasks for field usage.

## 1. The Technician "Activation Wizard"
Field technicians hate typing. Build a step-by-step Wizard optimized for touch.
-   **Route:** `/(technician)/activation/new`
-   **Steps:**
    1.  **Scan:** Use camera API to scan ONU/Router MAC Address Barcode.
    2.  **Locate:** Auto-fill GPS coordinates using Browser Geolocation.
    3.  **Provision:** Select Plan -> API call to Backend (creates User + Radius entry).
    4.  **Test:** Trigger a "Ping Test" from the backend (MikroTik -> ONU) and show result on phone.

## 2. Financial Dashboard (ISP Admin)
-   **Charts:** Use `Recharts` or `Tremor` for:
    -   Revenue vs Expenses (Bar Chart).
    -   Churn Rate (Line Chart).
-   **Invoicing UX:**
    -   Bulk Action: "Select All Overdue" -> "Send WhatsApp Reminder".
    -   PDF Preview: Use `react-pdf` or iframe to show invoices before sending.

## 3. SaaS Admin (Super Admin)
-   **Tenant Management:**
    -   Button: "Reset VPN Tunnel" (Triggers backend script).
    -   Indicator: VPN Keep-alive status (Green if MikroTik is communicating).