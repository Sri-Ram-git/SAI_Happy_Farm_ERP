# Technical Requirements — Existing Implementation

## 1. Document Purpose and Evidence Rules

This document specifies the technical requirements of the **SAI Happy Farms ERP** application based entirely on the currently implemented codebase. It records the actual runtime environment, framework dependencies, functional and non-functional constraints, and security mechanisms as verified in the repository.

- **Audit Date:** 01 October 2026
- **Evidence Hierarchy:**
  1. Implemented source code and build configurations (`frontend/`, `backend/`, `firestore.rules`).
  2. Executed and verified test suites (`vitest`).
  3. Existing project documentation.
  4. Historical requirements specification (`Option_2_Local_Language_Web_Form_SRS.md`).
- **Evidence Labels Used Throughout:**
  - **VERIFIED:** Directly confirmed through code inspection and execution paths.
  - **PARTIALLY VERIFIED:** Core logic confirmed; peripheral or edge behaviors unverified.
  - **IMPLEMENTATION-ONLY:** Present and operational in code, but absent from original SRS.
  - **SRS ONLY:** Specified in requirements, but not found in the codebase.
  - **NOT VERIFIED:** Insufficient evidence in local code to confirm runtime behavior.

---

## 2. Existing Technology Stack

### 2.1 Core Frameworks & Languages
| Technology | Category | Version / Evidence | Purpose / Usage | Status |
| :--- | :--- | :--- | :--- | :--- |
| **TypeScript** | Programming Language | Frontend `~6.0.2`, Backend `^5.3.3` | Strong typing across frontend and backend services | **VERIFIED** |
| **Node.js** | Runtime Environment | `backend/package.json` engines: `node >=18.0.0` | Backend API server and build tooling | **VERIFIED** |
| **React** | Frontend Framework | `^19.2.18` (via types & React 19 API) | Client UI component rendering | **VERIFIED** |
| **Vite** | Build Tool & Dev Server | `^8.2.2` (`frontend/package.json`) | Frontend HMR dev server and production bundling | **VERIFIED** |
| **Express** | Backend Framework | `^4.18.2` (`backend/package.json`) | REST API routing, middleware, and request dispatch | **VERIFIED** |
| **Cloud Firestore** | NoSQL Database | JS Compat `12.18.0`, Admin `^12.0.0` | Primary application document persistence | **VERIFIED** |
| **Firebase Auth** | Identity & Auth | JS Compat `12.18.0`, Admin `^12.0.0` | User credentials, session tokens, and password auth | **VERIFIED** |

### 2.2 Client-Side Libraries
| Library | Version | Purpose | Location | Status |
| :--- | :--- | :--- | :--- | :--- |
| **react-router-dom** | `^7.18.3` | Client-side routing, route guards, URL navigation | `frontend/src/App.tsx` | **VERIFIED** |
| **i18next** | `^26.4.1` | Internationalization framework | `frontend/src/i18n/index.ts` | **VERIFIED** |
| **react-i18next** | `^17.0.13` | React bindings for i18n (`useTranslation`) | `frontend/src/pages/FarmerFormPage.tsx` | **VERIFIED** |
| **i18next-browser-languagedetector** | `^8.2.1` | Detects language from `localStorage` / navigator | `frontend/src/i18n/index.ts` | **VERIFIED** |
| **recharts** | `^3.10.1` | Interactive SVG charting (Line, Bar, Area, Composed) | `EnterpriseAnalyticsDashboard.tsx` | **VERIFIED** |
| **lucide-react** | `^1.39.0` | UI icon set across dashboard and form buttons | Component icons | **VERIFIED** |
| **xlsx** | `^0.18.5` | Excel workbook parsing (import) and generation (export) | `SupervisorRankingsPage.tsx`, `historicalImportService.ts` | **VERIFIED** |

### 2.3 Backend Libraries & Tooling
| Library | Version | Purpose | Location | Status |
| :--- | :--- | :--- | :--- | :--- |
| **zod** | `^3.22.4` | Schema validation for HTTP bodies and environment | `backend/src/validators/*` | **VERIFIED** |
| **helmet** | `^7.1.0` | Security headers (CSP, XSS protection, HSTS) | `backend/src/index.ts` | **VERIFIED** |
| **cors** | `^2.8.5` | Cross-Origin Resource Sharing control | `backend/src/index.ts` | **VERIFIED** |
| **dotenv** | `^17.4.2` | Environment variable loading | `backend/src/config/environment.ts`| **VERIFIED** |
| **uuid** | `^9.0.0` | UUIDv4 generation for reports and request tracking | `backend/src/utils/requestId.ts` | **VERIFIED** |
| **vitest** | `^1.2.0` | Unit and integration test runner | `backend/vitest.config.ts` | **VERIFIED** |

