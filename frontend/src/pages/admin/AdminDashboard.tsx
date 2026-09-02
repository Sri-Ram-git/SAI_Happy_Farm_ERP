import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/dashboard/DashboardLayout';
import { KpiCard } from '../../components/dashboard/KpiCard';
import { LoadingState } from '../../components/dashboard/LoadingState';
import { EmptyState } from '../../components/dashboard/EmptyState';
import { DateFilter } from '../../components/dashboard/DateFilter';
import { DetailDrawer } from '../../components/dashboard/DetailDrawer';
import { type ReportDoc } from '../../services/reportDataService';
import { getAllFarms, type FarmDoc } from '../../services/farmDataService';
import { getAllUsers, type UserDoc } from '../../services/userDataService';
import { getBirdInventory, type BirdInventory } from '../../services/inventoryService';
import { getIstDate, getDaysAgo, formatDisplayDate, formatTime } from '../../utils/dateUtils';
import {
  calcProductionRate,
  calcMortalityRate,
  calcAverage,
  aggregateReports,
} from '../../utils/kpiCalculations';
import { useAllDailyReports } from '../../hooks/useDailyReports';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, AreaChart, Area } from 'recharts';

function normalizeRole(role: string | undefined | null): string {
  return (role ?? '').trim().toLowerCase();
}

type DrawerType = 'farms' | 'farmers' | 'supervisors' | 'submitted' | 'submissionRate' | 'missing' | 'birds' | 'production' | 'mortality' | 'reports' | null;

