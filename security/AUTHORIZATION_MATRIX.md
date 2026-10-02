# AUTHORIZATION MATRIX — Happy Farmer ERP

## Roles

| Role | Description | Farm Scope |
|---|---|---|
| `admin` | Full system access | All farms |
| `supervisor` | Read access to assigned farms | `farmIds[]` |
| `farmer` | Submit/read own reports, read own farm | `farmIds[]` (single) |

---

## Backend API Authorization Matrix

| # | Endpoint | Admin | Supervisor | Farmer | Unauthenticated | Notes |
|---|----------|-------|-----------|--------|-----------------|-------|
| 1 | `GET /reports/export-production-curve` | ✅ All farms | ✅ Own farms only | ✅ Own farms only | ❌ | SEC-01 fixed |
| 2 | `POST /reports/daily` | ✅ | ✅ Own farms | ✅ Own farm | ❌ | `requireFarmAccess` |
| 3 | `GET /reports/daily/:id` | ✅ | ⚠️ **Weak check** | ⚠️ **Weak check** | ❌ | SEC-09: farm access checked in controller but after report fetch |
| 4 | `GET /farms/` | ✅ All | ✅ Own | ✅ Own | ❌ | In-controller scoping |
| 5 | `GET /farms/:farmId` | ✅ | ✅ Own | ✅ Own | ❌ | `requireFarmAccess` |
| 6 | `POST /flocks/` | ✅ | ❌ | ❌ | ❌ | Admin only |
| 7 | `PATCH /flocks/:flockId/status` | ✅ | ❌ | ❌ | ❌ | Admin only |
| 8 | `GET /admin/users` | ✅ | ❌ | ❌ | ❌ | Admin only |
| 9 | `DELETE /admin/users/:uid` | ✅ | ❌ | ❌ | ❌ | Admin only |
| 10 | `PATCH /admin/users/:uid/status` | ✅ | ❌ | ❌ | ❌ | Admin only |
| 11 | `POST /admin/users/farmer` | ✅ | ❌ | ❌ | ❌ | Admin only |
| 12 | `POST /admin/users/supervisor` | ✅ | ❌ | ❌ | ❌ | Admin only |
| 13 | `POST /admin/users/admin` | ✅ | ❌ | ❌ | ❌ | Admin only |
| 14 | `PATCH /admin/users/supervisor/:uid/farms` | ✅ | ❌ | ❌ | ❌ | Admin only |
| 15 | `POST /admin/import/*` | ✅ | ❌ | ❌ | ❌ | Admin only |
| 16 | `GET /admin/import/*` | ✅ | ❌ | ❌ | ❌ | Admin only |

---

## Firestore Rules Authorization Matrix

### `/users/{userId}`

| Operation | Admin | Supervisor | Farmer (self) | Farmer (other) |
|-----------|-------|-----------|---------------|----------------|
| Read | ✅ | ✅ (via `isSupervisor()`) | ✅ (own doc) | ❌ |
| Create | ✅ | ❌ | ❌ | ❌ |
| Update | ✅ | ❌ | ✅ (excluding protected fields) | ❌ |
| Delete | ✅ | ❌ | ❌ | ❌ |

**Protected update fields:** `role`, `farmIds`, `active`, `createdat`, `createdAt`, `created_at`, `email`, `uid`

### `/farms/{farmId}`

| Operation | Admin | Supervisor (assigned) | Supervisor (unassigned) | Farmer (assigned) | Farmer (unassigned) |
|-----------|-------|-----------------------|------------------------|-------------------|---------------------|
| Read | ✅ | ✅ | ❌ | ✅ | ❌ |
| Create | ✅ | ❌ | ❌ | ❌ | ❌ |
| Update | ✅ | ✅ | ❌ | ✅ | ❌ |
| Delete | ✅ | ❌ | ❌ | ❌ | ❌ |

### `/flocks/{flockId}`

| Operation | Admin | Supervisor (farm access) | Farmer (farm access) | No farm access |
|-----------|-------|-------------------------|---------------------|----------------|
| Read | ✅ | ✅ | ✅ | ❌ |
| Create | ✅ | ❌ | ❌ | ❌ |
| Update (safe fields) | ✅ | ✅ | ✅ | ❌ |
| Update (protected fields) | ✅ | ❌ | ❌ | ❌ |
| Delete | ✅ | ❌ | ❌ | ❌ |

**Protected update fields:** `farmId`, `flockId`, `initialBirds`, `startDate`, `breedType`, `productionCurve`, `batchNumber`, `isInitialFlock`, `status`

### `/dailyReports/{userId}/dailyLogs/{date}`

| Operation | Admin | Owner | Supervisor (farm access) | No access |
|-----------|-------|-------|-------------------------|-----------|
| Read | ✅ | ✅ | ✅ | ❌ |
| Create | ✅ | ✅ (if farm access) | ✅ (if farm access) | ❌ |
| Update | ✅ | ✅ (if farm access) | ✅ (if farm access) | ❌ |
| Delete | ✅ | ❌ | ❌ | ❌ |

### `/dailyReportLocks/{lockId}`

| Operation | Admin | User with farm access | No access |
|-----------|-------|-----------------------|-----------|
| Read | ✅ | ✅ | ❌ |
| Create | ✅ | ✅ | ❌ |
| Update | ✅ | ✅ | ❌ |
| Delete | ✅ | ❌ | ❌ |

### `/auditLogs/{logId}`

| Operation | Admin | Non-admin |
|-----------|-------|-----------|
| Read | ✅ | ❌ |
| Create | ✅ | ✅ (own userId only) |
| Update/Delete | ✅ | ❌ |

### `/importBatches/{batchId}`

| Operation | Admin | Non-admin |
|-----------|-------|-----------|
| All | ✅ | ❌ |

---

## Frontend Route Protection Matrix

| Route | Guard Component | Allowed Roles | Backend Enforcement |
|-------|----------------|---------------|---------------------|
| `/farmer/form` | `ProtectedRoute` | `farmer` | Firestore rules (direct writes) |
| `/supervisor/*` | `ProtectedManagementRoute` | `supervisor` | Firestore rules (reads) |
| `/admin/*` | `ProtectedManagementRoute` | `admin` | Backend API + Firestore rules |
| `/supervisor/feed-load` | `ProtectedManagementRoute` | `supervisor` | Firestore rules (direct writes) |
| `/admin/feed-load` | `ProtectedManagementRoute` | `admin` | Firestore rules (direct writes) |
| `/login` | None | Public | — |
| `/management/login` | None | Public | — |

> [!WARNING]
> Frontend route guards are **client-side only**. They redirect unauthorized users but do NOT prevent direct Firestore access. Security depends entirely on Firestore rules for direct operations and backend middleware for API calls.