---

## 3. System Architecture

The existing architecture implements a monorepo multi-tier model:

```mermaid
flowchart TD
    subgraph Client_Tier["Client Tier (SPA)"]
        WEB_APP["React 19 Single Page App<br/>(Hosted on Vercel / Firebase Hosting)"]
        CLIENT_CACHE["Browser Cache & IndexedDB<br/>(happy_farm_offline_db)"]
    end

    subgraph Service_Tier["Service & API Tier"]
        EXPRESS_API["Node.js / Express Backend API<br/>(Hosted on Railway / Container)"]
        CORS_SEC["CORS & Helmet Security Middleware"]
        RATE_LIMIT["Rate Limiting Middleware"]
    end

    subgraph Data_Tier["Cloud Data Tier (Firebase)"]
        FIREBASE_AUTH["Firebase Authentication Service"]
        FIRESTORE_DB["Cloud Firestore Database Engine"]
        SEC_RULES["firestore.rules Engine"]
    end

    WEB_APP <==>|Direct Client SDK (gRPC/Websockets)| SEC_RULES
    SEC_RULES --> FIRESTORE_DB
    WEB_APP <==>|Auth Token Exchange| FIREBASE_AUTH
    WEB_APP -.->|Offline Queue / Drafts| CLIENT_CACHE

    WEB_APP ==>|REST API (HTTP/JSON + Bearer Token)| CORS_SEC
    CORS_SEC --> RATE_LIMIT
    RATE_LIMIT --> EXPRESS_API

    EXPRESS_API <==>|Firebase Admin SDK (Service Account)| FIREBASE_AUTH
    EXPRESS_API <==>|Firebase Admin SDK (Privileged Bypass)| FIRESTORE_DB
```

---

## 4. Runtime and Environment Requirements

### 4.1 Node.js and Execution Engines
- **Node.js:** `>=18.0.0` (specified in `backend/package.json:17-19`).
- **Package Manager:** `npm` (monorepo root uses npm workspaces scripts).

### 4.2 Frontend Environment Variables (`frontend/.env` / `frontend/.env.example`)
| Variable Name | Required | Default / Fallback | Purpose |
| :--- | :--- | :--- | :--- |
| `VITE_FIREBASE_API_KEY` | Optional | Hardcoded project API key in `firebase.ts` | Firebase Client Auth & Firestore access |
| `VITE_FIREBASE_AUTH_DOMAIN` | Optional | `farm-form.firebaseapp.com` | Firebase Auth OAuth redirect domain |
| `VITE_FIREBASE_PROJECT_ID` | Optional | `farm-form` | Target Cloud Project ID |
| `VITE_FIREBASE_STORAGE_BUCKET`| Optional | `farm-form.firebasestorage.app` | Cloud Storage bucket URI |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Optional | `429169430487` | Firebase Cloud Messaging ID |
| `VITE_FIREBASE_APP_ID` | Optional | `1:429169430487:web:5de26e54e3fc7b72c18592` | Web App Client ID |
| `VITE_API_URL` / `VITE_API_BASE_URL` | Optional | `http://localhost:3000` | Target URL for backend Express API calls |

### 4.3 Backend Environment Variables (`backend/.env` / `backend/src/config/environment.ts`)
| Variable Name | Required | Validation Rule | Default Value | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `FIREBASE_PROJECT_ID` | **YES** | `z.string().min(1)` | None | Firestore and Auth project target |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | No | `z.string()` | `./service-account.json` | Path to service account key file |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | No | Valid JSON string | None | Alternate credentials injection |
| `FIREBASE_SERVICE_ACCOUNT_BASE64`| No | Base64 encoded JSON | None | Alternate container credentials |
| `PORT` | No | `z.coerce.number()` | `3000` | HTTP server listening port |
| `NODE_ENV` | No | `'development' \| 'production' \| 'test'` | `'development'` | Environment mode flag |
| `ALLOWED_ORIGINS` | No | Valid origin string(s) | `http://localhost:3000` | CORS whitelist (wildcards blocked in prod) |
| `RATE_LIMIT_WINDOW_MS` | No | `z.coerce.number()` | `900000` (15 min) | Rate limiting window |
| `RATE_LIMIT_MAX_REQUESTS` | No | `z.coerce.number()` | `100` | Max requests per IP per window |
| `LOG_LEVEL` | No | `'debug' \| 'info' \| 'warn' \| 'error'` | `'info'` | Application logging verbosity |

