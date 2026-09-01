import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
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

export function SupervisorAnalyticsPage() {
  const { userProfile } = useAuth();
  const [days, setDays] = useState(30);
  const [farms, setFarms] = useState<{ id: string; name: string }[]>([]);

  const assignedFarmIds = userProfile?.farmIds ?? [];
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

  if (loading) return <DashboardLayout role="supervisor" userName={userProfile?.name}><LoadingState /></DashboardLayout>;

  return (
    <DashboardLayout role="supervisor" userName={userProfile?.name}>
      <div className="mgmt-page">
        <div className="mgmt-page-header">
          <h2>Analytics</h2>
          <DateFilter days={days} onChange={setDays} />
        </div>

        {error && <div className="alert alert--error" style={{ marginBottom: 16 }}>{error}</div>}

        {chartData.length === 0 ? (
          <EmptyState message="No data available for analytics." />
        ) : (
          <>
            <div className="chart-grid">
              <div className="chart-card">
                <h3>Production Rate Trend</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="production" stroke="#15803d" strokeWidth={2} name="Production %" />
                    <Line type="monotone" dataKey="selection" stroke="#2563eb" strokeWidth={2} name="Selection %" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="chart-card">
                <h3>Mortality Trend</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="mortality" stroke="#dc2626" strokeWidth={2} name="Mortality %" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="chart-card">
                <h3>Temperature Trend</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="temperature" stroke="#d97706" strokeWidth={2} name="Temp °C" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="chart-card">
                <h3>Farm Comparison</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={farmComparison}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
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
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
