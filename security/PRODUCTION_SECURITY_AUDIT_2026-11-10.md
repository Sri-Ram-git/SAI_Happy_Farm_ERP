# SAI Happy Farms ERP — Production Security Audit & Scalability Assessment

**Date:** 2026-11-10  **Mode:** Read-only audit (no application code, rules, config, data or deployments were changed)
**Scope (exact code audited):**

| Component | Repository | Commit audited |
|---|---|---|
| Frontend (Vercel) | `Sri-Ram-git/Happy_Farm_ERP_Frontend` | `057c0c136b71f938dd143e4b8178ee237575e740` |
| Backend (Render) | `Sri-Ram-git/happy_farm_erp_backend` | `d7607bb795bea03ed29ce74e769bbc05ff9d9112` |
| Firestore rules | Not in either deployed repo. Taken from the **uncommitted working copy** of `firestore.rules` in the monorepo checkout (`Happy_Farm_ERP`, branch `fix/admin-overview-farm-ranking`). | working tree (see SAF-06) |
| Storage rules / firebase.json | Monorepo `storage.rules`, `firebase.json` | `c0528b2` (unchanged in working tree) |
| Secrets / history | All local refs of the monorepo plus the `frontend-remote`, `render-backend` and `vercel-target` remotes | all reachable commits |

> **Assumption to verify:** I did not query Firebase, so I could not confirm that the working-copy rules are byte-identical to the active ruleset `d4d069c2-be48-4e21-8f53-74b3063f7f54`. The working copy is the only version that implements "feed transactions append-only for Supervisors", which matches your description. Please confirm it in the Firebase Console (Firestore → Rules → History).

**Evidence legend:** **Confirmed-Emulator** = reproduced against the rules in a local Firestore emulator. **Confirmed-Code** = proven by reading the full code path. **Suspected** = needs staging verification.

---

## Deliverable 1 — Architecture and attack-surface map

```
                      ┌─────────────────────────── Trust boundary: Internet ───────────────────────────┐
  Browser (Admin /    │                                                                                 │
  Supervisor /        │  Vercel (static SPA, React 19 + Vite 8)                                         │
  Farmer)             │   • index.html loads Firebase compat SDK 12.18.0 from www.gstatic.com (no SRI)  │
     │                │   • Firebase web config hard-coded in index.html (project farm-form)            │
     │                │   • vercel.json: SPA rewrite only, no security headers                          │
     │                └─────────────────────────────────────────────────────────────────────────────────┘
     │
     ├──(1) Firebase Auth (email/password) ───────────────► Firebase Auth (farm-form)
     │
     ├──(2) DIRECT Firestore SDK reads/writes ───────────► Cloud Firestore (farm-form)
     │      ~110 write call-sites, 13 realtime listeners      ▲  Enforced ONLY by firestore.rules
     │      • daily report submission + version 2 corrections │
     │      • farm inventory (birds/feed) updates             │
     │      • Feed Load add/edit/delete, flocks, notifications│
     │      • user status / farm allocation FALLBACK writes   │
     │                                                        │
     └──(3) HTTPS + Firebase ID token ──► Render: Express API │ (Admin SDK = bypasses rules)
            /api/v1/admin/*  (user mgmt, import/revert)       │
            /api/v1/reports/export-production-curve ──► spawns python (openpyxl) per request
            Unused but live: /reports/daily, /reports/daily/:id, /farms, /farms/:id, /flocks
                                                              │
            Service account (env FIREBASE_SERVICE_ACCOUNT_JSON / _BASE64 / file) ─┘

  Firebase Storage: rules deployed but the app never uses Storage.
  SMS/Email: not integrated (notification docs only carry "pending_provider/not_configured" states).
```

**Key architectural fact:** most business operations (report submission, stock arithmetic, report date window, version-2 corrections, Feed Load stock recalculation and notification generation) run **in the browser**. The backend handles only user management, historical import/revert and Excel export. So for those core flows, **Firestore Security Rules are the only server-side control**, and any authenticated user can call Firestore directly with their own ID token, bypassing every UI check.

**Trust boundaries:** (a) browser ↔ Firestore (rules); (b) browser ↔ Render API (ID-token verification with `checkRevoked=true` plus a live `users/{uid}` lookup); (c) Render ↔ Firestore (Admin SDK, full privilege); (d) developer machines ↔ production (seed/migration scripts point at `farm-form`).

---

## Deliverable 2 — Executive security summary

