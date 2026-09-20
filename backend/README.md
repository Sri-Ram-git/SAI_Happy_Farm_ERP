# SAI Happy Farms ERP - Express REST API Backend

Standalone Node.js + Express REST API backend for SAI Happy Farms Data Capture System, ready for deployment on **Railway**.

---

## 1. Component Architecture & Endpoints

### **Health Check Endpoints**
* `GET /health` -> `{"status": "ok"}`
* `GET /` -> `{"name": "SAI Happy Farms API", "version": "1.0.0", "status": "running"}`

### **API v1 Routes**
* `POST /api/v1/reports/daily` (Auth, Rate Limited, Zod Validated, Farm Access Check)
* `GET /api/v1/reports/daily/:id` (Auth Check)
* `GET /api/v1/farms`, `POST /api/v1/farms`, `GET /api/v1/farms/:id`
* `GET /api/v1/flocks`, `POST /api/v1/flocks`, `GET /api/v1/flocks/:id`
* `GET /api/v1/admin/users`, `PATCH /api/v1/admin/users/:uid/status`, `POST /api/v1/admin/users/farmer`

---

## 2. Local Setup & Execution

1. Clone repository:
   ```bash
   git clone https://github.com/kkeerthanaaaa/Happy_Farm_ERP_backend.git
   cd Happy_Farm_ERP_backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy environment template:
   ```bash
   cp .env.example .env
   ```
4. Place `service-account.json` in root folder (for local dev fallback).
5. Run development server:
   ```bash
   npm run dev
   ```
6. Build & Test production startup:
   ```bash
   npm run build
   npm start
   ```

---

## 3. Railway Deployment Configuration

* **Root Directory:** `./`
* **Build Command:** `npm run build` *(Compiles TypeScript to `dist/`)*
* **Start Command:** `npm start` *(Executes `node dist/index.js`)*

### **Required Railway Environment Variables:**
| Variable Name | Example Value | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables production mode & strict security rules |
| `FIREBASE_PROJECT_ID` | `farm-form` | Your Firebase Project ID |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | `{"type":"service_account",...}` | Raw JSON text of Firebase Admin Service Account Key |
| `ALLOWED_ORIGINS` | `https://your-frontend.vercel.app` | Comma-separated CORS allowed origin URLs |
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate limit window in ms (15 minutes) |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | Max requests per IP per window |
| `LOG_LEVEL` | `info` | Logging verbosity level |
