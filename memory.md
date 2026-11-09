# Happy Farm ERP - Project Memory

> **Notice:** The comprehensive master product architecture and memory document is available at [PRODUCT_MEMORY.md](file:///c:/Users/SRIRAM/myprojectss/project_repo/Happy_Farm_ERP/PRODUCT_MEMORY.md). Refer to it for full technical blueprints, biological formulas, deployment guides, and the preserved AVG pipeline.

---

## 1. EXACT FIRESTORE SCHEMA - DAILY REPORTS

The correct location for daily report records is:
`dailyReports/{userId}/dailyLogs/{date}`

**DO NOT** modify this schema.
**DO NOT** invent alternative schemas.

### Schema Hierarchy:
```
dailyReports
  / {USER_ID} (Submission Metadata)
      farmId
      lastSubmissionDate
      updatedAt
      userId

      / dailyLogs (Actual Daily Report Records)
          / {DATE_DOCUMENT_ID} (e.g., 2026-09-02)
              ammoniaPpm
              birdCount
              bodyWeight
                  avg
                  max
                  min
              culling
              eggWeight
                  avg
                  max
                  min
              eggsProduced
              actualProductionPct
              standardProductionPct
              feedConsumedKg
              feedGramsPerBird
              ...
```

### Critical Rules:
1. **Parent `dailyReports/{userId}` Document**: Contains submission metadata.
2. **Subcollection `dailyLogs`**: Contains the actual daily report records.
3. **Date Document**: The actual report for that user on that date.
4. **Data Retrieval Strategy**: Use a Firestore collection group query (`collectionGroup(db, "dailyLogs")`) to retrieve daily reports across all users.
5. **Path Validation**: When reading a document, always verify the source path and extract `userId` from the parent path, `date` from the document ID, and `farmId` from either the payload or user/farm metadata.
6. **Logging**: Log `[Daily Report Loaded] Path: dailyReports/{USER_ID}/dailyLogs/{DATE}` when fetching to confirm the UI is reading real backend data.

---

## 2. HISTORICAL EXCEL IMPORT & PRESERVED AVG PIPELINE

1. **Worksheet Summary Classification:** Source headers matching `AVG` or `AVERAGE` (case-insensitive, trimmed) are classified as `worksheetSummary`.
2. **UI Representation:** Dropdown displays `Preserve Existing AVG Row`; badge displays `Recognized`.
3. **Exclusion from Daily Records:** Summary rows are strictly excluded from daily Firestore records (`STANDARD_DAILY_IMPORT_FIELDS`). Never persist summary rows as daily logs.
4. **Persistence Strategy:** Preserved AVG values are stored per farm/worksheet in `farms/{farmId}` (`preservedAvg`, `preservedAvgByDate`) and `importBatches/{batchId}` (`worksheets`).
5. **Excel Export Generation:** The Python analytics engine (`generate_production_curve.py`) injects preserved AVG values into row 14 (`AVG`) with bold font and yellow background (`#FFFF00`).
6. **Numeric Zero Preservation:** A stored numeric `0` or `0.0` in `actualProductionPct` is a valid percentage and must never fall back to recalculation.

---

## 3. PRODUCTION DEPLOYMENT TARGETS

- **Frontend:** Vercel Production (`https://happy-farm-erp-frontend.vercel.app`, Project `happy-farm-erp-frontend`).
- **Backend:** Render Production (`https://happy-farm-erp-backend.onrender.com`, Git repo `https://github.com/Sri-Ram-git/happy_farm_erp_backend.git`, branch `main`).
- **Database & Auth:** Google Cloud Platform / Firebase (`farm-form`).

