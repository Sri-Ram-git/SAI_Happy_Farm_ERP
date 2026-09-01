import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useMockProfile } from '../../utils/useMockProfile';
import { DashboardLayout } from '../../components/dashboard/DashboardLayout';
import { KpiCard } from '../../components/dashboard/KpiCard';
import { LoadingState } from '../../components/dashboard/LoadingState';
import { EmptyState } from '../../components/dashboard/EmptyState';
import { DateFilter } from '../../components/dashboard/DateFilter';
import { type ReportDoc } from '../../services/reportDataService';
import { useDailyReportsByFarms } from '../../hooks/useDailyReports';
import { getFarmById, type FarmDoc } from '../../services/farmDataService';
import { getUserByUid, type UserDoc } from '../../services/userDataService';
import { getIstDate, getDaysAgo, formatDisplayDate, formatTime } from '../../utils/dateUtils';
import { calcProductionRate, calcMortalityRate, calcFeedPerBird, calcSelectionRate, calcAverage, aggregateReports } from '../../utils/kpiCalculations';
import { KPI_THRESHOLDS } from '../../config/kpiThresholds';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import {
  ArrowLeft,
  Building2,
  User,
  TrendingUp,
  Activity,
  Wheat,
  Thermometer,
  Egg,
  FileText,
  AlertTriangle,
  Clock,
} from 'lucide-react';

