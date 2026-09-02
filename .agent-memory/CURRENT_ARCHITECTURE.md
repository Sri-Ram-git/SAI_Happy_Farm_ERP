# CURRENT_ARCHITECTURE.md

## Project Structure

```
Happy_Farm_ERP/
├── frontend/                    # React + Vite SPA
│   ├── index.html               # Firebase CDN scripts + config
│   ├── src/
│   │   ├── App.tsx              # All routes
│   │   ├── main.tsx             # Entry point
│   │   ├── context/AuthContext.tsx
│   │   ├── services/            # Firestore data access
│   │   ├── hooks/               # React hooks
│   │   ├── utils/               # Helpers, KPI calcs, validation
│   │   ├── components/          # Shared UI components
│   │   ├── pages/               # All page components
│   │   ├── config/              # Firebase config, KPI thresholds
│   │   └── styles.css           # All CSS
│   └── package.json
├── src/                         # Backend Express API
│   ├── index.ts                 # Express app entry
│   ├── config/                  # Environment, Firebase Admin init
│   ├── middleware/               # Auth, RBAC, validation, rate limit
│   ├── routes/                  # API routes
│   ├── controllers/             # Request handlers
│   ├── services/                # Business logic
│   ├── repositories/            # Firestore access (Admin SDK)
│   ├── validators/              # Zod schemas, business rules
│   ├── types/                   # TypeScript types
│   └── utils/                   # Errors, logger, requestId
├── scripts/seed-users.mjs       # Test user seeding
├── service-account.json         # Firebase Admin SDK credentials
└── package.json                 # Backend dependencies
```

## Frontend Architecture

### Authentication Flow
1. User enters email/password on `LoginPage` or `ManagementLoginPage`
2. `authService.loginUser()` calls `firebase.auth().signInWithEmailAndPassword()`
3. `AuthContext.onAuthStateChanged` fires
4. Fetches user profile from `users/{uid}` via `userService.getUserProfile()`
5. Validates: profile exists, `active === true`, role exists
6. Sets `isAuthenticated = true`, `role`, `userProfile`
7. `ProtectedRoute` or `ProtectedManagementRoute` checks role
8. Redirects to appropriate dashboard

### Daily Report Submission Flow (VERIFIED IMPLEMENTED)
1. Farmer opens `/farmer/form` → `FarmerFormPage`
2. Fetches bird count from `farms/{farmId}/inventory/birds` (read-only display)
3. Farmer fills 3-step form: Feed & Health → Eggs & Temperature → Weights & Remarks
4. Clicks "Verify" → sees summary → clicks "Submit Report"
5. `reportService.submitReport()` runs a **Firestore transaction** that:
   - Checks for duplicate (`dailyReports/{userId}/dailyLogs/{date}`)
   - Reads bird inventory → `openingBirdCount = currentBirdCount`
   - Reads feed inventory → `currentFeedStock`
   - Calculates `closingBirdCount = openingBirdCount - mortality - culling`
   - Calculates `newFeedStock = currentFeedStock - feedKg`
   - Writes `dailyReports/{userId}/dailyLogs/{YYYY-MM-DD}` with system-generated fields
   - Updates `farms/{farmId}/inventory/birds/currentBirdCount`
   - Updates `farms/{farmId}/inventory/feed/currentFeedStockKg`
   - Creates `birdTransactions` records (MORTALITY, CULLING)
   - Creates `feedTransactions` record (FEED_USAGE)

### Admin Dashboard Data Flow (VERIFIED IMPLEMENTED)
1. `AdminDashboard` mounts
2. Fetches `farms` via `getAllFarms()`, `users` via `getAllUsers()`
3. For each active farm, fetches `farms/{farmId}/inventory/birds` for bird count
4. Subscribes to reports via `useAllDailyReports(startDate, endDate)`
5. `subscribeToAllDailyReports` sets up TWO parallel listeners:
   - Old format: `collection('dailyReports').where('submissionDate', ...)`
   - New format: `collectionGroup('dailyLogs').where('submissionDate', ...)`
6. Reports merged, deduped by `farmId_submissionDate`
7. KPIs computed from merged reports + farm inventories
8. All 10 KPI cards are clickable → open `DetailDrawer` with detailed data

### Supervisor Dashboard Data Flow (VERIFIED IMPLEMENTED)
Same pattern as Admin but filtered to `assignedFarmIds` from `userProfile.farmIds`.

### Report Data Reading (VERIFIED IMPLEMENTED)
- `reportDataService.ts` reads BOTH formats simultaneously
- Old format: `collection('dailyReports')` with `isParentDoc()` filter to exclude parent user documents
- New format: `collectionGroup('dailyLogs')` with range query on `submissionDate`
- `normalizeReport()` handles both formats with safe defaults
- `dedupeAndSort()` ensures no double-counting

## Backend Architecture (Express API)

### Running on port 3000 (separate from frontend on port 5173)

### API Routes
- `POST /api/v1/reports/daily` — Create daily report (with auth, rate limit, validation)
- `GET /api/v1/reports/daily/:id` — Get report by ID
- `GET /api/v1/farms` — List farms (role-filtered)
- `GET /api/v1/farms/:farmId` — Get farm by ID (with farm access check)
- `GET /api/v1/admin/users` — List users (admin only, stub)

### Middleware Stack
1. Helmet (security headers)
2. CORS
3. JSON parsing (100kb limit)
4. Request ID generation
5. Global rate limiter
6. Per-route: auth → role check → farm access → validation → controller

### Important: Frontend Does NOT Use Backend API
The frontend reads/writes Firestore directly via CDN SDK. The Express API is an independent layer, currently used only for backend validation tests.

## CURRENT vs TARGET Implementation

### CURRENTLY IMPLEMENTED
- Farmer login + daily report submission with inventory updates
- Admin dashboard with 10 interactive KPI cards + detail drawers
- Supervisor dashboard with farm-filtered KPIs + today's summary
- Feed load workflow for admin/supervisor
- Bird and feed inventory management
- Atomic report submission with inventory deduction
- Real-time data via onSnapshot listeners
- Backward compatibility with old report format

### TARGET ARCHITECTURE (partially implemented)
- Backend API should be the primary data access layer (currently unused by frontend)
- Cloud Functions for server-side inventory updates (currently done client-side)
- Push notifications for missing reports
- Export/download functionality
