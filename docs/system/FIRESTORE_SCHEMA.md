# Firestore Schema — Verified from Live Data + Source Code

## Collections

### 1. `users/{userId}`
```
{
  name: string,           // "ramu"
  email: string,          // "farmer@test.com"
  phone_no: string|number,// "85556633" (inconsistent type in existing data)
  role: string,           // "farmer" | "supervisor" | "admin"
  active: boolean,        // true
  farmIds: string[],      // ["AP12"]
  supervisor_id?: string[],// ["sp6"] (supervisor only)
  createdAt: Timestamp,
  updatedAt?: Timestamp
}
```

### 2. `farms/{farmId}`
Document ID = farmId (e.g. "AP12", "AP13")
```
{
  farmId: string,           // "AP12"
  name: string,             // "Farm Alpha 12"
  location: string,         // "Region B"
  active: boolean,          // true
  farmIds: string[],        // ["AP12"] (legacy, redundant)

  // Master Bird Inventory
  initialBirdCount: number, // 1000
  currentBirdCount: number, // 992

  // Master Feed Inventory
  initialFeedKg: number,       // 5000
  currentFeedKg: number,       // 4880
  totalFeedLoadedKg: number,   // 5000
  totalFeedConsumedKg: number, // 120

  // Control
  inventoryInitialized: boolean,  // true
  inventoryInitializedAt: Timestamp,
  inventoryUpdatedAt: Timestamp,
  updatedAt: Timestamp
}
```

### 3. `flocks/{flockId}`
```
{
  flockId: string,        // auto-generated
  farmId: string,         // "AP12"
  flockName: string,
  initialBirds: number,
  currentBirds: number,
  totalMortality: number,
  totalCulling: number,
  totalEggs: number,
  startDate: string,      // "2026-01-15"
  currentAgeWeeks: number,
  breedType: string,
  productionCurve: "CF_STD" | "FR_STD",
  status: "active" | "completed",
  createdAt: string,
  updatedAt: string
}
```

### 4. `dailyReports/{userId}` (Parent Metadata)
```
{
  userId: string,
  farmId: string,
  flockId: string,
  lastSubmissionDate: string,  // "2026-09-02"
  updatedAt: string
}
```

### 5. `dailyReports/{userId}/dailyLogs/{submissionDate}_{flockId}` (Actual Report)
```
{
  userId: string,
  submittedBy: string,
  farmId: string,
  flockId: string,
  submissionDate: string,       // "2026-09-02"
  submissionMethod: "DIGITAL_FORM",
  submissionVersion: number,    // 1 or 2
  status: "submitted" | "corrected",

  // Bird Inventory Snapshot
  openingBirdCount: number,
  closingBirdCount: number,
  birdCount: number,            // = closingBirdCount

  // Mortality
  mortality: number,
  culling: number,

  // Feed
  feedKg: number,
  feedGrams: number,
  feedG: number,

  // Eggs
  eggsProduced: number,
  selectionEggs: number,
  eggWeight: { min: number, max: number, avg: number },

  // Body Weight
  bodyWeight: { min: number, max: number, avg: number },

  // Environment
  temperature: number,
  tempMin: number,
  tempMax: number,
  ammoniaPpm: number,

  // Notes
  remarks: string,

  // Timestamps
  submittedAt: string,
  createdAt: string,
  updatedAt: string
}
```

### 6. `dailyReportLocks/{farmId}_{submissionDate}` (Backend)
```
{
  farmId: string,
  submissionDate: string,
  reportId: string,
  createdAt: string
}
```

### 7. `auditLogs/{logId}`
```
{
  eventType: string,
  uid: string,
  farmId?: string,
  resourceId?: string,
  timestamp: string,
  requestId: string,
  metadata?: object
}
```

### 8. Subcollections
- `farms/{farmId}/birdTransactions/{txId}` — Mortality/Culling audit trail
- `farms/{farmId}/feedTransactions/{txId}` — Feed usage/load audit trail
- `dailyReports/{userId}/dailyLogs/{id}/revisions/v1` — Archived V1 when corrected
