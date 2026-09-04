# System Architecture

The Farm ERP strictly uses a 2-tier serverless architecture connecting a React frontend directly to Firebase.

```text
                    FARM ERP (React SPA)
                       |
          +------------+------------+
          |            |            |
       FARMER      SUPERVISOR      ADMIN
          |            |            |
          +------------+------------+
                       |
                  FIREBASE SDK
                       |
        +--------------+--------------+
        |                             |
  FIREBASE AUTH                CLOUD FIRESTORE
        |                             |
        |               +-------------+-------------+
        |               |             |             |
        v               v             v             v
      Users           users         farms      dailyReports
```

## Architectural Flow
1. **Frontend:** React application built with Vite (`frontend/src/`).
2. **Authentication:** User logs in via Firebase Auth (`frontend/src/context/AuthContext.tsx`).
3. **User Resolution:** The Auth UID is used to query the `users/{uid}` collection to determine the user's `role` and `farmIds`.
4. **Farm Resolution:** The frontend reads `farmIds[0]` (for Farmers) and queries `farms/{farmId}` to establish the live master inventory context.
5. **Firestore:** The NoSQL document database acts as the strict source of truth for all modules.
6. **Inventory:** All live balances (`currentBirdCount`, `currentFeedKg`) are stored directly on the `farms/{farmId}` document and updated via atomic transactions.
7. **Daily Reports:** Farmers submit logs stored hierarchically at `dailyReports/{userId}/dailyLogs/{YYYY-MM-DD}`.
8. **Dashboard/KPI:** Supervisor and Admin portals aggregate analytics in real-time by subscribing to collections (farms, users, dailyReports) and performing frontend calculations.

## Shared Services
- `userDataService.ts`: Reads/writes user profiles.
- `farmDataService.ts`: Reads/writes farm definitions and live inventory.
- `reportService.ts`: Handles the complex atomic transactions that deduct inventory and save daily logs simultaneously.
- `reportDataService.ts`: Aggregates historical reports for dashboards.
