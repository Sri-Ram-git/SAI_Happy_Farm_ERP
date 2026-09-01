import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useMockProfile } from '../../utils/useMockProfile';
import { DashboardLayout } from '../../components/dashboard/DashboardLayout';
import { KpiCard } from '../../components/dashboard/KpiCard';
import { LoadingState } from '../../components/dashboard/LoadingState';
import { EmptyState } from '../../components/dashboard/EmptyState';
import { DateFilter } from '../../components/dashboard/DateFilter';
import { getAllReports, type ReportDoc } from '../../services/reportDataService';
import { getAllFarms, type FarmDoc } from '../../services/farmDataService';
import { getAllUsers, type UserDoc } from '../../services/userDataService';
import { getIstDate, getDaysAgo } from '../../utils/dateUtils';
import { calcProductionRate, calcMortalityRate, calcAverage } from '../../utils/kpiCalculations';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';

export function AdminDashboard() {
  const { userProfile } = useAuth();
  const mockProfile = useMockProfile('admin');
  const profile = userProfile || mockProfile;
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<ReportDoc[]>([]);
  const [farms, setFarms] = useState<FarmDoc[]>([]);
  const [users, setUsers] = useState<UserDoc[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const startDate = getDaysAgo(days);
      const endDate = getIstDate();
      const [rpts, frms, usrs] = await Promise.all([
        getAllReports(startDate, endDate),
        getAllFarms(),
        getAllUsers(),
      ]);
      setReports(rpts);
      setFarms(frms);
      setUsers(usrs);
    } catch (err) {
      console.error('[AdminDashboard] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { loadData(); }, [loadData]);

  const today = getIstDate();
  const todayReports = reports.filter((r) => r.submissionDate === today);
  const submittedToday = new Set(todayReports.map((r) => r.farmId)).size;
  const farmers = users.filter((u) => u.role === 'farmer' && u.active);
  const supervisors = users.filter((u) => u.role === 'supervisor');
  const avgProd = reports.length > 0 ? calcAverage(reports.map((r) => calcProductionRate(r.eggsProduced ?? 0, r.birdCount ?? 0))) : 0;
  const avgMort = reports.length > 0 ? calcAverage(reports.map((r) => calcMortalityRate(r.mortality ?? 0, r.birdCount ?? 0))) : 0;

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
        reports: dayReports.length,
      }));
  })();

  if (loading) return <DashboardLayout role="admin" userName={profile?.name}><LoadingState /></DashboardLayout>;

  return (
    <DashboardLayout role="admin" userName={profile?.name}>
      <div className="mgmt-page">
        <div className="mgmt-page-header">
          <h2>Admin Overview</h2>
          <DateFilter days={days} onChange={setDays} />
        </div>

        <div className="kpi-grid">
          <KpiCard title="Total Farms" value={farms.length} icon="&#127968;" />
          <KpiCard title="Active Farmers" value={farmers.length} icon="&#128100;" />
          <KpiCard title="Supervisors" value={supervisors.length} icon="&#128188;" />
          <KpiCard title="Submitted Today" value={`${submittedToday} / ${farms.length}`} icon="&#9989;" />
          <KpiCard title="Missing Today" value={Math.max(0, farms.length - submittedToday)} icon="&#9888;" color="#dc2626" />
          <KpiCard title="Avg Production" value={`${avgProd}%`} icon="&#128002;" />
          <KpiCard title="Avg Mortality" value={`${avgMort}%`} icon="&#128196;" color={avgMort > 10 ? '#dc2626' : undefined} />
          <KpiCard title="Total Reports" value={reports.length} icon="&#128196;" />
        </div>

        {chartData.length > 0 && (
          <div className="chart-grid">
            <div className="chart-card">
              <h3>Production & Mortality Trend</h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="production" stroke="#15803d" strokeWidth={2} name="Production %" />
                  <Line type="monotone" dataKey="mortality" stroke="#dc2626" strokeWidth={2} name="Mortality %" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="chart-card">
              <h3>Daily Report Submissions</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="reports" fill="#15803d" name="Reports" />
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
