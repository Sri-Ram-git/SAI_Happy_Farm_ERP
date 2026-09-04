# Known Issues

The following issues are known to exist but have been determined to be non-blocking for the V1 Finalized ERP release.

## Non-Blocking
- **Legacy Flocks Lifecycle:** The legacy `flocks` collection currently lacks a robust automated completion trigger. Admin users must manually intervene or ignore old flock entries. This does not block daily operations as the true master inventory resides on `farms/{farmId}`.

## Cosmetic
- **Responsive Tables:** The Admin dashboard tables may overflow horizontally on exceptionally narrow mobile devices (< 320px). The core KPI cards flex correctly.

## Future Improvements
- **Pagination:** The Supervisor and Admin dashboards currently fetch the entire `dailyReports` sub-tree for the selected date range. As data scales into thousands of reports per month, query pagination or cloud-function aggregation will become necessary to maintain UI performance.
- **Offline PWA Support:** Currently, the system relies on Firebase's native offline caching, but a full Progressive Web App (PWA) manifest with explicit Service Worker caching for assets would improve rural connectivity resilience.
