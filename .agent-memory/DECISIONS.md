# DECISIONS.md

*Record important architecture decisions so future agents do not reverse them.*

---

## DECISION 1: Daily Report Hierarchy

**Decision:** Daily reports use nested structure `dailyReports/{userId}/dailyLogs/{YYYY-MM-DD}`

**Reason:** One farmer submits one report per day. Reports must be easily grouped by farmer and date. The parent document at `dailyReports/{userId}` provides metadata (lastSubmissionDate) without scanning all logs.

**Date:** 2026-09-02

**Status:** ✅ Implemented

---

## DECISION 2: Old Report Preservation

**Decision:** Existing old reports stored as `dailyReports/{randomReportId}` must remain untouched. No automatic migration.

**Reason:** Old test data exists. Migration could cause data loss or duplication. Backward compatibility is maintained by reading both formats.

**Date:** 2026-09-02

**Status:** ✅ Implemented

---

## DECISION 3: Master Bird Inventory Location

**Decision:** Master bird inventory belongs to the farm at `farms/{farmId}/inventory/birds`

**Reason:** Bird count is a farm-level attribute, not a user-level attribute. Multiple farmers could theoretically work the same farm (though currently 1:1).

**Date:** 2026-09-02

**Status:** ✅ Implemented

---

## DECISION 4: Master Feed Inventory Location

**Decision:** Master feed inventory belongs to the farm at `farms/{farmId}/inventory/feed`

**Reason:** Feed stock is a farm-level attribute. Only authorized admin/supervisor workflows should modify it.

**Date:** 2026-09-02

**Status:** ✅ Implemented

---

## DECISION 5: Farmers Do Not Enter Master Counts

**Decision:** Farmers do not manually enter master bird count or master feed stock. These are system-managed values.

**Reason:** Prevents inventory corruption. Bird count and feed stock are calculated from transaction history and report submissions.

**Date:** 2026-09-02

**Status:** ✅ Implemented

---

## DECISION 6: Atomic Report Submission

**Decision:** Daily report submission must not deduct inventory twice. Inventory updates and report creation must be atomic (single Firestore transaction).

**Reason:** Prevents race conditions and double-counting if the farmer submits twice quickly or the network retries.

**Date:** 2026-09-02

**Status:** ✅ Implemented

---

## DECISION 7: Collection Group Queries

**Decision:** Admin and Supervisor global report queries must query actual `dailyLogs` documents via `collectionGroup("dailyLogs")` rather than `dailyReports` parent documents.

**Reason:** `dailyReports` now contains parent user documents, not actual reports. The actual reports are nested inside `dailyLogs` subcollections.

**Date:** 2026-09-02

**Status:** ✅ Implemented

---

## DECISION 8: No Hardcoded Dashboard Values

**Decision:** Dashboard values must come from Firestore/backend data. No hardcoded farmer counts, report counts, or KPI values.

**Reason:** Ensures data accuracy. Values must reflect real-time Firestore state.

**Date:** 2026-09-02

**Status:** ✅ Implemented

---

## DECISION 9: TEST Environment Only

**Decision:** All current changes are being performed on the TEST Firebase environment/project (`farm-form`). Production must not be modified without explicit instruction.

**Reason:** Prevents accidental data loss or disruption to production users.

**Date:** 2026-09-02

**Status:** ✅ Maintained

---

## DECISION 10: Frontend Direct Firestore Access

**Decision:** The frontend reads/writes Firestore directly via the Firebase CDN compat SDK, not through the Express backend API.

**Reason:** Simplifies development. The Express API exists as a separate validation/testing layer but is not used by the frontend for most operations.

**Date:** 2026-09-02

**Status:** ✅ Current architecture

**Future consideration:** The backend API should eventually become the primary data access layer for security and validation.

---

## DECISION 11: Non-Fatal CollectionGroup Errors

**Decision:** collectionGroup query failures are logged to console but do NOT show error messages in the UI. The dashboard still loads with available data.

**Reason:** Prevents the "Unable to load reports" error from blocking the entire dashboard when the collectionGroup query fails due to missing indexes or security rules.

**Date:** 2026-09-02

**Status:** ✅ Implemented
