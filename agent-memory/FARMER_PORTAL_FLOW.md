# Farmer Portal Execution Flow

## 1. Authentication & User Profile
- Firebase Auth triggers state change.
- `AuthContext.tsx` reads `auth.currentUser.uid`.
- Fetches `users/{uid}`.
- Validates `role === 'farmer'` and `active === true`.
- Asserts that `farmIds` array has at least one valid Farm ID.

## 2. Inventory & Flock Loading (`FarmerFormPage.tsx`)
- Extracts primary `farmId = userProfile.farmIds[0]`.
- Listens to `farms/{farmId}` snapshot to load master inventory (Feed, Birds).
- Listens to `flocks` where `farmId == farmId` (Used for optional legacy flock ID assignment).
- Subscribes to today's canonical report `dailyReports/{uid}/dailyLogs/{YYYY-MM-DD}` to detect existing submissions and populate draft data.

## 3. UI State Management
- `FarmFormData` holds raw string values.
- Step-by-step form uses `validateStep` (checks `isNaN` and limits).
- Drafts are saved to `localStorage` using a key tied to `farmId` and `date`.

## 4. Backend Submission (`reportService.ts`)
- Normalizes units (e.g. `g` to `kg`).
- Uses `runTransaction` for idempotency and safety.
- **Guards:** Checks `user` authorization, verifies `farmDoc` exists and `inventoryInitialized === true`.
- Optional: Checks if `flockDoc` exists. (If it doesn't, gracefully skips flock updates to support flock-less farm submissions).
- Blocks submission if `input.feedKg > currentFeedStock` or `deduction > currentBirdCount`.
- Writes canonical log to `dailyReports/{userId}/dailyLogs/{YYYY-MM-DD}`.
- Computes new balances and atomically sets `currentBirdCount` and `currentFeedKg` on `farms/{farmId}`.
