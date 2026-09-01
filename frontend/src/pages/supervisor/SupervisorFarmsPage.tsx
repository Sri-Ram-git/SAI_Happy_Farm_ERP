import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useMockProfile } from '../../utils/useMockProfile';
import { DashboardLayout } from '../../components/dashboard/DashboardLayout';
import { LoadingState } from '../../components/dashboard/LoadingState';
import { EmptyState } from '../../components/dashboard/EmptyState';
import { DateFilter } from '../../components/dashboard/DateFilter';
import { type ReportDoc } from '../../services/reportDataService';
import { useDailyReportsByFarms } from '../../hooks/useDailyReports';
import { getFarmsByIds, type FarmDoc } from '../../services/farmDataService';
import { getIstDate, getDaysAgo } from '../../utils/dateUtils';
import { calcProductionRate, calcMortalityRate, aggregateReports } from '../../utils/kpiCalculations';
import {
  TreePine,
  MapPin,
  TrendingUp,
  Activity,
  FileText,
  AlertTriangle,
} from 'lucide-react';

export function SupervisorFarmsPage() {
  const { userProfile } = useAuth();
  const mockProfile = useMockProfile('supervisor');
  const profile = userProfile || mockProfile;
  const navigate = useNavigate();
  const [days, setDays] = useState(7);
  const [farms, setFarms] = useState<FarmDoc[]>([]);

  const assignedFarmIds = profile?.farmIds ?? [];
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

  if (loading) return <DashboardLayout role="supervisor" userName={profile?.name}><LoadingState /></DashboardLayout>;
  if (assignedFarmIds.length === 0) return <DashboardLayout role="supervisor" userName={profile?.name}><EmptyState message="No farms assigned." /></DashboardLayout>;

  return (
    <DashboardLayout role="supervisor" userName={profile?.name}>
      <div className="mgmt-page">
        <div className="mgmt-page-header">
          <div className="mgmt-page-header__title-group">
            <h2 className="mgmt-page-header__title">My Farms</h2>
            <p className="mgmt-page-header__description">Overview of all assigned farms</p>
          </div>
          <div className="mgmt-page-header__actions">
            <DateFilter days={days} onChange={setDays} />
          </div>
        </div>

        {error && (
          <div className="mgmt-error" style={{ marginBottom: 16 }}>
            <div className="mgmt-error__icon"><AlertTriangle size={24} /></div>
            <div className="mgmt-error__description">{error}</div>
          </div>
        )}

        <div className="mgmt-farm-grid">
          {farmData.map(({ farm, agg, submittedToday, reportCount }) => (
            <div
              key={farm.farmId}
              className="mgmt-farm-card"
              onClick={() => navigate(`/supervisor/farms/${farm.farmId}`)}
            >
              <div className="mgmt-farm-card__header">
                <div>
                  <div className="mgmt-farm-card__name">{farm.name || 'Unnamed Farm'}</div>
                  <div className="mgmt-farm-card__location">
                    <MapPin size={12} />
                    {farm.farmId}
                  </div>
                </div>
                <span className={`mgmt-badge ${submittedToday ? 'mgmt-badge--success' : 'mgmt-badge--warning'}`}>
                  <span className="mgmt-badge__dot" />
                  {submittedToday ? 'Submitted' : 'Pending'}
                </span>
              </div>
              <div className="mgmt-farm-card__metrics">
                <div className="mgmt-farm-card__metric">
                  <span className="mgmt-farm-card__metric-label">Production</span>
                  <span className="mgmt-farm-card__metric-value">{agg.avgProductionRate}%</span>
                </div>
                <div className="mgmt-farm-card__metric">
                  <span className="mgmt-farm-card__metric-label">Mortality</span>
                  <span className="mgmt-farm-card__metric-value">{agg.avgMortalityRate}%</span>
                </div>
                <div className="mgmt-farm-card__metric">
                  <span className="mgmt-farm-card__metric-label">Reports</span>
                  <span className="mgmt-farm-card__metric-value">{reportCount}</span>
                </div>
                <div className="mgmt-farm-card__metric">
                  <span className="mgmt-farm-card__metric-label">Feed/Bird</span>
                  <span className="mgmt-farm-card__metric-value">{agg.avgFeedPerBird}g</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
