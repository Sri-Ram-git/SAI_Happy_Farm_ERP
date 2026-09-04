# Firestore Schema

This is the definitive, verified structure of the production database.

## 1. `users` Collection
**Path:** `users/{userId}`
**Purpose:** Maps Firebase Auth UID to application roles and farm assignments.
- **ID:** Firebase Auth UID
- `name` (string)
- `email` (string)
- `phone_no` (string)
- `role` ('farmer' | 'supervisor' | 'admin')
- `active` (boolean)
- `farmIds` (string[]: e.g. `["AP12"]`)
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

## 2. `farms` Collection (MASTER INVENTORY)
**Path:** `farms/{farmId}`
**Purpose:** Holds farm definitions and the LIVE master inventory balances.
- `farmId` (string)
- `name` (string)
- `location` (string)
- `active` (boolean)
- `inventoryInitialized` (boolean)
- `initialBirdCount` (number)
- `currentBirdCount` (number) — **MASTER BIRD BALANCE**
- `initialFeedKg` (number)
- `currentFeedKg` (number) — **MASTER FEED BALANCE**
- `totalFeedLoadedKg` (number)
- `totalFeedConsumedKg` (number)
- `inventoryUpdatedAt` (timestamp)
- `updatedAt` (timestamp)

## 3. `dailyReports` Collection
**Path:** `dailyReports/{userId}`
**Purpose:** Root collection mapping reports to the submitting farmer.
- `userId` (string)
- `farmId` (string)
- `updatedAt` (timestamp)

### `dailyLogs` Subcollection
**Path:** `dailyReports/{userId}/dailyLogs/{YYYY-MM-DD}`
**Purpose:** Stores the actual daily report snapshot for a specific date.
- `submissionDate` (string: YYYY-MM-DD)
- `submissionVersion` (number: 1, 2)
- `status` ('submitted' | 'corrected')
- `openingBirdCount` (number) — **FROZEN START-OF-DAY SNAPSHOT**
- `closingBirdCount` (number) — **FROZEN END-OF-DAY SNAPSHOT**
- `birdCount` (number) — Legacy mapped to closingBirdCount
- `openingFeedKg` (number) — **FROZEN START-OF-DAY SNAPSHOT**
- `feedKg` (number) — Consumed feed
- `closingFeedKg` (number)
- `mortality` (number)
- `culling` (number)
- `eggsProduced` (number)
- `selectionEggs` (number)
- `temperature` (number)
- `tempMin` / `tempMax` (number)
- `eggWeight` / `bodyWeight` (map: min, max, avg)
- `remarks` (string)

## 4. `flocks` Collection (Legacy / Analytics cohort)
**Path:** `flocks/{flockId}`
**Purpose:** Used primarily by Admin/Supervisor for historical cohort age analytics. Daily reports conditionally update these if they exist, but they are NOT the master inventory.
- `flockId` (string)
- `farmId` (string)
- `status` ('active' | 'completed')
- `startDate` (string)
- `currentBirds` (number)

## Important Firestore Relationships
- **Authoritative Mapping:** The `Firebase Auth UID` maps exactly to `users/{UID}`. 
- **Farm Association:** `users/{UID}.farmIds` dictates which `farms/{farmId}` a user can act upon.
- **Report Pathing:** Reports are exclusively stored under `dailyReports/{UID}`. The `dailyLog` document ID is exclusively the ISO date `YYYY-MM-DD`. Do not use arbitrary unique strings for the daily log ID.
