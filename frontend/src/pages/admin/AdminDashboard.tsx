import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useMockProfile } from '../../utils/useMockProfile';
import { DashboardLayout } from '../../components/dashboard/DashboardLayout';
import { LoadingState } from '../../components/dashboard/LoadingState';
import { EmptyState } from '../../components/dashboard/EmptyState';
import { DateFilter } from '../../components/dashboard/DateFilter';
import { type ReportDoc } from '../../services/reportDataService';
import { getAllFarms, type FarmDoc } from '../../services/farmDataService';
import { getAllUsers, type UserDoc } from '../../services/userDataService';
import { getIstDate, getDaysAgo } from '../../utils/dateUtils';
import { calcProductionRate, calcMortalityRate, calcAverage } from '../../utils/kpiCalculations';
import { useAllDailyReports } from '../../hooks/useDailyReports';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import {
  Warehouse,
  Users,
  Briefcase,
  Bird,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  FileText,
} from 'lucide-react';

export function AdminDashboard() {
  const { userProfile } = useAuth();
  const mockProfile = useMockProfile('admin');
  const profile = userProfile || mockProfile;
  const [days, setDays] = useState(7);
  const [farms, setFarms] = useState<FarmDoc[]>([]);
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [farmLoading, setFarmLoading] = useState(true);
  const { reports, loading: reportsLoading, error } = useAllDailyReports(getDaysAgo(days), getIstDate());
  const loading = farmLoading || reportsLoading;

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [frms, usrs] = await Promise.all([getAllFarms(), getAllUsers()]);
        if (mounted) { setFarms(frms); setUsers(usrs); }
      } catch (err) {
        console.error('[AdminDashboard] Load error:', err);
      } finally {
        if (mounted) setFarmLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

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

  const kpis = [
    { label: 'Total Farms', value: farms.length, icon: Warehouse, accent: 'primary' as const },
    { label: 'Active Farmers', value: farmers.length, icon: Users, accent: 'success' as const },
    { label: 'Supervisors', value: supervisors.length, icon: Briefcase, iconClass: 'info' as const },
    { label: 'Active Birds', value: reports.length > 0 ? reports.reduce((sum, r) => sum + (r.birdCount ?? 0), 0).toLocaleString() : '0', icon: Bird, accent: 'primary' as const },
    { label: 'Avg Production', value: `${avgProd}%`, icon: TrendingUp, accent: 'success' as const },
    { label: 'Avg Mortality', value: `${avgMort}%`, icon: AlertTriangle, accent: avgMort > 10 ? 'danger' as const : 'warning' as const },
    { label: 'Submitted Today', value: `${submittedToday} / ${farms.length}`, icon: CheckCircle, accent: 'success' as const },
    { label: 'Total Reports', value: reports.length, icon: FileText, accent: 'info' as const },
  ];

  return (
    <DashboardLayout role="admin" userName={profile?.name}>
      <div className="mgmt-page">
        {error && <div className="mgmt-error" style={{ marginBottom: 16 }}><span className="mgmt-error__description">{error}</span></div>}

        <div className="mgmt-page-header">
          <div className="mgmt-page-header__title-group">
            <h2 className="mgmt-page-header__title">Admin Overview</h2>
            <p className="mgmt-page-header__description">Monitor farm operations across your organization</p>
          </div>
          <div className="mgmt-page-header__actions">
            <DateFilter days={days} onChange={setDays} />
          </div>
        </div>

        <div className="mgmt-kpi-grid">
          {kpis.map((kpi) => (
            <div className="mgmt-kpi-card" key={kpi.label}>
              <div className={`mgmt-kpi-card__accent mgmt-kpi-card__accent--${kpi.accent}`} />
              <div className="mgmt-kpi-card__header">
                <div className={`mgmt-kpi-card__icon mgmt-kpi-card__icon--${kpi.iconClass ?? kpi.accent}`}>
                  <kpi.icon size={20} />
                </div>
              </div>
              <div className="mgmt-kpi-card__label">{kpi.label}</div>
              <div className="mgmt-kpi-card__value">{kpi.value}</div>
            </div>
          ))}
        </div>

        {chartData.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 24 }}>
            <div className="mgmt-chart-card">
              <div className="mgmt-chart-card__header">
                <div>
                  <div className="mgmt-chart-card__title">Production & Mortality Trend</div>
                  <div className="mgmt-chart-card__subtitle">Last {days} days</div>
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
                  <div className="mgmt-chart-card__title">Daily Report Submissions</div>
                  <div className="mgmt-chart-card__subtitle">Reports per day</div>
                </div>
              </div>
              <div className="mgmt-chart-card__body">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--mgmt-border)" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="reports" fill="#15803d" name="Reports" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {chartData.length === 0 && (
          <div className="mgmt-empty-state">
            <div className="mgmt-empty-state__icon"><FileText size={24} /></div>
            <div className="mgmt-empty-state__title">No Data Available</div>
            <div className="mgmt-empty-state__description">No report data available for the selected period.</div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
