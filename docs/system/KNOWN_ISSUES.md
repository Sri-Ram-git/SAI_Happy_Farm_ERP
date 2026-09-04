# Known Issues — Identified During Full System Audit

## CRITICAL

### 1. Dashboard `submissionMatrix` does not match farmer form document IDs
- **Farmer form** writes to: `dailyReports/{userId}/dailyLogs/{date}_{flockId}`
- **Dashboard `reportDataService`** dedup key: `${userId}_${submissionDate}_${flockId || 'noflock'}`
- **Dashboard `submissionMatrix`** builds Expected from `activeFarms × dates` — but farms don't directly submit reports; users do. A farm with NO assigned active farmer still shows as "Expected" even though no human can submit for it.
- **FIX NEEDED**: submissionMatrix must cross-reference users→farmIds to determine which farms have active farmers.

### 2. Dashboard `chartData` submitted/missing counts were misaligned with submissionMatrix
- **FIXED** in previous session — now uses `submissionMatrix.submitted.filter(s => s.date === dStr).length`.

### 3. Supervisor user had dirty role value `'Supervisor '` with trailing space
- **FIXED** via migration script — normalized to `'supervisor'`.

### 4. Farm documents had trailing spaces in field names (`'active '`, `'name '`)
- **FIXED** via migration script — cleaned all keys.

### 5. Supervisor was missing `farmIds` assignment
- **FIXED** via migration script — assigned `['AP12', 'AP13']`.

### 6. Double sidebar rendering bug
- `AdminFlocksPage.tsx` (lines 85-86) and `PredictionPage.tsx` (lines 130-131) render `<Sidebar>` alongside `<DashboardLayout>` which itself contains `<Sidebar>`.
- **STATUS**: Not yet fixed (cosmetic, not data-critical).

### 7. PredictionPage requires Firestore composite index
- Query: `collectionGroup('dailyLogs').where('farmId', '==', ...).where('submissionDate', '>=', ...).orderBy('submissionDate', 'asc')`
- Requires explicit composite index in Firebase Console.
- **STATUS**: Not yet created.

### 8. Backend `reports.repository.ts` uses OLD flat schema
- Backend writes to: `dailyReports/{reportId}` with random UUID
- Frontend writes to: `dailyReports/{userId}/dailyLogs/{date}_{flockId}`
- The backend API endpoint `/api/v1/reports/daily` is NOT used by the frontend farmer form.
- The frontend's `reportService.ts` handles submission directly.
- **IMPACT**: If someone calls the backend API, it would create reports in the wrong location.

### 9. `phone_no` type inconsistency
- User creation stores phone as `Number(input.phone_no)` in backend `farmer.service.ts`
- Schema and frontend expect string
- Existing data has both string and number values

## MODERATE

### 10. No `openingFeedKg` / `closingFeedKg` written by `reportService.ts`
- The farmer form's `FarmerFormPage.tsx` writes these fields, but `reportService.ts` does not.
- Dashboard cannot track feed inventory snapshot per report.

### 11. Farm `farmIds` array (legacy)
- Farm documents contain a `farmIds: ["AP12"]` array which is redundant with the `farmId` field.
- Not harmful but confusing.

### 12. `subscribeToAllBirdInventories` only emits once
- The callback fires only when `loadedCount === farmIds.length`, meaning subsequent real-time updates from individual farm documents won't re-emit.
- **FIX NEEDED**: Should emit on every snapshot change, not just initial load.
