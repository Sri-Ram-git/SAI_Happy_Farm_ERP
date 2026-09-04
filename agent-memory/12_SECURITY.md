# Security Architecture

## Firebase Authentication
- Enforces identity via Email/Password credentials.
- Implicitly secures session management via client SDK tokens.

## Role-Based Access Control (RBAC)
- **Farmer:** Locked to `/` (Farmer Portal).
- **Supervisor:** Locked to `/supervisor`.
- **Admin:** Locked to `/admin`.

## Firestore Security Rules
The backend explicitly enforces read/write isolation.
- **Rule:** A Farmer can only write to `dailyReports/{userId}/*` where the `userId` strictly matches `request.auth.uid`.
- **Rule:** A Farmer cannot arbitrarily mutate `farms/{farmId}` unless executing a strict transaction that is authorized by their assigned `farmIds` array in `users/{uid}`.
- **Rule:** Only an `admin` role can write to the `users` collection to provision new farmers or alter roles.

## Secret Management
- **Never store Secrets in source control.**
- Firebase Web SDK keys (`apiKey`, `projectId`) are safely included in the bundled frontend because they are intentionally public identifiers for the Google Cloud perimeter.
- No `serviceAccountKey.json` files or Server-side Admin SDK credentials exist in the Git repository.
