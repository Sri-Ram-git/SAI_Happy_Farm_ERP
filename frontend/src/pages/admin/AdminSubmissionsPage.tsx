import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/dashboard/DashboardLayout';
import { LoadingState } from '../../components/dashboard/LoadingState';
import { EmptyState } from '../../components/dashboard/EmptyState';
import { type ReportDoc } from '../../services/reportDataService';
import { getAllFarms, type FarmDoc } from '../../services/farmDataService';
import { getAllUsers, type UserDoc } from '../../services/userDataService';
import { getIstDate, formatDisplayDate, formatTime } from '../../utils/dateUtils';
import { useDailyReportsByDate } from '../../hooks/useDailyReports';

import { ExportReportsCard } from '../../components/dashboard/ExportReportsCard';

export function AdminSubmissionsPage() {
  const { userProfile } = useAuth();
  const [date, setDate] = useState(getIstDate());
  const [farms, setFarms] = useState<FarmDoc[]>([]);
  const [farmers, setFarmers] = useState<UserDoc[]>([]);
  const [farmLoading, setFarmLoading] = useState(true);
  const [search, setSearch] = useState('');
  const { reports, loading: reportsLoading, error } = useDailyReportsByDate(date);
  const loading = farmLoading || reportsLoading;

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [frms, frs] = await Promise.all([getAllFarms(), getAllUsers()]);
        if (mounted) { setFarms(frms); setFarmers(frs.filter((u) => u.role === 'farmer')); }
      } catch (err) {
        console.error('[AdminSubmissions] Load error:', err);
      } finally {
        if (mounted) setFarmLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const rows = farms.map((farm) => {
    const report = reports.find((r) => r.farmId === farm.farmId);
    const farmer = farmers.find((f) => f.farmIds.includes(farm.farmId));
    return { farm, report, farmer, submitted: !!report };
  }).filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.farm.farmId.toLowerCase().includes(q) || (r.farmer?.name ?? '').toLowerCase().includes(q);
  });

  const submittedCount = rows.filter((r) => r.submitted).length;

  if (loading) return <DashboardLayout role="admin" userName={userProfile?.name}><LoadingState /></DashboardLayout>;

  return (
    <DashboardLayout role="admin" userName={userProfile?.name}>
      <div className="mgmt-page">
        {error && <div className="alert alert--error" style={{ marginBottom: 16 }}>{error}</div>}
        <ExportReportsCard />
        <div className="mgmt-page-header">
          <h2>Submissions - {formatDisplayDate(date)}</h2>
          <div className="header-controls">
            <input
              type="text"
              className="search-input"
              placeholder="Search farm or farmer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <input
              type="date"
              className="date-input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>

        <div className="submission-summary">
          <span className="submission-count">{submittedCount} / {farms.length} submitted</span>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Farm ID</th>
                <th>Farmer</th>
                <th>Status</th>
                <th>Birds</th>
                <th>Production</th>
                <th>Submitted At</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ farm, report, farmer }) => (
                <tr key={farm.farmId}>
                  <td className="td-bold">{farm.farmId}</td>
                  <td>{farmer?.name || 'Unknown'}</td>
                  <td>
                    <span className={`status-badge ${report ? 'status-badge--ok' : 'status-badge--warn'}`}>
                      {report ? 'Submitted' : 'Not Submitted'}
                    </span>
                  </td>
                  <td>{report?.birdCount ?? '--'}</td>
                  <td>{report ? `${((report.eggsProduced ?? 0) / (report.birdCount ?? 1) * 100).toFixed(1)}%` : '--'}</td>
                  <td>{report ? formatTime(report.createdAt) : '--'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {rows.length === 0 && <EmptyState message="No farms found." />}
      </div>
    </DashboardLayout>
  );
}
