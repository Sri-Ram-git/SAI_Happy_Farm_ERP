import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/dashboard/DashboardLayout';
import { LoadingState } from '../../components/dashboard/LoadingState';
import { EmptyState } from '../../components/dashboard/EmptyState';
import { DateFilter } from '../../components/dashboard/DateFilter';
import { type ReportDoc } from '../../services/reportDataService';
import { useDailyReportsByFarms } from '../../hooks/useDailyReports';
import { getFarmsByIds, type FarmDoc } from '../../services/farmDataService';
import { getIstDate, getDaysAgo } from '../../utils/dateUtils';
import { calcProductionRate, calcMortalityRate, aggregateReports } from '../../utils/kpiCalculations';

export function SupervisorFarmsPage() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [days, setDays] = useState(7);
  const [farms, setFarms] = useState<FarmDoc[]>([]);

  const assignedFarmIds = userProfile?.farmIds ?? [];
  const { reports, loading, error } = useDailyReportsByFarms(assignedFarmIds, getDaysAgo(days), getIstDate());

  useEffect(() => {
    if (assignedFarmIds.length === 0) return;
    getFarmsByIds(assignedFarmIds)
      .then(setFarms)
      .catch((err) => console.error('[SupervisorFarms] Load error:', err));
  }, [assignedFarmIds.join(',')]);

  const farmData = farms.map((farm) => {
    const farmReports = reports.filter((r) => r.farmId === farm.farmId);
    const agg = aggregateReports(farmReports);
    const latestReport = farmReports[farmReports.length - 1];
    const today = getIstDate();
    const submittedToday = farmReports.some((r) => r.submissionDate === today);
    return { farm, agg, latestReport, submittedToday, reportCount: farmReports.length };
  });

  if (loading) return <DashboardLayout role="supervisor" userName={userProfile?.name}><LoadingState /></DashboardLayout>;
  if (assignedFarmIds.length === 0) return <DashboardLayout role="supervisor" userName={userProfile?.name}><EmptyState message="No farms assigned." /></DashboardLayout>;

  return (
    <DashboardLayout role="supervisor" userName={userProfile?.name}>
      <div className="mgmt-page">
        <div className="mgmt-page-header">
          <h2>My Farms</h2>
          <DateFilter days={days} onChange={setDays} />
        </div>

        {error && <div className="alert alert--error" style={{ marginBottom: 16 }}>{error}</div>}

        <div className="farm-grid">
          {farmData.map(({ farm, agg, submittedToday, reportCount }) => (
            <div
              key={farm.farmId}
              className="farm-card"
              onClick={() => navigate(`/supervisor/farms/${farm.farmId}`)}
            >
              <div className="farm-card-header">
                <span className="farm-card-id">{farm.farmId}</span>
                <span className={`farm-card-status ${submittedToday ? 'farm-card-status--ok' : 'farm-card-status--warn'}`}>
                  {submittedToday ? 'Submitted' : 'Not Submitted'}
                </span>
              </div>
              <div className="farm-card-name">{farm.name || 'Unnamed Farm'}</div>
              <div className="farm-card-stats">
                <span>Production: {agg.avgProductionRate}%</span>
                <span>Mortality: {agg.avgMortalityRate}%</span>
                <span>Reports: {reportCount}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
