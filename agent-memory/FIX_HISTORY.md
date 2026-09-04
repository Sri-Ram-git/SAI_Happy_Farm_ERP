# Fix History

## 2026-09-04: Farmer Portal Error Normalization & Master Inventory Unit Conversion
**Agent Notes:**
- **Files Changed:** `FarmerFormPage.tsx`, `reportService.ts`
- **Why:** Fixed generic `"Error"` string squashing in `FarmerFormPage.tsx` catch blocks. Handled `g` to `kg` conversion accurately for feed inputs. Forced `YYYY-MM-DD` canonical pathing for daily logs. Implemented strict `Number.isFinite` validation logic.

## 2026-09-04: Surgical Fix - Farm/Flock Lookup Blockage
**Agent Notes:**
- **Files Changed:** `reportService.ts`
- **Why:** Converted the atomic backend transaction's dependency on `flocks/{flockId}` from a hard `throw new Error('FLOCK_NOT_FOUND')` block into an optional legacy update. This safely decoupled the master farm inventory updates from the optional historical flock records.

## 2026-09-04: Surgical Fix - Opening Birds UI Binding
**Agent Notes:**
- **Files Changed:** `FarmerFormPage.tsx`
- **Why:** The Farmer Portal incorrectly displayed `"OPENING BIRDS: --"` because the UI was actively querying the obsolete `flocks[0]?.currentBirds` state instead of the true master inventory `farms/{farmId}.currentBirdCount`. 
- We rewired the `useEffect` for `subscribeToFarm` to inject `fetchedFarm.currentBirdCount` into the form's state. 
- We removed the obsolete `handleChange` intercept that forcefully reset `birdCount` upon flock selection. 
- We updated the UI fallback strictly to `farmDoc?.currentBirdCount != null` ensuring safe rendering of explicit `0` values without falsely declaring the data as missing (`--`).

## 2026-09-04: Surgical Fix - Frozen Daily Opening Snapshot
**Agent Notes:**
- **Files Changed:** `FarmerFormPage.tsx`, `reportService.ts`
- **Why:** The Farmer Portal UI incorrectly shifted its `OPENING BIRDS` and `TOTAL FEED AVAILABLE` to the live, deducted master inventory values immediately after submitting Version 1, instead of keeping the frozen snapshot for that day.
- Added explicit logic in `FarmerFormPage.tsx` to prioritize rendering `todayReport.openingBirdCount` and `todayReport.openingFeedKg` if a report already exists for the day, only falling back to the live master inventory if starting a brand new report.
- Fixed a bug in `reportService.ts` Version 2 (Correction) submission where it mistakenly overwrote the frozen `openingFeedKg` with the live deducted master feed. It now uses `existingData.openingFeedKg ?? currentFeedStock` to ensure the daily snapshot is permanently immutable once established for that date.
