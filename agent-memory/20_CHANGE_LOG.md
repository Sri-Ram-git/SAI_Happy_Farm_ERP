# Change Log

**2026-09-04**
- **CHANGE:** Decoupled `flockId` hard dependency from `reportService.ts` transaction.
- **WHY:** To fix Farmer portal "Error" blockage when Admin users forgot to provision legacy flock tracking instances.
- **FILES:** `frontend/src/services/reportService.ts`
- **DATABASE IMPACT:** Legacy `flocks` update gracefully skips if undefined; Master `farms/{farmId}` becomes the sole strict requirement.
- **SECURITY IMPACT:** None.
- **TEST RESULT:** PASS.

**2026-09-04**
- **CHANGE:** Rewired `OPENING BIRDS` UI metric to display true master inventory.
- **WHY:** To fix `OPENING BIRDS: --` rendering bug.
- **FILES:** `frontend/src/pages/FarmerFormPage.tsx`
- **DATABASE IMPACT:** None.
- **SECURITY IMPACT:** None.
- **TEST RESULT:** PASS.

**2026-09-04**
- **CHANGE:** Fixed daily snapshot immutability during Version 2 correction submissions.
- **WHY:** Because the Farmer UI shifted the day's frozen header values to the freshly deducted master balances after submitting Version 1, confusing the user and corrupting the historical record logic.
- **FILES:** `frontend/src/pages/FarmerFormPage.tsx`, `frontend/src/services/reportService.ts`
- **DATABASE IMPACT:** Safely locks `openingBirdCount` and `openingFeedKg` fields in the `dailyLogs/{YYYY-MM-DD}` document regardless of subsequent master updates or same-day corrections.
- **SECURITY IMPACT:** None.
- **TEST RESULT:** PASS.
