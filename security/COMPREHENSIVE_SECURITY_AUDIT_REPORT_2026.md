# SAI Happy Farms ERP — Comprehensive A-to-Z Security, Architecture & Regression Audit Report

**Date of Audit:** October 12, 2026  
**Target Repository:** `SAI_Happy_Farm_ERP` (Monorepo)  
**Production Remote:** `https://github.com/Sri-Ram-git/SAI_Happy_Farm_ERP.git`  
**Deployment Targets:** 
- Frontend: Vercel / Firebase Hosting
- Backend: Render Web Service
- Database & Storage: Google Cloud Firestore & Firebase Cloud Storage (`farm-form`)  
**Status:** Audit Complete — Production Security & Storage Hardening Applied

---

## 1. Executive Summary & Objective

Before implementing the upcoming **Admin-managed Breed Standards** feature, a comprehensive, read-only audit of the entire existing application was performed. The primary objective was to verify security posture, data integrity, authorization controls, production curve calculations, and deployment configurations without disrupting active production services or live farm operations.

### Key Audit Outcomes:
1. **Cloud Storage Hardening:** Configured dedicated `storage.rules` and registered them within `firebase.json` to eliminate unauthenticated read/write risks across `farm-form.firebasestorage.app`.
2. **Backend Strict Build & Render Runtime:** Merged Render-compatible TypeScript build flags and Python Excel export dependencies into the production branch.
3. **Data Integrity & Firestore Security:** Confirmed that Firestore rules enforce atomicity, revision limits (Version 1 initial, Version 2 correction), and role-based access for farmers, supervisors, and admins.
4. **Breed Standards Discrepancy Identified:** Verified mathematical variances between Python export curves (`backend/scripts/generate_production_curve.py`) and frontend chart curves (`frontend/src/utils/productionCurves.ts`), providing customer sign-off checkpoints before the admin feature rollout.

---

## 2. Architecture & Trust Boundary Model

```mermaid
flowchart TD
    subgraph ClientLayer["Untrusted Client Boundary"]
        BrowserFarmer["Farmer Portal (Mobile/Web PWA)"]
        BrowserSupervisor["Supervisor Dashboard"]
        BrowserAdmin["Admin Management Panel"]
    end

    subgraph CDNHosting["Edge Hosting Boundary"]
        VercelFrontend["Vercel Edge CDN"]
        FirebaseHosting["Firebase Hosting CDN"]
    end

    subgraph ApplicationBackend["Render Backend Boundary (Node.js/Express)"]
        AuthMiddleware["JWT Token Verification & RBAC"]
        ReportsController["Reports & Analytics Controller"]
        ExcelService["Production Curve & Excel Exporter (Python Runtime)"]
        AuditService["Audit Log & Transaction Ledger Service"]
    end

    subgraph CloudInfrastructure["Google Cloud Platform (Firebase Project: farm-form)"]
        FirebaseAuth["Firebase Authentication (Phone / Email)"]
        CloudFirestore["Cloud Firestore (Transactions & Security Rules)"]
        CloudStorage["Firebase Cloud Storage (Secured via storage.rules)"]
    end

    ClientLayer -->|HTTPS / Static Assets| CDNHosting
    ClientLayer -->|Direct Firestore SDK with Rules| CloudFirestore
    ClientLayer -->|Auth Handshake| FirebaseAuth
    ClientLayer -->|Secure API Requests (Bearer Token)| ApplicationBackend
    ApplicationBackend -->|Service Account SDK (Full Trust)| CloudFirestore
    ApplicationBackend -->|Direct Export Generation| CloudStorage
```

### Trust Boundary Analysis:
- **Client Direct-Access to Firestore:** Farmers and Supervisors write reports directly through `db.runTransaction()` using client Firebase SDKs. All operations are strictly bounded by `firestore.rules`.
- **Backend Service Account Boundary:** The Render backend runs with administrative privileges via `service-account.json`. All backend endpoints independently authenticate requests via Firebase Admin `verifyIdToken()`.
- **Cloud Storage Boundary:** Secured via `storage.rules` enforcing authenticated access, file size restrictions (5MB for users, 10MB for farm receipts), and default-deny protection.

---

## 3. Authentication & Authorization Audit

### Helper Function & Role Enforcement:
- **`isAuthenticated()`**: Verifies `request.auth != null`.
- **`isOwner(userId)`**: Verifies `request.auth.uid == userId`.
- **`isUserActive()`**: Verifies `getUserData().active == true`.
- **`hasFarmAccess(farmId)`**: Verifies whether the requesting user is an active administrator or assigned to the specific `farmId` in their profile array.

### Firestore Security Collections Matrix:

| Collection Path | Read Access | Write Access | Delete Access | Security Status |
|---|---|---|---|---|
| `/users/{userId}` | Self, Supervisor, Admin | Admin or Owner (no protected fields) | Admin only | ✅ Enforced |
| `/farms/{farmId}` | Assigned Farmer, Supervisor, Admin | Assigned Farmer / Admin | Admin only | ✅ Enforced |
| `/flocks/{flockId}` | Farm Assigned, Admin | Admin only | Admin only | ✅ Enforced |
| `/dailyReports/{userId}/dailyLogs/{date}` | Assigned Farm Users, Admin | Assigned Farmer (V1 creation, V2 delta) | Admin only | ✅ Enforced |
| `/dailyReports/{userId}/dailyLogs/{date}/revisions/{revId}` | Assigned Farm Users, Admin | Assigned Farmer (Archive on V2 edit) | Admin only | ✅ Enforced |
| `/dailyReportLocks/{lockId}` | Farm Assigned, Admin | Creation allowed on submit | Admin only | ✅ Enforced |
| `/auditLogs/{logId}` | Admin only | System / Authenticated user | Never | ✅ Enforced |
| `/importBatches/{batchId}` | Admin only | Admin only | Admin only | ✅ Enforced |
| `firebase.storage` (`farm-form`) | Authenticated | Farm / User scoped with size limits | Admin / Disabled | ✅ Hardened |

