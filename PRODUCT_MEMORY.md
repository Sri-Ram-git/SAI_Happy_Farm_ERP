# SAI Happy Farms ERP — Complete Product Memory & Architecture Blueprint

```
Document Version: 2.0.0
Product: SAI Happy Farms ERP (Commercial Poultry Layer ERP)
Last Updated: October 2026
Status: Production (Active)
```

---

## 1. Executive Summary & Product Mission

**SAI Happy Farms ERP** is an enterprise-grade digital management system specifically built for commercial poultry layer farming operations (specializing in **BV380 Commercial Layers**).

### Core Problem Solved
Traditional commercial layer farming relies on error-prone paper registers and fragmented monthly Excel spreadsheets. This leads to:
1. Delayed visibility into flock health and mortality spikes.
2. Inaccurate feed inventory forecasting and unauthorized stock shrinkage.
3. Complex, inconsistent manual calculations of egg production percentages against breed standards.
4. Data loss and inability to analyze multi-month production curves across distributed farms.

### Product Mission
SAI Happy Farms ERP digitizes the entire lifecycle of layer farming into a unified real-time platform:
- **Farmers** submit daily operations via a lightweight, multilingual mobile-friendly portal.
- **Supervisors** oversee clusters of assigned farms, review mortality/production KPIs, and dispatch bulk feed loads.
- **Administrators** control farm allocations, flock life-cycle curves, historical Excel data imports, user provisioning, and automated production curve reporting.

---

## 2. System Architecture & Tech Stack

The system employs a modern, hybrid serverless and micro-service architecture:

```
+-----------------------------------------------------------------------------------+
|                                  CLIENT LAYER                                     |
|                                                                                   |
|  Farmer Portal (Mobile/Web)     Supervisor Dashboard          Admin Enterprise    |
|   - Daily Log Submission         - Farm Performance Review     - User / Farm Admin|
|   - Multilingual (EN, TE)        - Feed Load Management        - Historical Import|
|   - Offline-resilient            - Multi-Farm Analytics        - Curve Generation |
+----------------------------------------+------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                        FRONTEND APPLICATION (React 19 SPA)                        |
|                                                                                   |
|  - Framework: React 19, TypeScript, Vite                                          |
|  - Routing: React Router v7                                                       |
|  - State & UI: React Context (AuthContext), Lucide Icons, Recharts                |
|  - Internationalization: i18next (English, Telugu)                                |
|  - Excel Engine: SheetJS (xlsx v0.18.5)                                            |
|  - Hosting: Vercel Production (https://happy-farm-erp-frontend.vercel.app)        |
+--------------------+-------------------------------------+------------------------+
                     | Direct Firestore (Compat SDK)       | Authenticated REST API
                     v                                     v
+----------------------------------+   +--------------------------------------------+
|        DATABASE & AUTH           |   |           BACKEND SERVICE LAYER            |
|   (Google Cloud / Firebase)      |   |            (Node.js / Express)             |
|                                  |   |                                            |
|  - Cloud Firestore               |   |  - Runtime: Node.js 22, Express, TypeScript|
|  - Firebase Authentication       |   |  - Security: Helmet, CORS, Rate Limiting   |
|  - Firebase Admin SDK            |   |  - Privilege Operations & Imports          |
|  - Hosting: Firebase Project     |   |  - Hosting: Render Production Service      |
|    `farm-form`                   |   |    (https://happy-farm-erp-backend.onrender.com)
+----------------------------------+   +--------------------+-----------------------+
                                                            | Invokes Subprocess
                                                            v
                                       +--------------------------------------------+
                                       |        PYTHON ANALYTICS ENGINE             |
                                       |                                            |
                                       |  - Script: generate_production_curve.py    |
                                       |  - Engine: Python 3.10+, openpyxl          |
                                       |  - BV380 Standard Production Interpolation |
                                       |  - Exact Preserved AVG Formatting & Export |
                                       +--------------------------------------------+
```

### Technology Matrix

