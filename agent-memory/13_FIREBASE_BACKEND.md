# Firebase Backend Connections

This document details the exact connection pathways between the React frontend and the Firebase backend services.

## Initialization
`frontend/src/firebase/config.ts` initializes the app and exports `auth` and `db` (Firestore).

## Services
All direct backend integrations are abstracted into dedicated service modules:
- `authService.ts`: Wraps `signInWithEmailAndPassword`, `signOut`, `onAuthStateChanged`.
- `userService.ts`: Executes Admin creation of new users via Firebase Functions or direct Auth integration.
- `userDataService.ts`: Queries `users/{uid}`.
- `farmDataService.ts`: Queries `farms/{farmId}` and executes master feed additions.
- `flockDataService.ts`: Queries `flocks/{flockId}`.
- `reportService.ts`: The most critical backend connection. Contains `submitReport()` which executes a `db.runTransaction` guaranteeing atomic consistency between the Farmer's `dailyLog` and the Master `farm` inventory.
- `reportDataService.ts`: Queries `dailyReports` across various date thresholds for the Admin and Supervisor dashboards.

*Note: No custom Firebase Cloud Functions are used for standard reporting operations; the application relies entirely on client-initiated Firestore Transactions to maintain data integrity.*
