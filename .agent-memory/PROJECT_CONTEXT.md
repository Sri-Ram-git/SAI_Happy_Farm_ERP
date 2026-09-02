# PROJECT_CONTEXT.md

## Project Name
Sai Happy Farms / Poultry Farm Management ERP

## Purpose
A web-based poultry farm management system where farmers submit daily farm reports digitally and data synchronizes to Supervisor and Admin dashboards in real-time. The system supports approximately 50 users/farmers submitting daily reports across multiple farms.

## Core Roles
- **Farmer** — Submits daily reports (mortality, culling, feed usage, eggs produced, etc.)
- **Supervisor** — Monitors assigned farms, views KPIs, manages feed loads
- **Admin** — Manages all users, farms, inventory, views global analytics

## Core Technology Stack
- **Frontend:** React 19 + TypeScript + Vite (SPA, single-page application)
- **Backend API:** Node.js + Express + TypeScript (runs on port 3000)
- **Database:** Cloud Firestore (Firebase)
- **Authentication:** Firebase Authentication (email/password)
- **Firebase SDK:** v12.18.0 loaded via CDN (compat mode) — NOT npm package
- **Charting:** Recharts v3.10.1
- **Timezone:** All dates use Asia/Kolkata (IST)

## Important: Dual Data Access Pattern
The frontend talks **directly to Firestore** via the Firebase CDN compat SDK for reads and writes. The backend Express API is a **separate, independent layer** with its own Firebase Admin SDK access. The frontend does NOT call the Express API endpoints for most operations.

## Firebase Configuration
- Project ID: `farm-form`
- Auth domain: `farm-form.firebaseapp.com`
- Config location: `frontend/index.html` (CDN scripts + inline config)

## Test vs Production
All current development is on the **TEST Firebase environment/project** (`farm-form`). Production must not be modified without explicit instruction.