| Layer | Technologies | Deployment Target | Key Responsibilities |
| :--- | :--- | :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite, Tailwind/CSS, Lucide React, i18next, Recharts, SheetJS | **Vercel** (`happy-farm-erp-frontend`) | User interface, farmer data entry, supervisor reviews, admin panels, historical file parsing. |
| **Backend API** | Node.js 22, Express, TypeScript, Firebase Admin SDK, Helmet, Winston Logger | **Render** (`happy_farm_erp_backend`) | Role enforcement, user creation/deletion cascades, import batch orchestration, report generation. |
| **Database** | Cloud Firestore NoSQL | **Google Cloud Platform** (`farm-form`) | Master state, real-time sync, atomic transaction logs, audit records. |
| **Auth** | Firebase Authentication | **Google Cloud Platform** (`farm-form`) | Email/password authentication, JWT tokens, session management. |
| **Reporting** | Python 3, `openpyxl` | Render Subprocess | Generates pixel-perfect production curve workbooks with exact standard curves and preserved AVG rows. |

---

## 3. Core Domain Rules & Biological Logic

### 3.1 Flock Lifecycle & Age Interpolation
- **Layer Breed:** BV380 Commercial Layers.
- **Age Representation:** Weeks and Days (e.g., `W.D` such as `25.3` = Week 25, Day 3).
- **Flock Age Calculation:**
  $$\text{Current Age (Weeks)} = \text{Flock Initial Age Weeks} + \frac{\text{Current Date} - \text{Flock Start Date}}{7}$$
- **Daily Standard Curve Increment:** Standard curves are defined weekly. For day fractions $D \in [0, 6]$:
  $$\text{Daily Increment} = \frac{\text{Std}(W+1) - \text{Std}(W)}{7}$$
  $$\text{Std}(W.D) = \text{Std}(W) + (D \times \text{Daily Increment})$$

### 3.2 Production & Feed Calculations
1. **Actual Production Percentage (ACT %):**
   $$\text{ACT \%} = \left( \frac{\text{Total Eggs Produced}}{\text{Opening Bird Count}} \right) \times 100$$
   *Validation Rule:* Must be a finite number between `0.0%` and `100.0%`. Stored numeric `0.0` is valid and must never be treated as missing.
2. **Standard Production Percentage (STD %):**
   Derived from the flock's assigned production curve:
   - `CF_STD`: Cage-Free Standard Curve.
   - `FR_STD`: Free-Range Standard Curve.
3. **Feed Consumption (Grams / Bird):**
   $$\text{Feed Gms/Bird} = \left( \frac{\text{Feed Consumed in Kg} \times 1000}{\text{Opening Bird Count}} \right)$$
4. **Egg Weight & Body Weight Sampling:**
   Recorded periodically with `min`, `max`, and `avg` grams. Body weights are recorded weekly to assess flock uniformity.

### 3.3 Atomic Inventory & Flock Depletion
Submitting a daily report triggers an **atomic Firestore transaction**:
1. Checks idempotency lock: `dailyReportLocks/{farmId}_{date}`.
2. Reads current master balances from `farms/{farmId}`:
   $$\text{New Bird Count} = \text{currentBirdCount} - (\text{mortality} + \text{culling})$$
   $$\text{New Feed Stock} = \text{currentFeedKg} - \text{feedConsumedKg}$$
3. Writes immutable audit log documents:
   - `farms/{farmId}/birdTransactions/{txId}`
   - `farms/{farmId}/feedTransactions/{txId}`
4. Persists the daily report in `dailyReports/{userId}/dailyLogs/{date}`.

---

## 4. Exact Cloud Firestore Database Schema

> [!IMPORTANT]
> **Strict Law for AI Agents and Developers:**
> Daily report records reside exclusively at `dailyReports/{userId}/dailyLogs/{date}`.
> Never save daily logs directly at root collections or alter field naming conventions.

### 4.1 Collection Inventory

```
/users/{userId}
/farms/{farmId}
    /feedTransactions/{txId}
    /birdTransactions/{txId}
/flocks/{flockId}
/dailyReports/{userId}
    /dailyLogs/{date}
/dailyReportLocks/{lockKey}
/logs/{farmId}/feedLogs/{logId}
/logs/{farmId}/flockLogs/{logId}
/importBatches/{batchId}
/auditLogs/{auditId}
```

### 4.2 Document Schema Specifications

