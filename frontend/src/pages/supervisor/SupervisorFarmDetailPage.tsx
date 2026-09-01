import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/dashboard/DashboardLayout';
import { KpiCard } from '../../components/dashboard/KpiCard';
import { LoadingState } from '../../components/dashboard/LoadingState';
import { EmptyState } from '../../components/dashboard/EmptyState';
import { DateFilter } from '../../components/dashboard/DateFilter';
import { getReportsByFarm, type ReportDoc } from '../../services/reportDataService';
import { getFarmById, type FarmDoc } from '../../services/farmDataService';
import { getUserByUid, type UserDoc } from '../../services/userDataService';
import { getIstDate, getDaysAgo, formatDisplayDate, formatTime } from '../../utils/dateUtils';
import { calcProductionRate, calcMortalityRate, calcFeedPerBird, calcSelectionRate, calcAverage, aggregateReports } from '../../utils/kpiCalculations';
import { KPI_THRESHOLDS } from '../../config/kpiThresholds';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export function SupervisorFarmDetailPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [farm, setFarm] = useState<FarmDoc | null>(null);
  const [farmer, setFarmer] = useState<UserDoc | null>(null);
  const [reports, setReports] = useState<ReportDoc[]>([]);

  const loadData = useCallback(async () => {
    if (!farmId) return;
    setLoading(true);
    try {
      const startDate = getDaysAgo(days);
      const endDate = getIstDate();
      const [f, rpts] = await Promise.all([
        getFarmById(farmId),
        getReportsByFarm(farmId, startDate, endDate),
      ]);
      setFarm(f);
      setReports(rpts);
      if (rpts.length > 0 && rpts[0]) {
        const u = await getUserByUid(rpts[0].submittedBy);
        setFarmer(u);
      }
    } catch (err) {
      console.error('[FarmDetail] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [farmId, days]);

  useEffect(() => { loadData(); }, [loadData]);

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

  const role = userProfile?.role === 'admin' ? 'admin' : 'supervisor';
  const basePath = role === 'admin' ? '/admin' : '/supervisor';

  if (loading) return <DashboardLayout role={role} userName={userProfile?.name}><LoadingState /></DashboardLayout>;
  if (!farm) return <DashboardLayout role={role} userName={userProfile?.name}><EmptyState message="Farm not found." /></DashboardLayout>;

  return (
    <DashboardLayout role={role} userName={userProfile?.name}>
      <div className="mgmt-page">
        <button className="btn-back" onClick={() => navigate(`${basePath}/farms`)}>&#8592; Back to Farms</button>

        <div className="farm-detail-header">
          <h2>{farm.farmId}</h2>
          <p>{farm.name || 'Unnamed Farm'} | Farmer: {farmer?.name || 'Unknown'}</p>
          {attentionItems.length > 0 && (
            <div className="attention-banner">&#9888; Attention: {attentionItems.join(', ')}</div>
          )}
        </div>

        <DateFilter days={days} onChange={setDays} />

        <div className="kpi-grid">
          <KpiCard title="Avg Production" value={`${agg.avgProductionRate}%`} icon="&#128002;" />
          <KpiCard title="Avg Mortality" value={`${agg.avgMortalityRate}%`} icon="&#128196;" color={agg.avgMortalityRate > 10 ? '#dc2626' : undefined} />
          <KpiCard title="Avg Feed/Bird" value={`${agg.avgFeedPerBird}g`} icon="&#127838;" />
          <KpiCard title="Avg Temperature" value={`${agg.avgTemperature}°C`} icon="&#127777;" />
          <KpiCard title="Avg Egg Weight" value={`${agg.avgEggWeight}g`} icon="&#129370;" />
          <KpiCard title="Reports" value={agg.totalReports} icon="&#128196;" />
        </div>

        {chartData.length > 0 && (
          <div className="chart-grid">
            <div className="chart-card">
              <h3>Production & Mortality Trend</h3>
              <ResponsiveContainer width="100%" height={250}>
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
          </div>
        )}

        <div className="section-card">
          <h3>Report History</h3>
          <div className="table-container">
            <table className="data-table">
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
                    <td>{r.birdCount}</td>
                    <td>{calcProductionRate(r.eggsProduced ?? 0, r.birdCount ?? 0)}%</td>
                    <td className={calcMortalityRate(r.mortality ?? 0, r.birdCount ?? 0) > 10 ? 'text-danger' : ''}>
                      {calcMortalityRate(r.mortality ?? 0, r.birdCount ?? 0)}%
                    </td>
                    <td>{calcFeedPerBird(r.feedKg ?? 0, r.birdCount ?? 0)}g</td>
                    <td>{r.temperature}°C</td>
                    <td>{formatTime(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {reports.length === 0 && <EmptyState message="No reports found for this period." />}
        </div>
      </div>
    </DashboardLayout>
  );
}
