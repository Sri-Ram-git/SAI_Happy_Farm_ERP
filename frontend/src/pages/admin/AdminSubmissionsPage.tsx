import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useMockProfile } from '../../utils/useMockProfile';
import { DashboardLayout } from '../../components/dashboard/DashboardLayout';
import { LoadingState } from '../../components/dashboard/LoadingState';
import { EmptyState } from '../../components/dashboard/EmptyState';
import { type ReportDoc } from '../../services/reportDataService';
import { getAllFarms, type FarmDoc } from '../../services/farmDataService';
import { getAllUsers, type UserDoc } from '../../services/userDataService';
import { getIstDate, formatDisplayDate, formatTime } from '../../utils/dateUtils';
import { useDailyReportsByDate } from '../../hooks/useDailyReports';
import {
  Search,
  CheckCircle,
  Clock,
  FileText,
} from 'lucide-react';

export function AdminSubmissionsPage() {
  const { userProfile } = useAuth();
  const mockProfile = useMockProfile('admin');
  const profile = userProfile || mockProfile;
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

  if (loading) return <DashboardLayout role="admin" userName={profile?.name}><LoadingState /></DashboardLayout>;

  return (
    <DashboardLayout role="admin" userName={profile?.name}>
      <div className="mgmt-page">
        {error && <div className="mgmt-error" style={{ marginBottom: 16 }}><span className="mgmt-error__description">{error}</span></div>}

        <div className="mgmt-page-header">
          <div className="mgmt-page-header__title-group">
            <h2 className="mgmt-page-header__title">Submissions - {formatDisplayDate(date)}</h2>
            <p className="mgmt-page-header__description">
              {submittedCount} of {farms.length} farms submitted ({farms.length - submittedCount} pending)
            </p>
          </div>
          <div className="mgmt-page-header__actions">
            <div className="mgmt-search">
              <Search className="mgmt-search__icon" size={16} />
              <input
                type="text"
                className="mgmt-search__input"
                placeholder="Search farm or farmer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button className="mgmt-search__clear" onClick={() => setSearch('')}>
                  &times;
                </button>
              )}
            </div>
            <input
              type="date"
              className="mgmt-filters__select"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{ padding: '6px 10px', fontFamily: 'var(--mgmt-font)', fontSize: 13 }}
            />
          </div>
        </div>

        <div className="mgmt-table-container">
          <div className="mgmt-table-container__header">
            <span className="mgmt-table-container__title">Daily Submissions</span>
            <span className="mgmt-badge mgmt-badge--info">
              <CheckCircle size={12} />
              {submittedCount} / {farms.length} submitted
            </span>
          </div>
          <table className="mgmt-table">
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
                  <td style={{ fontWeight: 600, fontFamily: 'var(--mgmt-font-mono)' }}>{farm.farmId}</td>
                  <td>{farmer?.name || 'Unknown'}</td>
                  <td>
                    <span className={`mgmt-badge ${report ? 'mgmt-badge--success' : 'mgmt-badge--warning'}`}>
                      <span className="mgmt-badge__dot" />
                      {report ? 'Submitted' : 'Not Submitted'}
                    </span>
                  </td>
                  <td className="mgmt-table__cell--number">{report?.birdCount ?? '--'}</td>
                  <td className="mgmt-table__cell--number">
                    {report ? `${((report.eggsProduced ?? 0) / (report.birdCount ?? 1) * 100).toFixed(1)}%` : '--'}
                  </td>
                  <td>{report ? formatTime(report.createdAt) : '--'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {rows.length === 0 && (
          <div className="mgmt-empty-state">
            <div className="mgmt-empty-state__icon"><FileText size={24} /></div>
            <div className="mgmt-empty-state__title">No Farms Found</div>
            <div className="mgmt-empty-state__description">
              {search ? 'No farms match your search criteria.' : 'No farms found for this date.'}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
