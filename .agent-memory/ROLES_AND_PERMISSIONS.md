# ROLES_AND_PERMISSIONS.md

## Role Normalization

All role comparisons must use `normalizeRole()` which trims whitespace and lowercases:
- `"Supervisor "` → `"supervisor"`
- `"Farmer"` → `"farmer"`
- `"ADMIN"` → `"admin"`

## FARMER

### Can:
- Authenticate via `/login`
- Submit daily report via `/farmer/form`
- View their own reports

### Cannot:
- Modify master bird inventory
- Modify master feed inventory
- Modify other users' reports
- Access admin or supervisor dashboards
- Access management portal

### Implementation Status: ✅ VERIFIED IMPLEMENTED

## SUPERVISOR

### Can:
- Authenticate via `/management/login`
- View assigned farms (filtered by `userProfile.farmIds`)
- View assigned farmer reports and KPIs
- View farm detail pages
- View analytics and rankings
- Record feed loads for assigned farms
- View submission status

### Cannot:
- Modify master bird inventory directly
- Modify other supervisors' farms
- Manage users
- Access admin-only pages

### Implementation Status: ✅ VERIFIED IMPLEMENTED

## ADMIN

### Can:
- Authenticate via `/management/login`
- View ALL farms, users, and reports
- Create/manage users (partially implemented)
- Activate/deactivate users
- Manage farms
- Add feed loads (atomic transaction)
- View all KPIs, analytics, and rankings
- Access all pages including admin-only pages

### Cannot:
- Modify master inventory directly (must use feed load workflow)

### Implementation Status: ✅ VERIFIED IMPLEMENTED
- User management page: ✅ AdminUsersPage with activate/deactivate
- Farm management: ✅ AdminFarmsPage + AdminFarmDetailPage
- Feed load: ✅ FeedLoadPage
- All dashboards: ✅ AdminDashboard, AdminAnalyticsPage, AdminSubmissionsPage

## Backend API Permissions (Express)

### Middleware Stack:
1. `authMiddleware` — Verifies Firebase ID token, loads user profile
2. `requireRole(...roles)` — Checks user role against allowed roles
3. `requireFarmAccess()` — Admins bypass; others must have farmId in farmIds
4. `validateBody(schema)` — Zod schema validation

### Current Backend Routes:
- `POST /api/v1/reports/daily` — Authenticated, rate-limited, farm-access-checked
- `GET /api/v1/reports/daily/:id` — Authenticated, farm-access-checked
- `GET /api/v1/farms` — Authenticated, role-filtered
- `GET /api/v1/farms/:farmId` — Authenticated, farm-access-checked
- `GET /api/v1/admin/users` — Admin only (stub)

### Implementation Status: ⚠️ PARTIALLY IMPLEMENTED
- Auth middleware: ✅ Implemented
- Role-based access: ✅ Implemented
- Farm-level access: ✅ Implemented
- Validation: ✅ Implemented
- Rate limiting: ✅ Implemented
- Admin users endpoint: ⚠️ Stub only

## Inventory Permissions

| Action | Farmer | Supervisor | Admin |
|--------|--------|------------|-------|
| Read bird count | ✅ (display only) | ✅ | ✅ |
| Read feed stock | ❌ | ✅ | ✅ |
| Add feed load | ❌ | ✅ (assigned farms) | ✅ (all farms) |
| Modify bird inventory | ❌ (auto via report) | ❌ | ❌ |
| Modify feed inventory | ❌ (auto via report) | ❌ (only via feed load) | ❌ (only via feed load) |
