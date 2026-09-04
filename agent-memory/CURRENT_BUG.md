# Current Bug

**Original Symptom:**
The Farmer Portal displayed `"Farm or Flock data not found. Please contact an administrator."` when the farmer attempted to submit a daily report. The frontend blocked the transaction from successfully registering the daily log.

**Actual Root Cause:**
The backend `reportService.ts` strictly required an active document inside the `flocks` collection to exist during the submission transaction. If a farm was operating purely off the master inventory in `farms/{farmId}` and did not have a defined `flocks` lifecycle document (or if the frontend's `subscribeToFlocksByFarm` query failed to find an active flock due to timing or missing indexes), the system fell back to a default fabricated flock ID (`{farmId}_FL01`).

When the atomic transaction attempted to fetch this non-existent flock ID (`const flockDoc = await transaction.get(flockRef);`), it threw a hard `FLOCK_NOT_FOUND` error, completely aborting the submission process, even though the primary constraint (the Master Inventory residing on the `farms` document) was fully valid.

**Files Changed:**
- `frontend/src/services/reportService.ts`

**Functions Changed:**
- `submitReport`

**Firestore Paths Verified:**
- `users/{userId}` (Authorization verified inside transaction)
- `farms/{farmId}` (Master inventory loaded perfectly)
- `flocks/{flockId}` (Isolated as optional)
- `dailyReports/{userId}/dailyLogs/{YYYY-MM-DD}` (Submission path confirmed)

**Fix Explanation:**
Made the flock lookup and legacy update non-blocking. The system still fetches the `flockRef`, but if it doesn't exist, it gracefully skips updating the `totalMortality`/`totalCulling`/`currentBirds` on the flock level. The master `farmRef` inventory updates and the canonical `dailyLogRef` writes proceed safely regardless of the flock's existence.

**Tests:**
- UI Error catch map confirms accurate relay of `FLOCK_NOT_FOUND` (though it won't occur during submission anymore).
- Typescript build and lint passed.
