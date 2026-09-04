# Data Flow — End-to-End

## 1. Farmer Report Submission Flow
```
FARMER LOGIN
  │ Firebase Auth: signInWithEmailAndPassword
  ▼
LOAD USER DOCUMENT
  │ Firestore: users/{userId}
  │ Extract: role, active, farmIds[]
  ▼
VALIDATE ACCESS
  │ role === 'farmer'
  │ active === true
  │ farmIds.length > 0
  ▼
LOAD ASSIGNED FARM
  │ Firestore: farms/{farmId}
  │ Extract: inventoryInitialized, currentBirdCount, currentFeedKg
  ▼
LOAD ACTIVE FLOCKS
  │ Firestore: flocks where farmId=X AND status='active'
  ▼
INVENTORY GATE
  │ IF inventoryInitialized !== true → BLOCK
  ▼
FARMER FILLS FORM
  │ 3 steps: Production → Mortality/Feed → Environment
  ▼
FRONTEND VALIDATION
  │ mortality + culling <= currentBirdCount
  │ feedKg <= currentFeedKg
  │ Business rule checks
  ▼
FIRESTORE TRANSACTION (reportService.ts)
  │
  ├── READ farms/{farmId} (master inventory)
  ├── READ flocks/{flockId} (flock state)
  ├── READ dailyReports/{userId}/dailyLogs/{date}_{flockId} (duplicate check)
  │
  ├── WRITE dailyReports/{userId} (parent metadata)
  ├── WRITE dailyReports/{userId}/dailyLogs/{date}_{flockId} (full report)
  ├── WRITE farms/{farmId} (update currentBirdCount, currentFeedKg)
  ├── WRITE flocks/{flockId} (update currentBirds, totals)
  ├── WRITE farms/{farmId}/birdTransactions/{txId} (audit)
  └── WRITE farms/{farmId}/feedTransactions/{txId} (audit)
  │
  ▼ ALL ATOMIC — commit or rollback
SUCCESS
```

## 2. Admin Dashboard Data Flow
```
ADMIN LOGIN
  │ Firebase Auth
  ▼
VERIFY admin ROLE
  │ users/{adminUid}.role === 'admin'
  ▼
SUBSCRIBE TO ALL DATA (real-time)
  ├── subscribeToAllFarms() → farms collection
  ├── subscribeToAllUsers() → users collection
  ├── subscribeToAllFlocks() → flocks collection
  ├── collectionGroup('dailyLogs').onSnapshot() → ALL reports
  └── subscribeToAllBirdInventories() → farms/{farmId} per farm
  ▼
COMPUTE DASHBOARD METRICS
  ├── Total Birds = SUM(farmInventories.currentBirdCount)
  ├── Avg Production = AVG(eggsProduced / openingBirdCount × 100)
  ├── Submission Matrix = activeFarmsWithFarmers × daysInRange
  └── Charts = date-grouped aggregations
```

## 3. Supervisor Dashboard Data Flow
```
SUPERVISOR LOGIN
  │ Firebase Auth
  ▼
VERIFY supervisor ROLE
  │ users/{supervisorUid}.role === 'supervisor'
  │ Extract: farmIds[] (assigned farms)
  ▼
SUBSCRIBE TO SCOPED DATA (real-time)
  ├── subscribeToAllFarms() → FILTER by assignedFarmIds
  ├── subscribeToDailyReportsByFarms(assignedFarmIds) → FILTER by farmIds
  └── subscribeToAllBirdInventories(activeFarmIds) → per assigned farm
  ▼
SAME DASHBOARD COMPONENT as Admin
  └── EnterpriseAnalyticsDashboard role="supervisor"
```

## 4. Admin Creates Farmer Flow
```
ADMIN → AdminUsersPage → Create Farmer Form
  │
  ▼
POST /api/v1/admin/users/farmer (Bearer token)
  │ Backend: authMiddleware → requireRole(ADMIN)
  ▼
BACKEND TRANSACTION (farmer.service.ts)
  ├── Firebase Auth: createUser(email, password)
  ├── Derive next Farm ID dynamically from existing farms
  ├── Firestore: CREATE farms/{newFarmId}
  ├── Firestore: CREATE users/{newUserId}
  └── Audit log
  │
  ▼ If error: DELETE auth user (compensation)
SUCCESS → New farmer can login immediately
```