### 4.4 Build and Execution Commands
- **Monorepo Root Commands:**
  - `npm run dev:frontend` $\rightarrow$ `npm --prefix frontend run dev`
  - `npm run dev:backend` $\rightarrow$ `npm --prefix backend run dev`
  - `npm run build:frontend` $\rightarrow$ `npm --prefix frontend run build` (`tsc && vite build`)
  - `npm run build:backend` $\rightarrow$ `npm --prefix backend run build` (`tsc`)
  - `npm run test:backend` $\rightarrow$ `npm --prefix backend run test` (`vitest run`)
- **Frontend Direct Commands:**
  - `npm --prefix frontend run build` (verified passing cleanly).
  - `npx --prefix frontend vitest run` (runs frontend unit tests).

---

## 5. Functional Technical Requirements

### 5.1 Farmer Module
- **FR-F01 (Authentication):** The system shall authenticate farmers using email and password, verifying that their Firestore record has `role == 'farmer'`, `active == true`, and contains at least one assigned farm ID (`userProfile.farmIds`).
- **FR-F02 (Multi-Step Capture):** The form wizard shall capture daily metrics across three sequential steps: (1) Feed & Health, (2) Eggs & Temperature, and (3) Weights & Remarks.
- **FR-F03 (Date Window Constraint):** Daily submissions shall strictly be allowed only for "Today" and "Yesterday" calculated in the `Asia/Kolkata` timezone (`reportService.ts:getAllowedReportDates()`).
- **FR-F04 (Inventory Delta Transaction):** Report submission shall execute an atomic transaction updating `farms/{farmId}`:
  - Deducting feed consumed from `currentFeedKg`.
  - Deducting mortality and culling from `currentBirdCount`.
  - Logging transactions in `birdTransactions` and `feedTransactions`.
- **FR-F05 (Version 2 Revision):** If a report already exists for a date, the farmer may submit a single correction (Version 2). The system must archive Version 1 to `revisions/v1`, calculate net inventory deltas, and lock the document from subsequent edits.
- **FR-F06 (Offline Resilience):** In-progress form inputs shall auto-save to browser IndexedDB drafts. Offline submissions shall queue into `pendingSubmissions` and synchronize when network status reports online.

### 5.2 Supervisor Module
- **FR-S01 (Data Scoping):** Supervisors shall only view, analyze, and rank farms explicitly contained in their `userProfile.farmIds` array.
- **FR-S02 (5-Parameter Ranking):** The ranking engine shall compute the 5 customer-documented parameters across configurable date presets (Today, 7 Days, 30 Days, 90 Days) or custom date ranges:
  - Production Gap %
  - Feed Conversion Ratio (FCR)
  - Egg Damage %
  - Mortality %
  - Selection %
- **FR-S03 (Documented Tie-Breakers):** Ranking ties shall be resolved using documented secondary criteria (e.g., Production Gap tied $\rightarrow$ Lower FCR wins; FCR tied $\rightarrow$ Higher Production Gap wins).
- **FR-S04 (Excel Export):** Supervisors shall be able to export multi-tab Excel workbooks containing rankings, raw weekly aggregates, and data completeness summaries.

### 5.3 Admin Module
- **FR-A01 (Sequential Farm Provisioning):** When creating a farmer, the system shall scan existing farms and generate the next sequential identifier (e.g., `AP16` following `AP15`).
- **FR-A02 (Atomic Onboarding):** Farmer onboarding shall atomically create the Firebase Auth user, the Firestore farm record, the user document, the initial flock (`Flock 1`), and opening feed/flock logs.
- **FR-A03 (Role-Aware Cascade Deletion):** Deleting a farmer account shall verify sole ownership of assigned farms and cascade delete the farm document, all associated flocks, subcollections, report locks, and daily logs, while updating assigned supervisors.
- **FR-A04 (Historical Import & Rollback):** The system shall ingest Excel spreadsheets, map headers against standard dictionaries, detect date collisions, write batch manifests to `importBatches`, and support atomic rollback of imported batches.
- **FR-A05 (Feed Shipments):** Admins shall record bulk feed deliveries (`feed-load`), updating farm inventory and creating immutable feed logs.

