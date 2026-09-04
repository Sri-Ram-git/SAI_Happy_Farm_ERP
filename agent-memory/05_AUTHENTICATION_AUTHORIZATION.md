# Authentication & Authorization

## Authentication
Authentication is handled strictly by Firebase Auth.
- Users authenticate via Email and Password.
- Sessions are maintained by the Firebase Web SDK (`session` or `local` persistence depending on browser settings).
- Current user UID is resolved globally via `AuthContext.tsx`.

## Authorization & Roles
The application uses Role-Based Access Control (RBAC). Upon login, the system queries the `users/{uid}` document to determine the user's explicit role string.

### Roles
1. **Farmer (`farmer`)**
   - **Access:** Can exclusively access the Farmer Portal (`/`).
   - **Permissions:** 
     - Can read their assigned `farms/{farmId}`.
     - Can read/write their own `dailyReports/{uid}/*`.
     - Cannot modify the master farm definition or inventory directly outside of the strict `reportService.ts` transaction bounds.
     - Cannot read data of other farmers or farms they are not explicitly assigned to in their `farmIds` array.

2. **Supervisor (`supervisor`)**
   - **Access:** Can access the Supervisor Dashboard (`/supervisor`).
   - **Permissions:**
     - Can read all farms and reports within their jurisdictional scope.
     - Cannot submit daily logs on behalf of farmers.
     - Cannot perform administrative user management.

3. **Admin (`admin`)**
   - **Access:** Can access the Enterprise Admin Dashboard (`/admin`).
   - **Permissions:**
     - Complete global read/write access.
     - Can create new users, modify farm assignments, edit master inventory directly, and review enterprise-wide analytics.

## Security Rule Enforcement
Authorization is enforced in two layers:
1. **Frontend Routing:** React Router protects paths based on the `userProfile.role` loaded in `AuthContext`.
2. **Backend (Firestore Security Rules):** Firestore enforces read/write isolation based on `request.auth.uid`. A farmer physically cannot write to another farmer's path or directly overwrite the master farm schema, even if they bypass the frontend UI.
