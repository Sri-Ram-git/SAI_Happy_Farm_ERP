# SAI Happy Farms - Farm Data Capture System API

Secure backend API for the SAI Happy Farms farm data management system.

## Architecture

```
Frontend
    ↓ HTTPS
API
    ↓
Authentication (Firebase Auth)
    ↓
Authorization / RBAC
    ↓
Request validation (Zod schemas)
    ↓
Business-rule validation
    ↓
Rate limiting / abuse protection
    ↓
Business service
    ↓
Firestore (via Admin SDK)
    ↓
Audit logging
```

## Tech Stack

- Node.js + TypeScript (strict mode)
- Express.js
- Firebase Authentication
- Firebase Admin SDK (Firestore)
- Zod (schema validation)
- Helmet (security headers)
- CORS
- Vitest (testing)
- ESLint + Prettier

## Project Structure

```
src/
├── index.ts                    # Express app entry point
├── config/
│   ├── firebase.ts             # Firebase Admin SDK initialization
│   └── environment.ts          # Environment config with Zod validation
├── middleware/
│   ├── auth.middleware.ts       # Firebase token verification
│   ├── authorization.middleware.ts  # RBAC + farm-level authorization
│   ├── validation.middleware.ts # Zod schema validation
│   ├── rateLimit.middleware.ts  # Rate limiting
│   └── error.middleware.ts      # Centralized error handling
├── routes/
│   ├── reports.routes.ts       # Report endpoints
│   ├── farms.routes.ts         # Farm endpoints
│   └── admin.routes.ts         # Admin-only endpoints
├── controllers/
│   ├── reports.controller.ts   # Report request handlers
│   └── farms.controller.ts     # Farm request handlers
├── services/
│   ├── reports.service.ts      # Report business logic
│   ├── farms.service.ts        # Farm business logic
│   └── audit.service.ts        # Audit logging
├── repositories/
│   ├── reports.repository.ts   # Firestore report operations
│   └── farms.repository.ts     # Firestore farm operations
├── validators/
│   └── report.validator.ts     # Business rule validation
├── types/
│   ├── auth.ts                 # Auth types and roles
│   └── reports.ts              # Report types and Zod schemas
└── utils/
    ├── errors.ts               # Custom error classes
    ├── logger.ts               # Structured JSON logging
    └── requestId.ts            # Request ID generation
```

## Environment Variables

Required environment variables (see `.env.example`):

| Variable | Description | Default |
|----------|-------------|---------|
| `FIREBASE_PROJECT_ID` | Firebase project ID | Required |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Path to service account JSON | `./service-account.json` |
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment | `development` |
| `ALLOWED_ORIGINS` | CORS origins (comma-separated) | `http://localhost:3000` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window (ms) | `900000` |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | `100` |
| `LOG_LEVEL` | Log level | `info` |

## Setup

### Backend

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and configure.

3. Place your Firebase service account JSON at the path specified in `FIREBASE_SERVICE_ACCOUNT_PATH`.

4. Run in development:
   ```bash
   npm run dev
   ```

### Frontend (Testing UI)

The `frontend/` folder contains a login testing UI that connects to the backend API.

1. Go to the frontend folder:
   ```bash
   cd frontend
   ```

2. Start the frontend server:
   ```bash
   npx serve . -l 5500
   ```

3. Open `http://localhost:5500` in your browser.

4. Create a test user in Firebase Console → Authentication → Users tab.

5. Sign in with the test user credentials.

6. Use the dashboard to test API endpoints.

## API Endpoints

### Reports
- `POST /api/v1/reports/daily` - Create daily report
- `GET /api/v1/reports/daily/:id` - Get report by ID

### Farms
- `GET /api/v1/farms` - List authorized farms
- `GET /api/v1/farms/:farmId` - Get farm by ID

### Admin
- `GET /api/v1/admin/users` - List users (admin only)

### Health
- `GET /health` - Health check

## Security Features

1. **Firebase Authentication** - All protected endpoints require valid Firebase ID token
2. **RBAC** - Role-based access control (farmer, supervisor, office_staff, admin)
3. **Farm-level authorization** - Farmers can only access their assigned farms
4. **Strict input validation** - Zod schemas reject unexpected fields and invalid data
5. **Business rule validation** - Server-side business logic validation
6. **Server-side timestamps** - Client cannot override submission dates
7. **Server-side identity** - Client cannot override submittedBy or role
8. **Rate limiting** - Configurable rate limiting per endpoint
9. **CORS** - Configurable allowed origins
10. **Security headers** - Helmet middleware
11. **Request size limits** - 100kb JSON body limit
12. **Structured logging** - JSON logs with request IDs
13. **Audit logging** - Track important events
14. **Error sanitization** - No internal details exposed to client

## Testing

```bash
npm test
npm run test:watch
npm run test:coverage
```

## Linting

```bash
npm run lint
npm run lint:fix
npm run format
```

## Daily Report Input Schema

```json
{
  "farmId": "AP12",
  "birdCount": 5000,
  "feedKg": 1250,
  "mortality": 10,
  "culling": 2,
  "eggProduction": 4500,
  "selectionEggs": 100,
  "temperature": 25.5,
  "eggWeightMin": 58,
  "eggWeightMax": 62,
  "eggWeightAvg": 60,
  "bodyWeightMin": 1.7,
  "bodyWeightMax": 1.9,
  "bodyWeightAvg": 1.8,
  "remarks": "",
  "ammoniaResult": 10
}
```

The backend generates these fields server-side:
- `submittedBy` - from verified Firebase UID
- `submissionDate` - server-generated date
- `createdAt` - server timestamp
- `submissionMethod` - "DIGITAL_FORM"

## Business Rules

- `birdCount` >= 0
- `mortality` >= 0 and <= `birdCount`
- `culling` >= 0 and <= `birdCount`
- `mortality + culling` <= `birdCount`
- `eggWeightMin` <= `eggWeightAvg` <= `eggWeightMax`
- `bodyWeightMin` <= `bodyWeightAvg` <= `bodyWeightMax`
- `eggProduction` <= `birdCount`
- `selectionEggs` <= `eggProduction`
- Temperature between -10 and 60
- Ammonia between 0 and 100

## Duplicate Detection

The system prevents duplicate daily submissions based on `farmId` + `submissionDate` combination. Returns HTTP 409 if a report already exists for the same farm on the same date.
