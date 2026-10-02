# ATTACK SURFACE MAP — Happy Farmer ERP

## 1. Architecture Overview

```
┌───────────────────────────────────────────────────────────┐
│                    BROWSER (SPA)                          │
│  React + Vite  │  Firebase Compat SDK v12.18.0 (CDN)     │
│  Direct Firestore reads/writes via firebase.firestore()  │
│  Firebase Auth via firebase.auth()                        │
└────────────┬──────────────────────┬───────────────────────┘
             │ REST API             │ Direct Firestore
             │ (Bearer token)       │ (Firebase Auth token)
             ▼                      ▼
┌────────────────────────┐  ┌──────────────────────────────┐
│  Backend API (Express) │  │  Cloud Firestore             │
│  firebase-admin SDK    │  │  Project: farm-form          │
│  Port: env.PORT        │  │  Rules: firestore.rules      │
│  helmet + CORS         │  │                              │
└────────────┬───────────┘  └──────────────────────────────┘
             │
             ▼
    Cloud Firestore (Admin SDK — bypasses rules)
```

> [!IMPORTANT]
> The frontend performs **direct Firestore reads AND writes** (reports, inventory, feed loads, flocks).
> The backend API is used for user management, import/export, and flock creation.
> **Both paths must be secured independently** — Firestore rules protect direct access; backend middleware protects API calls.

---

## 2. Entry Points

### 2.1 Backend API Routes

| # | Method | Path | Auth | Authz | Rate-Limited | Validator |
|---|--------|------|------|-------|-------------|-----------|
| 1 | GET | `/api/v1/reports/export-production-curve` | `authMiddleware` | In-controller (SEC-01 fixed) | Global only | — |
| 2 | POST | `/api/v1/reports/daily` | `authMiddleware` | `requireFarmAccess` | 10/min | `DailyReportInputSchema` |
| 3 | GET | `/api/v1/reports/daily/:id` | `authMiddleware` | **In-controller (weak — SEC-09)** | Global only | — |
| 4 | GET | `/api/v1/farms/` | `authMiddleware` | In-controller | Global only | — |
| 5 | GET | `/api/v1/farms/:farmId` | `authMiddleware` | `requireFarmAccess` | Global only | — |
| 6 | POST | `/api/v1/flocks/` | `authMiddleware` | `requireRole(ADMIN)` | Global only | `createFlockSchema` |
| 7 | PATCH | `/api/v1/flocks/:flockId/status` | `authMiddleware` | `requireRole(ADMIN)` | Global only | `updateFlockStatusSchema` |
| 8 | GET | `/api/v1/admin/users` | `authMiddleware` | `requireRole(ADMIN)` | Global only | — |
| 9 | DELETE | `/api/v1/admin/users/:uid` | `authMiddleware` | `requireRole(ADMIN)` | Global only | — |
| 10 | PATCH | `/api/v1/admin/users/:uid/status` | `authMiddleware` | `requireRole(ADMIN)` | `UpdateUserStatusSchema` |
| 11 | PUT | `/api/v1/admin/users/:uid/status` | `authMiddleware` | `requireRole(ADMIN)` | `UpdateUserStatusSchema` |
| 12 | POST | `/api/v1/admin/users/farmer` | `authMiddleware` | `requireRole(ADMIN)` | `CreateFarmerSchema` |
| 13 | POST | `/api/v1/admin/users/supervisor` | `authMiddleware` | `requireRole(ADMIN)` | `CreateSupervisorSchema` |
| 14 | POST | `/api/v1/admin/users/admin` | `authMiddleware` | `requireRole(ADMIN)` | `CreateAdminUserSchema` |
| 15 | PATCH | `/api/v1/admin/users/supervisor/:uid/farms` | `authMiddleware` | `requireRole(ADMIN)` | `UpdateSupervisorFarmsSchema` |
| 16 | POST | `/api/v1/admin/import/check-conflicts` | `authMiddleware` | `requireRole(ADMIN)` | `CheckConflictsSchema` |
| 17 | POST | `/api/v1/admin/import/execute` | `authMiddleware` | `requireRole(ADMIN)` | `ExecuteImportSchema` |
| 18 | GET | `/api/v1/admin/import/batches` | `authMiddleware` | `requireRole(ADMIN)` | — |
| 19 | GET | `/api/v1/admin/import/batches/:batchId` | `authMiddleware` | `requireRole(ADMIN)` | — |
| 20 | GET | `/api/v1/admin/import/batches/:batchId/revert-preview` | `authMiddleware` | `requireRole(ADMIN)` | — |
| 21 | POST | `/api/v1/admin/import/batches/:batchId/revert` | `authMiddleware` | `requireRole(ADMIN)` | `RevertBatchSchema` |
| 22 | GET | `/health` | None | None | Global | — |
| 23 | GET | `/` | None | None | Global | — |

