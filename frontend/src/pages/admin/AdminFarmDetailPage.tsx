import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useMockProfile } from '../../utils/useMockProfile';
import { DashboardLayout } from '../../components/dashboard/DashboardLayout';
import { LoadingState } from '../../components/dashboard/LoadingState';
import { EmptyState } from '../../components/dashboard/EmptyState';
import { DateFilter } from '../../components/dashboard/DateFilter';
import { type ReportDoc } from '../../services/reportDataService';
import { getFarmById, type FarmDoc } from '../../services/farmDataService';
import { getUserByUid, type UserDoc } from '../../services/userDataService';
import { getIstDate, getDaysAgo, formatDisplayDate, formatTime } from '../../utils/dateUtils';
import { calcProductionRate, calcMortalityRate, calcFeedPerBird, aggregateReports } from '../../utils/kpiCalculations';
import { useDailyReportsByFarms } from '../../hooks/useDailyReports';
import { KPI_THRESHOLDS } from '../../config/kpiThresholds';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import {
  ArrowLeft,
  Warehouse,
  User,
  AlertTriangle,
  TrendingUp,
  Thermometer,
  Wheat,
  Scale,
  FileText,
  Bird,
  Clock,
} from 'lucide-react';

export function AdminFarmDetailPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const { userProfile } = useAuth();
  const mockProfile = useMockProfile('admin');
  const profile = userProfile || mockProfile;
  const navigate = useNavigate();
  const [days, setDays] = useState(30);
  const [farm, setFarm] = useState<FarmDoc | null>(null);
  const [farmer, setFarmer] = useState<UserDoc | null>(null);
  const [farmLoading, setFarmLoading] = useState(true);
  const farmIdArray = farmId ? [farmId] : [];
  const { reports, loading: reportsLoading, error } = useDailyReportsByFarms(farmIdArray, getDaysAgo(days), getIstDate());
  const loading = farmLoading || reportsLoading;

  useEffect(() => {
    if (!farmId) return;
    let mounted = true;
    (async () => {
      try {
        const f = await getFarmById(farmId);
        if (mounted) setFarm(f);
      } catch (err) {
        console.error('[AdminFarmDetail] Load error:', err);
      } finally {
        if (mounted) setFarmLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [farmId]);

  useEffect(() => {
    if (!farmId || reports.length === 0) return;
    let mounted = true;
    (async () => {
      try {
        const u = await getUserByUid(reports[0].submittedBy);
        if (mounted) setFarmer(u);
      } catch (err) {
        console.error('[AdminFarmDetail] Farmer load error:', err);
      }
    })();
    return () => { mounted = false; };
  }, [farmId, reports.length > 0 ? reports[0].submittedBy : '']);

  const chartData = reports.map((r) => ({
    date: r.submissionDate.slice(5),
    production: calcProductionRate(r.eggsProduced ?? 0, r.birdCount ?? 0),
    mortality: calcMortalityRate(r.mortality ?? 0, r.birdCount ?? 0),
    temperature: r.temperature ?? 0,
    feed: calcFeedPerBird(r.feedKg ?? 0, r.birdCount ?? 0),
  }));

  const agg = aggregateReports(reports);
  const todayReport = reports.find((r) => r.submissionDate === getIstDate());

  const attentionItems: string[] = [];
  if (agg.avgMortalityRate > KPI_THRESHOLDS.mortalityRateCritical) attentionItems.push('High mortality rate');
  if (agg.avgTemperature > KPI_THRESHOLDS.temperatureCritical) attentionItems.push('High temperature');
  if (agg.avgAmmonia > KPI_THRESHOLDS.ammoniaCritical) attentionItems.push('High ammonia');
  if (!todayReport) attentionItems.push('No report submitted today');

  if (loading) return <DashboardLayout role="admin" userName={profile?.name}><LoadingState /></DashboardLayout>;
  if (!farm) return <DashboardLayout role="admin" userName={profile?.name}><EmptyState message="Farm not found." /></DashboardLayout>;

  const kpis = [
    { label: 'Avg Production', value: `${agg.avgProductionRate}%`, icon: TrendingUp, accent: 'success' as const },
    { label: 'Avg Mortality', value: `${agg.avgMortalityRate}%`, icon: AlertTriangle, accent: agg.avgMortalityRate > 10 ? 'danger' as const : 'warning' as const },
    { label: 'Avg Feed/Bird', value: `${agg.avgFeedPerBird}g`, icon: Wheat, accent: 'info' as const },
    { label: 'Avg Temperature', value: `${agg.avgTemperature}°C`, icon: Thermometer, accent: 'warning' as const },
    { label: 'Avg Egg Weight', value: `${agg.avgEggWeight}g`, icon: Scale, accent: 'primary' as const },
    { label: 'Reports', value: agg.totalReports, icon: FileText, accent: 'info' as const },
  ];

  return (
    <DashboardLayout role="admin" userName={profile?.name}>
      <div className="mgmt-page">
        {error && <div className="mgmt-error" style={{ marginBottom: 16 }}><span className="mgmt-error__description">{error}</span></div>}

        <button
          className="mgmt-btn mgmt-btn--ghost mgmt-btn--sm"
          onClick={() => navigate('/admin/farms')}
          style={{ marginBottom: 16 }}
        >
          <ArrowLeft size={16} /> Back to Farms
        </button>

        <div className="mgmt-detail-header">
          <div className="mgmt-detail-header__icon">
            <Warehouse size={28} />
          </div>
          <div className="mgmt-detail-header__content">
            <div className="mgmt-detail-header__title">{farm.farmId}</div>
            <div className="mgmt-detail-header__meta">
              <span className="mgmt-detail-header__meta-item">
                <Warehouse size={14} /> {farm.name || 'Unnamed Farm'}
              </span>
              <span className="mgmt-detail-header__meta-item">
                <User size={14} /> {farmer?.name || 'Unknown'}
              </span>
              <span className={`mgmt-badge ${farm.active ? 'mgmt-badge--success' : 'mgmt-badge--warning'}`}>
                <span className="mgmt-badge__dot" />
                {farm.active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
          <div className="mgmt-page-header__actions">
            <DateFilter days={days} onChange={setDays} />
          </div>
        </div>

        {attentionItems.length > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 16px',
            background: 'var(--mgmt-danger-bg)',
            border: '1px solid var(--mgmt-danger-border)',
            borderRadius: 'var(--mgmt-radius)',
            marginBottom: 24,
            color: 'var(--mgmt-danger)',
            fontSize: 13,
            fontWeight: 500,
          }}>
            <AlertTriangle size={16} />
            Attention: {attentionItems.join(', ')}
          </div>
        )}

        <div className="mgmt-kpi-grid" style={{ marginBottom: 24 }}>
          {kpis.map((kpi) => (
            <div className="mgmt-kpi-card" key={kpi.label}>
              <div className={`mgmt-kpi-card__accent mgmt-kpi-card__accent--${kpi.accent}`} />
              <div className="mgmt-kpi-card__header">
                <div className={`mgmt-kpi-card__icon mgmt-kpi-card__icon--${kpi.accent}`}>
                  <kpi.icon size={20} />
                </div>
              </div>
              <div className="mgmt-kpi-card__label">{kpi.label}</div>
              <div className="mgmt-kpi-card__value">{kpi.value}</div>
            </div>
          ))}
        </div>

        {chartData.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            <div className="mgmt-chart-card">
              <div className="mgmt-chart-card__header">
                <div>
                  <div className="mgmt-chart-card__title">Production & Mortality Trend</div>
                  <div className="mgmt-chart-card__subtitle">Last {days} days</div>
                </div>
              </div>
              <div className="mgmt-chart-card__body">
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--mgmt-border)" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="production" stroke="#15803d" strokeWidth={2} name="Production %" />
                    <Line type="monotone" dataKey="mortality" stroke="#dc2626" strokeWidth={2} name="Mortality %" />
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
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--mgmt-border)" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="temperature" stroke="#d97706" strokeWidth={2} name="Temp °C" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        <div className="mgmt-section-card">
          <div className="mgmt-section-card__header">
            <div>
              <div className="mgmt-section-card__title">Report History</div>
              <div className="mgmt-section-card__subtitle">{reports.length} reports in this period</div>
            </div>
          </div>
          <div className="mgmt-table-container" style={{ border: 'none', borderRadius: 0 }}>
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
                {[...reports].reverse().map((r) => (
                  <tr key={r.reportId}>
                    <td>{formatDisplayDate(r.submissionDate)}</td>
                    <td className="mgmt-table__cell--number">{r.birdCount}</td>
                    <td className="mgmt-table__cell--number">{calcProductionRate(r.eggsProduced ?? 0, r.birdCount ?? 0)}%</td>
                    <td className="mgmt-table__cell--number">
                      <span className={`mgmt-badge ${calcMortalityRate(r.mortality ?? 0, r.birdCount ?? 0) > 10 ? 'mgmt-badge--danger' : 'mgmt-badge--success'}`}>
                        {calcMortalityRate(r.mortality ?? 0, r.birdCount ?? 0)}%
                      </span>
                    </td>
                    <td className="mgmt-table__cell--number">{calcFeedPerBird(r.feedKg ?? 0, r.birdCount ?? 0)}g</td>
                    <td className="mgmt-table__cell--number">{r.temperature}°C</td>
                    <td>{formatTime(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {reports.length === 0 && (
            <div className="mgmt-empty-state">
              <div className="mgmt-empty-state__icon"><FileText size={24} /></div>
              <div className="mgmt-empty-state__title">No Reports</div>
              <div className="mgmt-empty-state__description">No reports found for this period.</div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
