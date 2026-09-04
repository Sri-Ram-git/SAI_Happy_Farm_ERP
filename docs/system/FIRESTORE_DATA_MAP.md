# Firestore Data Map

**Date:** 2026-09-03
**Status:** FULLY MAPPED

## Core Collections

### 1. `users`
**Path:** `users/{userId}`
- **Purpose:** Master user profiles, RBAC, and farm assignment.
- **Fields:**
  - `name` (string)
  - `email` (string)
  - `phone_no` (number | string)
  - `role` (string: `'farmer'`, `'supervisor'`, `'admin'`)
  - `active` (boolean)
  - `farmIds` (string[]: e.g., `["AP12", "AP13"]`)
  - `createdAt`, `updatedAt` (Timestamp)

### 2. `farms`
**Path:** `farms/{farmId}`
- **Purpose:** Master inventory for live bird and feed counts.
- **Fields:**
  - `farmId` (string)
  - `name` (string)
  - `location` (string)
  - `active` (boolean)
  - `initialBirdCount` (number)
  - `currentBirdCount` (number) - **MASTER BIRD INVENTORY**
  - `initialFeedKg` (number)
  - `currentFeedKg` (number) - **MASTER FEED INVENTORY**
  - `inventoryInitialized` (boolean)
  - `createdAt`, `updatedAt` (Timestamp)

### 3. `flocks`
**Path:** `flocks/{flockId}`
- **Purpose:** Flock lifecycle management.
- **Fields:**
  - `flockId` (string)
  - `farmId` (string)
  - `status` (string: `'active'`, `'completed'`)
  - `currentBirds` (number)
  - `totalMortality`, `totalCulling`, `totalEggs` (number)
  - `startDate` (YYYY-MM-DD)

### 4. `dailyReports` (Parent Metadata)
**Path:** `dailyReports/{userId}`
- **Purpose:** Parent container for a user's reports.
- **Fields:**
  - `userId`, `farmId`, `flockId` (string)
  - `lastSubmissionDate` (YYYY-MM-DD)

### 5. `dailyLogs` (Subcollection)
**Path:** `dailyReports/{userId}/dailyLogs/{YYYY-MM-DD}_{flockId}`
- **Purpose:** Canonical historical daily report records. Queried globally via `collectionGroup('dailyLogs')`.
- **Fields:**
  - `submissionDate` (YYYY-MM-DD)
  - `submissionVersion` (number: 1, 2)
  - `status` (string: `'submitted'`, `'corrected'`)
  - `openingBirdCount`, `closingBirdCount`, `birdCount` (number)
  - `openingFeedKg`, `feedKg`, `closingFeedKg` (number)
  - `mortality`, `culling` (number)
  - `eggsProduced`, `selectionEggs` (number)
  - `temperature`, `tempMin`, `tempMax` (number)
  - `eggWeight`: `{ min, max, avg }`
  - `bodyWeight`: `{ min, max, avg }`
  - `ammoniaPpm` (number)
  - `remarks` (string)

### 6. `feedTransactions` (Subcollection)
**Path:** `farms/{farmId}/feedTransactions/{autoId}`
- **Purpose:** Audit trail for feed additions and subtractions.
- **Fields:** `type` (`FEED_USAGE`, `FEED_USAGE_CORRECTION`, `FEED_LOAD`), `feedKg`, `reportDate`.

### 7. `birdTransactions` (Subcollection)
**Path:** `farms/{farmId}/birdTransactions/{autoId}`
- **Purpose:** Audit trail for mortality and culling.
- **Fields:** `type` (`MORTALITY`, `CULLING`), `count`, `reportDate`.