#### `/users/{userId}` (Keyed by Firebase Auth UID)
```typescript
interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: 'farmer' | 'supervisor' | 'admin';
  farmIds: string[];         // Assigned farm IDs (e.g., ["AP15", "AP16"])
  assignedFarms?: string[];   // Alias maintained for cross-version compatibility
  active: boolean;           // Deactivated users cannot log in
  createdAt: string;
  updatedAt: string;
}
```

#### `/farms/{farmId}` (Deterministic Key, e.g., "AP15")
```typescript
interface Farm {
  farmId: string;
  name: string;
  farmerUid: string;         // Owner Farmer UID
  initialBirdCount: number;
  currentBirdCount: number;  // Live bird balance (decremented atomically by mortality/culling)
  currentFeedKg: number;     // Live feed inventory balance
  feedBags: number;          // Bag representation (1 bag = 50 kg)
  flockId: string;           // Active flock document ID
  status: 'active' | 'inactive';
  preservedAvg?: number | null;                // Preserved worksheet summary AVG value
  preservedAvgByDate?: Record<string, number>; // Preserved AVG values by date column
  createdAt: string;
  updatedAt: string;
}
```

#### `/dailyReports/{userId}` (Parent Submission Metadata)
```typescript
interface DailyReportSummary {
  userId: string;
  farmId: string;
  lastSubmissionDate: string; // YYYY-MM-DD
  updatedAt: string;
}
```

#### `/dailyReports/{userId}/dailyLogs/{date}` (Canonical Daily Record, e.g. "2026-10-01")
```typescript
interface DailyLogRecord {
  date: string;               // YYYY-MM-DD
  farmId: string;
  userId: string;
  flockId: string;
  ageWeeks: number;           // e.g. 26.4
  openingBirdCount: number;   // Birds at the beginning of the day
  closingBirdCount: number;   // openingBirdCount - (mortality + culling)
  mortality: number;
  culling: number;
  eggsProduced: number;       // Good eggs
  damagedEggs?: number;       // Cracked / rejected eggs
  actualProductionPct: number;// (eggsProduced / openingBirdCount) * 100
  standardProductionPct?: number; // BV380 curve target
  feedConsumedKg: number;
  feedGramsPerBird: number;
  eggWeight?: { min: number; max: number; avg: number };
  bodyWeight?: { min: number; max: number; avg: number };
  temperatureC?: number;
  waterIntakeLiters?: number;
  notes?: string;
  submissionDate: string;     // ISO timestamp
  isHistoricalImport?: boolean;
  importBatchId?: string;
}
```

#### `/importBatches/{batchId}` (Historical Excel Import Manifests)
```typescript
interface ImportBatchRecord {
  batchId: string;
  importedBy: string;         // Admin UID
  importTimestamp: string;
  totalRecords: number;
  successfulRecords: number;
  failedRecords: number;
  conflictAction: 'skip' | 'replace';
  sourceFiles: string[];
  revertStatus: 'NOT_REVERTED' | 'PARTIALLY_REVERTED' | 'REVERTED';
  worksheets: Array<{
    worksheetKey: string;     // e.g., "Sample_Curve.xlsx [AP15]"
    fileName: string;
    sheetName: string | null;
    farmId: string;
    preservedAvg: number | null;
    preservedAvgByDate?: Record<string, number>;
    importedCount: number;
    failedCount: number;
    conflictsCount: number;
  }>;
}
```

---

## 5. User Roles, Portals & Permissions

```
+-----------------------------------------------------------------------------------+
|                            ROLE AUTHORIZATION MATRIX                              |
|                                                                                   |
| Feature / Action               | Farmer          | Supervisor    | Administrator  |
| :----------------------------- | :-------------- | :------------ | :------------- |
| Daily Operations Form          | Own Farm Only   | View-Only     | Full Access    |
| Multi-farm Dashboard           | Denied          | Assigned Farms| Global All     |
| Farm Rankings & KPIs           | Denied          | Assigned Farms| Global All     |
| Feed Load Bulk Entry           | Denied          | Allowed       | Allowed        |
| User Account Provisioning      | Denied          | Denied        | Full (Cascade) |
| Farm & Flock Provisioning      | Denied          | Denied        | Full           |
| Historical Excel Batch Import  | Denied          | Denied        | Full           |
| Excel Batch Revert / Rollback  | Denied          | Denied        | Full           |
| Production Curve Excel Export  | Denied          | Assigned Farms| Global All     |
| Security Audit Logs            | Denied          | Denied        | View Only      |
+-----------------------------------------------------------------------------------+
```

