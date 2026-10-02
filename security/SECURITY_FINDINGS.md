# SECURITY FINDINGS — Happy Farmer ERP

This document contains all security findings identified during the production security audit and penetration testing discovery phase.

---

## Summary of Findings by Severity & Status

| Finding ID | Severity | Title | Status |
|---|---|---|---|
| **SEC-08** | MEDIUM | Farmer password minimum length inconsistency (min 6 vs min 8) | ✅ **RESOLVED** (Phase C) |
| **SEC-09** | MEDIUM | `getReportById` backend endpoint lacks `requireFarmAccess` route middleware | ⚠️ OPEN |
| **SEC-10** | HIGH | `reportDataService.ts` fetches ALL `dailyLogs` via unbounded `collectionGroup` | ⚠️ OPEN |
| **SEC-11** | LOW | Production codebase contains over 100 debug console statements | ✅ **RESOLVED** (Phase C) |
| **SEC-12** | LOW | Structured logger does not redact sensitive fields | ✅ **RESOLVED** (Phase C) |
| **SEC-13** | LOW | Missing security headers in Firebase Hosting configuration | ✅ **RESOLVED** (Phase C) |
| **SEC-14** | INFO | Public Firebase web API key & configuration | ℹ️ DOCUMENTED (Design) |
| **SEC-15** | MEDIUM | In-memory rate limiting not distributed across instances | ⚠️ OPEN |
| **SEC-16** | LOW | Unhandled error logging via `console.error` in flock controller | ⚠️ OPEN |
| **SEC-17** | HIGH | Frontend route guards provide no security for direct Firestore access | ℹ️ MITIGATED (By Rules) |
| **SEC-18** | MEDIUM | Absence of Content Security Policy (CSP) | ⚠️ OPEN |
| **SEC-19** | INFO | Viewport accessibility and zoom disabling (`user-scalable=no`) | ℹ️ DOCUMENTED |
| **SEC-20** | LOW | Generic Firebase error handler leaks error codes | ✅ **RESOLVED** (Phase C) |
| **SEC-21** | MEDIUM | Backend report repository uses legacy flat collection path | ⚠️ OPEN |

---

## Detailed Vulnerability & Risk Catalog

### [SEC-08] Farmer Password Minimum Length Inconsistency (Weak Policy)
- **Severity:** MEDIUM
- **Category:** Authentication & Password Security
- **Affected File:** `backend/src/validators/farmer.validator.ts:18-20`
- **Evidence:**
  ```typescript
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .max(128, 'Password must be 128 characters or fewer'),
  ```
- **Context:**
  In the remediation of SEC-05, admin and supervisor creation validators were upgraded to `min(8)`. However, `CreateFarmerSchema` was left at `min(6)`. This creates an inconsistent security baseline across roles.
- **Risk:**
  Accounts created for farmers can use 6-character passwords, increasing vulnerability to credential stuffing, dictionary attacks, and brute-force cracking.
- **Remediation:**
  Update `farmer.validator.ts` password length to `min(8)` and verify frontend input alignment on farmer creation forms.

---

### [SEC-09] Backend `getReportById` IDOR Defense-in-Depth Gap
- **Severity:** MEDIUM
- **Category:** Broken Object-Level Authorization (BOLA / IDOR)
- **Affected File:** `backend/src/routes/reports.routes.ts:28-31`, `backend/src/controllers/reports.controller.ts:46-57`
- **Evidence:**
  `backend/src/routes/reports.routes.ts`:
  ```typescript
  router.get(
    '/daily/:id',
    authMiddleware,
    getReportById,
  );
  ```
  `backend/src/controllers/reports.controller.ts`:
  ```typescript
  const report = await reportsService.getReportById(reportId, user);

  if (user.role === UserRole.ADMIN || user.role === UserRole.OFFICE_STAFF) {
    // Admin and office staff can access all reports
  } else if (user.farmIds.length === 0 || !user.farmIds.includes(report.farmId)) {
    res.status(403).json({ ... });
  ```
- **Context:**
  The route executes without `requireFarmAccess` middleware. The controller queries Firestore using the Admin SDK, loads the full report into memory, and only *then* evaluates whether `user.farmIds.includes(report.farmId)`.
- **Risk:**
  While access is blocked before returning the payload to non-admins, unauthorized requests trigger database document reads and memory allocation on unassigned farm records. If a logic error or exception occurs in response rendering, unredacted fields or error context could leak.
- **Remediation:**
  Ensure authorization checks precede data retrieval where possible or wrap in an isolated query verifying `report.farmId` within allowed `farmIds`.

---

### [SEC-10] Unbounded `collectionGroup('dailyLogs')` Client-Side Query
- **Severity:** HIGH
- **Category:** Denial of Service / Resource Exhaustion / Excessive Data Retrieval
- **Affected File:** `frontend/src/services/reportDataService.ts:37-57`
- **Evidence:**
  ```typescript
  const snap = await db.collectionGroup('dailyLogs').get();
  let reports: NormalizedReport[] = [];
  snap.docs.forEach((d: any) => { ... });
  if (farmIds && farmIds.length > 0) {
    const farmSet = new Set(farmIds);
    reports = reports.filter((r) => farmSet.has(r.farmId));
  }
  ```
