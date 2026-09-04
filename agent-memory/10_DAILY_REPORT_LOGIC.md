# Daily Report Logic

The Daily Report is the core operational unit of the ERP. It captures the daily deltas (deductions) that affect the master inventory.

## Path Structure
Reports are stored using a canonical date format as the document ID to intrinsically prevent duplicate submissions.
Path: `dailyReports/{userId}/dailyLogs/{YYYY-MM-DD}`

## Submission Workflow (Version 1)
1. **Validation:** Checks that `mortality + culling <= currentBirdCount` and `feedConsumed <= currentFeedKg`.
2. **Snapshot Creation:** Derives `openingBirdCount` and `openingFeedKg` directly from the LIVE master `farms/{farmId}` document.
3. **Execution:** Runs `transaction.set(dailyLogRef, ...)` to create the report and simultaneously executes `transaction.set(farmRef, ...)` to decrement the live master inventory.

## Correction Workflow (Version 2)
If the farmer edits the report later the same day:
1. **Delta Calculation:** 
   - `feedDiff = newFeedKg - oldFeedKg`
2. **Snapshot Preservation:**
   - Ensures `openingBirdCount = existingData.openingBirdCount ?? currentBirdCount`
   - Ensures `openingFeedKg = existingData.openingFeedKg ?? currentFeedStock`
   *(This ensures that corrections do not accidentally reset the opening balances to the already-deducted master values).*
3. **Execution:** Updates the `dailyLog` document with the new corrected totals, and applies ONLY the delta to the master `farms/{farmId}` inventory.