### 5.1 Farmer Portal
- Located at `/farmer/form`.
- Automatic farm context initialization via `farmIds[0]`.
- Pulls `currentBirdCount` and `currentFeedKg` live to validate inputs.
- Real-time client-side calculation of `Feed Gms/Bird` and `ACT %`.
- Prevents double submissions for the same date via client checks and backend Firestore locks.
- Multilingual toggle (English / Telugu) via `react-i18next`.

### 5.2 Supervisor Portal
- Located at `/supervisor/overview`, `/supervisor/farms`, `/supervisor/analytics`, `/supervisor/rankings`, `/supervisor/feed-load`.
- Scoped strictly to farms listed in supervisor's `assignedFarms` profile.
- Ranks farms by production efficiency, mortality percentage, and feed conversion ratio (FCR).
- Dispatches bulk feed deliveries (`/supervisor/feed-load`) that increment farm inventory via atomic transactions.

### 5.3 Admin Portal
- Located at `/admin/users`, `/admin/farms`, `/admin/flocks`, `/admin/import`, `/admin/analytics`.
- User Provisioning: Creates Farmers, Supervisors, and Admins via Firebase Admin SDK.
- Deletion Security:
  - Deleting a **Farmer** cascades to their owned farm and records.
  - Deleting a **Supervisor** removes assignments without deleting farms.
  - Deleting an **Admin** retains all system data.
- Historical Data Import: Drag-and-drop Excel workbook processor with column auto-detection, simulation mode, and live Firestore execution.
- Production Curve Generator: Generates comprehensive multi-farm Excel workbooks matching customer curve templates.

---

## 6. The Historical Excel Import & Preserved AVG Pipeline

A core requirement of Happy Farm ERP is the preservation and exact reproduction of worksheet summary data (specifically the **`AVG`** row) from historical production curve workbooks (e.g., `Sample Production Curve (july - sep) (2).xlsx`).

### 6.1 The AVG Problem & Engineering Solution
- **The Challenge:** Historical Excel sheets contain daily date columns (e.g., columns `B` through `AF`) with a summary row labeled `AVG`. If treated as a daily metric, it would pollute daily Firestore records. If ignored, the original average values are lost when exporting reports.
- **The Solution:** 
  1. The mapper detects `AVG` or `AVERAGE` (case-insensitive, trimmed) and categorizes it as `worksheetSummary`.
  2. The UI dropdown explicitly displays `Preserve Existing AVG Row` with a green `Recognized` badge.
  3. During parsing, `extractPreservedAvgFromMappings()` extracts the numeric average per farm/worksheet.
  4. Daily record builders strictly filter out `worksheetSummary` fields (`STANDARD_DAILY_IMPORT_FIELDS`), guaranteeing **zero summary rows are saved as daily Firestore records**.
  5. The extracted `preservedAvg` and `preservedAvgByDate` are saved into `importBatches` and the `farms/{farmId}` document.
  6. The Python export script (`generate_production_curve.py`) retrieves `preservedAvg` / `preservedAvgByDate`, formats row 14 (`AVG`) with bold font and yellow background (`#FFFF00`), and injects the exact imported values.

```
+-----------------------------------------------------------------------------------+
|                        THE PRESERVED AVG PIPELINE FLOW                            |
|                                                                                   |
|  [ Uploaded Excel File ]                                                          |
|            |                                                                      |
|            v                                                                      |
|  detectColumnMappings() -> Identifies 'AVG' / 'AVERAGE'                           |
|            |                                                                      |
|            +---> UI Mapping: "Preserve Existing AVG Row" (Badge: Recognized)      |
|            |                                                                      |
|            v                                                                      |
|  extractPreservedAvgFromMappings() -> Extracts worksheet numeric values           |
|            |                                                                      |
|            +------------------------------------+                                 |
|            |                                    |                                 |
|            v                                    v                                 |
|  [ Daily Records Pipeline ]          [ Summary Metadata Pipeline ]                |
|  - STANDARD_DAILY_IMPORT_FIELDS       - Saved to farms.preservedAvg               |
|  - AVG strictly EXCLUDED              - Saved to farms.preservedAvgByDate         |
|  - Stored in dailyReports/{uid}       - Saved to importBatches.worksheets         |
|            |                                    |                                 |
|            +------------------+-----------------+                                 |
|                               |                                                   |
|                               v                                                   |
|                 [ Production Curve Export ]                                       |
|                 - Invokes reports.service.ts                                      |
|                 - Reads daily records + farm.preservedAvg                         |
|                 - Executes generate_production_curve.py                           |
|                 - Row 13: Canonical ACT % (Preserves valid 0.0)                   |
|                 - Row 14: Preserved AVG (Yellow #FFFF00, Bold)                    |
+-----------------------------------------------------------------------------------+
```