---

## 6. Non-Functional Requirements

### 6.1 Security
- **Authentication:** Enforced via Firebase Authentication using bcrypt-hashed passwords on Google infrastructure.
- **Transport Security:** All client-to-Firebase and client-to-backend communications require TLS/HTTPS.
- **Least Privilege:** Firestore Security Rules enforce document access limits based on user role and assigned `farmIds`.
- **Backend Protection:** Helmet security headers, rate limiting (100 requests / 15 minutes per IP), and token signature verification on all admin endpoints.

### 6.2 Data Integrity & Consistency
- **Atomic Transactions:** Master inventory updates (bird count, feed stock) are coupled to report submissions inside `db.runTransaction()`. Reports cannot be persisted if feed stock is insufficient.
- **Duplicate Prevention:** Enforced via deterministic document IDs (`dailyReports/{userId}/dailyLogs/{submissionDate}`) and unique lock documents (`dailyReportLocks/{farmId}_{submissionDate}`).
- **Audit Logging:** Administrative operations (user creation, user deletion, supervisor allocation changes) create immutable records in `auditLogs`.

### 6.3 Performance & Responsiveness
- **Client Bundle Size:** Optimized with Vite tree-shaking; Recharts and XLSX bundled efficiently.
- **Real-Time Efficiency:** Data listeners use targeted queries (`collectionGroup('dailyLogs')` with date bounds) rather than loading entire historical collections.
- **Offline First:** Instant form rendering using IndexedDB cached drafts without awaiting network roundtrips.

### 6.4 Localization & Accessibility
- **Languages:** Complete UI translations for English (`en`), Telugu (`te`), Tamil (`ta`), Kannada (`kn`), and Hindi (`hi`).
- **Number Formatting:** Standardized decimal precision (1 decimal for %, 2 decimals for FCR).
- **Timezone Standardization:** All date comparisons and day boundaries anchor strictly to Indian Standard Time (`Asia/Kolkata`, UTC+5:30).

---

## 7. Validation and Data Integrity Requirements

| Field / Action | Validation Rule | Enforced In | Error Behavior |
| :--- | :--- | :--- | :--- |
| **Feed Consumed** | Non-negative number; cannot exceed farm `currentFeedKg` | `formValidation.ts`, `reportService.ts` | Inline UI error; transaction throws `INSUFFICIENT_FEED` |
| **Mortality** | Non-negative integer; cannot exceed opening bird count | `formValidation.ts`, `reportService.ts` | Inline UI error; transaction throws `MORTALITY_EXCEEDS_BIRD_COUNT` |
| **Culling** | Non-negative integer; Mortality + Culling $\le$ bird count | `formValidation.ts`, `reportService.ts` | Inline UI error; transaction throws `INSUFFICIENT_BIRDS` |
| **Eggs Produced** | Non-negative integer; cannot exceed 95% of opening bird count | `formValidation.ts:168-179` | Inline UI error; block form advancement |
| **Selection Eggs** | Non-negative integer; Selection + Damaged $\le$ Eggs Produced | `formValidation.ts:200-215` | Inline UI error; block form advancement |
| **Temperature** | Min and Max between 10°C and 50°C; Min $\le$ Max | `formValidation.ts:224-234` | Inline UI error; block form advancement |
| **Egg Weight** | Min and Max between 30g and 80g; Min $\le$ Max | `formValidation.ts:260-278` | Inline UI error; block form advancement |
| **Body Weight** | Optional daily; if entered, Min and Max between 500g and 3000g | `formValidation.ts:285-311` | Inline UI error; block form advancement |
| **Ammonia** | Non-negative number; Max 50 ppm | `formValidation.ts:241-245` | Inline UI error; block form advancement |
| **Report Date** | Must be Yesterday or Today in IST (`Asia/Kolkata`) | `reportService.ts:430-433` | Throws `INVALID_REPORT_DATE_WINDOW` |
| **Farmer Creation** | Unique email, 10-digit phone, unique farm name | `backend/src/validators/farmer.validator.ts` | 400 Bad Request with field-level errors |

---

## 8. Business Calculation Requirements

Exact formulas implemented in code are cross-referenced below:

1. **Eligible Starting Bird Count:**
   - Code: `kpiCalculations.ts:8-46`
   - Formula: $\text{openingBirdCount} > 0 \ ?\ \text{openingBirdCount} : (\text{closingBirdCount} + \text{mortality} + \text{culling})$.
