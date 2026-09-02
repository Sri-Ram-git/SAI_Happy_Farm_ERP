# FIRESTORE_SCHEMA.md

## Collections Overview

```
users/{uid}
farms/{farmId}
  └── inventory/
       ├── birds
       ├── feed
       ├── birdTransactions/records/{docId}
       └── feedTransactions/records/{docId}
dailyReports/{userId}                    ← PARENT document (not a report)
  └── dailyLogs/{YYYY-MM-DD}            ← ACTUAL daily report
dailyReportLocks/{farmId_submissionDate}
auditLogs/{docId}
```

## Collection: `users`

**Document path:** `users/{uid}`

| Field | Type | Description |
|-------|------|-------------|
| uid | string | User ID (matches Firebase Auth UID) |
| email | string | User email |
| role | string | "farmer", "supervisor", or "admin" |
| farmIds | string[] | Assigned farm IDs (may also be stored as "farmID") |
| active | boolean | Whether account is active |
| name | string | Display name |
| createdAt | string (ISO) | Account creation timestamp |

**NOTE:** Role values may have inconsistent capitalization (e.g., "Supervisor " with trailing space). Always normalize via `normalizeRole()` (trim + lowercase).

## Collection: `farms`

**Document path:** `farms/{farmId}`

| Field | Type | Description |
|-------|------|-------------|
| farmId | string | Farm identifier (e.g., "AP12") |
| name | string | Farm display name |
| location | string | Farm location |
| active | boolean | Whether farm is active |

## Subcollection: `farms/{farmId}/inventory/birds`

**Document path:** `farms/{farmId}/inventory/birds`

**AUTHORITATIVE MASTER DATA — Farmers must never manually edit these values.**

| Field | Type | Description |
|-------|------|-------------|
| initialBirdCount | number | Starting bird count when inventory was initialized |
| currentBirdCount | number | Current live bird count (updated by report submission) |
| lastUpdated | string (ISO) | Last modification timestamp |
| lastReportDate | string (YYYY-MM-DD) | Date of last report that updated this inventory |

**Update rule:**
```
closingBirdCount = currentBirdCount - mortality - culling
```

## Subcollection: `farms/{farmId}/inventory/feed`

**Document path:** `farms/{farmId}/inventory/feed`

**AUTHORITATIVE MASTER DATA — Farmers must never manually edit these values.**

| Field | Type | Description |
|-------|------|-------------|
| currentFeedStockKg | number | Current feed stock in Kg |
| totalFeedLoadedKg | number | Total feed ever loaded |
| lastUpdated | string (ISO) | Last modification timestamp |
| lastTransactionDate | string (YYYY-MM-DD) | Date of last transaction |

**Update rules:**
- Daily usage: `newFeedStock = currentFeedStockKg - feedKg`
- Feed load: `newFeedStock = currentFeedStockKg + feedLoadKg`

## Subcollection: `farms/{farmId}/inventory/birdTransactions/records`

**Document path:** `farms/{farmId}/inventory/birdTransactions/records/{docId}`

| Field | Type | Description |
|-------|------|-------------|
| farmId | string | Farm identifier |
| type | string | "MORTALITY", "CULLING", "ADDITION", or "INITIAL" |
| count | number | Number of birds |
| reportDate | string (YYYY-MM-DD) | Date of the transaction |
| createdAt | string (ISO) | Creation timestamp |
| userId | string | User who triggered the transaction |

## Subcollection: `farms/{farmId}/inventory/feedTransactions/records`

**Document path:** `farms/{farmId}/inventory/feedTransactions/records/{docId}`

| Field | Type | Description |
|-------|------|-------------|
| farmId | string | Farm identifier |
| type | string | "FEED_LOAD" or "FEED_USAGE" |
| feedKg | number | Feed quantity in Kg |
| reportDate | string (YYYY-MM-DD) | Date of the transaction |
| createdAt | string (ISO) | Creation timestamp |
| loadedBy | string | User who created the transaction (for FEED_LOAD) |
| userId | string | User who triggered it (for FEED_USAGE) |
| notes | string | Optional notes |

## Collection: `dailyReports` — OLD FORMAT (DO NOT DELETE)

**Document path:** `dailyReports/{randomReportId}`

These are legacy test reports stored with random IDs. They contain report fields directly on the document (no subcollection). They may have `submissionDate` field but typically do NOT have `userId` or `lastSubmissionDate`.

**Rule:** Never delete or automatically migrate these. They remain readable for backward compatibility.

## Collection: `dailyReports` — NEW PARENT FORMAT

**Document path:** `dailyReports/{userId}`

This is a **parent/user document**, NOT a daily report. It groups reports by user.

| Field | Type | Description |
|-------|------|-------------|
| userId | string | User ID |
| farmId | string | Farm ID |
| lastSubmissionDate | string (YYYY-MM-DD) | Most recent submission date |
| updatedAt | string (ISO) | Last update timestamp |

**Identification:** A document in `dailyReports` is a parent document if it has `userId` AND `lastSubmissionDate` but does NOT have `submissionDate`.

## Subcollection: `dailyReports/{userId}/dailyLogs` — NEW REPORT FORMAT

**Document path:** `dailyReports/{userId}/dailyLogs/{YYYY-MM-DD}`

This is the **actual daily report**. One document per user per day.

| Field | Type | Description |
|-------|------|-------------|
| userId | string | User ID |
| submittedBy | string | User ID who submitted |
| farmId | string | Farm ID |
| submissionDate | string (YYYY-MM-DD) | Report date |
| submissionMethod | string | "DIGITAL_FORM" |
| submittedAt | string (ISO) | Submission timestamp |
| updatedAt | string (ISO) | Last update timestamp |
| openingBirdCount | number | System-generated: bird count before this report |
| closingBirdCount | number | System-generated: bird count after mortality/culling |
| birdCount | number | Same as closingBirdCount (backward compat) |
| feedKg | number | Feed used in Kg |
| mortality | number | Death count |
| culling | number | Culling count |
| eggsProduced | number | Total eggs produced |
| selectionEggs | number | Selection eggs count |
| temperature | number | Temperature in °C |
| eggWeight | object | `{ min, max, avg }` in grams |
| bodyWeight | object | `{ min, max, avg }` in grams |
| remarks | string | Farmer notes |
| ammoniaPpm | number | Ammonia level in PPM |

## Collection: `dailyReportLocks`

**Document path:** `dailyReportLocks/{farmId_submissionDate}`

Used by the backend API for duplicate prevention.

| Field | Type | Description |
|-------|------|-------------|
| farmId | string | Farm ID |
| submissionDate | string | Report date |
| reportId | string | Report ID |
| createdAt | string (ISO) | Lock timestamp |

## Collection: `auditLogs`

**Document path:** `auditLogs/{docId}`

| Field | Type | Description |
|-------|------|-------------|
| eventType | string | "LOGIN", "REPORT_CREATED", "REPORT_UPDATED", "REPORT_REJECTED" |
| uid | string | User ID |
| farmId | string | Farm ID (if applicable) |
| resourceId | string | Resource ID (if applicable) |
| timestamp | string (ISO) | Event timestamp |
| requestId | string | Request trace ID |
| metadata | object | Additional data |
