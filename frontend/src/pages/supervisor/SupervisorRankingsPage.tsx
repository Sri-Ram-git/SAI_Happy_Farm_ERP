import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/dashboard/DashboardLayout';
import { LoadingState } from '../../components/dashboard/LoadingState';
import { EmptyState } from '../../components/dashboard/EmptyState';
import { DateFilter } from '../../components/dashboard/DateFilter';
import { type ReportDoc } from '../../services/reportDataService';
import { useDailyReportsByFarms } from '../../hooks/useDailyReports';
import { getFarmsByIds, type FarmDoc } from '../../services/farmDataService';
import { getIstDate, getDaysAgo } from '../../utils/dateUtils';
import { aggregateReports, calcPerformanceScore, calcSubmissionCompliance } from '../../utils/kpiCalculations';

export function SupervisorRankingsPage() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [days, setDays] = useState(30);
  const [farms, setFarms] = useState<FarmDoc[]>([]);

  const assignedFarmIds = userProfile?.farmIds ?? [];
  const { reports, loading, error } = useDailyReportsByFarms(assignedFarmIds, getDaysAgo(days), getIstDate());

  useEffect(() => {
    if (assignedFarmIds.length === 0) return;
    getFarmsByIds(assignedFarmIds)
      .then(setFarms)
      .catch((err) => console.error('[SupervisorRankings] Load error:', err));
  }, [assignedFarmIds.join(',')]);

  const rankings = farms.map((farm) => {
    const farmReports = reports.filter((r) => r.farmId === farm.farmId);
    const agg = aggregateReports(farmReports);
    const expectedDays = days;
    const uniqueDays = new Set(farmReports.map((r) => r.submissionDate)).size;
    const compliance = calcSubmissionCompliance(uniqueDays, expectedDays);
    const score = calcPerformanceScore({
      productionRate: agg.avgProductionRate,
      mortalityRate: agg.avgMortalityRate,
      feedPerBird: agg.avgFeedPerBird,
      submissionCompliance: compliance,
    });
    return { farm, agg, compliance, score, reportCount: farmReports.length };
  }).sort((a, b) => b.score.total - a.score.total);

  if (loading) return <DashboardLayout role="supervisor" userName={userProfile?.name}><LoadingState /></DashboardLayout>;
  if (assignedFarmIds.length === 0) return <DashboardLayout role="supervisor" userName={userProfile?.name}><EmptyState message="No farms assigned." /></DashboardLayout>;

  return (
    <DashboardLayout role="supervisor" userName={userProfile?.name}>
      <div className="mgmt-page">
        <div className="mgmt-page-header">
          <h2>Farm Rankings</h2>
          <DateFilter days={days} onChange={setDays} />
        </div>

        {error && <div className="alert alert--error" style={{ marginBottom: 16 }}>{error}</div>}

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Farm</th>
                <th>Score</th>
                <th>Production</th>
                <th>Mortality</th>
                <th>Compliance</th>
                <th>Reports</th>
              </tr>
            </thead>
            <tbody>
              {rankings.map((r, i) => (
                <tr key={r.farm.farmId} className="clickable-row" onClick={() => navigate(`/supervisor/farms/${r.farm.farmId}`)}>
                  <td className="td-bold">#{i + 1}</td>
                  <td>
                    <div className="td-bold">{r.farm.farmId}</div>
                    <div className="td-muted">{r.farm.name || 'Unnamed'}</div>
                  </td>
                  <td>
                    <span className={`score-badge ${r.score.total >= 80 ? 'score-badge--good' : r.score.total >= 60 ? 'score-badge--ok' : 'score-badge--warn'}`}>
                      {r.score.total}
                    </span>
                  </td>
                  <td>{r.agg.avgProductionRate}%</td>
                  <td className={r.agg.avgMortalityRate > 10 ? 'text-danger' : ''}>{r.agg.avgMortalityRate}%</td>
                  <td>{r.compliance}%</td>
                  <td>{r.reportCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
