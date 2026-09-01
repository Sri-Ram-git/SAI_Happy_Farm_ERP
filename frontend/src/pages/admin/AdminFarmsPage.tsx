import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useMockProfile } from '../../utils/useMockProfile';
import { DashboardLayout } from '../../components/dashboard/DashboardLayout';
import { LoadingState } from '../../components/dashboard/LoadingState';
import { EmptyState } from '../../components/dashboard/EmptyState';
import { DateFilter } from '../../components/dashboard/DateFilter';
import { getAllFarms, type FarmDoc } from '../../services/farmDataService';
import { type ReportDoc } from '../../services/reportDataService';
import { getAllUsers, type UserDoc } from '../../services/userDataService';
import { getIstDate, getDaysAgo } from '../../utils/dateUtils';
import { aggregateReports, calcSubmissionCompliance } from '../../utils/kpiCalculations';
import { useAllDailyReports } from '../../hooks/useDailyReports';
import {
  Warehouse,
  ChevronRight,
} from 'lucide-react';

export function AdminFarmsPage() {
  const { userProfile } = useAuth();
  const mockProfile = useMockProfile('admin');
  const profile = userProfile || mockProfile;
  const navigate = useNavigate();
  const [days, setDays] = useState(30);
  const [farms, setFarms] = useState<FarmDoc[]>([]);
  const [farmers, setFarmers] = useState<UserDoc[]>([]);
  const [farmLoading, setFarmLoading] = useState(true);
  const { reports, loading: reportsLoading, error } = useAllDailyReports(getDaysAgo(days), getIstDate());
  const loading = farmLoading || reportsLoading;

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [frms, frs] = await Promise.all([getAllFarms(), getAllUsers()]);
        if (mounted) { setFarms(frms); setFarmers(frs.filter((u) => u.role === 'farmer')); }
      } catch (err) {
        console.error('[AdminFarms] Load error:', err);
      } finally {
        if (mounted) setFarmLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const farmRows = farms.map((farm) => {
    const farmReports = reports.filter((r) => r.farmId === farm.farmId);
    const agg = aggregateReports(farmReports);
    const farmer = farmers.find((f) => f.farmIds.includes(farm.farmId));
    const uniqueDays = new Set(farmReports.map((r) => r.submissionDate)).size;
    const compliance = calcSubmissionCompliance(uniqueDays, days);
    return { farm, agg, farmer, compliance, reportCount: farmReports.length };
  });

  if (loading) return <DashboardLayout role="admin" userName={profile?.name}><LoadingState /></DashboardLayout>;

  return (
    <DashboardLayout role="admin" userName={profile?.name}>
      <div className="mgmt-page">
        {error && <div className="mgmt-error" style={{ marginBottom: 16 }}><span className="mgmt-error__description">{error}</span></div>}

        <div className="mgmt-page-header">
          <div className="mgmt-page-header__title-group">
            <h2 className="mgmt-page-header__title">Farm Management</h2>
            <p className="mgmt-page-header__description">{farms.length} farms in the system</p>
          </div>
          <div className="mgmt-page-header__actions">
            <DateFilter days={days} onChange={setDays} />
          </div>
        </div>

        <div className="mgmt-table-container">
          <table className="mgmt-table">
            <thead>
              <tr>
                <th>Farm ID</th>
                <th>Name</th>
                <th>Farmer</th>
                <th>Production</th>
                <th>Mortality</th>
                <th>Compliance</th>
                <th>Reports</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {farmRows.map(({ farm, agg, farmer, compliance, reportCount }) => (
                <tr
                  key={farm.farmId}
                  className="mgmt-table__row--clickable"
                  onClick={() => navigate(`/admin/farms/${farm.farmId}`)}
                >
                  <td style={{ fontWeight: 600, fontFamily: 'var(--mgmt-font-mono)' }}>{farm.farmId}</td>
                  <td>{farm.name || '--'}</td>
                  <td>{farmer?.name || 'Unassigned'}</td>
                  <td className="mgmt-table__cell--number">{agg.avgProductionRate}%</td>
                  <td className="mgmt-table__cell--number">
                    <span className={`mgmt-badge ${agg.avgMortalityRate > 10 ? 'mgmt-badge--danger' : 'mgmt-badge--success'}`}>
                      {agg.avgMortalityRate}%
                    </span>
                  </td>
                  <td className="mgmt-table__cell--number">{compliance}%</td>
                  <td className="mgmt-table__cell--number">{reportCount}</td>
                  <td>
                    <span className={`mgmt-badge ${farm.active ? 'mgmt-badge--success' : 'mgmt-badge--warning'}`}>
                      <span className="mgmt-badge__dot" />
                      {farm.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="mgmt-table__cell--actions">
                    <span className="mgmt-icon-btn">
                      <ChevronRight size={16} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {farmRows.length === 0 && (
          <div className="mgmt-empty-state">
            <div className="mgmt-empty-state__icon"><Warehouse size={24} /></div>
            <div className="mgmt-empty-state__title">No Farms Found</div>
            <div className="mgmt-empty-state__description">No farms have been registered yet.</div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