### 2.2 Direct Firestore Access (Frontend)

| Service File | Collections Accessed | Operations |
|---|---|---|
| `reportService.ts` | `dailyReports/{uid}`, `dailyLogs/{date}`, `revisions/{revId}`, `dailyReportLocks/{lockId}`, `farms/{farmId}`, `flocks/{flockId}`, `birdTransactions/{txId}` | Transaction: read + write |
| `reportDataService.ts` | `collectionGroup('dailyLogs')` | Read (unbounded — SEC-10) |
| `inventoryService.ts` | `farms/{farmId}`, `feedTransactions/{txId}`, `birdTransactions/{txId}` | Read + write |
| `flockDataService.ts` | `flocks` (collection), `flocks` where farmId, `logs/{farmId}/flockLogs` | Read + subscribe |
| `farmDataService.ts` | `farms` (collection), `farms/{farmId}` | Read + subscribe |
| `userService.ts` | `users/{uid}` | Read |
| `userDataService.ts` | `users` (collection) | Read |
| `offlineDraftService.ts` | IndexedDB + localStorage | Local persistence |

### 2.3 Client-Side Storage

| Storage | Keys | Sensitivity |
|---|---|---|
| localStorage | `sai_language`, `pending_*`, `sai_login_attempts`, draft keys | LOW-MEDIUM — pending submissions contain report data |
| sessionStorage | `sai_feed_load_selected_farm` | LOW — farm ID only |
| IndexedDB | Offline drafts | MEDIUM — contains form data |
| Firestore persistence | All cached Firestore docs | HIGH — cached business data |

---

## 3. Authentication Model

| Component | Mechanism |
|---|---|
| Frontend login | `firebase.auth().signInWithEmailAndPassword()` |
| Frontend session | Firebase Auth ID token (auto-refreshed by SDK) |
| Backend API auth | Bearer token → `admin.auth().verifyIdToken(token, true)` |
| User profile lookup | Both: read `/users/{uid}` Firestore doc |
| Active check | Both: verify `userData.active === true` |
| Roles | `admin`, `supervisor`, `farmer` |
| Farm assignment | `userData.farmIds[]` array |

---

## 4. Firestore Collection Map

| Collection Path | Rules Exist | Farm-Scoped |
|---|---|---|
| `/users/{userId}` | ✅ | N/A |
| `/farms/{farmId}` | ✅ | ✅ via `hasFarmAccess(farmId)` |
| `/farms/{farmId}/feedTransactions/{txId}` | ✅ | ✅ |
| `/farms/{farmId}/birdTransactions/{txId}` | ✅ | ✅ |
| `/flocks/{flockId}` | ✅ | ✅ via `resource.data.farmId` |
| `/dailyReports/{userId}` | ✅ | ✅ partial |
| `/dailyReports/{userId}/dailyLogs/{date}` | ✅ | ✅ |
| `/dailyReports/{userId}/dailyLogs/{date}/revisions/{revId}` | ✅ | ✅ |
| `/dailyReportLocks/{lockId}` | ✅ | ✅ |
| `/auditLogs/{logId}` | ✅ | Admin-only read |
| `/importBatches/{batchId}` | ✅ | Admin-only |
| `/logs/{farmId}` | ✅ | ✅ |
| `/logs/{farmId}/feedLogs/{logId}` | ✅ | ✅ |
| `/logs/{farmId}/flockLogs/{logId}` | ✅ | ✅ |

---

## 5. Technology Inventory

| Component | Technology | Version |
|---|---|---|
| Frontend framework | React | 19.x (types) |
| Build tool | Vite | 8.2.2 |
| TypeScript | | 6.0.2 (frontend), 5.3.3 (backend) |
| Backend framework | Express | 4.18.2 |
| Firebase Admin | firebase-admin | 12.0.0 |
| Firebase Client | Compat CDN | 12.18.0 |
| Security headers | helmet | 7.1.0 |
| Validation | zod | 3.22.4 |
| Spreadsheet | xlsx (SheetJS) | 0.18.5 |
| Charting | recharts | 3.10.1 |
| i18n | i18next | 26.4.1 |
| Routing | react-router-dom | 7.18.3 |

---

## 6. Deployment Configuration

| Setting | Value | Notes |
|---|---|---|
| Firebase Hosting | `frontend/dist` | SPA rewrite to `index.html` |
| Backend | Separate process | Not hosted on Firebase |
| Firestore project | `farm-form` | Production |
| Storage rules | **Not found** | No `storage.rules` file |
| Cloud Functions | **Not found** | No `functions/` directory |
| `.firebaserc` | **Not found** | Project ID in firebase config only |
| Emulator config | **Not configured** | No emulator settings in `firebase.json` |
