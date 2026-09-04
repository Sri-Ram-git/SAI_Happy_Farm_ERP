================================================
FARM ERP — V1 FINALIZED STATE
================================================

Release: V1 Finalized ERP
Date: 2026-09-04
Status: FINALIZED
Git Commit: `f7ed84022fcd2760950254e6b1117b1b28bd48f7`

Architecture: VERIFIED (React SPA -> Firebase SDK -> Firestore)
Frontend: VERIFIED (Vite build successful)
Backend: VERIFIED (Firestore strictly enforces data rules)
Database: VERIFIED (Master Farm inventory + Daily Logs structure intact)
Authentication: VERIFIED (Firebase Auth roles function)
Roles: VERIFIED (Farmer, Supervisor, Admin logic isolated)
Farmer: VERIFIED (End-to-end report submission works)
Supervisor: VERIFIED (Dashboard KPIs render dynamically)
Admin: VERIFIED (User provisioning and global reporting works)
Inventory: VERIFIED (Atomic transactions correctly deduct from Master)
Daily reports: VERIFIED (Frozen snapshot correctly isolated from live master)
KPIs: VERIFIED (No hardcoded aggregations)
Security: VERIFIED (No secret leaks; RBAC enforced)
Testing: VERIFIED (Build, runtime, and logic tests pass)
Git: VERIFIED (Pushed to origin/master successfully)
Known issues: VERIFIED (Non-blocking edge cases documented)

## WHAT IS STABLE
- The core data lifecycle: Admin provisions Farm -> Farmer submits Report -> Master Inventory deducts -> Dashboard Aggregates.

## WHAT MUST NOT BE CHANGED CASUALLY
- `reportService.ts`: This file houses the highly sensitive atomic `db.runTransaction` logic that prevents race conditions and inventory corruption.
- `FarmerFormPage.tsx`: The data-binding architecture (subscribing to live Master vs subscribing to frozen Daily Snapshot) is intentionally complex. Do not simplify it without understanding the impact.

## WHAT FUTURE AGENTS SHOULD CHECK FIRST
- If instructed to fix a UI bug, read `04_DATA_FLOW.md` to trace the data origin.
- If modifying inventory, strictly adhere to `09_INVENTORY_LOGIC.md`.
