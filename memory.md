# Happy Farm ERP - Project Memory

## EXACT FIRESTORE SCHEMA - DAILY REPORTS

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
              ...
```

### Critical Rules:
1. **Parent `dailyReports/{userId}` Document**: Contains submission metadata.
2. **Subcollection `dailyLogs`**: Contains the actual daily report records.
3. **Date Document**: The actual report for that user on that date.
4. **Data Retrieval Strategy**: Use a Firestore collection group query (`collectionGroup(db, "dailyLogs")`) to retrieve daily reports across all users.
5. **Path Validation**: When reading a document, always verify the source path and extract `userId` from the parent path, `date` from the document ID, and `farmId` from either the payload or user/farm metadata.
6. **Logging**: Log `[Daily Report Loaded] Path: dailyReports/{USER_ID}/dailyLogs/{DATE}` when fetching to confirm the UI is reading real backend data.
