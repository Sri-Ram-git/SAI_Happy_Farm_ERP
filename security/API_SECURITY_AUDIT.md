# API SECURITY AUDIT — Happy Farmer ERP

## 1. Authentication (auth.middleware.ts)

### Implementation
- Extracts Bearer token from `Authorization` header
- Verifies via `admin.auth().verifyIdToken(idToken, true)` — the `true` parameter checks for token revocation ✅
- Fetches user document from `/users/{uid}` to get role and farmIds
- Checks `userData.active === true` — rejects deactivated accounts ✅
- Sets `req.user` with `uid`, `email`, `role`, `farmIds`

### Assessment: ✅ SECURE
- Token verification is server-side with revocation check
- User profile is fetched fresh on every request (not cached from token claims)
- Deactivated accounts are properly rejected
- Error handling doesn't leak internal details

---

## 2. Authorization (authorization.middleware.ts)

### `requireRole(...allowedRoles)`
- Checks `req.user.role` against allowed roles
- Logs denied attempts with context ✅

### `requireFarmAccess`
- Admin and OFFICE_STAFF bypass farm check ✅
- Extracts farmId from `req.params.farmId` OR `req.body.farmId`
- Checks `req.user.farmIds.includes(farmId)` ✅

### Assessment: ✅ SECURE (with one exception)
- **SEC-09**: `GET /reports/daily/:id` uses `authMiddleware` but NOT `requireFarmAccess`. The controller does check farm access after fetching the report, but this means the report data is fetched before authorization is confirmed. The check itself works, but it's a defense-in-depth concern.

---

## 3. Rate Limiting (rateLimit.middleware.ts)

### Global Rate Limiter
- Applied to all routes via `app.use(rateLimitMiddleware)`
- Uses configurable `RATE_LIMIT_WINDOW_MS` (default 900000ms = 15 min) and `RATE_LIMIT_MAX_REQUESTS` (default 100)

### Endpoint-Specific Rate Limiter
- `POST /reports/daily` has `createRateLimiter(60000, 10)` — 10 requests per minute

### Issues Found

| ID | Severity | Issue |
|---|---|---|
| SEC-15 | MEDIUM | Rate limiter uses in-memory `Map` — not shared across process instances or restarts. If the backend runs behind a load balancer with multiple instances, rate limits are per-instance. |
| — | LOW | Client identification uses `req.ip` which may be shared across users behind NAT/proxy, potentially causing legitimate users to be rate-limited. |

---

## 4. Input Validation (validators/)

### Password Policy

| Role | Backend Validator | Frontend Form | Consistent? |
|---|---|---|---|
| Admin | `min(8)` ✅ | `AdminCreateAdminPage.tsx` | ✅ |
| Supervisor | `min(8)` ✅ | `AdminCreateSupervisorPage.tsx` | ✅ |
| **Farmer** | **`min(6)`** ⚠️ | Unknown | **❌ SEC-08: Inconsistent** |

> [!WARNING]
> **SEC-08:** `farmer.validator.ts` line 19 still uses `min(6)` while admin and supervisor validators use `min(8)`. This was missed in the SEC-05 remediation. Farmer accounts have weaker password requirements.

### Schema Strictness
- All validators use `.strict()` — rejects unexpected fields ✅
- Import records use comprehensive field validation ✅

### Missing Validation
- No password complexity requirements (uppercase, lowercase, digits, special chars) for any role
- No email domain restriction

---

## 5. CORS Configuration (index.ts)

### Implementation
```typescript
const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (env.NODE_ENV === 'development') {
      if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
    }
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
}));
```

### Assessment
- ✅ Production wildcard check: `environment.ts` line 16-25 validates that `ALLOWED_ORIGINS` doesn't contain `*` in production
- ✅ Development mode allows localhost origins only
- ⚠️ `!origin` allows `null` origin — this permits requests from non-browser clients (curl, Postman) which is acceptable since auth is token-based
- ✅ `credentials: true` enables cookies/auth headers

---

## 6. Security Headers (helmet)

- `app.use(helmet())` applied ✅
- Default helmet provides: `X-DNS-Prefetch-Control`, `X-Frame-Options`, `Strict-Transport-Security`, `X-Download-Options`, `X-Content-Type-Options`, `X-XSS-Protection`
- **SEC-18:** No custom `Content-Security-Policy` configured. Helmet v7 does NOT set CSP by default.

---

## 7. Error Handling (error.middleware.ts)

### Assessment: ✅ SECURE
- `AppError` subclasses return structured `{ success, error: { code, message } }` — no stack traces ✅
- Unhandled errors wrapped in `InternalError` — returns generic "Internal server error" ✅
- Stack traces and internal details logged server-side only ✅
- Error names/messages NOT included in 500 responses ✅

---

## 8. Logger Security (logger.ts)

### Assessment: ⚠️ SEC-12
- JSON structured logging ✅
- **No sensitive field redaction** — if `password`, `token`, or PII is passed in metadata, it's logged as-is
- Logger doesn't filter `meta` keys before output
- The `authorization.middleware.ts` logs `allowedFarmIds` on denied requests — acceptable for audit trail

---

## 9. Backend Controller Issues

### `flock.controller.ts` — SEC-16
```typescript
} catch (error) {
  console.error('Create flock error:', error);
  res.status(500).json({ error: 'Failed to create flock' });
}
```
- Uses `console.error` instead of the structured logger
- The error object is logged raw — could contain sensitive stack traces or data
- Response is generic ✅ (doesn't leak to client)

### `reports.controller.ts:getReportById` — SEC-09
- Farm access check happens IN the controller (lines 46-57) AFTER the report is fetched
- No `requireFarmAccess` middleware on the route
- The check itself is correct but the report data is loaded before authorization

---

## 10. Request Size Limits

- `express.json({ limit: '10mb' })` — accepts up to 10MB request bodies
- ⚠️ 10MB is generous for an API that primarily handles JSON form data. Import payloads may need this size, but could enable memory pressure attacks.

---

## 11. Trust Proxy

- `app.set('trust proxy', 1)` — trusts one level of proxy ✅
- Important for correct `req.ip` in rate limiting behind reverse proxy