2. **Production Gap %:**
   - Code: `kpiCalculations.ts:454-459`
   - Formula: $\text{Actual Production \%} - 80.0\%$.
3. **Feed Conversion Ratio (FCR):**
   - Code: `kpiCalculations.ts:461-470`
   - Formula: $\frac{\text{Feed Consumed (kg)}}{\frac{\text{Eggs Produced} \times \text{Avg Egg Weight (g)}}{1000}}$.
   - Edge case: Returns `null` if feed, eggs, or average egg weight are zero or unrecorded.
4. **Egg Damage %:**
   - Code: `kpiCalculations.ts:472-477`
   - Formula: $\frac{\text{Damaged Eggs}}{\text{Eggs Received}} \times 100$. (Fallback: $\text{Eggs Produced}$ if received count unrecorded).
5. **Mortality %:**
   - Code: `kpiCalculations.ts:479-484`
   - Formula: $\frac{\text{Mortality Birds}}{\text{Eligible Starting Flock}} \times 100$.
6. **Selection %:**
   - Code: `kpiCalculations.ts:486-491`
   - Formula: $\frac{\text{Selected Eggs}}{\text{Eggs Produced}} \times 100$.
7. **Weighted Performance Score:**
   - Code: `kpiCalculations.ts:79-100`
   - Weights: Production (40%), Mortality (25%), Feed Efficiency (15%), Submission Compliance (20%).

---

## 9. Security Requirements

### 9.1 Authentication & Session Management
- Passwords are never stored in plaintext; authentication is delegated entirely to Firebase Auth.
- Session tokens are stored in secure browser storage (`localStorage`/`IndexedDB`).
- Expired tokens are refreshed automatically by the Firebase Client SDK.

### 9.2 Firestore Security Rules Enforcement (`firestore.rules`)
- All database accesses are restricted by default.
- Reads and updates enforce `isAuthenticated() && isUserActive()`.
- Farm data access requires `hasFarmAccess(farmId)`, requiring the user to be an admin or have the `farmId` present in their `users/{uid}.farmIds` array.
- Direct creation and deletion of `users`, `farms`, `flocks`, and `importBatches` is strictly restricted to `isAdmin()`.

### 9.3 Backend API Security
- Express router protected by `helmet()` for secure HTTP headers.
- CORS restricted to whitelisted origins (`ALLOWED_ORIGINS`).
- Rate limiting middleware restricts abusive IP calls (`rateLimitMiddleware`).
- Service account key permissions isolated to the backend container.

---

## 10. Performance and Reliability Characteristics

- **Composite Indexes:** Real-time collection group queries on `dailyLogs` require Cloud Firestore composite indexes on `farmId` and `submissionDate`.
- **Query Chunking:** In `farmDataService.ts:getFarmsByIds()`, queries with large `farmIds` arrays are chunked into batches of 10 to comply with Firestore's `in` operator limit.
- **Batch Processing:** Historical Excel imports process records in batches of 400 operations, below Firestore's 500-operation transaction/batch limit.
- **Tab Synchronization:** Multi-tab synchronization enabled via `db.enablePersistence({ synchronizeTabs: true })`.

---

## 11. Testing Requirements and Existing Coverage

- **Testing Framework:** Vitest (`vitest`) v1.2.0.
- **Test Locations & Verified Test Suites:**
  - `frontend/src/utils/kpiCalculations.test.ts` (16 unit tests verifying all 5 KPIs, tie-breakers, and total flock loss precedence).
  - `frontend/src/utils/farmerValidation.test.ts` (form input range and type validation).
  - `frontend/src/utils/mortalityHealthValidation.test.ts` (evaluates critical alert thresholds).
  - `backend/src/services/farmer.creation.test.ts` (farmer creation, sequential Farm ID generation, rollback on failure).
  - `backend/src/services/userService.delete.test.ts` (cascade deletion and last admin protection).
  - `backend/src/services/import.service.test.ts` (conflict detection and batch import).
- **Execution Command:** `npm --prefix backend run test` and `npx --prefix frontend vitest run`.

---

## 12. Build and Deployment Requirements

### 12.1 Frontend Build
- **Target:** Single Page Application (SPA) static bundle (`frontend/dist`).
- **Command:** `npm --prefix frontend run build` (`tsc && vite build`).
- **Hosting Targets:**
  - Firebase Hosting (`firebase.json:public: "frontend/dist"` with SPA rewrite to `/index.html`).
  - Vercel (`frontend/vercel.json`).

