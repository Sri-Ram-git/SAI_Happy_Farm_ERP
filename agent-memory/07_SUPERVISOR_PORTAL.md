# Supervisor Portal

The Supervisor Portal (`/supervisor`) serves as a mid-tier management dashboard for field managers.

## Core Responsibilities
- Monitor daily submission compliance from assigned farmers.
- Review farm-level health and production metrics.
- Identify anomalies (e.g., high mortality, low production) rapidly.

## Data Sources
- **Master Farms (`farms/{farmId}`):** To display total flock sizes and available feed.
- **Daily Reports (`dailyReports/*`):** To calculate "Submitted Today" vs "Missing Today" metrics.
- **Calculations:** Supervisor KPIs are built on the fly using `kpiCalculations.ts` or inline data hooks, evaluating the raw Firestore streams. 

## Important Features
- **Date Filtering:** Supervisors can evaluate historical data by changing the targeted date scope.
- **Drill-down:** Clicking on specific farms or aggregated metrics provides detailed table views of exactly who submitted what data.

*Note: The Supervisor portal is predominantly read-only. Supervisors do not directly deduct farm inventory or submit daily reports on behalf of farmers.*
