# Deployment Requirements

## Frontend
The frontend is a React SPA built with Vite. It can be deployed to Firebase Hosting.
Only the `frontend/dist` directory should be deployed.

## Backend (Admin Features)
The system includes a custom Node.js/Express API (located in `backend/`) that uses the Firebase Admin SDK. This API is **required** for privileged operations such as:
- Role assignment (Admin, Supervisor, Farmer)
- Batch exports (e.g., Production Curve Excel Export)
- User status management

### Configuration
You must deploy the `backend/` codebase to a Node.js hosting provider (such as Railway or Vercel).
Once deployed, the production URL of this backend API must be provided to the frontend build via the `VITE_API_URL` environment variable.

If `VITE_API_URL` is omitted during a production build, the build will explicitly fail to prevent the frontend from silently falling back to a development localhost URL.
