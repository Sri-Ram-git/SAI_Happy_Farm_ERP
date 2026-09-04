# Data Flow

This document details the complete end-to-end data flow for the most critical paths in the Farm ERP.

## 1. User Creation & Provisioning
**Actor:** Admin
1. Admin opens the User Management Dashboard.
2. Admin creates a new farmer via the `userService.ts` logic.
3. Firebase Authentication provisions the user, returning a `UID`.
4. The `users/{uid}` document is written containing `role: 'farmer'` and assigned `farmIds: ["AP12"]`.
5. The corresponding `farms/AP12` document must already exist or be initialized with starting master inventory.

## 2. Farmer Daily Report Submission
**Actor:** Farmer
1. Farmer logs into the application using Firebase Auth.
2. `AuthContext` queries `users/{uid}` to resolve the user's role and `farmIds`.
3. The Farmer Portal mounts `FarmerFormPage`.
4. The frontend subscribes to `farms/{farmIds[0]}` to establish the master inventory context (`currentBirdCount`, `currentFeedKg`).
5. The frontend subscribes to `dailyReports/{uid}/dailyLogs/{YYYY-MM-DD}` to check if today's report already exists.
6. The farmer fills out mortality, culling, and feed consumption.
7. The farmer clicks "Submit".
8. `reportService.submitReport` executes an **Atomic Firestore Transaction**:
   - Reads `farms/{farmId}` to verify sufficient inventory exists.
   - Calculates new closing inventory (e.g., `closingBirds = currentBirds - mortality - culling`).
   - Writes `dailyReports/{uid}/dailyLogs/{YYYY-MM-DD}` establishing the frozen `openingBirdCount` and `openingFeedKg`.
   - Modifies `farms/{farmId}` with the newly deducted live master inventory.
9. The transaction resolves, and the frontend state updates. The UI headers safely continue rendering the frozen snapshot from `todayReport`.

## 3. Dashboard Aggregation (Supervisor / Admin)
**Actor:** Supervisor / Admin
1. User navigates to their respective dashboard.
2. The frontend utilizes `reportDataService.ts` and `flockDataService.ts` to execute batch queries or real-time listeners across `farms`, `users`, and `dailyReports`.
3. Metrics like "Total Birds" directly aggregate the `currentBirdCount` from all active `farms`.
4. Metrics like "Submitted Today" query `dailyReports` across all users looking for the exact `YYYY-MM-DD` match.
5. All calculations happen client-side in the React components/hooks utilizing the synchronized real-time Firestore data streams. No middle-tier API intercepts or transforms the data.
