# CHANGELOG.md

*Concise chronological changelog. Do not include temporary debugging noise.*

---

## 2026-09-02

### Create Farmer Feature
- Added POST `/api/v1/admin/users/farmer` backend endpoint
- Added Zod validation schema for farmer creation
- Added Firebase Auth user creation via Admin SDK (secure backend)
- Added Firestore user document creation at `users/{authUid}`
- Added farm validation (ensures assigned farms exist)
- Added duplicate email detection
- Added audit logging (USER_CREATED event)
- Added rollback on partial failure (deletes Auth user if Firestore write fails)
- Added "Create Farmer" button and form to Admin Users page
- Added DetailDrawer-based form with name/email/phone/password/farm selection
- Added client-side and server-side validation
- Added success confirmation with auto-close
- Added error display with field-level errors

### Admin Dashboard Real-Time Sync
- Added `subscribeToAllUsers()` real-time listener
- Added `subscribeToAllFarms()` real-time listener
- Added `subscribeToAllBirdInventories()` real-time listener
- Replaced one-time fetches with real-time subscriptions in AdminDashboard

### Admin Portal Fix
- Fixed "farmsLoading is not defined" crash by removing diagnostic console.log block
- Fixed React key collision in All Reports table (duplicate keys when multiple farms submit same date)
- Fixed collectionGroup error propagation (`newQFailed` flag now properly set)

### Authentication System
- Implemented Firebase email/password authentication
- Added role-based route protection (farmer, supervisor, admin)
- Created ManagementLoginPage for supervisor/admin login
- Added role normalization utility for inconsistent Firestore data

### Farmer Daily Report
- Created 3-step multi-step form (Feed & Health, Eggs & Temperature, Weights & Remarks)
- Implemented duplicate prevention (same farm/date cannot submit twice)
- Removed birdCount from farmer input (now read from inventory)
- Added form validation with error messages

### Firestore Schema Migration
- Migrated daily reports from `dailyReports/{randomId}` to `dailyReports/{userId}/dailyLogs/{date}`
- Added parent documents at `dailyReports/{userId}` with metadata
- Implemented backward compatibility with old format
- Added `collectionGroup('dailyLogs')` queries

### Master Inventory System
- Created `farms/{farmId}/inventory/birds` for bird count management
- Created `farms/{farmId}/inventory/feed` for feed stock management
- Implemented atomic transaction: report submission + inventory deduction
- Created bird transaction records (MORTALITY, CULLING)
- Created feed transaction records (FEED_USAGE, FEED_LOAD)
- Created FeedLoadPage for admin/supervisor feed loading

### Admin Dashboard
- Implemented 10 interactive KPI cards with DetailDrawer
- Dynamic KPIs from real Firestore data + inventory
- Added Production & Mortality trend chart (LineChart)
- Added Daily Submissions chart (BarChart)
- Added Feed Usage chart (AreaChart)
- Added detail drawers for all KPI types
- Fixed collectionGroup error propagation

### Supervisor Dashboard
- Implemented 8 KPI cards + 9 today's summary cards
- Farm-filtered data (only assigned farms)
- Production, mortality, and feed charts

### Data Layer
- Implemented dual-format report reading (old + new)
- Added deduplication by `farmId_submissionDate`
- Implemented real-time `onSnapshot` listeners
- Added error logging with Firestore index hints
- Made collectionGroup failures non-fatal

### Backend API
- Created Express server with middleware stack
- Implemented auth middleware with Firebase Admin SDK
- Added RBAC middleware (role-based + farm-level access)
- Added Zod validation middleware
- Added rate limiting middleware
- Created reports, farms, and admin routes

### UI Components
- Created DetailDrawer component with slide-in animation
- Added DateFilter component (Today, 7, 30, 90 days)
- Added LoadingState, EmptyState, ErrorBoundary components
- Added KpiCard with clickable support
- Added professional CSS styles for drawers, charts, tables
