# Current Bug

**Original Symptom:**
The Farmer Portal displayed shifting opening values for the current day after a report was submitted. For instance, if the day started with 1000 birds and 5000 Kg of feed, and the farmer submitted a report deducting 8 birds and 120 Kg of feed, the page header immediately changed to display `OPENING BIRDS = 992` and `TOTAL FEED AVAILABLE = 4880 Kg`. If the farmer then made a correction, the system mistakenly overwrote the day's frozen snapshot with the new live values.

**Actual Root Cause:**
There were two critical issues:
1. **Frontend Data Binding:** The Farmer Portal UI headers were hardcoded to continuously render the live master inventory (`farmDoc.currentFeedKg` and `farmDoc.currentBirdCount`) directly from the real-time Firebase snapshot, rather than looking for a frozen `openingBirdCount` and `openingFeedKg` on the current day's report snapshot if it already existed.
2. **Backend Delta Overwrite:** While `reportService.ts` correctly established `openingBirdCount` and `openingFeedKg` in Version 1, the Version 2 (Correction) logic contained a flaw where it overwrote `openingFeedKg` with `currentFeedStock` (which represented the already-deducted Master Inventory).

**Correct Source Strategy:**
- Master inventory changes immediately after a successful daily submission. 
- Today's opening inventory is a date-specific snapshot and must not change during corrections/submissions on the same day. 
- The updated master inventory becomes the opening inventory of the next day.

**Files Changed:**
- `frontend/src/pages/FarmerFormPage.tsx`
- `frontend/src/services/reportService.ts`

**Functions Changed:**
- `FarmerFormPage` render block (Introduced `displayOpeningBirds` and `displayTotalFeed` variables to conditionally prioritize `todayReport`)
- `submitReport` (Version 2 correction branch)

**Tests Performed:**
- TypeScript frontend build completed successfully.
- Version 1 snapshot creation remains valid.
- Version 2 updates strictly respect `existingData.openingFeedKg ?? currentFeedStock` to guarantee immutability of the day's opening values.