- **Context:**
  When supervisors or dashboards load reports, the frontend issues a global `collectionGroup('dailyLogs').get()`. The client downloads all accessible daily logs across all user subcollections, and filters by `submissionDate` and `farmId` in JavaScript on the browser.
- **Risk:**
  1. As document counts grow into thousands, each client visit triggers hundreds or thousands of Firestore document reads, leading to excessive cloud billing and browser memory exhaustion.
  2. If Firestore security rules on `collectionGroup('dailyLogs')` suffer any regression, all cross-tenant daily log documents would be delivered to the client.
- **Remediation:**
  Refactor client report fetching to use targeted indexed queries (`where('farmId', 'in', user.farmIds)` and date bounds) rather than downloading the entire collection group and filtering client-side.

---

### [SEC-11] Production Codebase Contains Over 100 Debug Console Statements
- **Severity:** LOW
- **Category:** Information Disclosure
- **Affected File:** Multiple frontend components (`frontend/src/pages/`, `frontend/src/components/`, `frontend/src/services/`)
- **Evidence:**
  Over 105 occurrences of `console.log`, `console.warn`, and `console.error` exist across the codebase, e.g.:
  `frontend/src/components/ProtectedRoute.tsx:15`:
  ```typescript
  console.log('[ProtectedRoute] RENDER:', { path: location.pathname, allowedRole, loading, isAuthenticated, role });
  ```
  `frontend/src/services/authService.ts:4`:
  ```typescript
  console.log('[AuthService] signInWithEmailAndPassword for:', email);
  ```
- **Risk:**
  Browser dev tools expose user navigation paths, email addresses, internal paths, and state transitions to any local user or browser extension.
- **Remediation:**
  Configure Vite's build settings (`esbuild.drop = ['console', 'debugger']` in `vite.config.ts` for production builds) or implement a build-time stripping plugin.

---

### [SEC-12] Structured Logger Does Not Redact Sensitive Fields
- **Severity:** LOW
- **Category:** Sensitive Data Exposure in Logs
- **Affected File:** `backend/src/utils/logger.ts:41-89`
- **Evidence:**
  ```typescript
  function formatLog(entry: LogEntry): string {
    return JSON.stringify(entry);
  }
  ```
- **Context:**
  `logger.ts` serializes whatever metadata object is provided. Existing tests explicitly documented: *"The logger doesn't filter sensitive data by default."*
- **Risk:**
  If a developer or future middleware logs `req.body` or query parameters on auth endpoints, passwords, tokens, or personal phone numbers will be written in plaintext to server logs.
- **Remediation:**
  Implement recursive key masking in `formatLog()` for known sensitive keys (`password`, `token`, `authorization`, `secret`, `apiKey`).

---

### [SEC-13] Missing Security Headers in Firebase Hosting Configuration
- **Severity:** LOW
- **Category:** Security Misconfiguration
- **Affected File:** `firebase.json:1-24`
- **Evidence:**
  ```json
  {
    "hosting": {
      "public": "frontend/dist",
      "ignore": [ ... ],
      "rewrites": [
        {
          "source": "**",
          "destination": "/index.html"
        }
      ]
    }
  }
  ```
- **Context:**
  `firebase.json` specifies no custom headers block for static assets or HTML delivery.
- **Risk:**
  Missing standard HTTP hardening headers on hosting:
  - `X-Frame-Options: DENY` (Clickjacking defense)
  - `X-Content-Type-Options: nosniff` (MIME confusion)
  - `Strict-Transport-Security` (HSTS enforcement)
  - `Referrer-Policy: strict-origin-when-cross-origin`
- **Remediation:**
  Add a `"headers"` array to `firebase.json` under `"hosting"` specifying defensive security headers for `**/*.@(html|js|css)`.

---

### [SEC-14] Public Firebase Web API Key & Configuration
- **Severity:** INFO
- **Category:** Architecture & Configuration
- **Affected File:** `frontend/index.html:18-25`, `frontend/src/config/firebase.ts:8-15`
- **Evidence:**
  `apiKey: "AIzaSyCfBEshZQtNiGEw5b4qjuHESSoI5qcw9j8"`, `projectId: "farm-form"`
- **Context:**
  Firebase Web API keys are client identifiers, not private secrets, and are designed to be public. However, they allow any client to connect directly to the Firebase backend.
- **Risk:**
  Anyone possessing this key can communicate directly with Firestore and Auth endpoints, bypassing all frontend React code and guards. Security relies 100% on Firebase Security Rules and App Check.
- **Remediation:**
  1. Confirm Firestore Security Rules provide airtight boundary isolation for all direct connections.
  2. Implement Firebase App Check (reCAPTCHA v3 or Cloudflare Turnstile) to prevent automated unauthorized abuse of the Firebase Web API.

---

