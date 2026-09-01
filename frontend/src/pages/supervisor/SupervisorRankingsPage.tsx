import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useMockProfile } from '../../utils/useMockProfile';
import { DashboardLayout } from '../../components/dashboard/DashboardLayout';
import { LoadingState } from '../../components/dashboard/LoadingState';
import { EmptyState } from '../../components/dashboard/EmptyState';
import { DateFilter } from '../../components/dashboard/DateFilter';
import { type ReportDoc } from '../../services/reportDataService';
import { useDailyReportsByFarms } from '../../hooks/useDailyReports';
import { getFarmsByIds, type FarmDoc } from '../../services/farmDataService';
import { getIstDate, getDaysAgo } from '../../utils/dateUtils';
import { aggregateReports, calcPerformanceScore, calcSubmissionCompliance } from '../../utils/kpiCalculations';
import { AlertTriangle, Trophy } from 'lucide-react';

export function SupervisorRankingsPage() {
  const { userProfile } = useAuth();
  const mockProfile = useMockProfile('supervisor');
  const profile = userProfile || mockProfile;
  const navigate = useNavigate();
  const [days, setDays] = useState(30);
  const [farms, setFarms] = useState<FarmDoc[]>([]);

  const assignedFarmIds = profile?.farmIds ?? [];
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

  if (loading) return <DashboardLayout role="supervisor" userName={profile?.name}><LoadingState /></DashboardLayout>;
  if (assignedFarmIds.length === 0) return <DashboardLayout role="supervisor" userName={profile?.name}><EmptyState message="No farms assigned." /></DashboardLayout>;

  return (
    <DashboardLayout role="supervisor" userName={profile?.name}>
      <div className="mgmt-page">
        <div className="mgmt-page-header">
          <div className="mgmt-page-header__title-group">
            <h2 className="mgmt-page-header__title">Farm Rankings</h2>
            <p className="mgmt-page-header__description">Performance rankings based on production, mortality, and compliance</p>
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
          <div className="mgmt-table-container">
            <table className="mgmt-table">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>Rank</th>
                  <th>Farm</th>
                  <th>Score</th>
                  <th>Production</th>
                  <th>Mortality</th>
                  <th>Compliance</th>
                  <th>Reports</th>
                </tr>
              </thead>
              <tbody>
                {rankings.map((r, i) => {
                  const scoreLevel = r.score.total >= 80 ? 'high' : r.score.total >= 60 ? 'medium' : 'low';
                  return (
                    <tr
                      key={r.farm.farmId}
                      className="mgmt-table__row--clickable"
                      onClick={() => navigate(`/supervisor/farms/${r.farm.farmId}`)}
                    >
                      <td>
                        <span className="mgmt-table__cell--number" style={{ fontWeight: 700, fontSize: 14 }}>
                          {i + 1}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{r.farm.farmId}</div>
                        <div style={{ fontSize: 12, color: 'var(--mgmt-text-muted)' }}>{r.farm.name || 'Unnamed'}</div>
                      </td>
                      <td>
                        <span className={`mgmt-score mgmt-score--${scoreLevel}`}>
                          <span className="mgmt-score__value">{r.score.total}</span>
                          <span className="mgmt-score__bar">
                            <span className="mgmt-score__fill" style={{ width: `${r.score.total}%` }} />
                          </span>
                        </span>
                      </td>
                      <td>{r.agg.avgProductionRate}%</td>
                      <td>
                        <span className={`mgmt-badge ${r.agg.avgMortalityRate > 10 ? 'mgmt-badge--danger' : 'mgmt-badge--success'}`}>
                          {r.agg.avgMortalityRate}%
                        </span>
                      </td>
                      <td>{r.compliance}%</td>
                      <td className="mgmt-table__cell--number">{r.reportCount}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
