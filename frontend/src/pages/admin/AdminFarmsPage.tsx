import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useMockProfile } from '../../utils/useMockProfile';
import { DashboardLayout } from '../../components/dashboard/DashboardLayout';
import { LoadingState } from '../../components/dashboard/LoadingState';
import { EmptyState } from '../../components/dashboard/EmptyState';
import { DateFilter } from '../../components/dashboard/DateFilter';
import { getAllFarms, type FarmDoc } from '../../services/farmDataService';
import { getAllReports, type ReportDoc } from '../../services/reportDataService';
import { getAllUsers, type UserDoc } from '../../services/userDataService';
import { getIstDate, getDaysAgo } from '../../utils/dateUtils';
import { aggregateReports, calcSubmissionCompliance } from '../../utils/kpiCalculations';

export function AdminFarmsPage() {
  const { userProfile } = useAuth();
  const mockProfile = useMockProfile('admin');
  const profile = userProfile || mockProfile;
  const navigate = useNavigate();
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [farms, setFarms] = useState<FarmDoc[]>([]);
  const [reports, setReports] = useState<ReportDoc[]>([]);
  const [farmers, setFarmers] = useState<UserDoc[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const startDate = getDaysAgo(days);
      const endDate = getIstDate();
      const [frms, rpts, frs] = await Promise.all([
        getAllFarms(),
        getAllReports(startDate, endDate),
        getAllUsers(),
      ]);
      setFarms(frms);
      setReports(rpts);
      setFarmers(frs.filter((u) => u.role === 'farmer'));
    } catch (err) {
      console.error('[AdminFarms] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { loadData(); }, [loadData]);

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