export function AdminDashboard() {
  const { userProfile } = useAuth();
  const [days, setDays] = useState(7);
  const [farms, setFarms] = useState<FarmDoc[]>([]);
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [farmInventories, setFarmInventories] = useState<Map<string, BirdInventory>>(new Map());
  const [farmLoading, setFarmLoading] = useState(true);
  const [drawer, setDrawer] = useState<DrawerType>(null);
  const { reports, loading: reportsLoading, error } = useAllDailyReports(getDaysAgo(days), getIstDate());
  const loading = farmLoading || reportsLoading;

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [frms, usrs] = await Promise.all([getAllFarms(), getAllUsers()]);
        if (!mounted) return;
        setFarms(frms);
        setUsers(usrs);

        const invMap = new Map<string, BirdInventory>();
        await Promise.all(
          frms.filter((f) => f.active).map(async (farm) => {
            try {
              const inv = await getBirdInventory(farm.farmId);
              if (inv && mounted) invMap.set(farm.farmId, inv);
            } catch (err) {
              console.warn(`[AdminDashboard] Failed to load inventory for ${farm.farmId}:`, err);
            }
          })
        );
        if (mounted) setFarmInventories(invMap);
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

  const activeFarms = farms.filter((f) => f.active);
  const submittedFarmIds = new Set(todayReports.map((r) => r.farmId));
  const submittedToday = submittedFarmIds.size;
  const expectedFarms = activeFarms.length;
  const missingToday = Math.max(0, expectedFarms - submittedToday);

  const farmers = users.filter((u) => normalizeRole(u.role) === 'farmer' && u.active);
  const supervisors = users.filter((u) => normalizeRole(u.role) === 'supervisor');

  const totalBirdsToday = Array.from(farmInventories.values()).reduce((sum, inv) => sum + inv.currentBirdCount, 0);
  const submissionPct = expectedFarms > 0 ? ((submittedToday / expectedFarms) * 100).toFixed(0) : '--';

  const avgProd = reports.length > 0
    ? calcAverage(reports.map((r) => {
        const base = r.openingBirdCount || r.birdCount;
        return base > 0 ? calcProductionRate(r.eggsProduced ?? 0, base) : null;
      }))
    : null;
  const avgMort = reports.length > 0
    ? calcAverage(reports.map((r) => {
        const base = r.openingBirdCount || r.birdCount;
        return base > 0 ? calcMortalityRate(r.mortality ?? 0, base) : null;
      }))
    : null;

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
        production: calcAverage(dayReports.map((r) => {
          const base = r.openingBirdCount || r.birdCount;
          return base > 0 ? calcProductionRate(r.eggsProduced ?? 0, base) : null;
        })),
        mortality: calcAverage(dayReports.map((r) => {
          const base = r.openingBirdCount || r.birdCount;
          return base > 0 ? calcMortalityRate(r.mortality ?? 0, base) : null;
        })),
        submitted: dayReports.length,
        missing: Math.max(0, expectedFarms - dayReports.length),
        birds: dayReports.reduce((s, r) => s + (r.closingBirdCount || r.birdCount || 0), 0),
        feed: dayReports.reduce((s, r) => s + (r.feedKg ?? 0), 0),
      }));
  })();

  const todayAgg = aggregateReports(todayReports);

  const openDrawer = useCallback((type: DrawerType) => setDrawer(type), []);
  const closeDrawer = useCallback(() => setDrawer(null), []);

  if (loading) return <DashboardLayout role="admin" userName={userProfile?.name}><LoadingState /></DashboardLayout>;

  return (
    <DashboardLayout role="admin" userName={userProfile?.name}>
      <div className="mgmt-page">
        {error && (
          <div className="info-banner">
            <span>&#9888;</span>
            <span>{error}</span>
          </div>
        )}

        <div className="mgmt-page-header">
          <h2>Admin Overview</h2>
          <DateFilter days={days} onChange={setDays} />
        </div>

        <div className="kpi-grid">
          <KpiCard title="Total Farms" value={activeFarms.length} icon="&#127968;" onClick={() => openDrawer('farms')} />
          <KpiCard title="Active Farmers" value={farmers.length} icon="&#128100;" onClick={() => openDrawer('farmers')} />
          <KpiCard title="Supervisors" value={supervisors.length} icon="&#128188;" onClick={() => openDrawer('supervisors')} />
          <KpiCard
            title="Submitted Today"
            value={expectedFarms > 0 ? `${submittedToday} / ${expectedFarms}` : '--'}
            icon="&#9989;"
            onClick={() => openDrawer('submitted')}
          />
          <KpiCard
            title="Submission Rate"
            value={submissionPct !== '--' ? `${submissionPct}%` : '--'}
            icon="&#128200;"
            color={Number(submissionPct) >= 80 ? '#15803d' : '#d97706'}
            onClick={() => openDrawer('submissionRate')}
          />
          <KpiCard title="Missing Today" value={missingToday} icon="&#9888;" color="#dc2626" onClick={() => openDrawer('missing')} />
          <KpiCard title="Total Birds" value={totalBirdsToday.toLocaleString() || '--'} icon="&#129418;" onClick={() => openDrawer('birds')} />
          <KpiCard title="Avg Production" value={avgProd !== null ? `${avgProd}%` : '--'} icon="&#128002;" onClick={() => openDrawer('production')} />
          <KpiCard title="Avg Mortality" value={avgMort !== null ? `${avgMort}%` : '--'} icon="&#128196;" color={avgMort !== null && avgMort > 10 ? '#dc2626' : undefined} onClick={() => openDrawer('mortality')} />
          <KpiCard title="Total Reports" value={reports.length} icon="&#128196;" onClick={() => openDrawer('reports')} />
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
                  <Tooltip formatter={(value: unknown) => `${Number(value).toFixed(1)}%`} />
                  <Legend />
                  <Line type="monotone" dataKey="production" stroke="#15803d" strokeWidth={2} name="Production %" dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="mortality" stroke="#dc2626" strokeWidth={2} name="Mortality %" dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-card">
              <h3>Daily Submissions</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="submitted" fill="#15803d" name="Submitted" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="missing" fill="#fca5a5" name="Missing" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-card">
              <h3>Feed Usage (Kg)</h3>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="feed" stroke="#d97706" fill="#fef3c7" name="Feed Kg" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {chartData.length === 0 && !error && <EmptyState message="No report data available for the selected period." />}
      </div>

      {/* Detail Drawers */}
      <DetailDrawer open={drawer === 'farms'} title="All Farms" onClose={closeDrawer}>
        <table className="drawer-table">
          <thead>
            <tr><th>Farm ID</th><th>Name</th><th>Status</th><th>Birds</th></tr>
          </thead>
          <tbody>
            {activeFarms.map((farm) => {
              const inv = farmInventories.get(farm.farmId);
              return (
                <tr key={farm.farmId}>
                  <td className="td-bold">{farm.farmId}</td>
                  <td>{farm.name || 'Unnamed'}</td>
                  <td><span className="status-dot status-dot--ok" />Active</td>
                  <td>{inv?.currentBirdCount?.toLocaleString() ?? '--'}</td>
                </tr>
              );
            })}
            {farms.filter((f) => !f.active).map((farm) => (
              <tr key={farm.farmId} style={{ opacity: 0.5 }}>
                <td className="td-bold">{farm.farmId}</td>
                <td>{farm.name || 'Unnamed'}</td>
                <td><span className="status-dot status-dot--error" />Inactive</td>
                <td>--</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DetailDrawer>

      <DetailDrawer open={drawer === 'farmers'} title="Active Farmers" onClose={closeDrawer}>
        <table className="drawer-table">
          <thead>
            <tr><th>Farmer</th><th>Farm</th><th>Submitted Today</th></tr>
          </thead>
          <tbody>
            {farmers.map((farmer) => {
              const farmId = farmer.farmIds?.[0] ?? '--';
              const submitted = submittedFarmIds.has(farmId);
              return (
                <tr key={farmer.uid}>
                  <td>{farmer.name || farmer.email}</td>
                  <td className="td-bold">{farmId}</td>
                  <td>
                    <span className={`status-dot ${submitted ? 'status-dot--ok' : 'status-dot--warn'}`} />
                    {submitted ? 'Yes' : 'No'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </DetailDrawer>

      <DetailDrawer open={drawer === 'supervisors'} title="Supervisors" onClose={closeDrawer}>
        <table className="drawer-table">
          <thead>
            <tr><th>Name</th><th>Email</th><th>Farms</th></tr>
          </thead>
          <tbody>
            {supervisors.map((sup) => (
              <tr key={sup.uid}>
                <td>{sup.name || sup.email}</td>
                <td>{sup.email}</td>
                <td>{sup.farmIds?.join(', ') || '--'}</td>
              </tr>
            ))}
            {supervisors.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', color: '#9ca3af' }}>No supervisors found</td></tr>}
          </tbody>
        </table>
      </DetailDrawer>

      <DetailDrawer open={drawer === 'submitted'} title="Submitted Today" onClose={closeDrawer}>
        <table className="drawer-table">
          <thead>
            <tr><th>Farm</th><th>Farmer</th><th>Submitted At</th></tr>
          </thead>
          <tbody>
            {todayReports.map((r) => {
              const farmer = farmers.find((f) => f.farmIds?.includes(r.farmId));
              return (
                <tr key={`${r.farmId}_${r.submissionDate}`}>
                  <td className="td-bold">{r.farmId}</td>
                  <td>{farmer?.name || r.submittedBy || '--'}</td>
                  <td>{r.createdAt ? formatTime(r.createdAt) : '--'}</td>
                </tr>
              );
            })}
            {todayReports.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', color: '#9ca3af' }}>No submissions today</td></tr>}
          </tbody>
        </table>
      </DetailDrawer>

      <DetailDrawer open={drawer === 'missing'} title="Missing Today" onClose={closeDrawer}>
        <table className="drawer-table">
          <thead>
            <tr><th>Farm</th><th>Farmer</th><th>Last Submission</th></tr>
          </thead>
          <tbody>
            {activeFarms
              .filter((f) => !submittedFarmIds.has(f.farmId))
              .map((farm) => {
                const farmer = farmers.find((f) => f.farmIds?.includes(farm.farmId));
                const lastReport = reports.filter((r) => r.farmId === farm.farmId).pop();
                return (
                  <tr key={farm.farmId}>
                    <td className="td-bold">{farm.farmId}</td>
                    <td>{farmer?.name || '--'}</td>
                    <td>{lastReport ? `${formatDisplayDate(lastReport.submissionDate)}` : 'Never'}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
        <div style={{ marginTop: 12, padding: '10px 16px', background: '#fffbeb', borderRadius: 8, fontSize: 13, color: '#92400e' }}>
          &#9888; Reminder integration: Not yet connected. Mark this integration point for your notification system.
        </div>
      </DetailDrawer>

      <DetailDrawer open={drawer === 'birds'} title="Bird Population by Farm" onClose={closeDrawer}>
        <table className="drawer-table">
          <thead>
            <tr><th>Farm</th><th>Initial</th><th>Current</th><th>Change</th></tr>
          </thead>
          <tbody>
            {activeFarms.map((farm) => {
              const inv = farmInventories.get(farm.farmId);
              if (!inv) return (
                <tr key={farm.farmId}>
                  <td className="td-bold">{farm.farmId}</td>
                  <td colSpan={3} style={{ color: '#9ca3af' }}>No inventory data</td>
                </tr>
              );
              const change = inv.currentBirdCount - inv.initialBirdCount;
              return (
                <tr key={farm.farmId}>
                  <td className="td-bold">{farm.farmId}</td>
                  <td>{inv.initialBirdCount.toLocaleString()}</td>
                  <td>{inv.currentBirdCount.toLocaleString()}</td>
                  <td style={{ color: change < 0 ? '#dc2626' : change > 0 ? '#15803d' : undefined }}>
                    {change >= 0 ? '+' : ''}{change.toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="detail-section-title" style={{ marginTop: 20 }}>Today's Bird Changes</div>
        <table className="drawer-table">
          <thead>
            <tr><th>Farm</th><th>Opening</th><th>Mortality</th><th>Culling</th><th>Closing</th></tr>
          </thead>
          <tbody>
            {todayReports.map((r) => (
              <tr key={`${r.farmId}_bird`}>
                <td className="td-bold">{r.farmId}</td>
                <td>{(r.openingBirdCount ?? 0).toLocaleString()}</td>
                <td style={{ color: '#dc2626' }}>-{r.mortality}</td>
                <td style={{ color: '#dc2626' }}>-{r.culling}</td>
                <td>{(r.closingBirdCount ?? 0).toLocaleString()}</td>
              </tr>
            ))}
            {todayReports.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: '#9ca3af' }}>No reports today</td></tr>}
          </tbody>
        </table>
      </DetailDrawer>

      <DetailDrawer open={drawer === 'production'} title="Production Details" onClose={closeDrawer}>
        <div className="detail-section-title">Today's Production</div>
        <div className="detail-list">
          <div className="detail-item">
            <span className="detail-item-label">Total Eggs Produced</span>
            <span className="detail-item-value">{todayReports.reduce((s, r) => s + (r.eggsProduced ?? 0), 0).toLocaleString()}</span>
          </div>
          <div className="detail-item">
            <span className="detail-item-label">Avg Eggs / Farm</span>
            <span className="detail-item-value">{submittedToday > 0 ? (todayReports.reduce((s, r) => s + (r.eggsProduced ?? 0), 0) / submittedToday).toFixed(0) : '--'}</span>
          </div>
          <div className="detail-item">
            <span className="detail-item-label">Selection Eggs</span>
            <span className="detail-item-value">{todayReports.reduce((s, r) => s + (r.selectionEggs ?? 0), 0).toLocaleString()}</span>
          </div>
        </div>
        <div className="detail-section-title" style={{ marginTop: 20 }}>Farm Comparison</div>
        <table className="drawer-table">
          <thead>
            <tr><th>Farm</th><th>Eggs</th><th>Production %</th></tr>
          </thead>
          <tbody>
            {todayReports.map((r) => {
              const base = r.openingBirdCount || r.birdCount;
              return (
                <tr key={`${r.farmId}_prod`}>
                  <td className="td-bold">{r.farmId}</td>
                  <td>{(r.eggsProduced ?? 0).toLocaleString()}</td>
                  <td>{base > 0 ? calcProductionRate(r.eggsProduced ?? 0, base) : '--'}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </DetailDrawer>

      <DetailDrawer open={drawer === 'mortality'} title="Mortality Details" onClose={closeDrawer}>
        <div className="detail-section-title">Today's Mortality</div>
        <div className="detail-list">
          <div className="detail-item">
            <span className="detail-item-label">Total Mortality</span>
            <span className="detail-item-value" style={{ color: '#dc2626' }}>{todayReports.reduce((s, r) => s + (r.mortality ?? 0), 0).toLocaleString()}</span>
          </div>
          <div className="detail-item">
            <span className="detail-item-label">Total Culling</span>
            <span className="detail-item-value" style={{ color: '#d97706' }}>{todayReports.reduce((s, r) => s + (r.culling ?? 0), 0).toLocaleString()}</span>
          </div>
        </div>
        <div className="detail-section-title" style={{ marginTop: 20 }}>Farm Comparison</div>
        <table className="drawer-table">
          <thead>
            <tr><th>Farm</th><th>Mortality</th><th>Mortality %</th><th>Culling</th></tr>
          </thead>
          <tbody>
            {todayReports.map((r) => {
              const base = r.openingBirdCount || r.birdCount;
              return (
                <tr key={`${r.farmId}_mort`}>
                  <td className="td-bold">{r.farmId}</td>
                  <td style={{ color: '#dc2626' }}>{r.mortality}</td>
                  <td>{base > 0 ? calcMortalityRate(r.mortality ?? 0, base) : '--'}%</td>
                  <td>{r.culling}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </DetailDrawer>

      <DetailDrawer open={drawer === 'reports'} title="All Reports" onClose={closeDrawer}>
        <table className="drawer-table">
          <thead>
            <tr><th>Date</th><th>Farm</th><th>Eggs</th><th>Mortality</th><th>Culling</th><th>Feed</th></tr>
          </thead>
          <tbody>
            {[...reports].reverse().map((r) => (
              <tr key={r.id}>
                <td>{formatDisplayDate(r.submissionDate)}</td>
                <td className="td-bold">{r.farmId}</td>
                <td>{(r.eggsProduced ?? 0).toLocaleString()}</td>
                <td style={{ color: '#dc2626' }}>{r.mortality}</td>
                <td>{r.culling}</td>
                <td>{(r.feedKg ?? 0).toFixed(1)} Kg</td>
              </tr>
            ))}
            {reports.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: '#9ca3af' }}>No reports in selected period</td></tr>}
          </tbody>
        </table>
      </DetailDrawer>
    </DashboardLayout>
  );
}
