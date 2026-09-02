# DATA_FLOW.md

## Farmer Daily Report Submission

```
Farmer opens /farmer/form
        ↓
AuthContext validates authentication
        ↓
FarmerFormPage fetches farms/{farmId}/inventory/birds (read-only display)
        ↓
Farmer fills 3-step form:
  Step 1: Feed Quantity, Mortality, Culling
  Step 2: Eggs Produced, Selection Eggs, Temperature
  Step 3: Egg Weight, Body Weight, Ammonia, Remarks
        ↓
Farmer clicks "Verify" → sees summary
        ↓
Farmer clicks "Submit Report"
        ↓
reportService.submitReport() runs Firestore TRANSACTION:
  1. Check duplicate: dailyReports/{userId}/dailyLogs/{date}
  2. Read farms/{farmId}/inventory/birds → openingBirdCount
  3. Read farms/{farmId}/inventory/feed → currentFeedStockKg
  4. Calculate closingBirdCount = openingBirdCount - mortality - culling
  5. Calculate newFeedStock = currentFeedStockKg - feedKg
  6. Write dailyReports/{userId}/dailyLogs/{YYYY-MM-DD}
  7. Update farms/{farmId}/inventory/birds/currentBirdCount
  8. Update farms/{farmId}/inventory/feed/currentFeedStockKg
  9. Create birdTransactions records (MORTALITY, CULLING)
  10. Create feedTransactions record (FEED_USAGE)
        ↓
Real-time onSnapshot listeners fire
        ↓
Admin + Supervisor dashboards update automatically
```

## Bird Count Calculation

```
openingBirdCount = farms/{farmId}/inventory/birds.currentBirdCount (before report)
closingBirdCount = openingBirdCount - mortality - culling
```

**The farmer does NOT enter bird count.** It is read from master inventory.

## Feed Stock Calculation

```
Daily usage:  newFeedStock = currentFeedStockKg - feedKg
Feed load:    newFeedStock = currentFeedStockKg + feedLoadKg
```

**The farmer does NOT enter current feed stock.** It is read from master inventory.

## Feed Load Workflow (Admin/Supervisor)

```
Admin/Supervisor opens /admin/feed-load or /supervisor/feed-load
        ↓
Sees current feed stock table for all farms
        ↓
Selects farm, enters feed quantity (Kg), optional notes
        ↓
inventoryService.addFeedLoad() runs Firestore TRANSACTION:
  1. Read farms/{farmId}/inventory/feed
  2. Calculate newFeedStock = currentFeedStockKg + feedLoadKg
  3. Update farms/{farmId}/inventory/feed
  4. Create feedTransactions record (type: FEED_LOAD)
```

## Dashboard Data Flow

```
Admin/Supervisor Dashboard mounts
        ↓
Fetches farms from farms/ collection
Fetches users from users/ collection
Fetches bird inventory from farms/{farmId}/inventory/birds (for each active farm)
        ↓
Subscribes to reports via useAllDailyReports(startDate, endDate)
  → subscribeToAllDailyReports() sets up TWO parallel onSnapshot listeners:
    1. Old format: collection('dailyReports').where('submissionDate', ...)
    2. New format: collectionGroup('dailyLogs').where('submissionDate', ...)
  → Reports merged, deduped by farmId_submissionDate
        ↓
KPIs computed from merged reports + farm inventories
        ↓
All KPI cards clickable → open DetailDrawer with detailed data
```

## Real-Time Synchronization

```
Farmer submits report
        ↓
Firestore write (atomic transaction)
        ↓
onSnapshot listener fires in AdminDashboard
        ↓
setReports(data) → React re-renders
        ↓
KPIs recalculated from fresh data
Charts update
Detail drawers show latest data
```