---

## 7. Production Environments & Deployment Guide

### 7.1 Production URLs & Credentials

| Component | Target URL | Source Code / Repository | Build Command |
| :--- | :--- | :--- | :--- |
| **Frontend** | `https://happy-farm-erp-frontend.vercel.app` | Monorepo `/frontend` (Vercel Project `happy-farm-erp-frontend`) | `tsc && vite build` |
| **Backend** | `https://happy-farm-erp-backend.onrender.com` | Git Repo: `Sri-Ram-git/happy_farm_erp_backend` (`main`) | `python -m pip install -r requirements.txt && tsc` |
| **Database** | GCP Console: Project `farm-form` | Cloud Firestore Native | Managed |

### 7.2 Release Procedures

#### Backend (Render)
1. Work is synchronized to the standalone backend worktree at `happy_farm_erp_backend_worktree`.
2. Run validation tests:
   ```bash
   npx vitest run src/productionExportAvg.test.ts
   python -m py_compile scripts/generate_production_curve.py
   npx tsc -p tsconfig.json --noEmit
   ```
3. Commit and push strictly to `render-backend/main`:
   ```bash
   git push render-backend render-avg-fix:main
   ```
4. Verify health check:
   ```bash
   curl https://happy-farm-erp-backend.onrender.com/health
   # Expected: {"status":"ok"}
   ```

#### Frontend (Vercel)
1. Run local build and validation:
   ```bash
   npm --prefix frontend run build
   npx vitest run frontend/src/services/avgImportMapping.test.ts frontend/src/services/xlsxImport.test.ts
   ```
2. Deploy to production via Vercel CLI from `frontend/`:
   ```bash
   cd frontend
   npx --yes vercel --prod --yes
   ```
3. Verify live bundle and HTTP 200 at `https://happy-farm-erp-frontend.vercel.app`.

---

## 8. Verification & Test Architecture

The codebase includes an extensive automated verification harness across both tiers:

```
Happy_Farm_ERP
+-- backend/src/productionExportAvg.test.ts (Excel Generation & Preserved AVG Integration)
|   +-- Verifies multi-farm worksheet creation (AP12, AP15, AP16)
|   +-- Verifies preserved AVG values appear on Row 14 with yellow styling
|   +-- Verifies stored numeric 0.0 is never treated as missing
|   +-- Verifies fallback calculation when actualProductionPct is absent
+-- backend/src/services/import.service.test.ts (Batch Import & Revert Transactions)
+-- backend/src/controllers/reports.export.security.test.ts (Cross-Farm Isolation Security)
+-- backend/src/services/userService.delete.test.ts (Cascade Deletion Security)
+-- frontend/src/services/avgImportMapping.test.ts (AVG Column Recognition & Wording)
+-- frontend/src/services/xlsxImport.test.ts (Historical Parser, Sanitization & Conflict Resolution)
```

---

## 9. Critical Rules for Future Developers & Agents

1. **Schema Non-Negotiable:** Never alter the path `dailyReports/{userId}/dailyLogs/{date}`. Never store daily logs at the root.
2. **Preserve AVG Exclusion:** Summary columns (`AVG`, `AVERAGE`) must never be written as daily production records in Firestore.
3. **Numeric Zero Preservation:** In all production curve formulas, a stored numeric `0` or `0.0` is a valid percentage (zero egg production) and must not fall back to egg calculations or `None`.
4. **Zero Force-Pushes:** Never use `--force` pushes on `main` or `master`.
5. **No Blind Clean/Reset:** Never execute `git reset --hard` or `git clean -fd` in the monorepo; always preserve user work-in-progress and untracked validation files.
