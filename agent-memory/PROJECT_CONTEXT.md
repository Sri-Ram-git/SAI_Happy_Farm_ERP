# Project Context

**Application:** Happy Farm ERP (Poultry & Farm Management)

## Architecture Overview
- **Source of Truth:** Firestore is the master database. No secondary databases exist.
- **Portals:**
  - **Farmer Portal:** Used by farmers to submit daily activity logs (feed consumption, mortality, culling, egg production, environment metrics).
  - **Supervisor Dashboard:** Role-based analytics tracking only the farms assigned to the supervisor.
  - **Admin Dashboard:** Global analytics, user management, and flock/farm lifecycle administration.

## Core Directives
- **No Dummy Data:** The system strictly aggregates live Firestore data. Fake arrays, mock charts, and hardcoded values are prohibited.
- **Master Inventory:** The canonical source for live bird counts and feed stock is `farms/{farmId}`. The daily reports subtract from these totals using atomic Firestore transactions.
- **Backward Compatibility:** Existing Admin and Supervisor capabilities (such as flock-level age and curve calculations) must remain functional even when Farmer constraints evolve.

## Current Sub-system Context: Farmer Submission
- Farmers submit a single `dailyLogs` document per day using the path `dailyReports/{userId}/dailyLogs/{YYYY-MM-DD}`.
- Submissions are tightly coupled with the master inventory in `farms/{farmId}`.
- If a farmer corrects an already-submitted log on the same day, the backend executes a Delta adjustment to the master inventory (V2 Correction).
