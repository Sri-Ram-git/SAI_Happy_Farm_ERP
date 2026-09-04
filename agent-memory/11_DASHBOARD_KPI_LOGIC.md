# Dashboard & KPI Logic

Dashboards (Admin & Supervisor) generate key performance indicators dynamically.

## Core Principle
**There is no "KPI Database".** All dashboard metrics are generated at runtime by subscribing directly to the raw, underlying Firestore collections (`farms`, `users`, `dailyReports`). 

## Key Metrics & Sourcing
- **Total Farms:** Array length of active documents retrieved from the `farms` collection.
- **Active Farmers:** Array length of active documents retrieved from the `users` collection where `role == 'farmer'`.
- **Submitted Today:** A realtime query targeting the `dailyReports/{uid}/dailyLogs` subcollections matching the exact localized `YYYY-MM-DD` string representing "today".
- **Total Birds:** Reduces (sums) the `currentBirdCount` of every active farm.
- **Average Mortality:** Sums the daily reported mortality across all received `dailyLogs` for the targeted date scope, divided by the total active bird population.

## Implication for Agents
Never "hardcode" a KPI or create a dummy variable like `const mockTotalBirds = 50000;`. The UI must always derive these numbers from the live data stream. If a KPI fails to render, the issue is always either a misconfigured Firestore index, an incorrect date boundary (timezone shift), or a mismatched field reference in the aggregator hook.
