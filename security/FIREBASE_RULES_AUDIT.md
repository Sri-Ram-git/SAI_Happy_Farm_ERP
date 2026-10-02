# FIREBASE RULES AUDIT — Happy Farmer ERP

## Rules File
- **Path:** `firestore.rules` (186 lines)
- **Version:** `rules_version = '2'`

---

## Helper Functions Audit

### `isAuthenticated()`
```
function isAuthenticated() { return request.auth != null; }
```
✅ Correct — checks for valid Firebase Auth token.

### `isOwner(userId)`
```
function isOwner(userId) { return isAuthenticated() && request.auth.uid == userId; }
```
✅ Correct — verifies token UID matches document path.

### `getUserDoc()` / `getUserData()`
```
function getUserDoc() { return get(/databases/$(database)/documents/users/$(request.auth.uid)); }
function getUserData() { return getUserDoc().data; }
```
⚠️ Each invocation performs a Firestore `get()` read. When multiple helper functions call `getUserData()` in a single rule evaluation, this triggers multiple `get()` calls. Firestore limits to 10 `get()` calls per rule evaluation.

**Actual usage:** Most rules call `hasFarmAccess()` which calls `isAdmin()` OR `isUserActive()` — each path calls `getUserData()`. In the worst case (non-admin), `hasFarmAccess()` calls `isAdmin()` (1 get via `hasRole` → `isUserActive` → `getUserData`), then `isUserActive` (1 get), then `getUserData().farmIds` (1 get). Firestore may optimize repeated `get()` to the same path, but this is **not guaranteed**.

### `isUserActive()`
```
function isUserActive() { return isAuthenticated() && getUserData().active == true; }
```
✅ Correct — checks the `active` field.

### `hasRole(role)`
```
function hasRole(role) { return isUserActive() && getUserData().role == role; }
```
✅ Correct.

### `isAdmin()` / `isSupervisor()`
```
function isAdmin() { return hasRole('admin'); }
function isSupervisor() { return hasRole('supervisor') || isAdmin(); }
```
✅ `isSupervisor()` correctly includes admin fallback.

### `hasFarmAccess(farmId)`
```
function hasFarmAccess(farmId) {
  return isAdmin() || (isUserActive() && (farmId in getUserData().farmIds));
}
```
✅ Correct. Admin bypasses farm check. Others need the farm ID in their `farmIds` array.

---

## Collection Rules Audit

### `/users/{userId}` (Lines 43-52) ✅ SECURE
- **Read:** Authenticated + (self OR supervisor/admin) ✅
- **Create/Delete:** Admin only ✅
- **Update:** Admin OR (owner + no protected field changes) ✅
- **Protected fields:** `role`, `farmIds`, `active`, `createdat`, `createdAt`, `created_at`, `email`, `uid` ✅ SEC-07 fix confirmed

### `/farms/{farmId}` (Lines 55-72) ✅ SECURE
- **Read:** Authenticated + active + `hasFarmAccess(farmId)` ✅ SEC-02 fix confirmed
- **Create/Delete:** Admin only ✅
- **Update:** Admin OR (active + `hasFarmAccess(farmId)`) ✅
- **Subcollections:** `feedTransactions`, `birdTransactions` properly scoped ✅

### `/flocks/{flockId}` (Lines 75-85) ✅ SECURE
- **Read:** Authenticated + active + `hasFarmAccess(resource.data.farmId)` ✅
- **Create/Delete:** Admin only ✅
- **Update:** Admin OR (authenticated + active + farm access + no protected fields) ✅ SEC-03 fix confirmed

### `/dailyReports/{reportOrUserId}` (Lines 88-127) ✅ SECURE
- **Read:** Authenticated + active + (owner OR admin OR farm access) ✅
- **Create/Update:** Authenticated + active + (admin OR farm access via `request.resource.data.farmId`) ✅
- **Delete:** Admin only ✅
- **Subcollection `dailyLogs`:** Same pattern ✅
- **Subcollection `revisions`:** Same pattern ✅ (V2 correction fix confirmed)

### Collection Group Queries (Lines 130-143) ✅ SECURE
- **`dailyLogs`:** Admin OR farm access via `resource.data.farmId` ✅
- **`revisions`:** Admin OR farm access via `resource.data.farmId` ✅

### `/dailyReportLocks/{lockId}` (Lines 146-153) ✅ SECURE
- **Delete:** Admin only ✅ SEC-04 fix confirmed

### `/auditLogs/{logId}` (Lines 156-160) ✅ SECURE
- **Read:** Admin only ✅
- **Create:** Authenticated + `request.resource.data.userId == request.auth.uid` ✅

### `/importBatches/{batchId}` (Lines 163-165) ✅ SECURE
- **All operations:** Admin only ✅

### `/logs/{farmId}` (Lines 168-183) ✅ SECURE
- Farm-scoped via `hasFarmAccess(farmId)` ✅

---

## Coverage Gap Analysis

| Collection Path Found in Code | Has Firestore Rule | Verdict |
|---|---|---|
| `/users/{userId}` | ✅ | OK |
| `/farms/{farmId}` | ✅ | OK |
| `/farms/{farmId}/feedTransactions/{txId}` | ✅ | OK |
| `/farms/{farmId}/birdTransactions/{txId}` | ✅ | OK |
| `/flocks/{flockId}` | ✅ | OK |
| `/dailyReports/{userId}` | ✅ | OK |
| `/dailyReports/{userId}/dailyLogs/{date}` | ✅ | OK |
| `/dailyReports/{userId}/dailyLogs/{date}/revisions/{revId}` | ✅ | OK |
| `/dailyReportLocks/{lockId}` | ✅ | OK |
| `/auditLogs/{logId}` | ✅ | OK |
| `/importBatches/{batchId}` | ✅ | OK |
| `/logs/{farmId}` | ✅ | OK |
| `/logs/{farmId}/feedLogs/{logId}` | ✅ | OK |
| `/logs/{farmId}/flockLogs/{logId}` | ✅ | OK |

**Result:** ✅ All collections used in code have corresponding Firestore rules. No orphan collections found.

---

## Performance Concerns

| Issue | Impact |
|---|---|
| Multiple `getUserData()` calls per rule evaluation | Each `get()` counts toward the 10-get limit per rule evaluation. Complex rules with `hasFarmAccess()` that fall through `isAdmin()` to the farm check path may trigger 3+ gets. |
| `collectionGroup('dailyLogs')` collection group query | The collection group rule allows reads if admin OR farm access. Firestore evaluates the rule for every document returned. For large result sets, this could be expensive. |

---

## Missing Features

| Feature | Status |
|---|---|
| Storage rules (`storage.rules`) | ❌ Not found — if Cloud Storage is used, it's completely unprotected |
| Cloud Functions security | N/A — no functions directory |
| Data validation in rules | ❌ No `request.resource.data` field type/range validation in Firestore rules. All data validation relies on frontend code and backend validators. |
