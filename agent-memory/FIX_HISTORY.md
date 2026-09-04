# Fix History

## 2026-09-04: Farmer Portal Error Normalization & Master Inventory Unit Conversion
**Agent Notes:**
- **Files Changed:** `FarmerFormPage.tsx`, `reportService.ts`
- **Why:** The form incorrectly mapped all transaction validation failures (like `INVENTORY_NOT_INITIALIZED` or `INSUFFICIENT_FEED`) to a generic `"Error"` string, hiding critical debugging context from the user. We updated the catch blocks to route accurate messages. Additionally, the form sent raw input values (like `5000` grams) directly to the feed inventory deduction logic which expected Kg. We added a conditional check against `data.feedUnit` to accurately calculate `feedKg` before submission. We also hardened `reportService.ts` to strictly use the `YYYY-MM-DD` date as the canonical document ID for `dailyLogs`. Added strict `Number.isFinite()` guard checks to prevent `NaN` values from corrupting Firestore.

## 2026-09-04: Surgical Fix - Farm/Flock Lookup Blockage
**Agent Notes:**
- **Files Changed:** `reportService.ts`
- **Why:** The Farmer portal continued to fail with `"Farm or Flock data not found. Please contact an administrator."` We traced this to the `submitReport` transaction artificially enforcing the existence of a `flocks/{flockId}` document. The master architecture dictates that true inventory resides on `farms/{farmId}`, while flocks are used primarily by the Admin Dashboard for cohort analytics. We converted the transaction's flock dependency from a hard `throw new Error('FLOCK_NOT_FOUND')` blocking requirement into a graceful, optional metadata update. If the flock exists, it is updated. If the farm has no flock, the master report logic still safely executes against the farm inventory.