### [SEC-15] In-Memory Rate Limiting Not Distributed Across Instances
- **Severity:** MEDIUM
- **Category:** Rate Limiting / Abuse Prevention
- **Affected File:** `backend/src/middleware/rateLimit.middleware.ts:10-44`
- **Evidence:**
  ```typescript
  const requestCounts = new Map<string, RateLimitEntry>();
  ```
- **Context:**
  Rate limiting counters are stored in a process-local JavaScript `Map`.
- **Risk:**
  If the backend API is scaled horizontally across multiple instances or container pods, rate limits will be evaluated independently per instance, allowing an attacker to bypass thresholds by distributing requests. In addition, restarting the process resets all counters.
- **Remediation:**
  For production clustering, back rate limiters with Redis or Firestore distributed counters.

---

### [SEC-16] Unhandled Error Logging via `console.error` in Flock Controller
- **Severity:** LOW
- **Category:** Logging & Error Handling
- **Affected File:** `backend/src/controllers/flock.controller.ts:122,141`
- **Evidence:**
  ```typescript
  console.error('Create flock error:', error);
  res.status(500).json({ error: 'Failed to create flock' });
  ```
- **Context:**
  Bypasses the structured `logger` utility in favor of unstructured `console.error`.
- **Risk:**
  Logs are not parsed as structured JSON, lack `requestId` and contextual metadata, and cannot be ingested properly by automated SIEM/log parsers.
- **Remediation:**
  Replace `console.error` with `logger.error('Failed to create flock', { requestId: req.requestId, error })`.

---

### [SEC-17] Frontend Route Guards Provide No Security for Direct Firestore Access
- **Severity:** HIGH
- **Category:** Client-Side Enforcement vs True Access Control
- **Affected File:** `frontend/src/components/ProtectedRoute.tsx`, `frontend/src/components/ProtectedManagementRoute.tsx`
- **Context:**
  The React application handles role redirects in the UI. If a user tampers with client code, intercepts network requests, or uses the Firebase JS SDK in DevTools console, frontend guards are entirely circumvented.
- **Risk:**
  Any user possessing valid credentials can execute queries directly against Firestore collections unless the Firestore Security Rules explicitly forbid that specific user/role combination.
- **Remediation:**
  Maintain 100% server-side and rule-level enforcement. Regularly run contract tests ensuring rules reject unauthorized requests regardless of client-side role state.

---

### [SEC-18] Absence of Content Security Policy (CSP)
- **Severity:** MEDIUM
- **Category:** Cross-Site Scripting (XSS) Mitigation
- **Affected File:** `backend/src/index.ts:29`, `firebase.json`
- **Context:**
  Helmet is instantiated with default options (`app.use(helmet())`), which in v7 disables the default CSP middleware unless explicitly configured. No CSP header is served by Firebase hosting.
- **Risk:**
  If an XSS injection occurs in a third-party dependency (e.g. SheetJS/xlsx, recharts), the browser will not restrict malicious outbound network calls or inline execution.
- **Remediation:**
  Define a strict Content Security Policy allowing only trusted CDN scripts (`gstatic.com`, Google Fonts) and backend API domains.

---

### [SEC-19] Viewport Accessibility and Zoom Disabling
- **Severity:** INFO
- **Category:** Mobile Security / UX Policy
- **Affected File:** `frontend/index.html:5`
- **Evidence:**
  `user-scalable=no, maximum-scale=1.0`
- **Context:**
  Prevents zooming on mobile devices.
- **Risk:**
  WCAG accessibility violation; does not constitute a direct confidentiality/integrity vulnerability.
- **Remediation:**
  Remove `user-scalable=no` to satisfy mobile accessibility standards.

---

### [SEC-20] Generic Firebase Error Handler Leaks Error Codes
- **Severity:** LOW
- **Category:** Information Disclosure
- **Affected File:** `frontend/src/utils/firebaseErrors.ts:16`
- **Evidence:**
  ```typescript
  default:
    return `Error: ${code}`;
  ```
- **Context:**
  Unmapped Firebase auth and Firestore error codes are displayed directly to the end user.
- **Risk:**
  May reveal internal Firebase configurations or permission structures to end users.
- **Remediation:**
  Log the specific error code internally for diagnostics and present a generic friendly fallback: "An unexpected error occurred. Please try again."

---

### [SEC-21] Backend Report Repository Uses Legacy Flat Collection Path
- **Severity:** MEDIUM
- **Category:** Architectural Inconsistency / Data Isolation Disconnect
- **Affected File:** `backend/src/repositories/reports.repository.ts:18`
- **Evidence:**
  ```typescript
  const reportRef = this.db.collection('dailyReports').doc(report.reportId);
  transaction.set(reportRef, report);
  ```
- **Context:**
  The frontend submits reports directly to nested subcollections (`dailyReports/{userId}/dailyLogs/{date}`), whereas the backend API writes directly to `dailyReports/{reportId}`.
- **Risk:**
  Reports created via backend API are stored in a disparate location not visible to frontend report views, potentially causing data fragmentation and audit gaps.
- **Remediation:**
  Standardize backend repository write paths to match canonical nested Firestore structure or deprecate unused backend report creation endpoints.
