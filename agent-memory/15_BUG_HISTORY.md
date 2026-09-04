# Bug History

## 2026-09-04: Farmer Farm/Flock Lookup Failure
- **Symptom:** Farmer UI showed an arbitrary "Error" when submitting a report, halting the entire workflow.
- **Root Cause:** The atomic transaction strictly demanded a legacy `flockId` document. If the Admin did not explicitly create a legacy flock for a new farm, the entire master inventory update failed (`throw new Error('FLOCK_NOT_FOUND')`).
- **Fix:** Decoupled the dependency. The transaction now updates legacy flocks optionally (`if (flockData) { ... }`) while strictly demanding the master `farms/{farmId}` document.

## 2026-09-04: Opening Birds Showing "--"
- **Symptom:** Farmer UI rendered `OPENING BIRDS: --` despite the master inventory correctly holding `1000`.
- **Root Cause:** The UI was actively polling the obsolete legacy `flocks[0].currentBirds` instead of reading the correct `farmDoc.currentBirdCount`.
- **Fix:** Rewired the frontend state (`setData({ birdCount: String(fetchedFarm.currentBirdCount) })`) and removed the forced intercept.

## 2026-09-04: Frozen Daily Snapshot Overwrite
- **Symptom:** After a farmer submitted a daily report, the UI shifted to display the freshly deducted master inventory as the "Opening" inventory for the current day.
- **Root Cause:** The frontend explicitly rendered `farmDoc.currentFeedKg` instead of checking `todayReport.openingFeedKg`. Additionally, `reportService.ts` Version 2 (Correction) contained a flaw where it overwrote the daily frozen snapshot with the new live Master value.
- **Fix:** Modified `FarmerFormPage.tsx` to prioritize `displayOpeningBirds = todayReport?.openingBirdCount ?? ...`. Modified `reportService.ts` to strictly maintain `openingFeedKg: existingData.openingFeedKg ?? currentFeedStock` during corrections.