export function SupervisorFarmDetailPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const { userProfile } = useAuth();
  const mockProfile = useMockProfile('supervisor');
  const profile = userProfile || mockProfile;
  const navigate = useNavigate();
  const [days, setDays] = useState(30);
  const [farmLoading, setFarmLoading] = useState(true);
  const [farm, setFarm] = useState<FarmDoc | null>(null);
  const [farmer, setFarmer] = useState<UserDoc | null>(null);

  const farmIdArray = farmId ? [farmId] : [];
  const { reports, loading: reportsLoading, error } = useDailyReportsByFarms(farmIdArray, getDaysAgo(days), getIstDate());
  const loading = farmLoading || reportsLoading;

  useEffect(() => {
    if (!farmId) return;
    setFarmLoading(true);
    getFarmById(farmId)
      .then(setFarm)
      .catch((err) => console.error('[FarmDetail] Load error:', err))
      .finally(() => setFarmLoading(false));
  }, [farmId]);

  useEffect(() => {
    if (reports.length > 0 && reports[0]) {
      getUserByUid(reports[0].submittedBy).then(setFarmer);
    }
  }, [reports]);

  const chartData = reports.map((r) => ({
    date: r.submissionDate.slice(5),
    production: calcProductionRate(r.eggsProduced ?? 0, r.birdCount ?? 0),
    mortality: calcMortalityRate(r.mortality ?? 0, r.birdCount ?? 0),
    temperature: r.temperature ?? 0,
    feed: calcFeedPerBird(r.feedKg ?? 0, r.birdCount ?? 0),
  }));

  const agg = aggregateReports(reports);
  const todayReport = reports.find((r) => r.submissionDate === getIstDate());
  const latestReport = reports[reports.length - 1];

  const attentionItems: string[] = [];
  if (agg.avgMortalityRate > KPI_THRESHOLDS.mortalityRateCritical) attentionItems.push('High mortality rate');
  if (agg.avgTemperature > KPI_THRESHOLDS.temperatureCritical) attentionItems.push('High temperature');
  if (agg.avgAmmonia > KPI_THRESHOLDS.ammoniaCritical) attentionItems.push('High ammonia');
  if (!todayReport) attentionItems.push('No report submitted today');

  const role = profile?.role === 'admin' ? 'admin' : 'supervisor';
  const basePath = role === 'admin' ? '/admin' : '/supervisor';

  if (loading) return <DashboardLayout role={role} userName={profile?.name}><LoadingState /></DashboardLayout>;
  if (!farm) return <DashboardLayout role={role} userName={profile?.name}><EmptyState message="Farm not found." /></DashboardLayout>;

  return (
    <DashboardLayout role={role} userName={profile?.name}>
      <div className="mgmt-page">
        <button
          className="mgmt-btn mgmt-btn--ghost"
          onClick={() => navigate(`${basePath}/farms`)}
          style={{ marginBottom: 16 }}
        >
          <ArrowLeft size={16} />
          Back to Farms
        </button>

        {error && (
          <div className="mgmt-error" style={{ marginBottom: 16 }}>
            <div className="mgmt-error__icon"><AlertTriangle size={24} /></div>
            <div className="mgmt-error__description">{error}</div>
          </div>
        )}

        <div className="mgmt-detail-header">
          <div className="mgmt-detail-header__icon">
            <Building2 size={28} />
          </div>
          <div className="mgmt-detail-header__content">
            <h2 className="mgmt-detail-header__title">{farm.name || 'Unnamed Farm'}</h2>
            <div className="mgmt-detail-header__meta">
              <span className="mgmt-detail-header__meta-item">
                <Building2 size={14} />
                {farm.farmId}
              </span>
              <span className="mgmt-detail-header__meta-item">
                <User size={14} />
                {farmer?.name || 'Unknown'}
              </span>
              {attentionItems.length > 0 && (
                <span className="mgmt-badge mgmt-badge--danger">
                  <span className="mgmt-badge__dot" />
                  {attentionItems.length} issue{attentionItems.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            {attentionItems.length > 0 && (
              <div style={{ marginTop: 8, fontSize: 13, color: 'var(--mgmt-danger)' }}>
                <AlertTriangle size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                {attentionItems.join(' / ')}
              </div>
            )}
          </div>
          <div className="mgmt-detail-header__actions">
            <DateFilter days={days} onChange={setDays} />
          </div>
        </div>

        <div className="mgmt-section">
          <div className="mgmt-kpi-grid">
            <KpiCard title="Avg Production" value={`${agg.avgProductionRate}%`} icon={TrendingUp} />
            <KpiCard
              title="Avg Mortality"
              value={`${agg.avgMortalityRate}%`}
              icon={Activity}
              color={agg.avgMortalityRate > 10 ? 'var(--mgmt-danger)' : undefined}
            />
            <KpiCard title="Avg Feed/Bird" value={`${agg.avgFeedPerBird}g`} icon={Wheat} />
            <KpiCard title="Avg Temperature" value={`${agg.avgTemperature}°C`} icon={Thermometer} />
            <KpiCard title="Avg Egg Weight" value={`${agg.avgEggWeight}g`} icon={Egg} />
            <KpiCard title="Total Reports" value={agg.totalReports} icon={FileText} />
          </div>
        </div>

        {chartData.length > 0 && (
          <div className="mgmt-section">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              <div className="mgmt-chart-card">
                <div className="mgmt-chart-card__header">
                  <div>
                    <div className="mgmt-chart-card__title">Production & Mortality Trend</div>
                    <div className="mgmt-chart-card__subtitle">Daily performance metrics</div>
                  </div>
                </div>
                <div className="mgmt-chart-card__body">
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="production" stroke="var(--mgmt-primary, #15803d)" strokeWidth={2} name="Production %" />
                      <Line type="monotone" dataKey="mortality" stroke="var(--mgmt-danger, #dc2626)" strokeWidth={2} name="Mortality %" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="mgmt-chart-card">
                <div className="mgmt-chart-card__header">
                  <div>
                    <div className="mgmt-chart-card__title">Temperature Trend</div>
                    <div className="mgmt-chart-card__subtitle">Daily temperature readings</div>
                  </div>
                </div>
                <div className="mgmt-chart-card__body">
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="temperature" stroke="var(--mgmt-warning, #d97706)" strokeWidth={2} name="Temp °C" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mgmt-section">
          <div className="mgmt-section-card">
            <div className="mgmt-section-card__header">
              <div className="mgmt-section-card__title">Report History</div>
              <div className="mgmt-section-card__subtitle">{reports.length} report{reports.length !== 1 ? 's' : ''}</div>
            </div>
            <div className="mgmt-table-container">
              <table className="mgmt-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Birds</th>
                    <th>Production</th>
                    <th>Mortality</th>
                    <th>Feed</th>
                    <th>Temp</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {[...reports].reverse().map((r) => {
                    const mortRate = calcMortalityRate(r.mortality ?? 0, r.birdCount ?? 0);
                    return (
                      <tr key={r.reportId}>
                        <td>{formatDisplayDate(r.submissionDate)}</td>
                        <td className="mgmt-table__cell--number">{r.birdCount}</td>
                        <td>{calcProductionRate(r.eggsProduced ?? 0, r.birdCount ?? 0)}%</td>
                        <td>
                          <span className={`mgmt-badge ${mortRate > 10 ? 'mgmt-badge--danger' : 'mgmt-badge--success'}`}>
                            {mortRate}%
                          </span>
                        </td>
                        <td>{calcFeedPerBird(r.feedKg ?? 0, r.birdCount ?? 0)}g</td>
                        <td>{r.temperature}°C</td>
                        <td>{formatTime(r.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {reports.length === 0 && <EmptyState message="No reports found for this period." />}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
