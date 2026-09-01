import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useMockProfile } from '../../utils/useMockProfile';
import { DashboardLayout } from '../../components/dashboard/DashboardLayout';
import { LoadingState } from '../../components/dashboard/LoadingState';
import { EmptyState } from '../../components/dashboard/EmptyState';
import { DateFilter } from '../../components/dashboard/DateFilter';
import { type ReportDoc } from '../../services/reportDataService';
import { getAllFarms, type FarmDoc } from '../../services/farmDataService';
import { getIstDate, getDaysAgo } from '../../utils/dateUtils';
import { calcProductionRate, calcMortalityRate, calcFeedPerBird, calcSelectionRate, aggregateReports, calcAverage } from '../../utils/kpiCalculations';
import { useAllDailyReports } from '../../hooks/useDailyReports';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import {
  BarChart3,
  TrendingUp,
  Wheat,
  Thermometer,
  Scale,
} from 'lucide-react';

export function AdminAnalyticsPage() {
  const { userProfile } = useAuth();
  const mockProfile = useMockProfile('admin');
  const profile = userProfile || mockProfile;
  const [days, setDays] = useState(30);
  const [farms, setFarms] = useState<{ id: string; name: string }[]>([]);
  const [farmLoading, setFarmLoading] = useState(true);
  const { reports, loading: reportsLoading, error } = useAllDailyReports(getDaysAgo(days), getIstDate());
  const loading = farmLoading || reportsLoading;

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const frms = await getAllFarms();
        if (mounted) setFarms(frms.map((f) => ({ id: f.farmId, name: f.name || f.farmId })));
      } catch (err) {
        console.error('[AdminAnalytics] Load error:', err);
      } finally {
        if (mounted) setFarmLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const chartData = (() => {
    const byDate: Record<string, ReportDoc[]> = {};
    reports.forEach((r) => {
      if (!byDate[r.submissionDate]) byDate[r.submissionDate] = [];
      byDate[r.submissionDate]!.push(r);
    });
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, dayReports]) => ({
        date: date.slice(5),
        production: calcAverage(dayReports.map((r) => calcProductionRate(r.eggsProduced ?? 0, r.birdCount ?? 0))),
        mortality: calcAverage(dayReports.map((r) => calcMortalityRate(r.mortality ?? 0, r.birdCount ?? 0))),
        feed: calcAverage(dayReports.map((r) => calcFeedPerBird(r.feedKg ?? 0, r.birdCount ?? 0))),
        temperature: calcAverage(dayReports.map((r) => r.temperature)),
      }));
  })();

  const farmComparison = farms.map((farm) => {
    const farmReports = reports.filter((r) => r.farmId === farm.id);
    const agg = aggregateReports(farmReports);
    return { farmId: farm.id, name: farm.name, production: agg.avgProductionRate, mortality: agg.avgMortalityRate, feedPerBird: agg.avgFeedPerBird };
  });

  if (loading) return <DashboardLayout role="admin" userName={profile?.name}><LoadingState /></DashboardLayout>;

  return (
    <DashboardLayout role="admin" userName={profile?.name}>
      <div className="mgmt-page">
        {error && <div className="mgmt-error" style={{ marginBottom: 16 }}><span className="mgmt-error__description">{error}</span></div>}

        <div className="mgmt-page-header">
          <div className="mgmt-page-header__title-group">
            <h2 className="mgmt-page-header__title">Analytics</h2>
            <p className="mgmt-page-header__description">Production insights and farm performance data</p>
          </div>
          <div className="mgmt-page-header__actions">
            <DateFilter days={days} onChange={setDays} />
          </div>
        </div>

        {chartData.length === 0 ? (
          <div className="mgmt-empty-state">
            <div className="mgmt-empty-state__icon"><BarChart3 size={24} /></div>
            <div className="mgmt-empty-state__title">No Data Available</div>
            <div className="mgmt-empty-state__description">No data available for analytics.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="mgmt-chart-card">
              <div className="mgmt-chart-card__header">
                <div>
                  <div className="mgmt-chart-card__title">Production & Mortality Trend</div>
                  <div className="mgmt-chart-card__subtitle">Last {days} days</div>
                </div>
                <div className="mgmt-chart-card__actions">
                  <TrendingUp size={16} style={{ color: 'var(--mgmt-text-muted)' }} />
                </div>
              </div>
              <div className="mgmt-chart-card__body">
                <ResponsiveContainer width="100%" height={280}>
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
                  <div className="mgmt-chart-card__title">Feed Consumption (g/bird)</div>
                  <div className="mgmt-chart-card__subtitle">Daily feed intake</div>
                </div>
                <div className="mgmt-chart-card__actions">
                  <Wheat size={16} style={{ color: 'var(--mgmt-text-muted)' }} />
                </div>
              </div>
              <div className="mgmt-chart-card__body">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--mgmt-border)" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="feed" fill="#16a34a" name="Feed g/bird" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="mgmt-chart-card">
              <div className="mgmt-chart-card__header">
                <div>
                  <div className="mgmt-chart-card__title">Temperature Trend</div>
                  <div className="mgmt-chart-card__subtitle">Average daily temperature</div>
                </div>
                <div className="mgmt-chart-card__actions">
                  <Thermometer size={16} style={{ color: 'var(--mgmt-text-muted)' }} />
                </div>
              </div>
              <div className="mgmt-chart-card__body">
                <ResponsiveContainer width="100%" height={280}>
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

            <div className="mgmt-chart-card">
              <div className="mgmt-chart-card__header">
                <div>
                  <div className="mgmt-chart-card__title">Farm Comparison</div>
                  <div className="mgmt-chart-card__subtitle">Production vs Mortality by farm</div>
                </div>
                <div className="mgmt-chart-card__actions">
                  <Scale size={16} style={{ color: 'var(--mgmt-text-muted)' }} />
                </div>
              </div>
              <div className="mgmt-chart-card__body">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={farmComparison}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--mgmt-border)" />
                    <XAxis dataKey="farmId" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="production" fill="#15803d" name="Production %" />
                    <Bar dataKey="mortality" fill="#dc2626" name="Mortality %" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
