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
import { Eye } from 'lucide-react';
import { ReportDetailDrawer } from '../../components/dashboard/ReportDetailDrawer';

export function SupervisorSubmissionsPage() {
  const { userProfile } = useAuth();
  const [date, setDate] = useState(getIstDate());
  const [farms, setFarms] = useState<FarmDoc[]>([]);
  const [farmers, setFarmers] = useState<UserDoc[]>([]);
  const [selectedReportRow, setSelectedReportRow] = useState<{ report: ReportDoc; farm: FarmDoc; farmer?: UserDoc } | null>(null);

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
                <th>Remarks</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ farm, report, farmer }) => {
                const hasRemarks = Boolean(report?.remarks && report.remarks.trim().length > 0);
                return (
                  <tr key={farm.farmId}>
                    <td className="td-bold">{farm.farmId}</td>
                    <td>{farmer?.name || 'Unknown'}</td>
                    <td>
                      <span className={`status-badge ${report ? 'status-badge--ok' : 'status-badge--warn'}`}>
                        {report ? 'Submitted' : 'Not Submitted'}
                      </span>
                    </td>
                    <td>{report ? formatTime(report.createdAt) : '--'}</td>
                    <td style={{ maxWidth: 220 }}>
                      {report ? (
                        hasRemarks ? (
                          <div className="remarks-cell-preview" title={report.remarks}>
                            {report.remarks}
                          </div>
                        ) : (
                          <span className="remarks-cell-empty">No remarks provided</span>
                        )
                      ) : (
                        '--'
                      )}
                    </td>
                    <td>
                      {report && (
                        <button
                          type="button"
                          className="btn-row-action"
                          onClick={() => setSelectedReportRow({ report, farm, farmer })}
                          title="View full report and farmer remarks"
                        >
                          <Eye size={13} />
                          <span>View</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <ReportDetailDrawer
          open={Boolean(selectedReportRow)}
          onClose={() => setSelectedReportRow(null)}
          report={selectedReportRow?.report ?? null}
          farm={selectedReportRow?.farm}
          farmer={selectedReportRow?.farmer}
          role="supervisor"
        />
      </div>
    </DashboardLayout>
  );
}
