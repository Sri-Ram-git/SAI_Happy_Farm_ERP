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
import {
  Building2,
  Bird,
  TrendingUp,
  AlertTriangle,
  Wheat,
  ClipboardCheck,
  Activity,
  Users,
} from 'lucide-react';

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
          <div className="mgmt-page-header__title-group">
            <h2 className="mgmt-page-header__title">Supervisor Overview</h2>
            <p className="mgmt-page-header__description">Monitor farm performance and submission status</p>
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

        <div className="mgmt-section">
          <div className="mgmt-kpi-grid">
            <KpiCard title="Assigned Farms" value={assignedFarmIds.length} icon={Building2} />
            <KpiCard title="Active Birds" value={farmers.length} icon={Users} />
            <KpiCard
              title="Submitted Today"
              value={`${submittedToday} / ${assignedFarmIds.length}`}
              icon={ClipboardCheck}
              color={missingToday > 0 ? 'var(--mgmt-warning)' : 'var(--mgmt-success)'}
            />
            <KpiCard
              title="Avg Production"
              value={`${avgProd}%`}
              icon={TrendingUp}
              color={avgProd >= 70 ? 'var(--mgmt-success)' : 'var(--mgmt-warning)'}
            />
            <KpiCard
              title="Avg Mortality"
              value={`${avgMort}%`}
              icon={Activity}
              color={avgMort <= 5 ? 'var(--mgmt-success)' : 'var(--mgmt-danger)'}
            />
            <KpiCard
              title="Avg Feed/Bird"
              value={`${avgFeed.toFixed(0)}g`}
              icon={Wheat}
            />
          </div>
        </div>

        {chartData.length > 0 && (
          <div className="mgmt-section">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              <div className="mgmt-chart-card">
                <div className="mgmt-chart-card__header">
                  <div>
                    <div className="mgmt-chart-card__title">Production Trend</div>
                    <div className="mgmt-chart-card__subtitle">Daily average production rate</div>
                  </div>
                </div>
                <div className="mgmt-chart-card__body">
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="production" stroke="var(--mgmt-primary, #15803d)" strokeWidth={2} name="Production %" />
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
            </div>
          </div>
        )}

        {chartData.length === 0 && <EmptyState message="No report data available for the selected period." />}
      </div>
    </DashboardLayout>
  );
}