**What is solid**
- Backend authentication is done properly. Every non-health route verifies the Firebase ID token with revocation checking (`auth.middleware.ts:33`), then re-reads the user's role, `active` flag and `farmIds` from Firestore on every request. Nothing in the client is trusted for identity or role.
- All admin endpoints sit behind `authMiddleware` + `requireRole(ADMIN)` at router level (`admin.routes.ts:23-24`). Request bodies for account creation are strict Zod schemas, so no mass assignment is possible.
- Firestore rules block self-escalation (a user cannot change their own `role`, `farmIds`, `active` or `createdAt`) and block cross-farm **reads** of farms, reports and notifications.
- **All six stated security requirements hold**, and I verified each one in the emulator: Feed Load creator-only edit/delete (Admin and Supervisor both blocked on others' loads), farmers cannot create Feed Loads, feed transactions are append-only for Supervisors, notifications cannot be deleted, only Admin can resolve, and resolved notifications cannot be reopened.
- No XSS sinks (`dangerouslySetInnerHTML` / `innerHTML` / `eval`) exist in the frontend, and no private keys or service-account JSON appear anywhere in git history.

**What is not acceptable for a commercial ERP yet**
1. **Any active user who is assigned to at least one farm can overwrite or re-tag daily reports belonging to *any other farm*** (SAF-01, Confirmed-Emulator). This breaks tenant isolation for data integrity.
2. **Inventory and report business rules run only in the browser.** A farmer or supervisor can set their farm's feed stock and bird count to any number, append fake feed loads, and file back-dated reports (SAF-02, Confirmed-Emulator).
3. **Plaintext account credentials are committed to the monorepo's git history**, and a seed script hard-codes passwords for admin, supervisor and farmer accounts on the production project (SAF-03).
4. **The admin UI silently bypasses backend safety guards.** When the backend refuses a status or allocation change, the client writes to Firestore directly. That defeats the last-admin and self-deactivation protection, token revocation and audit logging (SAF-04).
5. **Deleting a farmer account permanently hard-deletes the farm and its history**, with silent partial failures (SAF-05).
6. **The deployed Firestore rules are not committed anywhere.** A redeploy from git would silently re-open Supervisor edit/delete on feed transactions (SAF-06).

None of these allow an **unauthenticated** attacker in, and none allow a non-admin to **become** admin. The dominant risk is **insider or compromised-account data tampering**, which matters greatly for an ERP whose output is the farm's operational and financial record.

---

## Deliverable 3 — Vulnerability register

CVSS 4.0 vectors are given where the evidence supports them. I have **not** computed numeric scores (no calculator was available offline); paste each vector into the FIRST CVSS 4.0 calculator. Severity is my assessment, without inflation.

### SAF-01 — Cross-farm overwrite and re-tagging of daily reports (BOLA in Firestore rules)
- **Severity:** High · **Status:** Confirmed-Emulator (probes R3, R5, R6)
- **Mapping:** CWE-639 (Authorization Bypass Through User-Controlled Key), CWE-863; OWASP API1:2023 BOLA; OWASP A01
- **CVSS 4.0 vector:** `AV:N/AC:L/AT:N/PR:L/UI:N/VC:N/VI:H/VA:L/SC:N/SI:N/SA:N`
- **Location:** `firestore.rules` → `match /dailyReports/{reportOrUserId}` (create/update) and nested `dailyLogs/{logDate}` and `revisions/{revId}` (live working copy, lines 93-96, 105-108, 117-120).
- **Root cause:** a write is allowed when `isOwner(reportOrUserId) || isAdmin() || hasFarmAccess(request.resource.data.farmId)`. The rule (a) checks only the **new** `farmId` and never the existing `resource.data.farmId`, and (b) lets the path owner write **any** `farmId`.
- **Attack scenario:** Farmer A (farm F1) uses the Firestore REST API with their own ID token to PATCH `dailyReports/{farmerB}/dailyLogs/2026-11-01` (farm F2), setting `farmId: "F1"` and `eggsProduced: 0`. The write succeeds. Farmer B's report disappears from F2's dashboards and exports, and fake data appears in F1. A supervisor of F1 can do the same to any farm. A farmer can also file reports under their own UID tagged with someone else's `farmId` (R3), which pollutes the other farm's analytics, rankings and Excel export.
- **Business impact:** falsified production records, farm rankings and incentive data across the whole tenant; silent loss of other farms' reports.
- **Recommended fix (rules only, backward compatible):** for `dailyLogs` and `revisions`:
  - create: `isAdmin() || (isOwner(reportOrUserId) && hasFarmAccess(request.resource.data.farmId))`
  - update: the same, plus `request.resource.data.farmId == resource.data.farmId`
  - Supervisors should not write to farmers' report paths. Confirm whether any supervisor UI writes reports; I found none, since `submitReport` requires `role == 'farmer'`.
- **Regression risk:** Medium. Historical import writes go through the Admin SDK and are unaffected. The farmer's own submission path (`dailyReports/{uid}/dailyLogs/{date}` with their own `farmId`) still passes. Re-run the farmer submission, version-2 correction and "submission over imported record" flows in the emulator.
- **Test to prove the fix:** emulator probes R3, R5 and R6 must return 403, while the farmer's own submission and correction still return 200.

### SAF-02 — Inventory and report business rules enforced only in the browser
- **Severity:** High · **Status:** Confirmed-Emulator (R1, R2, R4, R14, R15) + Confirmed-Code
- **Mapping:** CWE-602 (Client-Side Enforcement of Server-Side Security), CWE-345; OWASP API6:2023 (Unrestricted Access to Sensitive Business Flows), API3:2023 (BOPLA); OWASP A04
- **CVSS 4.0 vector:** `AV:N/AC:L/AT:N/PR:L/UI:N/VC:N/VI:H/VA:N/SC:N/SI:N/SA:N`
- **Location:** `firestore.rules` `farms/{farmId}` update (`isAdmin() || (isUserActive() && hasFarmAccess(farmId))`, no field restriction); `feedTransactions`/`birdTransactions` create (any farm user, unvalidated content); `flocks` update (farm users may change `currentBirds`, `totalMortality`, `totalEggs` …); `dailyReportLocks` create/update; no date constraint on `dailyLogs`. Client logic lives in `src/services/reportService.ts:444-1030` (`submitReport`) and `src/services/inventoryService.ts:240-660`.
- **Root cause:** the date window ("today/yesterday"), mortality ≤ birds, stock ≥ feed used, version numbering and opening/closing balances are all computed inside a browser-side `runTransaction`. The rules don't constrain the resulting values.
- **Attack scenario:** a farmer sets `farms/F1.currentFeedKg = 999999` and `currentBirdCount = 1` (R1) to hide feed theft or bird loss. They can append a fake `FEED_LOAD` feed transaction of 5,000 kg (R15) or file a report dated a year ago (R4). A supervisor can rename a farm or zero its stock (R2).
- **Business impact:** inventory fraud (feed is the main cost driver), with misleading KPIs and predictions.
- **Recommended fix:**
  - **Short term (rules, compatible):** for non-admins, allow-list the fields that may change on `farms/{id}` (`currentBirdCount`, `currentFeedKg`, `totalFeedConsumedKg`, `totalFeedLoadedKg`, `inventoryUpdatedAt`, `updatedAt`, `lastTransactionDate`). Forbid `name`, `active`, `initial*`, `preservedAvg*` and `inventoryInitialized`. Require that a farm-stock change by a farmer is accompanied in the same transaction by a `dailyLogs` write (`existsAfter`/`getAfter`), and constrain `transaction.type` to `FEED_USAGE`/`MORTALITY`/`CULLING` for farmers (no `FEED_LOAD`). Restrict `dailyLogs/{logDate}` so that `logDate` and `submissionDate` match and fall within a server-time window (`request.time`).
  - **Medium term (architectural, see Deliverable 11, batch B10):** move report submission and Feed Load stock maths into backend endpoints (the unused `POST /reports/daily` is the natural home). Then make farm inventory fields admin-SDK-only.
- **Regression risk:** High if rushed. Inventory writes come from several flows (initial submission, correction, submission over import, Feed Load add/edit/delete). Each must be exercised in the emulator before deployment.
- **Test:** emulator probes R1, R2, R4, R14 and R15 return 403; existing `inventoryService.test.ts` and `reportService` flows still pass against the emulator.

### SAF-03 — Plaintext credentials committed to git; hard-coded passwords in a production seed script
- **Severity:** High. **Critical if** the monorepo `Sri-Ram-git/SAI_Happy_Farm_ERP` is public or has been shared, **and** the credentials are still valid. · **Status:** Confirmed-Code (validity not tested, deliberately)
- **Mapping:** CWE-798, CWE-312, CWE-540; OWASP A07 / A02
- **Location:**
  - `SAI_Happy_Farms_Credential_Handover_Sheet.docx` (repo root). Added in commit `ee596ea` (2026-10-08) and reachable from `origin/master` and most local branches. It contains several username/password pairs (5 password entries). **Values redacted; I did not reproduce them.**
  - `scripts/seed-users.mjs`: `projectId: 'farm-form'` (production), with hard-coded emails and passwords for farmer, supervisor and **admin** test accounts. It creates them with `emailVerified: true`.
- **Not affected:** the deployed frontend and backend repos contain no credentials. The Firebase web `apiKey` appears in `index.html` and `src/config/firebase.ts`. That key is **public client configuration by design**: it identifies the project and does not grant access, which the rules enforce. No service-account private key or `private_key_id` appears in any commit.
- **Attack scenario:** anyone with read access to the repo or its history signs in as a listed account. If an admin pair is still valid, they get full ERP control, including the destructive operations in SAF-05.
- **Recommended fix:** (1) **Today:** rotate every password listed in the sheet and in `seed-users.mjs`, and delete or disable the seed test accounts in `farm-form` if they exist. (2) Check the GitHub visibility of all four repos (the `gh` CLI isn't installed here, so I couldn't). (3) Remove the docx and the passwords from the working tree. Purge them from history (`git filter-repo`), which requires a coordinated force-push that you must approve, and rotate first regardless. (4) Make seed scripts read credentials from env vars and refuse to run against `farm-form`.
- **Regression risk:** Low (operations only). Coordinate the password change with the affected users.
- **Test:** `git log --all -- SAI_Happy_Farms_Credential_Handover_Sheet.docx` returns nothing after the purge; secret scanning (gitleaks/trufflehog, if you adopt one) passes in CI; old passwords fail to sign in.

### SAF-04 — Admin client bypasses backend safety guards via direct-Firestore fallback
- **Severity:** Medium · **Status:** Confirmed-Code
- **Mapping:** CWE-602, CWE-284; OWASP A04 (Insecure Design)
- **Location:** frontend `src/services/userDataService.ts` → `updateUserStatus()` (lines ~85-108) and `updateSupervisorAllocation()` (lines ~277-305).
- **Root cause:** on **any** non-2xx response (including deliberate `400 ValidationError` refusals), the client falls back to `db.collection('users').doc(uid).update(...)`. Admin rules permit that write.
- **Concrete failure:** the backend refuses "You cannot deactivate your own administrator account" and "Cannot deactivate the last remaining active administrator" (`farmer.service.ts:360-380`). The UI then performs the deactivation anyway. **Every admin can be locked out**, and recovery requires the Firebase Console. Also skipped: refresh-token revocation (`farmer.service.ts:388-403`) and the audit log entry. For allocations, the backend's "only supervisor accounts" and "farm must exist" checks are bypassed, so an admin can give a **farmer** access to extra farms with no audit record.
- **Recommended fix:** remove both fallbacks and surface the backend error to the admin. If an offline fallback is truly needed, use it only on network errors (`TypeError` from `fetch`), never on HTTP 4xx.
- **Regression risk:** Low. User status changes fail visibly while the backend is down (Render cold start); the UI should show a retry.
- **Test:** unit test with mocked `fetch` returning 400 asserting no Firestore write; manual staging test that self-deactivation is refused.

### SAF-05 — Irreversible cascade hard-delete of farm history on farmer deletion, with silent partial failure
- **Severity:** Medium (security) / High business impact · **Status:** Confirmed-Code
- **Mapping:** CWE-460, CWE-1188 (insecure default), OWASP A04
- **Location:** backend `src/services/userService.ts` → `deleteUserAccount()` lines 311-539; route `DELETE /api/v1/admin/users/:uid`.
- **Root cause:** a single admin request permanently deletes `farms/{id}`, its `feedTransactions`, `birdTransactions`, `flocks`, `dailyReportLocks`, root `dailyReports` and the farmer's `dailyReports/{uid}/dailyLogs`. There is no soft delete, no export or backup, and no second approval. Each step catches errors and continues (`logger.warn`), and every sub-collection is deleted in **one** `batch()`. Firestore batches cap at 500 writes, so a farm with more than 500 feed transactions or reports fails that step silently, yet the farm document is still deleted. Not deleted, and so orphaned: `revisions` sub-collections, `logs/{farmId}/feedLogs`, `flockLogs`, and reports submitted by others for that farm.
- **Attack scenario:** a compromised admin account, or a mis-click, destroys years of a farm's records in seconds. A 500+ document farm ends up in an inconsistent half-deleted state.
- **Recommended fix:** change deletion to **deactivate + archive** (`active:false`, `deletedAt`, `deletedBy`), and keep data. If hard delete is a business requirement, require a typed confirmation (like the import revert), write a JSON backup to an admin-only location first, chunk deletes at ≤ 400 operations, and abort on the first failure. Enable Firestore **PITR / scheduled exports** as an operational safety net.
- **Regression risk:** Medium. The Admin Users page expects deletion semantics. Keep the endpoint contract and change only the server behaviour, or add a new endpoint.
- **Test:** emulator integration test with 600 feed transactions that asserts either complete deletion or no deletion; test that the user is deactivated and the data retained under the soft-delete design.

### SAF-06 — Deployed Firestore rules not version-controlled; security contract tests cannot run
- **Severity:** Medium · **Status:** Confirmed-Code
- **Mapping:** OWASP A05 / A08 (configuration and integrity of deployment artefacts)
- **Evidence:** the monorepo checkout has `M firestore.rules` and `M firebase/firestore.rules`. The only change is `feedTransactions` update/delete going from `isAdmin() || (supervisor && hasFarmAccess)` to `isAdmin()`, which is the "append-only for Supervisors" requirement. No commit on any branch contains this version. Neither the frontend nor backend repo contains rules at all. In the backend repo, 4 of 28 test files (including the `firestoreRules.contract`, `firstSubmissionModal.contract` and `farmerPortalConnection` security tests) fail to load because they read `../../../firestore.rules` and frontend files that only exist in the monorepo layout.
- **Impact:** the next `firebase deploy` from any committed source re-opens Supervisor edit and delete on feed transaction history. CI gives false assurance.
- **Fix:** commit the deployed rules (with `firebase.json`, `storage.rules` and `firestore.indexes.json`) to one canonical repo. Add an emulator rules test suite (the probe in Appendix A is a starting point) and run it in CI. Fix the test paths.
- **Regression risk:** None (repository hygiene).
- **Test:** CI job runs `firebase emulators:exec` with the rules tests; all 4 currently broken test files load.

### SAF-07 — Excel export: unbounded full-database scans and a Python process per request, open to every role
- **Severity:** Medium · **Status:** Confirmed-Code (not load-tested)
- **Mapping:** CWE-400, CWE-770; OWASP API4:2023 (Unrestricted Resource Consumption)
- **Location:** `GET /api/v1/reports/export-production-curve` → `reports.controller.ts:68-159`, `reports.service.ts:75-254`, `reports.repository.ts:118-175`.
- **Root cause:** each call reads the **entire** `collectionGroup('dailyLogs')`, `dailyReports`, `farms` and `flocks` collections, filters in memory, writes temp JSON to `scratch/`, and spawns `python`. There is no date-range cap and no per-user limit (only the global 100 requests per 15 minutes per IP). Temp files are not removed when Python fails. Farmers are allowed to export their own farm, so every farmer can trigger whole-database reads.
- **Secondary issues:** the client receives Python `stderr` (up to 200 characters) inside the 500 error message (`reports.service.ts:252`), which is information leakage (CWE-209). "No reports found" is returned as HTTP 500. `flockMap` keeps only the **last** flock per farm, so curves are wrong for multi-flock farms (correctness).
- **Fix:** query `dailyLogs` with `where('farmId','in',…)` and `where('submissionDate','>=',start)` (needs a collection-group index). Cap the range (for example 366 days), add a per-user rate limit (for example 5 per minute), run cleanup in `finally`, return a generic error message, and return 404 for "no data".
- **Regression risk:** Medium. Old-format reports with `reportDate` instead of `submissionDate` need a backfill or dual query. Verify the export AVG rows (recent fix area) against golden files.
- **Test:** export-output golden test (the `productionExportAvg.test.ts` pattern); load test in staging (see Deliverable 7).

### SAF-08 — Supervisors can read every user profile in the system
- **Severity:** Medium · **Status:** Confirmed-Emulator (R8)
- **Mapping:** CWE-359; OWASP API3:2023
- **Location:** `firestore.rules` `users/{userId}` read: `request.auth.uid == userId || isSupervisor()`.
- **Impact:** any supervisor can enumerate names, emails, phone numbers, roles and farm assignments of all farmers, supervisors and admins, including those on farms they don't manage.
- **Fix:** `resource.data.farmIds.hasAny(getUserData().farmIds)` for supervisors. List queries must then include `where('farmIds','array-contains-any', myFarms)`. Check `FeedLoadPage.tsx` (users map for "recorded by") and the supervisor screens.
- **Regression risk:** Medium (query shape changes on supervisor pages).
- **Test:** emulator R8 returns 403; supervisor pages still render recorder names for their farms.

### SAF-09 — Audit-trail and version-history integrity gaps
- **Severity:** Medium · **Status:** Confirmed-Emulator (R7, R9, R10) + Confirmed-Code
- **Mapping:** CWE-778, CWE-284; OWASP A09
- **Evidence:** admins can **edit and delete** `auditLogs` (R9). Any authenticated user, **including deactivated ones**, can create audit entries with arbitrary content (R10). Report `revisions` (the version-2 correction archive) can be **rewritten** by the report owner and farm users (R7), and admins can delete them. Backend audit writes are best-effort: failures are swallowed in `audit.service.ts:26-33`. Client-side audit entries for Feed Loads are written by the browser, so they are forgeable. Report submission records no `auditLogs` entry at all.
- **Fix:** `auditLogs`: `allow update, delete: if false;` create requires `isUserActive()` and `request.resource.data.timestamp == request.time`. `revisions`: create-only (no update, no delete except admin through backend tooling). Longer term, write audit events server-side, or export them to an append-only sink (Cloud Logging / BigQuery export).
- **Regression risk:** Low–Medium. Check that no flow updates an existing revision; `imported_v1` uses `set` and may be re-written on a repeat submission.
- **Test:** emulator R7, R9 and R10 return 403; correction flow still creates new revision docs.

### SAF-10 — Vulnerable and unnecessary dependencies
- **Severity:** Medium · **Status:** Confirmed (`npm audit --package-lock-only` on the release lockfiles)
- **Frontend (3 high):** `xlsx 0.18.5`, with prototype pollution (GHSA-4r6h-8v6p-xvw6) and ReDoS. **No npm fix**; SheetJS publishes patched builds (0.20.x) only from its own CDN. It parses admin-uploaded spreadsheets in `AdminImportPage` / `historicalImportService`, so a malicious workbook could pollute prototypes in an admin's session. Also `vite` (dev server issues; build-time only) and `source-map-js`.
- **Backend runtime (fix available):** `body-parser` (DoS, GHSA-27r3-jxmh-p828), `proxy-addr` (IP spoofing with trust subnets, GHSA-jqcg-44mw-7w3h; low impact here because `trust proxy` is a hop count), `node-forge` (signature verification issues), `@grpc/grpc-js`, `zod` (memory exhaustion on oversized collections), `qs`, `uuid`. **Dev-only:** `vitest`/`tinypool` (critical but test-time only), `vite`, `@typescript-eslint/*`, `esbuild`.
- **Unnecessary:** the backend declares the **client** SDK `firebase@^12` but never imports it. Remove it to shrink the attack surface; it's also the source of the `@firebase/firestore` advisories.
- **Totals:** backend 32 (3 critical, 18 high, 11 moderate), frontend 3 high.
- **Fix:** see batch B6. Apply non-major upgrades first, then majors (`firebase-admin` 13, `vitest` 3/4, `zod` 4) in a separate batch with the full test suite.
- **Regression risk:** Medium for majors (`firebase-admin`, `zod` 4 API changes).

### SAF-11 — No production/staging separation; production project hard-coded
- **Severity:** Medium · **Status:** Confirmed-Code
- **Mapping:** OWASP A05; ASVS V14.1
- **Evidence:** `index.html` initialises Firebase with the `farm-form` config regardless of `.env`. `vite.config.ts` only **warns** when `VITE_API_URL` is missing or localhost. Ten call sites fall back to `http://localhost:3000` (`userDataService.ts`, `historicalImportService.ts`, `excelExportService.ts`), so a mis-configured build ships and fails at runtime. `scripts/seed-users.mjs`, `scripts/initializeFarmInventory.mjs`, `scripts/seed-flocks.mjs`, `frontend/scripts/migrateFarmInventory.ts` and backend `src/check_user.ts` (hard-coded flock ID, compiled into `dist/`) all target production.
- **Impact:** local development and testing writes to live customer data; a mistaken script run mutates production.
- **Fix:** create a `farm-form-staging` project. Read the Firebase config from `VITE_FIREBASE_*` (already in `.env.example`). Make the build **fail** when `VITE_API_URL` is unset in production. Guard scripts with an explicit `--project`, and refuse `farm-form` without a confirmation flag.
- **Regression risk:** Medium (deployment configuration). Validate on a Vercel preview first.

### SAF-12 — Rate limiting: per-instance, IP-keyed, globally shared budget
- **Severity:** Low · **Status:** Suspected (behaviour depends on Render's proxy chain)
- **Mapping:** CWE-770, CWE-307
- **Location:** `rateLimit.middleware.ts`; `index.ts:25` (`trust proxy` = 1).
- **Issue:** a single 100-requests-per-15-minutes budget per IP covers *all* API calls, held in memory per instance. If the hop count is wrong, either every user shares Render's proxy IP (self-DoS during an import or export session) or `X-Forwarded-For` can be spoofed to bypass it. The client-side login limiter (`rateLimitService.ts`, `localStorage`) is cosmetic. Firebase Auth's own abuse protection is the real control for logins.
- **Test (staging):** log `req.ip` and `req.ips` for two known clients and confirm they differ and can't be spoofed with a forged `X-Forwarded-For`.

### SAF-13 — Notification spoofing and pre-resolved alerts
- **Severity:** Low · **Status:** Confirmed-Emulator (R11, R12)
- **Mapping:** CWE-345; API6
- **Issue:** farmers can create `CRITICAL` notifications with arbitrary title and message (React escapes them, so no XSS, but they enable social engineering and alert fatigue). Supervisors and farmers can **create** a notification already marked `resolved:true, resolvedBy:<adminUid>`, which sidesteps "only Admin can resolve" at creation time. Notifications are generated by browser code, so a user can also simply suppress them.
- **Fix:** on non-admin create, require `resolved == false` (or absent) and no `resolved*` fields; cap `title`/`message` length. Longer term, generate alerts server-side (Cloud Function trigger on `dailyLogs`).
- **Test:** emulator R12 returns 403.

### SAF-14 — Over-permissive Storage rules (Storage unused)
- **Severity:** Low · **Status:** Confirmed-Code
- **Issue:** `storage.rules` lets **any** authenticated user, of any farm and even deactivated, read and write `farms/{anyFarm}/**` (≤ 10 MB) and read every `users/**` and `exports/**`. There's no content-type check. The app never uses Storage (0 references), so this is pure attack surface (free file hosting and cost abuse).
- **Fix:** deny all until Storage is needed, then scope by `firestore.get(...)` farm membership.

### SAF-15 — Legacy, unused or broken backend endpoints
- **Severity:** Low · **Status:** Confirmed-Code
- **Issues:**
  - `POST /api/v1/reports/daily` is unused by the frontend. Its duplicate-lock check reads with `lockRef.get()` **outside** the transaction (`reports.repository.ts:22`), so concurrent submissions can create duplicates (race, CWE-362). It also writes a schema different from the live `dailyLogs` model.
  - `GET /reports/daily/:id` returns 404 vs 403, which is an existence oracle.
  - `POST /flocks` and `PATCH /flocks/:id/status` validate against schemas nested under `body:`/`params:`, but `validateBody` parses `req.body` directly. The endpoints therefore always reject correct payloads, or would read `undefined` fields.
  - `GET /farms`, `GET /farms/:id` and `GET /admin/users` (returns full user docs) are unused.
- **Fix:** remove the unused routes, or fix and cover them with tests. The proper server-authoritative report endpoint should be designed in batch B10, not revived as is.

### SAF-16 — Missing browser security headers on Vercel; third-party script without SRI
- **Severity:** Low · **Status:** Suspected (I did not request production URLs; verify with `curl -I` against the Vercel domain)
- **Issue:** `vercel.json` defines no headers. The headers in `firebase.json` apply only to Firebase Hosting, which production doesn't use. There's no CSP, no `frame-ancestors`/`X-Frame-Options` (the admin UI could be framed for clickjacking) and no `Permissions-Policy`. Firebase compat SDKs load from gstatic without Subresource Integrity.
- **Fix:** add headers in `vercel.json`, with CSP first in `Content-Security-Policy-Report-Only` (allow `self`, `www.gstatic.com`, `*.googleapis.com`, `*.firebaseio.com`, the Render API origin and Google Fonts). Longer term, bundle the modular Firebase SDK through npm instead of the CDN compat build.

### SAF-17 — Data integrity defects in user creation and admin guards
- **Severity:** Low · **Status:** Confirmed-Code
- **Issues:** `farmer.service.ts:134` stores `phone_no: Number(input.phone_no)`, so a value like `+91 98…` (valid per the validator) becomes `NaN` and the leading `+`/0 is lost, which also breaks duplicate-phone detection. Duplicate email, phone and farm-name checks are check-then-act races; email is still protected by Firebase Auth uniqueness. The last-admin check is not transactional (two admins can deactivate each other concurrently). PII (email, phone) is written to logs at warn and info level.
- **Fix:** store phone as a normalised E.164 string; perform the last-admin check inside a transaction; redact PII in logs.

### SAF-18 — Users can add arbitrary fields to their own profile (denylist rule)
- **Severity:** Informational · **Status:** Confirmed-Emulator (R13)
- **Issue:** the self-update rule is a **denylist**. A user can add e.g. `farmId` (singular), which backend deletion and import code read as a fallback when `farmIds` isn't an array. That isn't exploitable today because `farmIds` is always a protected array, but it's fragile.
- **Fix:** convert to an allowlist (`affectedKeys().hasOnly(['name','phone_no','language','updatedAt', …])`).

### SAF-19 — Historical import: non-atomic multi-batch writes and an unbounded batch record
- **Severity:** Low (admin-only) / scalability risk · **Status:** Confirmed-Code
- **Issue:** `executeImport` commits in chunks of 300, then writes **one** `importBatches/{id}` document containing `manifest`, `overwrittenRecords` (full previous data) and `errors`. A large import can exceed Firestore's 1 MiB document limit **after** the data is committed. That leaves imported data with no batch record, so revert is impossible. The `REVERTING` guard is check-then-set (not transactional). Import schemas have no `max()` on `records` or string lengths (the body limit is 10 MB).
- **Fix:** store manifest and overwrite snapshots in a sub-collection; write a `PENDING` batch record before data; cap the records per request; make the revert lock transactional.

### Positive controls verified (not findings)
Emulator controls C1–C12 all **DENIED** as required. Backend `authMiddleware` verifies revocation and the live `active` flag. Strict Zod on account creation. `.gitignore` excludes `.env` and `service-account.json`. Production Vite build strips `console.log`/`debug`/`info`. The dev notification route is gated by `import.meta.env.DEV`. Firestore rules check `active == true` on every path, so deactivation takes effect immediately even before token expiry.

---

## Deliverable 4 — Endpoint security matrix (backend `d7607bb`)

| # | Method & path | AuthN | Role check | Ownership / farm check | Input validation | Used by FE | Notes / findings |
|---|---|---|---|---|---|---|---|
| 1 | GET `/health`, GET `/` | none | – | – | – | – | Version disclosure only (low) |
| 2 | GET `/api/v1/reports/export-production-curve` | ✔ token + revocation | any active role | non-admin: `farmId` ∈ own `farmIds` (else all own farms) | date regex only | ✔ | SAF-07 |
| 3 | POST `/api/v1/reports/daily` | ✔ | any role | `requireFarmAccess(body.farmId)` | strict Zod + business rules; 10/min limiter | ✘ | SAF-15 (race) |
| 4 | GET `/api/v1/reports/daily/:id` | ✔ | any | post-fetch `farmIds` check | none on `:id` | ✘ | SAF-15 (oracle) |
| 5 | GET `/api/v1/farms` | ✔ | any | returns own farms (admin: all) | – | ✘ | unused |
| 6 | GET `/api/v1/farms/:farmId` | ✔ | any | `requireFarmAccess` | – | ✘ | unused |
| 7 | POST `/api/v1/flocks` | ✔ | admin | farm existence **not** checked (transaction `set` with merge would create a farm doc) | mis-shaped schema | ✘ | SAF-15 (broken) |
| 8 | PATCH `/api/v1/flocks/:flockId/status` | ✔ | admin | – | mis-shaped schema | ✘ | SAF-15 (broken) |
| 9 | GET `/api/v1/admin/users` | ✔ | admin | – | – | ✘ | returns full user docs |
| 10 | DELETE `/api/v1/admin/users/:uid` | ✔ | admin | self-delete and last-admin guard | – | ✔ | SAF-05 |
| 11 | PATCH/PUT `/api/v1/admin/users/:uid/status` | ✔ | admin | self and last-admin guard; revokes tokens | strict Zod | ✔ | SAF-04 (client bypass) |
| 12 | POST `/api/v1/admin/users/farmer` | ✔ | admin | farm ID/name uniqueness (racy) | strict Zod | ✔ | SAF-17 |
| 13 | POST `/api/v1/admin/users/supervisor` | ✔ | admin | farms must exist | strict Zod | ✔ | – |
| 14 | POST `/api/v1/admin/users/admin` | ✔ | admin | – | strict Zod | ✔ | consider second-admin approval (Deliverable 6) |
| 15 | PATCH `/api/v1/admin/users/supervisor/:uid/farms` | ✔ | admin | target must be supervisor; farms must exist | strict Zod | ✔ | SAF-04 (client bypass) |
| 16 | POST `/api/v1/admin/import/check-conflicts` | ✔ | admin | farm existence | Zod (no array max) | ✔ | full collection-group scan |
| 17 | POST `/api/v1/admin/import/execute` | ✔ | admin | farm existence; farmer mapping | Zod (no array or string max) | ✔ | SAF-19 |
| 18 | GET `/api/v1/admin/import/batches` | ✔ | admin | – | – | ✔ | `limit(50)` |
| 19 | GET `/api/v1/admin/import/batches/:batchId` | ✔ | admin | – | – | ✘ | – |
| 20 | GET `/api/v1/admin/import/batches/:batchId/revert-preview` | ✔ | admin | – | – | ✔ | – |
| 21 | POST `/api/v1/admin/import/batches/:batchId/revert` | ✔ | admin | typed batch-ID confirmation | Zod | ✔ | racy lock (SAF-19) |

**Important:** the most sensitive operations are **not** in this table. Report submission, corrections, Feed Load create/edit/delete, inventory updates, flock management and notification create/resolve all go **directly to Firestore** and are governed only by the rules (Deliverable 5).

---

## Deliverable 5 — Firestore security assessment (collection by collection)

| Collection / path | Client read | Client write (live rules) | Admin SDK writers (bypass rules) | Assessment |
|---|---|---|---|---|
| `users/{uid}` | self; **any supervisor reads all** | admin full; self denylist update | user creation, status, allocation, delete | SAF-08, SAF-18, SAF-04 |
| `farms/{farmId}` | farm members (active) | admin create/delete; **any farm member updates any field** | farmer creation, flock creation, import (`preservedAvg`), delete cascade | **SAF-02** |
| `farms/*/feedTransactions` | farm members | any farm member **creates** (content unvalidated); update/delete admin only (working copy) | farmer creation, import, delete cascade | append-only holds (C11b); fake entries possible (R15); SAF-06 |
| `farms/*/birdTransactions` | farm members | any farm member creates; update/delete admin | flock creation, delete cascade | same as above |
| `flocks/{id}` | farm members | admin create/delete; farm members update counters (identity fields locked) | flock/farmer creation, import, delete | counters forgeable (SAF-02) |
| `dailyReports/{uid}` (parent) and `/dailyLogs/{date}` | owner, admin, farm members | **owner writes any farmId; anyone writes if new farmId is theirs** | import, delete cascade | **SAF-01**, SAF-02 (no date/value constraints) |
| `…/dailyLogs/*/revisions/*` | same | same, **mutable** | – | SAF-01, SAF-09 |
| collection-group `dailyLogs`, `revisions` (read) | admin; farm members for matching `farmId` docs | – | export, import (full scans) | sound for reads, but `farmId` is writer-controlled (SAF-01) |
| `dailyReportLocks/{id}` | admin, farm members | farm members create/update | import, backend report API, delete cascade | locks forgeable/clearable by farm users (R14), so duplicate prevention is advisory |
| `auditLogs/{id}` | admin | any authenticated (even inactive) creates with own `userId`; **admin update/delete** | backend audit service | SAF-09 |
| `importBatches/{id}` | admin | admin | import service | OK (admin-only); SAF-19 size limit |
| `logs/{farmId}` (+ `feedLogs`, `flockLogs`) | farm members | feedLogs: creator-only update/delete, supervisor or admin create; flockLogs admin-only | farmer creation, import | **matches requirements** (C3–C6) |
| `notifications/{id}` | admin; supervisors of the farm | create by admin, supervisor (farm) or farmer (farm, limited sources); updates: admin resolution one-way, readBy self-append; **delete denied** | – | requirements hold (C7, C8); SAF-13 |
| Storage `farms/**`, `users/**`, `exports/**` | any authenticated | any authenticated (farms), self (users) | – | SAF-14 |

**Admin SDK paths:** every privileged backend write is reachable only through `/api/v1/admin/*` (admin role, verified per request) or `POST /reports/daily` and the export (farm-checked). I found no backend route where a non-admin can reach an Admin SDK write on another farm's data. The privileged-path risk is **insider/admin misuse** (SAF-05) and the **broad service account** (Deliverable 6), not missing authorization checks.

**Rule cost note:** `isUserActive()`/`hasRole()` call `get(users/{uid})` several times per evaluation. Firestore de-duplicates identical `get()`s within one request, and the 10/20 document-access limits are not exceeded by current transactions. Keep this in mind when adding `getAfter()` checks (SAF-02 fix).

---

## Deliverable 6 — Internal threat assessment

| Compromised / malicious account | What it can do today | Detectability | Key mitigations |
|---|---|---|---|
| **Farmer** | Rewrite own farm inventory to any value (R1); append fake feed/bird transactions (R15); back-date or alter any of own reports, and rewrite their revision history (R4, R7); **overwrite or re-tag any other farm's daily reports system-wide** (R5); inject reports into other farms' analytics (R3); send arbitrary CRITICAL alerts to admins (R11); trigger full-DB exports repeatedly (SAF-07) | Low: no server-side audit of report writes; `updatedAt` is client-supplied | SAF-01, SAF-02, SAF-09 rule fixes; server-side submission (B10) |
| **Supervisor** | Everything a farmer can do for assigned farms, plus rename farms, zero stock (R2), overwrite reports of **unassigned** farms (R6), read every user's PII (R8), create pre-resolved alerts (R12). Cannot edit others' Feed Loads or feed transaction history (verified) | Low | SAF-01, SAF-02, SAF-08, SAF-13 |
| **Admin** | Full user management, including creating more admins with no second approval; permanent deletion of a farm's history (SAF-05); edit and delete audit logs (R9); bypass guards via the client fallback (SAF-04); import with `replace` to overwrite history (snapshots retained in `importBatches`, revertible) | Medium: backend writes `auditLogs`, but the admin can delete them | Immutable audit logs; soft delete; alert on admin creation and deletions; consider two-person approval **only** for admin creation and hard deletes (low frequency, high impact, so minimal business friction) |
| **Backend service account** (Render env leak, Render account compromise) | Full read/write of all Firestore and Auth (Admin SDK), including deleting all users | Only GCP audit logs | Least-privilege custom IAM role (Firestore user + Firebase Auth admin, not Owner/Editor); key rotation schedule; Render account 2FA; consider Workload Identity Federation instead of a long-lived JSON key |
| **Developer machine** | Seed and migration scripts write to production (SAF-11); handover credentials in git (SAF-03) | None | SAF-03, SAF-11 |

**Account lifecycle:** deactivation is effective. Rules and backend both re-check `active`, and the backend revokes refresh tokens (except via the SAF-04 fallback). Deleted users lose Auth immediately. There is no detection of suspicious activity (mass edits, off-hours admin actions); Cloud Logging alerting on `auditLogs` writes of type `USER_DELETED` / `ADMIN_CREATED` is a cheap first step.

---

## Deliverable 7 — Scalability and hard-coding assessment

**Can it grow without a rewrite?** Yes. The Firestore data model (per-user `dailyLogs`, per-farm sub-collections) scales. The bottlenecks are **query patterns** that read entire collections, which can be fixed incrementally.

### Bottlenecks (all Confirmed-Code; no load test performed)
| Area | Location | Behaviour | Growth effect |
|---|---|---|---|
| Admin/Supervisor dashboards | FE `reportDataService.ts:49,108` | `collectionGroup('dailyLogs').get()` **and** an unfiltered realtime `onSnapshot` over all logs | Reads per dashboard open ≈ total report count (illustration: 50 farms × 365 days ≈ 18k reads per open, per admin) |
| Users, farms, flocks listeners | FE `userDataService.ts:133`, `farmDataService.ts:69`, `flockDataService.ts:79` | unfiltered listeners; 13 `onSnapshot` and only 1 `.limit()` in the whole frontend | linear in collection size × open sessions |
| Excel export | BE `reports.repository.ts:129,146`, `reports.service.ts:94,107` | full scans of 4 collections + Python process per call | latency and memory grow with total history, not the requested range |
| Import | BE `import.service.ts:78,262,1386` | full collection-group scans; one batch doc holding all manifests | 1 MiB document ceiling (SAF-19) |
| Farmer deletion | BE `userService.ts:352,444` | loads all farmers and supervisors; single-batch deletes | breaks above 500 docs (SAF-05) |
| Rate limiter | BE `rateLimit.middleware.ts` | in-memory, single instance | resets on restart; not shared if Render scales out |
| Concurrency | FE `submitReport` / `inventoryService` transactions on `farms/{id}` | single document hot-spot per farm | fine at 1 write/sec/farm; Feed Load + report at the same moment simply retries |

### Hard-coded assumptions
| Value | Location | Class | Recommendation |
|---|---|---|---|
| Firebase project `farm-form` config | FE `index.html`, scripts | arbitrary/environment | env-driven (SAF-11) |
| `http://localhost:3000` API fallback ×10 | FE services | arbitrary | fail the build when `VITE_API_URL` is missing |
| `initialBirds` fallback 1000/1200, `startWeek` 17, start date `2026-01-01` | BE `reports.service.ts:101,115-116,169-175` | arbitrary | fail loudly or mark the row "unknown" rather than fabricate curve data |
| Egg weight 30–80 g, body weight 500–3000 g, temp 10–50 °C, ammonia ≤ 50 ppm, eggs ≤ 95% of birds | BE `report.validator.ts`, `types/reports.ts`; FE `formValidation.ts`/`validationRules.ts` | **business limits** (legitimate) | keep, but put them in one shared config and enforce them server-side or in rules too (today the live flow enforces them only in the browser) |
| Today/yesterday report window | FE `reportService.ts:26,448` | **business/security limit** | enforce in rules with `request.time` (SAF-02) |
| Rate limit 100 / 15 min, report 10/min | BE env plus hard-coded limiter | **infrastructure/security limit** | keep env-configurable; key per user, not per IP |
| JSON body 10 MB; import chunk 300 ops | BE `index.ts:52`, `import.service.ts:279` | infrastructure | reasonable; add `records.max()` |
| `limit(50)` import batches | BE `import.service.ts:780` | arbitrary pagination | add cursor pagination |
| Firestore `in` chunks of 10 | BE `farms.repository.ts:39` | platform limit (now 30) | fine |
| Hard-coded flock ID | BE `src/check_user.ts:11` | debug artefact | remove from `src/` (it compiles into `dist/`) |

### How to measure safely (recommended, not executed)
Use a **staging** Firebase project seeded with synthetic data (for example 100 farms × 2 years of daily logs). Run k6 or Artillery against a staging Render service at gradually increasing virtual users, covering login, dashboard load, report submission and export. Record Firestore reads per action (Cloud Monitoring `document/read_count`), p95 latency, Render memory and CPU, and Python export duration. Never run this against `farm-form`.

---

## Deliverable 8 — Dependency and secrets assessment

**Dependencies:** see SAF-10. Summary: frontend 3 high (`xlsx` is the only runtime-relevant one, and it has no npm fix). Backend 32 total: runtime-relevant are `body-parser`, `proxy-addr`, `node-forge`, `@grpc/grpc-js`, `zod`, `qs`, `uuid`, `google-gax` chain (via `firebase-admin@12`) and the unused `firebase` client SDK. Critical items (`vitest`, `tinypool`) are dev-only and are not deployed, because Render runs `node dist/index.js`, but they matter on developer machines.

**Secrets** (values never printed or reproduced):
| Item | Location | Classification | Action |
|---|---|---|---|
| Username/password pairs | monorepo `SAI_Happy_Farms_Credential_Handover_Sheet.docx` (commit `ee596ea`, many branches) | **Dangerous: real credentials** | rotate now; purge history (SAF-03) |
| Test account passwords (admin, supervisor, farmer) | monorepo `scripts/seed-users.mjs` targeting `farm-form` | **Dangerous** if the accounts exist | disable/rotate; env-driven |
| Firebase web `apiKey`, `appId`, `messagingSenderId` | FE `index.html`, `src/config/firebase.ts` (all branches) | **Expected public configuration**; access is controlled by rules and Auth | optional: restrict the key's HTTP referrers in Google Cloud Console and enable **App Check** to curb scripted direct-Firestore abuse |
| Service-account credentials | **not found** in any commit; loaded from Render env `FIREBASE_SERVICE_ACCOUNT_JSON`/`_BASE64` | Correct pattern | verify the IAM role is least-privilege; document a rotation cadence |
| `.env` files | not committed (only `.env.example`); `.gitignore` correct | OK | – |

**Limitation:** I scanned `.docx` files and all text in git history. I did **not** OCR or parse the PDFs in `official_documentaion/`; review them manually for screenshots of credentials.

---

## Deliverable 9 — Prioritised remediation roadmap

| Priority | Items | Why |
|---|---|---|
| **P0 — immediate (no code required to start)** | SAF-03 rotate leaked credentials, disable seed accounts, check repo visibility · SAF-06 commit the deployed rules and verify them against ruleset `d4d069c2…` | Credential exposure; risk of silently regressing the append-only guarantee |
| **P1 — high** | SAF-01 report write binding (rules) · SAF-02 short-term rules hardening of `farms`, transactions, locks and date window · SAF-04 remove client fallbacks · SAF-05 soft delete / safe hard delete + enable PITR or exports | Cross-farm and inventory tampering by any insider; irreversible data loss |
| **P2 — medium hardening** | SAF-07 export limits · SAF-08 user PII scoping · SAF-09 immutable audit and revisions · SAF-10 dependency upgrades / `xlsx` replacement · SAF-11 staging project and env separation · SAF-13 notification create constraints · SAF-14 Storage deny-all · SAF-16 headers/CSP | Defence in depth; resource abuse; PII |
| **P3 — improvements and scalability** | SAF-12 rate-limit design · SAF-15 remove dead endpoints · SAF-17 phone normalisation and transactional guards · SAF-18 allowlist self-update · SAF-19 import batch storage · Deliverable 7 bounded queries, pagination, aggregate docs · server-side report submission (B10) · App Check | Long-term reliability and cost |

---

## Deliverable 10 — Production readiness verdict

### **CONDITIONALLY SAFE — REMEDIATION REQUIRED**

**Evidence for "not unsafe":** no unauthenticated access path was found. Backend identity verification is correct and checked on every request. There is no route from a farmer or supervisor to admin privileges (C1, C2). Cross-farm **reads** are blocked (C9, C12, except supervisor user profiles). All six explicitly stated security requirements are enforced by the deployed rules (C3–C8, C11b).

**Evidence for "remediation required":** any authenticated insider can falsify other farms' reports (SAF-01) and their own farm's inventory (SAF-02); both are confirmed in the emulator. Usable credentials sit in git history (SAF-03). The admin client can disable the system's last-admin protection (SAF-04). One admin action can irreversibly erase a farm's records (SAF-05). Finally, the protective version of the rules exists only as an uncommitted file (SAF-06).

**Conditions to reach "Ready subject to documented limitations":** P0 completed, SAF-01 / SAF-02 (short-term rules) / SAF-04 / SAF-05 fixed and verified by emulator tests in CI, and Firestore PITR or scheduled exports enabled.

---

## Deliverable 11 — Implementation plan (small, independent batches)

Each batch is independently deployable and reversible. Rules batches: deploy to a staging project first, run the emulator suite and a manual smoke test of all three portals, then deploy to production. Keep the previous ruleset ID for one-click rollback.

| Batch | Scope | Files | Depends on | Tests | Regression risk |
|---|---|---|---|---|---|
| **B0** Ops & hygiene | Rotate credentials; disable seed accounts; check repo visibility; commit live rules to a canonical repo; enable PITR / exports; confirm service-account IAM role | monorepo `firestore.rules`, `SAI_…Credential_Handover_Sheet.docx`, `scripts/seed-users.mjs`; GCP console | – | old passwords fail; rules file matches the console | Low |
| **B1** Rules test harness in CI | Turn Appendix A into a committed emulator test suite; fix backend test paths | new `tests/rules/*.test.ts`, backend `src/security/*.test.ts`, CI workflow | B0 | all of R1–R15 currently "allowed" are documented as known-failing | None |
| **B2** SAF-01 report write binding | rules for `dailyLogs`, `revisions`, parent `dailyReports` | `firestore.rules` | B1 | R3/R5/R6 → 403; farmer submit, version-2 correction, submit-over-import → 200 | Medium |
| **B3** SAF-04 remove client fallbacks | `updateUserStatus`, `updateSupervisorAllocation` | FE `src/services/userDataService.ts`, `AdminUsersPage.tsx` (error display) | – | mocked-fetch unit tests; staging self-deactivation refused | Low |
| **B4** SAF-09 / SAF-13 / SAF-18 small rule hardening | immutable `auditLogs`; create-only `revisions`; non-admin notifications cannot be pre-resolved; self-update allowlist | `firestore.rules` | B1, B2 | R7/R9/R10/R12/R13 → 403; notification create and readBy still work | Low–Medium |
| **B5** SAF-02 short-term inventory rules | field allowlist on `farms`; transaction `type` constraints; date window on `dailyLogs`; lock constraints | `firestore.rules` | B2 | R1/R2/R4/R14/R15 → 403; all inventory flows (report v1/v2, Feed Load add/edit/delete) pass in the emulator | **High**: most careful batch |
| **B6** SAF-10 dependencies | non-major `npm audit fix` (backend); remove unused `firebase` from backend; replace `xlsx` with the SheetJS 0.20.x CDN tarball; then majors separately | `package.json`, lockfiles, possibly `historicalImportService.ts` | – | full vitest suites; import golden files (`xlsxImport.test.ts`, `avgImportMapping.test.ts`) | Medium |
| **B7** SAF-05 safe user deletion | soft delete by default; chunked, abort-on-error hard delete behind a typed confirmation; backup before delete | BE `src/services/userService.ts`, FE `AdminUsersPage.tsx` | B0 (PITR) | emulator test with 600+ docs; existing `userService.delete.test.ts` | Medium |
| **B8** SAF-07 export hardening | bounded queries, range cap, per-user limiter, `finally` cleanup, generic errors, multi-flock fix | BE `reports.controller.ts`, `reports.service.ts`, `reports.repository.ts`, `firestore.indexes.json` | – | `productionExportAvg.test.ts`, `reports.export.security.test.ts`, golden xlsx compare | Medium |
| **B9** SAF-08 / SAF-11 / SAF-14 / SAF-16 | supervisor-scoped user reads (+ query change); staging project and env config; Storage deny-all; Vercel headers (CSP report-only first) | `firestore.rules`, `storage.rules`, FE `index.html`, `src/config/firebase.ts`, `vercel.json`, `vite.config.ts`, supervisor pages | B1 | R8 → 403; supervisor pages render; CSP report shows no violations for a week before enforcing | Medium |
| **B10** Server-authoritative operations (architectural, optional but recommended) | Move report submission and Feed Load stock maths to backend endpoints; make farm inventory fields Admin-SDK-only in rules | BE new controller/service (reusing `report.validator.ts`), FE `reportService.ts`, `inventoryService.ts`, `firestore.rules` | B2, B5 | parity tests old vs new path on identical inputs; offline-sync path (`syncPendingSubmissions`) | High. **Why:** it is the only complete fix for SAF-02, since rules cannot express all business arithmetic. **Affects:** farmer portal, Feed Load pages. **Compatibility:** same Firestore document shapes, so no migration. **Complexity:** large (2–3 weeks incl. testing). Alternative: Cloud Functions triggers that validate and correct after the fact. |
| **B11** P3 cleanup | remove dead endpoints (SAF-15); phone normalisation and transactional guards (SAF-17); import batch sub-collections (SAF-19); paginated / date-bounded dashboard queries | various | – | existing suites + new unit tests | Low–Medium |

**Approval gate:** per your instructions, nothing above has been implemented. I'm waiting for your approval and batch selection.

---

## Appendix A — Tests actually executed

| Test | Environment | Result |
|---|---|---|
| Firestore rules probe: 28 scenarios (15 predicted weaknesses R1–R15, 13 controls C1–C12/C5b/C11b), live working-copy rules | Local Firestore emulator via `firebase emulators:exec`, project **`demo-audit`** (cannot reach production), synthetic UIDs, unsigned emulator tokens | **28/28 matched predictions.** All of R1–R15 ALLOWED (vulnerabilities confirmed). All controls DENIED (requirements confirmed). Two first-run test-design errors (C5 seeded the creator as the same admin; C11 targeted a non-existent doc, so the write was a create) were corrected and re-run. |
| Backend unit tests | Backend release worktree at `d7607bb` (`npx vitest run`) | 198/198 tests passed; **4 test files failed to load** (missing monorepo paths, SAF-06) |
| `npm audit --package-lock-only` | Release lockfiles (read-only) | see SAF-10 |
| Git-history secret scan | All refs, path and content patterns (private keys, service-account JSON, Google API keys, live payment keys, GitHub/Slack tokens), plus docx text | see Deliverable 8 |

Probe script (local only): `C:\Users\SRIRAM\AppData\Local\Temp\claude\d3e7ad0a667ec4e4\62de1f09-bbad-45d4-93ee-e50418117808\scratchpad\tests\rules_probe.mjs`

**Not executed (recommended for staging):** any request to the production Vercel or Render URLs (response headers, proxy IP behaviour), load testing, frontend unit tests, PDF credential review, Firebase Console ruleset hash verification, GitHub repo visibility check.
