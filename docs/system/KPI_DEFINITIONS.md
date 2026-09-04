# KPI Definitions & Calculations

All KPIs are dynamically calculated from Firestore `dailyLogs` and `farms` documents. No static fallback arrays are used.

### Total Bird Population
- **Source:** `farms/{farmId}` (Real-time snapshot via `subscribeToAllBirdInventories`)
- **Formula:** `SUM(currentBirdCount)` for all active assigned farms.
- **Verification Status:** ✅ VERIFIED. Updates immediately when a farmer submits a daily log via transactional deduction.

### Avg Production %
- **Source:** `collectionGroup('dailyLogs')`
- **Formula:** `calcAverage( (eggsProduced / birdCount) * 100 )` across the date range.
- **Verification Status:** ✅ VERIFIED.

### Avg Mortality %
- **Source:** `collectionGroup('dailyLogs')`
- **Formula:** `calcAverage( (mortality / birdCount) * 100 )` across the date range.
- **Verification Status:** ✅ VERIFIED.

### Avg Culling %
- **Source:** `collectionGroup('dailyLogs')`
- **Formula:** `calcAverage( (culling / birdCount) * 100 )` across the date range.
- **Verification Status:** ✅ VERIFIED.

### Selection Quality %
- **Source:** `collectionGroup('dailyLogs')`
- **Formula:** `calcAverage( (selectionEggs / eggsProduced) * 100 )` across the date range.
- **Verification Status:** ✅ VERIFIED.

### Avg Feed / Bird
- **Source:** `collectionGroup('dailyLogs')`
- **Formula:** `calcAverage( (feedKg * 1000) / birdCount )` -> grams/day
- **Verification Status:** ✅ VERIFIED.

### Submission Compliance Ratio
- **Source:** `users` (where active && role=farmer) AND active `farms` AND `dailyLogs`.
- **Formula:**
  - Expected: `activeFarms` that have at least 1 `active` assigned `farmer`.
  - Submitted: Count of unique `farmId` dailyLogs for the specific date.
  - Ratio: `Submitted / Expected`
- **Verification Status:** ✅ VERIFIED. Safely ignores farms with no assigned farmers.

### Farm Performance Score
- **Source:** Aggregated farm data over the period.
- **Formula:**
  - Production (40%): `MIN((productionRate / 100) * 40, 40)`
  - Mortality (25%): `MAX(0, 25 - (mortalityRate / 20) * 25)`
  - Feed Efficiency (15%): `MAX(0, 15 - (ABS(feedPerBird - 120) / 120) * 15)`
  - Compliance (20%): `(compliancePct / 100) * 20`
  - Total: Sum of components.
- **Verification Status:** ✅ VERIFIED. Drives the supervisor rankings table.
