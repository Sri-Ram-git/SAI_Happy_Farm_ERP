# SAI Happy Farms ERP — System Architecture

## Overview
A full-stack poultry/farm ERP with three portals: Farmer, Supervisor, Admin.

## Tech Stack
- **Backend**: Node.js + Express + TypeScript + firebase-admin SDK
- **Frontend**: React + TypeScript + Vite (SPA)
- **Database**: Google Cloud Firestore (NoSQL)
- **Auth**: Firebase Authentication
- **Frontend Firebase**: Compat SDK v12.18.0 loaded via CDN `<script>` tags (NOT modular imports)

## Architecture Diagram
```
┌─────────────────────────────────────────────────────────────┐
│                     Firebase Auth                           │
│  (Email/Password login for Farmer, Supervisor, Admin)       │
└──────────────┬──────────────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────────────┐
│                   Firestore Database                        │
│  Collections: users, farms, flocks, dailyReports,           │
│  dailyReportLocks, auditLogs                                │
│  Subcollections: dailyLogs, feedTransactions,               │
│  birdTransactions, revisions                                │
└──────────────┬──────────────────────────────────────────────┘
               │
     ┌─────────┼─────────────────┐
     │         │                 │
┌────▼───┐ ┌───▼────┐  ┌────────▼─────────┐
│ Farmer │ │ Super  │  │  Admin Portal    │
│ Portal │ │ Portal │  │  + Backend API   │
└────────┘ └────────┘  └──────────────────┘
```

## Data Flow
```
Farmer submits report
  → Frontend Firestore Transaction
    → Validates farm inventory
    → Writes dailyReports/{userId}/dailyLogs/{date}_{flockId}
    → Updates farms/{farmId} inventory atomically
    → Updates flocks/{flockId} totals
    → Creates birdTransactions/feedTransactions audit trail
  → Firestore real-time listeners fire
    → Admin dashboard updates (collectionGroup('dailyLogs'))
    → Supervisor dashboard updates (filtered by farmIds)
```

## Backend API (Express)
- `POST /api/v1/admin/users/farmer` — Create farmer (Admin only)
- `PATCH /api/v1/admin/users/:uid/status` — Toggle user active status
- `GET /api/v1/admin/users` — List all users
- `GET /api/v1/farms/` — Get authorized farms
- `POST /api/v1/flocks/` — Create flock (Admin only)
- `POST /api/v1/reports/daily` — Submit report (legacy backend path)

## Frontend Report Submission
The primary report submission happens directly from the frontend via `reportService.ts`
using `db.runTransaction()` — NOT through the backend API.

## Real-Time Listeners
- `subscribeToAllFarms()` — farms collection
- `subscribeToAllUsers()` — users collection
- `subscribeToAllFlocks()` — flocks collection
- `subscribeToAllDailyReports()` — collectionGroup('dailyLogs')
- `subscribeToAllBirdInventories()` — per-farm document listeners
