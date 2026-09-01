import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/dashboard/DashboardLayout';
import { LoadingState } from '../../components/dashboard/LoadingState';
import { EmptyState } from '../../components/dashboard/EmptyState';
import { type ReportDoc } from '../../services/reportDataService';
import { useDailyReportsByDate } from '../../hooks/useDailyReports';
import { getFarmsByIds, type FarmDoc } from '../../services/farmDataService';
import { getActiveFarmers, type UserDoc } from '../../services/userDataService';
import { getIstDate, formatDisplayDate, formatTime } from '../../utils/dateUtils';

export function SupervisorSubmissionsPage() {
  const { userProfile } = useAuth();
  const [date, setDate] = useState(getIstDate());
  const [farms, setFarms] = useState<FarmDoc[]>([]);
  const [farmers, setFarmers] = useState<UserDoc[]>([]);

  const assignedFarmIds = userProfile?.farmIds ?? [];
  const { reports: allReports, loading, error } = useDailyReportsByDate(date);
  const reports = allReports.filter((r) => assignedFarmIds.includes(r.farmId));

  useEffect(() => {
    if (assignedFarmIds.length === 0) return;
    Promise.all([getFarmsByIds(assignedFarmIds), getActiveFarmers()])
      .then(([frms, frs]) => {
        setFarms(frms);
        setFarmers(frs.filter((f) => f.farmIds.some((id) => assignedFarmIds.includes(id))));
      })
      .catch((err) => console.error('[SupervisorSubmissions] Load error:', err));
  }, [assignedFarmIds.join(',')]);

  const submittedFarmIds = new Set(reports.map((r) => r.farmId));

  const rows = farms.map((farm) => {
    const report = reports.find((r) => r.farmId === farm.farmId);
    const farmer = farmers.find((f) => f.farmIds.includes(farm.farmId));
    return { farm, report, farmer, submitted: !!report };
  });

  const submittedCount = rows.filter((r) => r.submitted).length;

  if (loading) return <DashboardLayout role="supervisor" userName={userProfile?.name}><LoadingState /></DashboardLayout>;
  if (assignedFarmIds.length === 0) return <DashboardLayout role="supervisor" userName={userProfile?.name}><EmptyState message="No farms assigned." /></DashboardLayout>;

  return (
    <DashboardLayout role="supervisor" userName={userProfile?.name}>
      <div className="mgmt-page">
        <div className="mgmt-page-header">
          <h2>Submissions - {formatDisplayDate(date)}</h2>
          <div className="header-controls">
            <span className="submission-count">{submittedCount} / {farms.length} submitted</span>
            <input
              type="date"
              className="date-input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>

        {error && <div className="alert alert--error" style={{ marginBottom: 16 }}>{error}</div>}

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Farm ID</th>
                <th>Farmer</th>
                <th>Status</th>
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
                  <td>{report ? formatTime(report.createdAt) : '--'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
