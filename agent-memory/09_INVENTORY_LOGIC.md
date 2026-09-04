# Inventory Logic

The Farm ERP relies on a strict **Master Inventory System**.

## The Master Document
Path: `farms/{farmId}`

The master document maintains the canonical truth for the LIVE capacity of a farm at this exact second.
- `currentBirdCount`: Total living birds currently on the farm.
- `currentFeedKg`: Total feed stock currently available on the farm.

## Deductions (Daily Reports)
When a farmer submits a daily report, `reportService.ts` executes an atomic deduction.
Example:
- Start: `currentBirdCount = 10000`
- Submission: `mortality = 50`, `culling = 10`
- New Master: `currentBirdCount = 9940`

## Additions (Feed Loading)
When an Admin loads feed onto a farm:
- Start: `currentFeedKg = 400`
- Load: `1000`
- New Master: `currentFeedKg = 1400`
- `totalFeedLoadedKg` increases by 1000.

## Corrective Adjustments (Version 2 Reports)
If a farmer realizes they entered `feedConsumed = 100` but actually consumed `120`, they submit a correction.
- Initial submission deducted `100`.
- Correction calculates delta: `120 - 100 = 20`.
- Master inventory is deducted by the delta (`20`).
- Total deducted matches the true `120`.

## CRITICAL SNAPSHOT RULE
While the Master Inventory (`farms/{farmId}`) changes continuously, **Today's Opening Inventory** does NOT.
The start-of-day balances are explicitly frozen inside `dailyReports/{uid}/dailyLogs/{YYYY-MM-DD}` under the fields:
- `openingBirdCount`
- `openingFeedKg`

Once this `dailyLog` document is established for the day, its `opening` fields are treated as entirely immutable and are used to render the Farmer UI headers.
