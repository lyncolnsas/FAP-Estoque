# 🖥️ Frontend Rule: ISP Core Panel (Stage 2)

**Target Agent:** `frontend-specialist`
**Context:** The main ERP interface for the ISP owner.
**Critical Goal:** High-performance data tables and real-time network visibility.

## 1. Data Tables (The Heart of the System)
ISPs manage thousands of clients. Standard tables are not enough.
-   **Technology:** TanStack Table (React Table v8).
-   **Features Required:**
    -   Server-side Pagination, Sorting, and Filtering (Search by Name, PPPoE Login, CPF).
    -   "Dense Mode" toggle (Compact rows).
    -   **Action Columns:** Quick actions (Unlock, Kick Connection, View Logs) without opening detail page.

## 2. Customer Detail View (360° View)
Create a centralized `CustomerProfile` page composed of isolated Server/Client Components.
-   **Header:** Status Badges (Financial + Connection Status).
-   **Tabs:**
    1.  **Connection:** Real-time Radius attributes (IP, Uptime, MAC). *Action: "Kick User" button.*
    2.  **Financial:** Invoice history list. *Action: "Generate PDF" / "Send WhatsApp".*
    3.  **Logs:** Radius Auth Logs (Success/Reject history).

## 3. Real-Time Network Status
-   **Implementation:** Use `React Query` with short polling (e.g., 10s) or SSE (Server-Sent Events) for connection status.
-   **Visuals:**
    -   Online: Green Pulse Dot.
    -   Offline: Gray/Red Dot with "Last seen X mins ago".