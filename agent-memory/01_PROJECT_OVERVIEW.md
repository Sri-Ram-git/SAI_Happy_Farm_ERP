# Project Overview

**Project Name:** Farm ERP / Poultry Farm Management System (SAI Happy Farms)

## Purpose
The Farm ERP is a digital management system designed to track poultry farm operations, live bird inventory, feed consumption, environmental metrics, and daily farm activity. It eliminates manual record-keeping by providing a unified digital portal for farmers to submit data, and dashboards for supervisors and administrators to monitor live operations.

## Users & Workflows
- **Farmer:** Assigned to specific farms. Logs in daily to submit metrics (mortality, culling, feed consumed, eggs produced, temperature).
- **Supervisor:** Oversees multiple farmers and farms. Views aggregated daily reports, reviews farm health KPIs, and monitors submission compliance across assigned farms.
- **Admin:** Global system owner. Manages users, provisions new farms, creates historical tracking flocks, sets initial inventory, and reviews enterprise-wide analytics.

## Technology Stack
- **Frontend:** React, TypeScript, Vite
- **Styling:** CSS
- **Backend:** Firebase Cloud Firestore (Serverless)
- **Authentication:** Firebase Auth
- **Routing:** React Router

## Current Environment
- The application executes in the browser as a Single Page Application (SPA).
- No middle-tier server exists; clients communicate directly with Firebase via the Firebase Web SDK.
- The project is at **V1 Finalized ERP** state.
