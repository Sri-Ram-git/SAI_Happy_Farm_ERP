import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useMockProfile } from '../../utils/useMockProfile';
import { DashboardLayout } from '../../components/dashboard/DashboardLayout';
import { KpiCard } from '../../components/dashboard/KpiCard';
import { LoadingState } from '../../components/dashboard/LoadingState';
import { EmptyState } from '../../components/dashboard/EmptyState';
import { DateFilter } from '../../components/dashboard/DateFilter';
import { type ReportDoc } from '../../services/reportDataService';
import { useDailyReportsByFarms } from '../../hooks/useDailyReports';
import { getFarmsByIds, type FarmDoc } from '../../services/farmDataService';
import { getActiveFarmers, type UserDoc } from '../../services/userDataService';
import { getIstDate, getDaysAgo } from '../../utils/dateUtils';
import { calcProductionRate, calcMortalityRate, calcAverage } from '../../utils/kpiCalculations';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

export function SupervisorDashboard() {
  const { userProfile } = useAuth();
  const mockProfile = useMockProfile('supervisor');
  const profile = userProfile || mockProfile;
  const [days, setDays] = useState(7);
  const [farms, setFarms] = useState<FarmDoc[]>([]);
  const [farmers, setFarmers] = useState<UserDoc[]>([]);

  const assignedFarmIds = profile?.farmIds ?? [];
  const { reports, loading, error } = useDailyReportsByFarms(assignedFarmIds, getDaysAgo(days), getIstDate());

  useEffect(() => {
    if (assignedFarmIds.length === 0) return;
    Promise.all([getFarmsByIds(assignedFarmIds), getActiveFarmers()])
      .then(([frms, frs]) => {
        setFarms(frms);
        setFarmers(frs.filter((f) => f.farmIds.some((id) => assignedFarmIds.includes(id))));
      })
      .catch((err) => console.error('[SupervisorDashboard] Load error:', err));
  }, [assignedFarmIds.join(',')]);

  const today = getIstDate();
  const todayReports = reports.filter((r) => r.submissionDate === today);
  const submittedToday = new Set(todayReports.map((r) => r.farmId)).size;
  const missingToday = assignedFarmIds.length - submittedToday;
  const avgProd = reports.length > 0 ? calcAverage(reports.map((r) => calcProductionRate(r.eggsProduced ?? 0, r.birdCount ?? 0))) : 0;
  const avgMort = reports.length > 0 ? calcAverage(reports.map((r) => calcMortalityRate(r.mortality ?? 0, r.birdCount ?? 0))) : 0;
  const avgFeed = reports.length > 0 ? calcAverage(reports.map((r) => r.birdCount > 0 ? (r.feedKg * 1000) / r.birdCount : 0)) : 0;

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
        feed: calcAverage(dayReports.map((r) => r.birdCount > 0 ? (r.feedKg * 1000) / r.birdCount : 0)),
      }));
  })();

  if (loading) return <DashboardLayout role="supervisor" userName={profile?.name}><LoadingState /></DashboardLayout>;
  if (assignedFarmIds.length === 0) return <DashboardLayout role="supervisor" userName={profile?.name}><EmptyState message="No farms assigned to you." /></DashboardLayout>;

  return (
    <DashboardLayout role="supervisor" userName={profile?.name}>
      <div className="mgmt-page">
        <div className="mgmt-page-header">
          <h2>Supervisor Overview</h2>
          <DateFilter days={days} onChange={setDays} />
        </div>

        {error && <div className="alert alert--error" style={{ marginBottom: 16 }}>{error}</div>}

        <div className="kpi-grid">
          <KpiCard title="Assigned Farms" value={assignedFarmIds.length} icon="&#127968;" />
          <KpiCard title="Active Farmers" value={farmers.length} icon="&#128100;" />
          <KpiCard title="Submitted Today" value={`${submittedToday} / ${assignedFarmIds.length}`} icon="&#9989;" color={missingToday > 0 ? '#d97706' : '#15803d'} />
          <KpiCard title="Missing Today" value={missingToday} icon="&#9888;" color={missingToday > 0 ? '#dc2626' : '#15803d'} />
          <KpiCard title="Avg Production Rate" value={`${avgProd}%`} icon="&#128002;" color={avgProd >= 70 ? '#15803d' : '#d97706'} />
          <KpiCard title="Avg Mortality Rate" value={`${avgMort}%`} icon="&#128196;" color={avgMort <= 5 ? '#15803d' : '#dc2626'} />
          <KpiCard title="Avg Feed/Bird" value={`${avgFeed.toFixed(0)}g`} icon="&#127838;" />
          <KpiCard title="Attention Needed" value={missingToday + (avgMort > 10 ? 1 : 0)} icon="&#128680;" color="#dc2626" />
        </div>

        {chartData.length > 0 && (
          <div className="chart-grid">
            <div className="chart-card">
              <h3>Egg Production Trend</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="production" stroke="#15803d" strokeWidth={2} name="Production %" />
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
              <h3>Feed Consumption (g/bird)</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="feed" fill="#16a34a" name="Feed g/bird" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {chartData.length === 0 && <EmptyState message="No report data available for the selected period." />}
      </div>
    </DashboardLayout>
  );
}
