import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useMockProfile } from '../../utils/useMockProfile';
import { DashboardLayout } from '../../components/dashboard/DashboardLayout';
import { LoadingState } from '../../components/dashboard/LoadingState';
import { EmptyState } from '../../components/dashboard/EmptyState';
import { getReportsByDate, type ReportDoc } from '../../services/reportDataService';
import { getAllFarms, type FarmDoc } from '../../services/farmDataService';
import { getAllUsers, type UserDoc } from '../../services/userDataService';
import { getIstDate, formatDisplayDate, formatTime } from '../../utils/dateUtils';

export function AdminSubmissionsPage() {
  const { userProfile } = useAuth();
  const mockProfile = useMockProfile('admin');
  const profile = userProfile || mockProfile;
  const [date, setDate] = useState(getIstDate());
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<ReportDoc[]>([]);
  const [farms, setFarms] = useState<FarmDoc[]>([]);
  const [farmers, setFarmers] = useState<UserDoc[]>([]);
  const [search, setSearch] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [rpts, frms, frs] = await Promise.all([
        getReportsByDate(date),
        getAllFarms(),
        getAllUsers(),
      ]);
      setReports(rpts);
      setFarms(frms);
      setFarmers(frs.filter((u) => u.role === 'farmer'));
    } catch (err) {
      console.error('[AdminSubmissions] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { loadData(); }, [loadData]);

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

  if (loading) return <DashboardLayout role="admin" userName={profile?.name}><LoadingState /></DashboardLayout>;

  return (
    <DashboardLayout role="admin" userName={profile?.name}>
      <div className="mgmt-page">
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
