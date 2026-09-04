# Verified Firestore Schema

## Master Collections

### `users`
**Path:** `users/{userId}`
- **ID:** Firebase Auth UID
- `name` (string)
- `email` (string)
- `role` ('farmer' | 'supervisor' | 'admin')
- `active` (boolean)
- `farmIds` (string[]: e.g. `["AP12"]`)

### `farms`
**Path:** `farms/{farmId}`
- `farmId` (string)
- `active` (boolean)
- `inventoryInitialized` (boolean)
- `currentBirdCount` (number) - **MASTER BIRD BALANCE**
- `currentFeedKg` (number) - **MASTER FEED BALANCE**

### `flocks`
**Path:** `flocks/{flockId}`
- **Purpose:** Used primarily by Admin/Supervisor for historical analytics (age and production curves).
- `farmId` (string)
- `status` ('active' | 'completed')
- `startDate` (ISO Date)

### `dailyReports`
**Path:** `dailyReports/{userId}`
- `userId` (string)
- `farmId` (string)

#### `dailyLogs` (Subcollection)
**Path:** `dailyReports/{userId}/dailyLogs/{YYYY-MM-DD}`
- `submissionDate` (YYYY-MM-DD)
- `submissionVersion` (number)
- `birdCount` (number)
- `feedKg` (number)
- `mortality`, `culling` (number)
- `eggsProduced`, `selectionEggs` (number)
- `temperature` (number)
