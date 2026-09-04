# Role-Based Access Control — Actual Implementation

## Roles (from `src/types/auth.ts`)
| Role | Value |
|------|-------|
| Farmer | `'farmer'` |
| Supervisor | `'supervisor'` |
| Office Staff | `'office_staff'` |
| Admin | `'admin'` |

## Firestore Security Rules Summary

### Users Collection
| Action | farmer | supervisor | admin |
|--------|--------|------------|-------|
| Read own doc | ✅ | ✅ | ✅ |
| Read other docs | ❌ | ✅ | ✅ |
| Create | ❌ | ❌ | ✅ |
| Update own (non-sensitive) | ✅ | ✅ | ✅ |
| Update role/farmIds/active | ❌ | ❌ | ✅ |
| Delete | ❌ | ❌ | ✅ |

### Farms Collection
| Action | farmer | supervisor | admin |
|--------|--------|------------|-------|
| Read (active user) | ✅ | ✅ | ✅ |
| Create | ❌ | ❌ | ✅ |
| Update (with farm access) | ✅ | ✅ | ✅ |
| Delete | ❌ | ❌ | ✅ |

### Daily Reports
| Action | farmer | supervisor | admin |
|--------|--------|------------|-------|
| Read own | ✅ | ✅ | ✅ |
| Read by farm access | ✅ | ✅ | ✅ |
| CollectionGroup read | ✅ (active) | ✅ (active) | ✅ |
| Create own | ✅ | ✅ | ✅ |
| Delete | ❌ | ❌ | ✅ |

### Audit Logs
| Action | farmer | supervisor | admin |
|--------|--------|------------|-------|
| Read | ❌ | ❌ | ✅ |
| Write | ✅ (authenticated) | ✅ | ✅ |

## Backend API Authorization
- `authMiddleware`: Verifies Firebase ID token, loads user doc, checks `active === true`
- `requireRole(role)`: Restricts endpoint to specific roles
- `requireFarmAccess`: Validates `farmId` is in user's `farmIds[]` (admin bypasses)

## Frontend Route Guards
- `/farmer/report` → `<ProtectedRoute allowedRole="farmer">`
- `/admin/*` → `<ProtectedManagementRoute allowedRoles={['admin', 'supervisor']}>`
- `/supervisor/*` → `<ProtectedManagementRoute allowedRoles={['admin', 'supervisor']}>`
