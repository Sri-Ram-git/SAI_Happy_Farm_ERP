# SECURITY REMEDIATION LOG — Happy Farmer ERP

## Log of Implemented Remediations

| Ref | Date | Commit | Title | Component | Description & Verification |
|---|---|---|---|---|---|
| **SEC-01** | 2026-10-01 | `9ec5c85` | BOLA / IDOR in Production Curve Export | `backend/src/controllers/reports.controller.ts` | Added user farm assignment check against query parameters (`farmIdParam`). Rejects unauthorized exports with 403. Tested with automated unit/integration tests in `reports.export.security.test.ts`. |
| **SEC-02** | 2026-10-01 | `9ec5c85` | Cross-Farm Read Permissions in Firestore Rules | `firestore.rules`, `frontend/src/services/farmDataService.ts` | Updated rule on `/farms/{farmId}` to require `hasFarmAccess(farmId)`. Refactored frontend dashboards to query targeted farm document paths rather than unfiltered queries. |
| **SEC-03** | 2026-10-01 | `9ec5c85` | Direct Flock Field Tampering | `firestore.rules` | Added `affectedKeys().hasAny([...])` guard prohibiting non-admins from mutating `farmId`, `initialBirds`, `startDate`, `breedType`, `productionCurve`, `batchNumber`, `status`. Verified via `firestoreRules.contract.test.ts`. |
| **SEC-04** | 2026-10-01 | `9ec5c85` | Weekly Report Lock Deletion | `firestore.rules` | Restricted `delete` operations on `/dailyReportLocks/{lockId}` exclusively to `isAdmin()`. Verified via contract test. |
| **SEC-05** | 2026-10-01 | `9ec5c85` | Weak Administrative Password Length | `backend/src/validators/adminUser.validator.ts`, `backend/src/validators/supervisor.validator.ts` | Increased minimum password length from 6 to 8 characters for admin and supervisor creation. Tested in `managementPassword.security.test.ts`. |
| **SEC-06** | 2026-10-01 | `9ec5c85` | Account Enumeration via Detailed Auth Errors | `frontend/src/utils/firebaseErrors.ts` | Unified `auth/user-not-found`, `auth/wrong-password`, and `auth/invalid-credential` into a single generic message `"Invalid email or password."`. |
| **SEC-07** | 2026-10-01 | `9ec5c85` | Privilege Escalation on User Profiles | `firestore.rules` | Blocked self-modification of `role`, `farmIds`, `active`, `email`, and `uid` fields on `/users/{userId}`. |
| **CORR-V2** | 2026-10-01 | `4c787d2` | Revision Subcollection Rules for V2 Corrections | `firestore.rules`, `frontend/src/services/reportService.ts` | Added Firestore rules for `/revisions/{revId}` subcollection under `dailyLogs` and attached `farmId`, `flockId`, `userId` to archive payloads to resolve permission errors during corrections. Verified via `reportCorrection.security.test.ts`. |
| **SEC-08** | 2026-10-01 | Staged | Farmer Password Length Minimum Alignment | `backend/src/validators/farmer.validator.ts`, `frontend/src/pages/admin/AdminCreateFarmerPage.tsx` | Aligned farmer password policy to `min(8)`. Tested in `farmer.validator.test.ts` and `managementPassword.security.test.ts` for <8, =8, and >8 lengths. |
| **SEC-11** | 2026-10-01 | Staged | Eliminate Diagnostic Console Logs in Production | `frontend/vite.config.ts` | Configured Vite esbuild to eliminate `console.log`, `console.debug`, and `console.info` in production builds, while preserving `console.error` and `console.warn` for critical runtime diagnostics. |
| **SEC-12** | 2026-10-01 | Staged | Sensitive Key and Credential Redaction in Logger | `backend/src/utils/logger.ts` | Added recursive sanitization for `password`, `token`, `authorization`, `secret`, `apiKey`, `credential` and Bearer tokens without mutating original metadata objects. Verified via `logger.test.ts`. |
| **SEC-13** | 2026-10-01 | Staged | HTTP Security Headers in Hosting | `firebase.json` | Configured `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security`, and `Referrer-Policy` under hosting headers. |
| **SEC-20** | 2026-10-01 | Staged | Generic Fallback for Unmapped Firebase Errors | `frontend/src/utils/firebaseErrors.ts` | Changed `default:` fallback to `"An unexpected error occurred. Please try again."` without disclosing error code names. Added security tests in `firebaseErrors.security.test.ts`. |

---

## Remaining Staged Remediations / Open Items

The remaining open findings from the Phase A audit are cataloged in `security/SECURITY_FINDINGS.md`:
- **SEC-09 (Medium):** `getReportById` backend endpoint lacks `requireFarmAccess` route middleware (checks in controller).
- **SEC-10 (High):** `reportDataService.ts` unbounded `collectionGroup('dailyLogs')` query on client.
- **SEC-15 (Medium):** In-memory rate limiting not distributed across clustered instances.
- **SEC-16 (Low):** `flock.controller.ts` raw `console.error` calls.
- **SEC-17 (High):** Frontend route guards are client-side only (mitigated by Firestore security rules).
- **SEC-18 (Medium):** Content Security Policy (CSP) not defined in hosting.
- **SEC-19 (Info):** Viewport `user-scalable=no` accessibility setting.
- **SEC-21 (Medium):** Backend `ReportsRepository` writes to flat `/dailyReports/{reportId}` rather than nested `/dailyReports/{userId}/dailyLogs/{date}`.
