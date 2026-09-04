# Admin Portal

The Enterprise Admin Dashboard (`/admin`) is the central control point for global application management.

## Core Responsibilities
- Create and provision new farmers, supervisors, and administrators.
- Establish new farm entities and assign users to those farms.
- Define initial master inventory limits.
- Manage "legacy flocks" for age-based cohort tracking.
- Add bulk feed to the master `currentFeedKg` inventory of any farm.
- Review global, enterprise-wide aggregated analytics.

## Data Sources
- The Admin portal has unrestricted read access to `users`, `farms`, `flocks`, `dailyReports`, and system-wide audit tables.
- Aggregated charts utilize D3/Recharts to visualize `currentBirdCount` vs capacity, feed consumption rates, and overall daily compliance metrics.

## Authoritative Management
The Admin portal is the authoritative origin for all core relationships. A farmer cannot exist or access the platform unless explicitly provisioned and bound to a `farmId` by an Admin.
