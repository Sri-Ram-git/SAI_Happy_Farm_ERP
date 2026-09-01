import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useMockProfile } from '../../utils/useMockProfile';
import { DashboardLayout } from '../../components/dashboard/DashboardLayout';
import { LoadingState } from '../../components/dashboard/LoadingState';
import { EmptyState } from '../../components/dashboard/EmptyState';
import { DateFilter } from '../../components/dashboard/DateFilter';
import { type ReportDoc } from '../../services/reportDataService';
import { useDailyReportsByFarms } from '../../hooks/useDailyReports';
import { getFarmsByIds } from '../../services/farmDataService';
import { getIstDate, getDaysAgo } from '../../utils/dateUtils';
import { calcProductionRate, calcMortalityRate, calcFeedPerBird, calcSelectionRate, calcAverage, aggregateReports } from '../../utils/kpiCalculations';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { AlertTriangle } from 'lucide-react';

export function SupervisorAnalyticsPage() {
  const { userProfile } = useAuth();
  const mockProfile = useMockProfile('supervisor');
  const profile = userProfile || mockProfile;
  const [days, setDays] = useState(30);
  const [farms, setFarms] = useState<{ id: string; name: string }[]>([]);

  const assignedFarmIds = profile?.farmIds ?? [];
  const { reports, loading, error } = useDailyReportsByFarms(assignedFarmIds, getDaysAgo(days), getIstDate());

  useEffect(() => {
    if (assignedFarmIds.length === 0) return;
    getFarmsByIds(assignedFarmIds)
      .then((frms) => setFarms(frms.map((f) => ({ id: f.farmId, name: f.name || f.farmId }))))
      .catch((err) => console.error('[SupervisorAnalytics] Load error:', err));
  }, [assignedFarmIds.join(',')]);

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
        selection: calcAverage(dayReports.map((r) => calcSelectionRate(r.selectionEggs ?? 0, r.eggsProduced ?? 0))),
      }));
  })();

  const farmComparison = farms.map((farm) => {
    const farmReports = reports.filter((r) => r.farmId === farm.id);
    const agg = aggregateReports(farmReports);
    return { farmId: farm.id, name: farm.name, production: agg.avgProductionRate, mortality: agg.avgMortalityRate, feedPerBird: agg.avgFeedPerBird };
  });

  if (loading) return <DashboardLayout role="supervisor" userName={profile?.name}><LoadingState /></DashboardLayout>;

  return (
    <DashboardLayout role="supervisor" userName={profile?.name}>
      <div className="mgmt-page">
        <div className="mgmt-page-header">
          <div className="mgmt-page-header__title-group">
            <h2 className="mgmt-page-header__title">Analytics</h2>
            <p className="mgmt-page-header__description">Comprehensive data analysis across all farms</p>
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

        {chartData.length === 0 ? (
          <EmptyState message="No data available for analytics." />
        ) : (
          <div className="mgmt-section">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              <div className="mgmt-chart-card">
                <div className="mgmt-chart-card__header">
                  <div>
                    <div className="mgmt-chart-card__title">Production Rate Trend</div>
                    <div className="mgmt-chart-card__subtitle">Daily average production and selection rates</div>
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
                      <Line type="monotone" dataKey="selection" stroke="var(--mgmt-info, #2563eb)" strokeWidth={2} name="Selection %" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="mgmt-chart-card">
                <div className="mgmt-chart-card__header">
                  <div>
                    <div className="mgmt-chart-card__title">Mortality Trend</div>
                    <div className="mgmt-chart-card__subtitle">Daily average mortality rate</div>
                  </div>
                </div>
                <div className="mgmt-chart-card__body">
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="mortality" stroke="var(--mgmt-danger, #dc2626)" strokeWidth={2} name="Mortality %" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="mgmt-chart-card">
                <div className="mgmt-chart-card__header">
                  <div>
                    <div className="mgmt-chart-card__title">Temperature Trend</div>
                    <div className="mgmt-chart-card__subtitle">Daily average temperature readings</div>
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

              <div className="mgmt-chart-card">
                <div className="mgmt-chart-card__header">
                  <div>
                    <div className="mgmt-chart-card__title">Farm Comparison</div>
                    <div className="mgmt-chart-card__subtitle">Production vs mortality by farm</div>
                  </div>
                </div>
                <div className="mgmt-chart-card__body">
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={farmComparison}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="farmId" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="production" fill="var(--mgmt-primary, #15803d)" name="Production %" />
                      <Bar dataKey="mortality" fill="var(--mgmt-danger, #dc2626)" name="Mortality %" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
