import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/dashboard/DashboardLayout';
import { LoadingState } from '../../components/dashboard/LoadingState';
import { EmptyState } from '../../components/dashboard/EmptyState';
import { getReportsByDate, type ReportDoc } from '../../services/reportDataService';
import { getFarmsByIds, type FarmDoc } from '../../services/farmDataService';
import { getActiveFarmers, type UserDoc } from '../../services/userDataService';
import { getIstDate, formatDisplayDate, formatTime } from '../../utils/dateUtils';

export function SupervisorSubmissionsPage() {
  const { userProfile } = useAuth();
  const [date, setDate] = useState(getIstDate());
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<ReportDoc[]>([]);
  const [farms, setFarms] = useState<FarmDoc[]>([]);
  const [farmers, setFarmers] = useState<UserDoc[]>([]);

  const assignedFarmIds = userProfile?.farmIds ?? [];

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [allReports, frms, frs] = await Promise.all([
        getReportsByDate(date),
        getFarmsByIds(assignedFarmIds),
        getActiveFarmers(),
      ]);
      const assignedReports = allReports.filter((r) => assignedFarmIds.includes(r.farmId));
      setReports(assignedReports);
      setFarms(frms);
      setFarmers(frs.filter((f) => f.farmIds.some((id) => assignedFarmIds.includes(id))));
    } catch (err) {
      console.error('[SupervisorSubmissions] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [date, assignedFarmIds]);

  useEffect(() => { loadData(); }, [loadData]);

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