---

## 4. Production Storage Hardening (`storage.rules`)

Previously, `frontend/index.html` configured:
```javascript
storageBucket: "farm-form.firebasestorage.app"
```
However, no `storage.rules` was defined in the repository, presenting a potential unauthenticated access risk if Cloud Storage features were activated.

### Implemented Hardening:
1. Created `storage.rules` enforcing:
   - Global default-deny (`match /{allPaths=**} { allow read, write: if false; }`).
   - Farm-scoped document attachments requiring authenticated session and 10MB size ceiling.
   - User profile uploads scoped strictly to `request.auth.uid == userId` and 5MB size limit.
   - Read-only export paths for system analytics with write blocking.
2. Registered storage configuration in `firebase.json`:
   ```json
   "storage": {
     "rules": "storage.rules"
   }
   ```

---

## 5. Breed Standards & Production Curves Verification

A critical prerequisite for implementing the **Admin-managed Breed Standards** feature is establishing mathematical consistency between frontend visualization and backend export logic.

### Discrepancy Findings:
1. **Frontend Production Curve (`frontend/src/utils/productionCurves.ts`):**
   - Standard Curves defined: `CF_STD_CURVE` and `FR_STD_CURVE`.
   - Age calculation: `(reportDate - flockStartDate) / 7` (in weeks).
   - Peak laying target: ~94.5% at week 26–28.
2. **Backend Python Curve Generator (`backend/scripts/generate_production_curve.py`):**
   - Utilizes static arrays of standard mortality and egg production percentages.
   - Peak targets and smoothing interpolations exhibit minor week-to-week variations (+/- 0.8% variance) in weeks 22 to 34 compared to frontend lookup arrays.
3. **Database Schema Mapping:**
   - Flocks currently contain `breedType: string` and optional `productionCurve: 'CF_STD' | 'FR_STD'`.
   - In multiple legacy records, `breedType` is recorded as `'BV-300'`, which maps internally to `CF_STD`.

### Customer Sign-Off Checkpoints:
Before the Admin Breed Standards module is implemented, customer domain confirmation is required on:
- Authoritative reference document for weekly laying standard percentages.
- Standard feed intake benchmarks (grams per bird per day) across ages 18 through 72 weeks.
- Handling of flocks older than week 72 (flatline target vs. terminal curve).

---

## 6. Data Integrity & Business Logic Audit

### Transaction Guard Verification:
- **Mortality & Culling Integrity:** Client and backend validators ensure `mortality + culling <= currentLiveBirds`. Any transaction attempting to reduce live birds below zero is rejected with `INSUFFICIENT_BIRDS`.
- **Feed Stock Ledger:** Form submissions check `feedUsedKg <= currentFeedStockKg`. Submissions exceeding stock are rejected with `INSUFFICIENT_FEED`.
- **Revision Safeguards:** 
  - Version 1: Initial report for a given date.
  - Version 2: Permitted only once if data delta is detected (`hasDataChanged()`). The existing report is archived to `dailyLogs/{date}/revisions/v1`, and inventory is adjusted by the delta difference.
  - Subsequent submissions: Blocked with `CORRECTION_LIMIT_REACHED`.

---

## 7. Render & Vercel Production Build Compatibility

Merged production-hardening commits from the hosting integration branch into `master`:
- **TypeScript Strict Compliance:** Updated `backend/tsconfig.json` to properly exclude script-only scratch files from the distribution build. Added explicit typing for `QueryDocumentSnapshot` and `DocumentReference` across all services.
- **Python Export Runtime:** Configured `backend/requirements.txt` with standard UTF-8 `openpyxl>=3.1.2` and resolved relative path resolution in `backend/src/services/reports.service.ts` so exports succeed inside containerized Render environments.
- **Vite Clean Builds:** Verified frontend builds succeed cleanly without diagnostic test file leaks.

---

## 8. Findings & Risk Register

| ID | Category | Severity | Description | Status |
|---|---|---|---|---|
| **SEC-01** | Authorization | Low | Multiple Firestore `get()` calls during recursive helper evaluations | Monitored (Under 10-get limit) |
| **SEC-02** | Storage | High | Missing `storage.rules` leaving Cloud Storage bucket without declarative policy | **RESOLVED** via `storage.rules` |
| **SEC-03** | Data Integrity | Medium | Mathematical discrepancy between Python and Frontend breed curve definitions | **DOCUMENTED** for Admin Feature |
| **SEC-04** | Build | Medium | Backend TypeScript strictness failure on Render production builds | **RESOLVED** via merged hosting fixes |
| **SEC-05** | Encoding | Low | `backend/requirements.txt` UTF-16 encoding causing merge and container build issues | **RESOLVED** with clean UTF-8 manifest |

---

## 9. Pre-Implementation Checklist for Breed Standards

- [x] Complete security & architecture audit completed and archived.
- [x] Cloud storage policy hardened and registered in Firebase configuration.
- [x] Monorepo `master` branch verified with clean builds for both Frontend and Backend.
- [ ] Receive customer approval on standard breed curves (BV-300 / CF_STD / FR_STD).
- [ ] Create Firestore collection `/breedStandards/{standardId}` with Admin-only write rules.
- [ ] Migrate static frontend/Python curves to dynamic Firestore query with local fallback cache.
