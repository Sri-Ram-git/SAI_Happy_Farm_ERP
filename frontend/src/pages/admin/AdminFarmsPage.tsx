import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
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

export function AdminFarmsPage() {
  const { userProfile } = useAuth();
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

  if (loading) return <DashboardLayout role="admin" userName={userProfile?.name}><LoadingState /></DashboardLayout>;

  return (
    <DashboardLayout role="admin" userName={userProfile?.name}>
      <div className="mgmt-page">
        {error && <div className="alert alert--error" style={{ marginBottom: 16 }}>{error}</div>}
        <div className="mgmt-page-header">
          <h2>Farm Management</h2>
          <DateFilter days={days} onChange={setDays} />
        </div>

        <div className="table-container">
          <table className="data-table">
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
              </tr>
            </thead>
            <tbody>
              {farmRows.map(({ farm, agg, farmer, compliance, reportCount }) => (
                <tr key={farm.farmId} className="clickable-row" onClick={() => navigate(`/admin/farms/${farm.farmId}`)}>
                  <td className="td-bold">{farm.farmId}</td>
                  <td>{farm.name || '--'}</td>
                  <td>{farmer?.name || 'Unassigned'}</td>
                  <td>{agg.avgProductionRate}%</td>
                  <td className={agg.avgMortalityRate > 10 ? 'text-danger' : ''}>{agg.avgMortalityRate}%</td>
                  <td>{compliance}%</td>
                  <td>{reportCount}</td>
                  <td>
                    <span className={`status-badge ${farm.active ? 'status-badge--ok' : 'status-badge--warn'}`}>
                      {farm.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {farmRows.length === 0 && <EmptyState message="No farms found." />}
      </div>
    </DashboardLayout>
  );
}
