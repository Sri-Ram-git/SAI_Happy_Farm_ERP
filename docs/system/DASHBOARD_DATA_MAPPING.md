# Dashboard Data Mapping — Source of Truth

Every KPI and chart on the Admin/Supervisor dashboard is derived from live Firestore data.

## KPI Cards → Firestore Source

| KPI Card | Source Service | Firestore Path | Calculation |
|----------|---------------|----------------|-------------|
| Total Bird Population | `subscribeToAllBirdInventories()` | `farms/{farmId}` → `currentBirdCount` | Sum across all active farms |
| Avg Production % | `useAllDailyReports()` | `collectionGroup('dailyLogs')` | `avg(eggsProduced / openingBirdCount × 100)` |
| Avg Mortality % | `useAllDailyReports()` | `collectionGroup('dailyLogs')` | `avg(mortality / openingBirdCount × 100)` |
| Avg Feed/Bird | `useAllDailyReports()` | `collectionGroup('dailyLogs')` | `avg((feedKg × 1000) / openingBirdCount)` g/day |
| Avg Egg Weight | `useAllDailyReports()` | `collectionGroup('dailyLogs')` | `avg(eggWeight.avg)` |
| Submission Ratio | `submissionMatrix` | Users + Farms + dailyLogs | `submitted / expected` |

## Charts → Firestore Source

All 7 charts use `chartData[]` array derived from `useAllDailyReports()` → `collectionGroup('dailyLogs')`.

| Chart | X-Axis | Y-Axis Source |
|-------|--------|---------------|
| Production Trend | Date | `avg(eggsProduced / openingBirdCount × 100)` per day |
| Mortality & Culling | Date | `sum(mortality)`, `sum(culling)` per day |
| Feed Consumption | Date | `sum(feedKg)`, `avg((feedKg×1000)/openingBirdCount)` per day |
| Egg Weight & Quality | Date | `avg(eggWeight.avg/min/max)`, `selectionEggs/eggsProduced × 100` |
| Body Weight | Date | `avg(bodyWeight.avg/min/max)` per day |
| Temperature | Date | `avg(temperature)`, `max(tempMax)` per day |
| Submission Timeline | Date | `submissionMatrix.submitted.count`, `submissionMatrix.missing.count` per day |

## Submission Matrix Calculation
```
activeFarmers = users where role='farmer' AND active=true
activeFarms = farms where active=true
farmAssignments = activeFarms that have ≥1 active farmer assigned via farmIds

Expected = farmAssignments.count × daysInRange
Submitted = unique dailyLogs docs matching (farmId, date)
Missing = Expected - Submitted
```

## Real-Time Update Chain
```
Farmer submits report → reportService.ts → Firestore transaction
  → farms/{farmId} updated (currentBirdCount, currentFeedKg)
  → dailyReports/{userId}/dailyLogs/{date}_{flockId} created
  → collectionGroup('dailyLogs') onSnapshot fires
  → Dashboard hooks receive new data
  → All KPI cards and charts re-render
```
