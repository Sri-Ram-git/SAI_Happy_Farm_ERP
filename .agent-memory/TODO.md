# TODO.md

*Last updated: 2026-09-02*

## CRITICAL

- [ ] Verify collectionGroup("dailyLogs") query works in Firebase Console (check security rules + indexes)
- [ ] Verify inventory documents exist for all active farms (run init script or manually create)
- [ ] Test full daily submission → dashboard update end-to-end flow
- [ ] Fix "Submitted Today: 0 / 1" if it persists after above checks
- [ ] Verify active farmer denominator matches actual active farmers in users collection

## HIGH

- [ ] Verify Firestore security rules allow collectionGroup reads on `dailyLogs`
- [ ] Create Firestore composite index for `dailyLogs` on `submissionDate` if needed
- [ ] Add loading skeleton component to KpiCard (CSS exists, not wired up)
- [ ] Add Farm Production Comparison chart to AdminDashboard
- [ ] Add Bird Population Trend chart to AdminDashboard
- [ ] Verify Supervisor dashboard loads reports correctly
- [ ] Test feed load workflow end-to-end
- [ ] Verify bird inventory updates after report submission
- [ ] Verify feed inventory decreases after report submission

## MEDIUM

- [ ] Add bird transaction history viewer to Admin dashboard
- [ ] Add feed transaction history viewer to Admin dashboard
- [ ] Implement reminder/notification for missing reports (integration point marked)
- [ ] Add export/download functionality for reports
- [ ] Add bulk inventory initialization script
- [ ] Verify backend API endpoints work correctly
- [ ] Add admin user creation endpoint (currently stub)

## LOW

- [ ] Clean up legacy placeholder pages (AdminPage.tsx, SupervisorPage.tsx)
- [ ] Remove unused RoleSelector.tsx component
- [ ] Add error boundaries to all page components
- [ ] Add accessibility labels to form inputs
- [ ] Add unit tests for frontend components
- [ ] Add E2E tests for critical flows

## COMPLETED

- [x] Create Farmer feature (admin can create farmer accounts via backend API)
- [x] Fix "farmsLoading is not defined" crash (AdminDashboard.tsx)
- [x] Fix React key collision in Admin All Reports table
- [x] Fix collectionGroup error propagation (newQFailed flag)
- [x] Farmer login + daily report submission
- [x] Admin dashboard with 10 interactive KPI cards + detail drawers
- [x] Supervisor dashboard with farm-filtered KPIs
- [x] Feed load workflow (FeedLoadPage)
- [x] Bird and feed inventory management
- [x] Atomic report submission with inventory deduction
- [x] Backward compatibility with old report format
- [x] Real-time data via onSnapshot listeners
- [x] Date range filtering (Today, 7, 30, 90 days)
- [x] Professional chart enhancements (Line, Bar, Area)
- [x] DetailDrawer component with animations
- [x] Role normalization for inconsistent data
- [x] collectionGroup error handling (non-fatal)
- [x] Form validation for daily report
- [x] Duplicate prevention
- [x] IST timezone handling
