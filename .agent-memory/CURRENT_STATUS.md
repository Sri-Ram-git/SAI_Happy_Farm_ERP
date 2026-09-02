# CURRENT_STATUS.md

*Last updated: 2026-09-02*

## CURRENTLY WORKING

### Authentication
- ✅ Farmer login (`/login`) with email/password
- ✅ Management login (`/management/login`) for supervisor/admin
- ✅ Role-based route protection (`ProtectedRoute`, `ProtectedManagementRoute`)
- ✅ Session management with `onAuthStateChanged`
- ✅ Role normalization (handles inconsistent casing/whitespace)
- ✅ Logout with proper cleanup

### Farmer
- ✅ Multi-step daily report form (3 steps + verify)
- ✅ Bird count read-only from inventory (not user-entered)
- ✅ Atomic report submission with inventory deduction
- ✅ Duplicate prevention (same farm/date cannot submit twice)
- ✅ Form validation with error messages

### Admin Dashboard
- ✅ 10 interactive KPI cards with DetailDrawer
- ✅ Dynamic KPIs from real Firestore data
- ✅ Today's submissions, missing farms, bird count, production, mortality
- ✅ Production & Mortality trend chart (LineChart)
- ✅ Daily submissions chart (BarChart)
- ✅ Feed usage chart (AreaChart)
- ✅ Detail drawers for all KPIs (farms, farmers, supervisors, submitted, missing, birds, production, mortality, reports)
- ✅ Date range filtering (Today, 7, 30, 90 days)

### Admin User Management
- ✅ User list with role filtering
- ✅ Activate/Deactivate users
- ✅ Create Farmer via backend API (Firebase Auth + Firestore)
- ✅ Farm assignment from existing farms collection
- ✅ Duplicate email detection
- ✅ Audit logging (USER_CREATED event)

### Supervisor Dashboard
- ✅ 8 KPI cards + 9 today's summary cards
- ✅ Farm-filtered data (only assigned farms)
- ✅ Charts (production, mortality, feed)
- ✅ Date range filtering

### Data Layer
- ✅ `collectionGroup('dailyLogs')` queries for new report format
- ✅ Old format backward compatibility
- ✅ Deduplication by `farmId_submissionDate`
- ✅ Real-time `onSnapshot` listeners
- ✅ `isParentDoc()` filter to exclude parent documents
- ✅ Error logging with Firestore index hints
- ✅ Error propagation fixed (`newQFailed` now properly set)

### Inventory
- ✅ Bird inventory at `farms/{farmId}/inventory/birds`
- ✅ Feed inventory at `farms/{farmId}/inventory/feed`
- ✅ Bird transaction records (`birdTransactions/records`)
- ✅ Feed transaction records (`feedTransactions/records`)
- ✅ Feed load workflow (FeedLoadPage)
- ✅ Atomic inventory updates in report submission transaction

### Other Pages
- ✅ Admin Users page (activate/deactivate)
- ✅ Admin Farms page with metrics
- ✅ Admin Farm Detail page with KPIs, charts, report history
- ✅ Admin Analytics page with 4 charts
- ✅ Admin Submissions page with search
- ✅ Supervisor Farms, Farm Detail, Analytics, Rankings, Submissions pages
- ✅ Feed Load page (shared admin/supervisor)

## CURRENTLY FIXED

- ✅ **"farmsLoading is not defined" error** — Removed diagnostic console.log block that referenced undefined `farmsLoading` variable (was typo for `farmLoading`)
- ✅ **React key collision** — Fixed duplicate keys in All Reports table (`key={r.id}` → `key={r.farmId}_${r.submissionDate}`)
- ✅ **collectionGroup error propagation** — `subscribeToCollectionGroup` now accepts `onError` callback; `newQFailed` flag properly set when collectionGroup fails

## REMAINING KNOWN ISSUES

- ⚠️ **collectionGroup query may require Firestore index** — If `dailyLogs` collection group query fails:
  - Check Firebase Console → Firestore → Indexes
  - Create index: Collection `dailyLogs`, Field `submissionDate` ASC
  - Console will log `HINT:` messages with exact instructions
- ⚠️ **No Firestore Security Rules file in repository** — Rules may exist in Firebase Console but are not tracked in code

## CURRENT TEST ENVIRONMENT STATUS

- **Firebase Project:** `farm-form`
- **Auth Domain:** `farm-form.firebaseapp.com`
- **Environment:** TEST only
- **Backend:** Express API on port 3000
- **Frontend:** Vite dev server on port 5173

## CURRENT PRODUCTION STATUS

**Production Firebase has NOT been touched.** All development is on the TEST environment/project (`farm-form`). No production credentials, configuration, or data has been modified.