### 12.2 Backend Build
- **Target:** Node.js CommonJS/ES bundle (`backend/dist`).
- **Command:** `npm --prefix backend run build` (`tsc`).
- **Start Command:** `npm --prefix backend start` (`node dist/index.js`).
- **Hosting Target:** Railway, Render, or Docker container with Node.js 18+.

---

## 13. Current Technical Limitations

1. **Dual Report Data Structure:** Historical backend code writes to top-level `dailyReports/{id}`, while frontend writes to subcollection `dailyReports/{userId}/dailyLogs/{date}`. Collection group queries bridge this gap, but schema homogenization should be considered in future releases.
2. **Client-Side Heavy Excel Generation:** Large ranking exports ($\ge 50$ farms over 90 days) generate workbooks on the client thread using `xlsx`, which can cause momentary UI frame drops on low-end mobile devices.
3. **No Native Push Notifications:** Real-time updates occur via active Firestore listeners; background push notifications (Web Push / FCM) are not implemented.

---

## 14. SRS-to-Code Traceability

| SRS Requirement | SRS Reference | Actual Code Evidence | Status | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Local-Language Form** | SRS §4.1, §4.2 | `frontend/src/i18n/*` (5 languages) | **IMPLEMENTED** | Supports English, Telugu, Tamil, Kannada, Hindi. |
| **Daily Farm Data Entry** | SRS §4.2, §5.1 | `FarmerFormPage.tsx`, `reportService.ts` | **IMPLEMENTED** | 3-step wizard with atomic Firestore writes. |
| **Flock Size & Bird Count**| SRS §5.1.1 | `FarmerFormPage.tsx`, `inventoryService.ts`| **IMPLEMENTED** | Opening/closing bird counts, mortality, culling. |
| **Feed Consumption** | SRS §5.1.2 | `FarmerFormPage.tsx`, `inventoryService.ts`| **IMPLEMENTED** | Feed in kg/g; auto-deducted from master inventory. |
| **Egg Production & Quality**| SRS §5.1.3 | `FarmerFormPage.tsx`, `formValidation.ts` | **IMPLEMENTED** | Eggs produced, selection eggs, damaged, floor eggs. |
| **Weights & Environment** | SRS §5.1.4 | `FarmerFormPage.tsx`, `formValidation.ts` | **IMPLEMENTED** | Egg weights (min/max/avg), ambient temp (min/max). |
| **Standard Breed Curves** | SRS §2.1, §6.3 | `frontend/src/data/productionCurves.ts` | **IMPLEMENTED** | Cobb (`CF_STD`) and Ross (`FR_STD`) curves. |
| **5-Parameter Ranking** | Customer Review Doc | `kpiCalculations.ts`, `SupervisorRankingsPage.tsx` | **IMPLEMENTED** | Production Gap, FCR, Damage, Mortality, Selection. |
| **Excel Ingestion** | SRS §2.1, §7.1 | `AdminImportPage.tsx`, `historicalImportService.ts` | **IMPLEMENTED** | Parsing, conflict detection, and batch rollback. |
| **Automated SMS Alerts** | SRS §2.1, §8.1 | Not found in codebase | **NOT FOUND IN CODE** | No telephony provider integration present. |
| **Office Staff Portal** | SRS §1.1, §4.3 | `backend/src/types/auth.ts` | **NOT VERIFIED** | Role exists in backend enum; no UI pages exist. |
| **WhatsApp Ingestion** | SRS §1.1, §3.1 | Not found in codebase | **SRS ONLY** | Described in SRS as old manual workflow to replace. |

---

## 15. Future Change Constraints

Future AI agents and developers must heed these critical constraints:
1. **Never mutate Firestore document schemas directly:** Changing field names like `submissionDate`, `birdCount`, `feedKg`, or `eggsProduced` will immediately break real-time analytics and the ranking engine.
2. **Preserve `collectionGroup('dailyLogs')` query patterns:** The analytics and rankings pipelines depend on collection group listeners to aggregate daily reports across all users.
3. **Do not bypass master inventory transactions:** All daily submissions must execute through `submitReport()` to maintain atomic synchronization between farm stock levels and daily logs.
4. **Preserve Indian Standard Time (IST) date normalization:** Date comparisons must never use UTC `toISOString().split('T')[0]` directly on client devices, as UTC shifts dates by -5:30 hours before 05:30 AM IST. Always use `getIstDate()` from `dateUtils.ts`.
