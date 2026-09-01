import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useMockProfile } from '../../utils/useMockProfile';
import { DashboardLayout } from '../../components/dashboard/DashboardLayout';
import { KpiCard } from '../../components/dashboard/KpiCard';
import { LoadingState } from '../../components/dashboard/LoadingState';
import { EmptyState } from '../../components/dashboard/EmptyState';
import { type ReportDoc } from '../../services/reportDataService';
import { useDailyReportsByDate } from '../../hooks/useDailyReports';
import { getFarmsByIds, type FarmDoc } from '../../services/farmDataService';
import { getActiveFarmers, type UserDoc } from '../../services/userDataService';
import { getIstDate, formatDisplayDate, formatTime } from '../../utils/dateUtils';
import {
  ClipboardCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

export function SupervisorSubmissionsPage() {
  const { userProfile } = useAuth();
  const mockProfile = useMockProfile('supervisor');
  const profile = userProfile || mockProfile;
  const [date, setDate] = useState(getIstDate());
  const [farms, setFarms] = useState<FarmDoc[]>([]);
  const [farmers, setFarmers] = useState<UserDoc[]>([]);

  const assignedFarmIds = profile?.farmIds ?? [];
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
  const pendingCount = rows.length - submittedCount;

  if (loading) return <DashboardLayout role="supervisor" userName={profile?.name}><LoadingState /></DashboardLayout>;
  if (assignedFarmIds.length === 0) return <DashboardLayout role="supervisor" userName={profile?.name}><EmptyState message="No farms assigned." /></DashboardLayout>;

  return (
    <DashboardLayout role="supervisor" userName={profile?.name}>
      <div className="mgmt-page">
        <div className="mgmt-page-header">
          <div className="mgmt-page-header__title-group">
            <h2 className="mgmt-page-header__title">Submissions</h2>
            <p className="mgmt-page-header__description">{formatDisplayDate(date)}</p>
          </div>
          <div className="mgmt-page-header__actions">
            <input
              type="date"
              className="mgmt-search__input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{ width: 'auto' }}
            />
          </div>
        </div>

        {error && (
          <div className="mgmt-error" style={{ marginBottom: 16 }}>
            <div className="mgmt-error__icon"><AlertTriangle size={24} /></div>
            <div className="mgmt-error__description">{error}</div>
          </div>
        )}

        <div className="mgmt-section">
          <div className="mgmt-kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <KpiCard title="Total Farms" value={farms.length} icon={ClipboardCheck} />
            <KpiCard title="Submitted" value={submittedCount} icon={CheckCircle2} color="var(--mgmt-success)" />
            <KpiCard title="Pending" value={pendingCount} icon={Clock} color={pendingCount > 0 ? 'var(--mgmt-warning)' : 'var(--mgmt-success)'} />
          </div>
        </div>

        <div className="mgmt-section">
          <div className="mgmt-table-container">
            <table className="mgmt-table">
              <thead>
                <tr>
                  <th>Farm</th>
                  <th>Farmer</th>
                  <th>Status</th>
                  <th>Submitted At</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ farm, report, farmer }) => (
                  <tr key={farm.farmId}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{farm.farmId}</div>
                      <div style={{ fontSize: 12, color: 'var(--mgmt-text-muted)' }}>{farm.name || 'Unnamed'}</div>
                    </td>
                    <td>{farmer?.name || 'Unknown'}</td>
                    <td>
                      <span className={`mgmt-badge ${report ? 'mgmt-badge--success' : 'mgmt-badge--warning'}`}>
                        <span className="mgmt-badge__dot" />
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
      </div>
    </DashboardLayout>
  );
}
