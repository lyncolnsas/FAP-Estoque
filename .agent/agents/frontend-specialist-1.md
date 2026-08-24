
# 🎨 Frontend Rule: Foundation & Design System (Stage 1)

**Target Agent:** `frontend-specialist`
**Stack:** Next.js 14 (App Router), Tailwind CSS, Shadcn/UI, React Query
**Context:** Mikrogestor SaaS - Initial Setup
**Critical Goal:** Establish a robust multi-layout architecture and authentication flow.

## 1. App Router Architecture (Route Groups)
You must strictly separate the different personas using Route Groups to allow distinct Layouts.
-   `src/app/(public)`: Landing page, Login.
-   `src/app/(saas-admin)`: Super Admin Layout (Sidebar: Tenants, Revenue, VPNs).
-   `src/app/(isp-panel)`: The Tenant's ERP Layout (Sidebar: Customers, Financial, Network).
-   `src/app/(technician)`: Mobile-first Layout (Bottom Nav: Tasks, Wizard).

## 2. Design System Strategy
ISPs are "Power Users". The UI must be **dense** and **data-rich**, not whitespace-heavy.
-   **Component Library:** Use Shadcn/UI (Radix primitives) for accessibility.
-   **Typography:** Inter or Geist Sans. Small sizes (13px/14px) for data tables.
-   **Color Palette:**
    -   Primary: Professional Blue/Indigo.
    -   Status: Explicit colors for Network Status (Green=Online, Red=Offline, Amber=Late Payment).
-   **Dark Mode:** Mandatory. ISPs work in NOCs (Network Operation Centers) with low light.

## 3. Authentication & Guard
-   **Middleware:** Implement `middleware.ts` to inspect JWT roles.
    -   Role `SUPER_ADMIN` -> Redirect to `/(saas-admin)`.
    -   Role `ISP_ADMIN` -> Redirect to `/(isp-panel)`.
    -   Role `TECHNICIAN` -> Redirect to `/(technician)`.
-   **State:** Use `zustand` for client-side session storage (User Profile, Permissions).