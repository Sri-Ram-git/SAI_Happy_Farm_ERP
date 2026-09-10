import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { KpiCard } from './KpiCard';
import { LoadingState } from './LoadingState';
import { EmptyState } from './EmptyState';
import { DateFilter } from './DateFilter';
import { type ReportDoc } from '../../services/reportDataService';
import { type FarmDoc, subscribeToAllFarms } from '../../services/farmDataService';
import { type UserDoc, subscribeToAllUsers } from '../../services/userDataService';
import { type BirdInventory, subscribeToAllBirdInventories } from '../../services/inventoryService';
import { type FlockDoc, subscribeToAllFlocks } from '../../services/flockDataService';
import { DashboardMetricDetailModal } from './DashboardMetricDetailModal';
import { ExportReportsCard } from './ExportReportsCard';
import { type ChartType } from './ChartDataTable';
import { useAllDailyReports, useDailyReportsByFarms } from '../../hooks/useDailyReports';
import { getIstDate, getDaysAgo, generateDateArray, getShortDate, formatDisplayDate, formatTime } from '../../utils/dateUtils';
import {
  calcProductionRate,
  calcMortalityRate,
  calcCullingRate,
  calcSelectionRate,
  calcFeedPerBird,
  calcAverage,
  calcPerformanceScore,
} from '../../utils/kpiCalculations';
import { getStandardProductionAtAge } from '../../data/productionCurves';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, AreaChart, Area,
  ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine
} from 'recharts';
import {
  Home, Users, UserCheck, CheckCircle2, TrendingUp, AlertTriangle,
  Layers, Activity, HeartPulse, FileText, Egg, Package, Thermometer,
  Award, ShieldAlert, Sliders, Flame, ArrowUpRight, ArrowDownRight, Check, Maximize2
} from 'lucide-react';

function normalizeRole(role: string | undefined | null): string {
  return (role ?? '').trim().toLowerCase();
}

interface EnterpriseAnalyticsDashboardProps {
  role: 'admin' | 'supervisor';
  variant?: 'overview' | 'analytics' | 'full';
}

export function EnterpriseAnalyticsDashboard({ role, variant = 'full' }: EnterpriseAnalyticsDashboardProps) {
  const { userProfile } = useAuth();
  const [days, setDays] = useState(7);
  const [selectedFarmId, setSelectedFarmId] = useState('');
  const [selectedFlockId, setSelectedFlockId] = useState('');
  const [standardCurveType, setStandardCurveType] = useState<'CF_STD' | 'FR_STD'>('CF_STD');

  const [farms, setFarms] = useState<FarmDoc[]>([]);
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [flocks, setFlocks] = useState<FlockDoc[]>([]);
  const [farmInventories, setFarmInventories] = useState<Map<string, BirdInventory>>(new Map());
  const [dataLoading, setDataLoading] = useState(true);
  const [expandedMetric, setExpandedMetric] = useState<{
    type: ChartType;
    title: string;
    sub: string;
  } | null>(null);
  const unsubRefs = useRef<(() => void)[]>([]);

  // Assigned farms scoping for Supervisor
  const assignedFarmIds = useMemo(() => {
    if (role === 'admin') return undefined;
    return userProfile?.farmIds || [];
  }, [role, userProfile?.farmIds]);

  const startDate = getDaysAgo(days === 1 ? 0 : days - 1);
  const endDate = getIstDate();

  // Load report data based on role scoping
  const allReportsQuery = useAllDailyReports(startDate, endDate);
  const supervisorReportsQuery = useDailyReportsByFarms(assignedFarmIds ?? [], startDate, endDate);

  const rawReports = role === 'admin' ? allReportsQuery.reports : supervisorReportsQuery.reports;
  const reportsLoading = role === 'admin' ? allReportsQuery.loading : supervisorReportsQuery.loading;
  const reportsError = role === 'admin' ? allReportsQuery.error : supervisorReportsQuery.error;

  useEffect(() => {
    setDataLoading(true);
    let initialDataLoaded = false;

    const unsubFarms = subscribeToAllFarms((frms) => {
      let filtered = frms;
      if (role === 'supervisor') {
        const farmSet = new Set(assignedFarmIds || []);
        filtered = frms.filter((f) => farmSet.has(f.farmId));
      }
      setFarms(filtered);

      if (!initialDataLoaded) {
        const activeIds = filtered.filter((f) => f.active !== false).map((f) => f.farmId);
        if (activeIds.length > 0) {
          unsubRefs.current.push(
            subscribeToAllBirdInventories(activeIds, (invMap) => {
              setFarmInventories(invMap);
            })
          );
        }
      }
    });
    unsubRefs.current.push(unsubFarms);

    const unsubUsers = subscribeToAllUsers((usrs) => {
      setUsers(usrs);
      initialDataLoaded = true;
      setDataLoading(false);
    });
    unsubRefs.current.push(unsubUsers);

    const unsubFlocks = subscribeToAllFlocks((flks) => {
      let filtered = flks;
      if (role === 'supervisor') {
        const farmSet = new Set(assignedFarmIds || []);
        filtered = flks.filter((f) => farmSet.has(f.farmId));
      }
      setFlocks(filtered);
    });
    unsubRefs.current.push(unsubFlocks);

    return () => {
      unsubRefs.current.forEach((u) => u());
      unsubRefs.current = [];
    };
  }, [role, assignedFarmIds?.join(',')]);

  const loading = dataLoading || reportsLoading;

  // Filter raw reports by selected farm & flock dropdowns, resolving missing farmIds dynamically
  const reports = useMemo(() => {
    return rawReports.map(r => {
      if (!r.farmId && r.userId) {
        const matchedUser = users.find(u => u.uid === r.userId);
        if (matchedUser && matchedUser.farmIds && matchedUser.farmIds.length > 0) {
          return { ...r, farmId: matchedUser.farmIds[0] };
        }
      }
      return r;
    }).filter((r) => {
      if (!r.farmId) return false;
      if (selectedFarmId && r.farmId !== selectedFarmId) return false;
      if (selectedFlockId && r.flockId !== selectedFlockId) return false;
      return true;
    });
  }, [rawReports, selectedFarmId, selectedFlockId, users]);

  const activeFarms = useMemo(() => farms.filter((f) => f.active !== false), [farms]);
  const expectedFarms = useMemo(() => (selectedFarmId ? 1 : activeFarms.length || farms.length), [selectedFarmId, activeFarms, farms]);

  const farmers = useMemo(() => users.filter((u) => normalizeRole(u.role) === 'farmer' && u.active !== false), [users]);
  const supervisors = useMemo(() => users.filter((u) => normalizeRole(u.role) === 'supervisor'), [users]);

  const today = getIstDate();
  const todayReports = useMemo(() => reports.filter((r) => r.submissionDate === today), [reports, today]);
  const submittedFarmIdsToday = useMemo(() => new Set(todayReports.map((r) => r.farmId)), [todayReports]);

  // Expected Submission Matrix
  const submissionMatrix = useMemo(() => {
    const dateList = generateDateArray(startDate, endDate);
    const targetFarms = selectedFarmId ? activeFarms.filter(f => f.farmId === selectedFarmId) : activeFarms;
    
    const farmAssignments = targetFarms
      .map(farm => {
        const assignedFarmers = farmers.filter(u => u.farmIds?.includes(farm.farmId));
        return { farm, assignedFarmers };
      })
      .filter(({ assignedFarmers }) => assignedFarmers.length > 0); // Only expect submissions from farms with assigned active farmers

    const expected: { date: string; farm: FarmDoc; farmer?: UserDoc }[] = [];
    const submitted: { date: string; farm: FarmDoc; farmer?: UserDoc; report: ReportDoc }[] = [];
    const missing: { date: string; farm: FarmDoc; farmer?: UserDoc }[] = [];

    dateList.forEach(dateStr => {
      farmAssignments.forEach(({ farm, assignedFarmers }) => {
        const primaryFarmer = assignedFarmers.length > 0 ? assignedFarmers[0] : undefined;
        const report = reports.find(r => r.farmId === farm.farmId && r.submissionDate === dateStr);

        expected.push({ date: dateStr, farm, farmer: primaryFarmer });
        if (report) {
          submitted.push({ date: dateStr, farm, farmer: primaryFarmer, report });
        } else {
          missing.push({ date: dateStr, farm, farmer: primaryFarmer });
        }
      });
    });

    return { expected, submitted, missing };
  }, [startDate, endDate, activeFarms, farmers, reports, selectedFarmId]);

  const expectedSubmissionsPeriod = submissionMatrix.expected.length;
  const receivedSubmissionsPeriod = submissionMatrix.submitted.length;
  const missingSubmissionsPeriod = submissionMatrix.missing.length;

  const totalBirdsLive = useMemo(() => {
    return (
      Array.from(farmInventories.values()).reduce((sum, inv) => sum + inv.currentBirdCount, 0) ||
      todayReports.reduce((sum, r) => sum + (r.closingBirdCount || r.birdCount || 0), 0) ||
      reports.reduce((sum, r) => Math.max(sum, r.closingBirdCount || r.birdCount || 0), 0) ||
      farms.reduce((sum, f) => sum + ((f as any).currentBirds || 0), 0)
    );
  }, [farmInventories, todayReports, reports, farms]);

  const avgProd = useMemo(() => {
    if (reports.length === 0) return null;
    return calcAverage(reports.map((r) => {
      const base = r.openingBirdCount || r.birdCount;
      return base > 0 ? calcProductionRate(r.eggsProduced ?? 0, base) : null;
    }));
  }, [reports]);

  const avgMort = useMemo(() => {
    if (reports.length === 0) return null;
    return calcAverage(reports.map((r) => {
      const base = r.openingBirdCount || r.birdCount;
      return base > 0 ? calcMortalityRate(r.mortality ?? 0, base) : null;
    }));
  }, [reports]);

  const totalFeedKg = useMemo(() => reports.reduce((s, r) => s + (r.feedKg ?? 0), 0), [reports]);
  const totalEggs = useMemo(() => reports.reduce((s, r) => s + (r.eggsProduced ?? 0), 0), [reports]);
  const totalMortality = useMemo(() => reports.reduce((s, r) => s + (r.mortality ?? 0), 0), [reports]);
  const totalCulling = useMemo(() => reports.reduce((s, r) => s + (r.culling ?? 0), 0), [reports]);

  const avgFeedPerBirdGrams = useMemo(() => {
    if (reports.length === 0) return null;
    return calcAverage(reports.map((r) => {
      const base = r.openingBirdCount || r.birdCount;
      return base > 0 ? (r.feedKg * 1000) / base : null;
    }));
  }, [reports]);

  // Feed Conversion Ratio (FCR): Kg Feed consumed / Dozen Eggs produced
  const fcrApprox = useMemo(() => {
    const dozen = totalEggs / 12;
    return dozen > 0 ? Number((totalFeedKg / dozen).toFixed(2)) : null;
  }, [totalFeedKg, totalEggs]);

  const avgEggWeight = useMemo(() => {
    if (reports.length === 0) return null;
    return calcAverage(reports.map((r) => r.eggWeight?.avg));
  }, [reports]);

  const avgBodyWeight = useMemo(() => {
    if (reports.length === 0) return null;
    return calcAverage(reports.map((r) => r.bodyWeight?.avg));
  }, [reports]);

  const avgSelectionPct = useMemo(() => {
    if (reports.length === 0) return null;
    return calcAverage(reports.map((r) => calcSelectionRate(r.selectionEggs ?? 0, r.eggsProduced ?? 0)));
  }, [reports]);

  const avgTemp = useMemo(() => {
    if (reports.length === 0) return null;
    return calcAverage(reports.map((r) => r.temperature));
  }, [reports]);

  // Baseline standard curve calculation (averaging across active flock age)
  const avgFlockAgeWeeks = useMemo(() => {
    if (flocks.length === 0) return 30;
    const ages = flocks.map((f) => f.currentAgeWeeks || 30);
    return Math.round(ages.reduce((a, b) => a + b, 0) / ages.length);
  }, [flocks]);

  const targetStdProdPct = useMemo(() => {
    return Number(getStandardProductionAtAge(standardCurveType, avgFlockAgeWeeks).toFixed(1));
  }, [standardCurveType, avgFlockAgeWeeks]);

  const prodVariance = useMemo(() => {
    if (avgProd === null) return null;
    return Number((avgProd - targetStdProdPct).toFixed(1));
  }, [avgProd, targetStdProdPct]);

  // Real-time Operational Alerts Engine
  const alerts = useMemo(() => {
    const list: { id: string; type: 'critical' | 'warning' | 'info'; title: string; desc: string; farmId: string }[] = [];

    // Check missing submissions today for active farms
    activeFarms.forEach((f) => {
      if (!submittedFarmIdsToday.has(f.farmId)) {
        const farmLabel = f.name ? `Farm ${f.farmId} (${f.name})` : `Farm ${f.farmId}`;
        list.push({
          id: `missing_${f.farmId}`,
          type: 'warning',
          title: `Missing Daily Report Today`,
          desc: `${farmLabel} has not submitted a report for ${formatDisplayDate(today)}.`,
          farmId: f.farmId,
        });
      }
    });

    // Check recent high mortality or low production
    todayReports.forEach((r) => {
      const farmObj = activeFarms.find((f) => f.farmId === r.farmId);
      const farmLabel = farmObj?.name ? `Farm ${r.farmId} (${farmObj.name})` : `Farm ${r.farmId || 'Unknown'}`;

      const base = r.openingBirdCount || r.birdCount;
      const mortPct = base > 0 ? calcMortalityRate(r.mortality ?? 0, base) : 0;
      const prodPct = base > 0 ? calcProductionRate(r.eggsProduced ?? 0, base) : 0;
      const selectPct = calcSelectionRate(r.selectionEggs ?? 0, r.eggsProduced ?? 0);

      if (mortPct > 2.0) {
        list.push({
          id: `mort_${r.farmId}`,
          type: 'critical',
          title: `High Daily Mortality Alert`,
          desc: `${farmLabel} recorded ${r.mortality} dead birds (${mortPct}% mortality rate).`,
          farmId: r.farmId,
        });
      }
      if (prodPct < 55.0 && base > 0) {
        list.push({
          id: `prod_${r.farmId}`,
          type: 'critical',
          title: `Low Production Drop Alert`,
          desc: `${farmLabel} production dropped to ${prodPct}% (${r.eggsProduced.toLocaleString()} eggs).`,
          farmId: r.farmId,
        });
      }
      if (selectPct < 80.0 && r.eggsProduced > 0) {
        list.push({
          id: `select_${r.farmId}`,
          type: 'warning',
          title: `Egg Quality / Selection Warning`,
          desc: `${farmLabel} selection egg rate is ${selectPct}% (${r.selectionEggs} selection eggs).`,
          farmId: r.farmId,
        });
      }
      if (r.temperature && (r.temperature > 36 || r.temperature < 18)) {
        list.push({
          id: `temp_${r.farmId}`,
          type: 'warning',
          title: `Abnormal Temperature Warning`,
          desc: `${farmLabel} temperature recorded at ${r.temperature}°C.`,
          farmId: r.farmId,
        });
      }
    });

    return list;
  }, [activeFarms, submittedFarmIdsToday, todayReports, today]);

  // Farm Ranking & Multi-KPI Comparison
  const farmRankings = useMemo(() => {
    return activeFarms.map((farm) => {
      const farmReps = reports.filter((r) => r.farmId === farm.farmId);
      const farmTodayRep = todayReports.find((r) => r.farmId === farm.farmId);
      const liveBirds = farmInventories.get(farm.farmId)?.currentBirdCount || farmTodayRep?.closingBirdCount || (farm as any).currentBirds || 0;

      const pRate = farmReps.length > 0
        ? calcAverage(farmReps.map((r) => { const b = r.openingBirdCount || r.birdCount; return b > 0 ? calcProductionRate(r.eggsProduced ?? 0, b) : null; }))
        : 0;
      const mRate = farmReps.length > 0
        ? calcAverage(farmReps.map((r) => { const b = r.openingBirdCount || r.birdCount; return b > 0 ? calcMortalityRate(r.mortality ?? 0, b) : null; }))
        : 0;
      const fGrams = farmReps.length > 0
        ? calcAverage(farmReps.map((r) => { const b = r.openingBirdCount || r.birdCount; return b > 0 ? (r.feedKg * 1000) / b : null; }))
        : 0;
      const sRate = farmReps.length > 0
        ? calcAverage(farmReps.map((r) => calcSelectionRate(r.selectionEggs ?? 0, r.eggsProduced ?? 0)))
        : 0;
      const compliance = farmReps.length > 0 ? Math.min(100, Math.round((farmReps.length / days) * 100)) : 0;

      const score = calcPerformanceScore({
        productionRate: pRate,
        mortalityRate: mRate,
        feedPerBird: fGrams,
        submissionCompliance: compliance,
      });

      let statusLabel: 'EXCELLENT' | 'HEALTHY' | 'NEEDS ATTENTION' | 'CRITICAL' = 'HEALTHY';
      let statusColor = '#15803d';

      if (score.total >= 80) {
        statusLabel = 'EXCELLENT';
        statusColor = '#15803d';
      } else if (score.total >= 65) {
        statusLabel = 'HEALTHY';
        statusColor = '#059669';
      } else if (score.total >= 50) {
        statusLabel = 'NEEDS ATTENTION';
        statusColor = '#d97706';
      } else {
        statusLabel = 'CRITICAL';
        statusColor = '#dc2626';
      }

      return {
        farmId: farm.farmId,
        name: farm.name || `Farm ${farm.farmId}`,
        liveBirds,
        pRate,
        mRate,
        fGrams,
        sRate,
        compliance,
        score: score.total,
        statusLabel,
        statusColor,
      };
    }).sort((a, b) => b.score - a.score);
  }, [activeFarms, reports, todayReports, farmInventories, days]);

  // Contiguous Time Series Chart Data for Recharts
  const chartData = useMemo(() => {
    const dateList = generateDateArray(startDate, endDate);
    const byDate = new Map<string, ReportDoc[]>();
    reports.forEach((r) => {
      if (!byDate.has(r.submissionDate)) byDate.set(r.submissionDate, []);
      byDate.get(r.submissionDate)!.push(r);
    });

    return dateList.map((dStr, idx) => {
      const dayReports = byDate.get(dStr) || [];
      const submitted = submissionMatrix.submitted.filter(s => s.date === dStr).length;
      const missing = submissionMatrix.missing.filter(m => m.date === dStr).length;

      const prod = dayReports.length > 0
        ? calcAverage(dayReports.map((r) => { const b = r.openingBirdCount || r.birdCount; return b > 0 ? calcProductionRate(r.eggsProduced ?? 0, b) : null; }))
        : null;

      const mort = dayReports.length > 0
        ? calcAverage(dayReports.map((r) => { const b = r.openingBirdCount || r.birdCount; return b > 0 ? calcMortalityRate(r.mortality ?? 0, b) : null; }))
        : null;

      const cullingCount = dayReports.reduce((s, r) => s + (r.culling ?? 0), 0);
      const mortalityCount = dayReports.reduce((s, r) => s + (r.mortality ?? 0), 0);
      const feedKg = dayReports.reduce((s, r) => s + (r.feedKg ?? 0), 0);

      const feedPerBirdG = dayReports.length > 0
        ? calcAverage(dayReports.map((r) => { const b = r.openingBirdCount || r.birdCount; return b > 0 ? (r.feedKg * 1000) / b : null; }))
        : null;

      const eggWtMin = dayReports.length > 0 ? calcAverage(dayReports.map((r) => r.eggWeight?.min)) : null;
      const eggWtMax = dayReports.length > 0 ? calcAverage(dayReports.map((r) => r.eggWeight?.max)) : null;
      const eggWtAvg = dayReports.length > 0 ? calcAverage(dayReports.map((r) => r.eggWeight?.avg)) : null;

      const bodyWtMin = dayReports.length > 0 ? calcAverage(dayReports.map((r) => r.bodyWeight?.min)) : null;
      const bodyWtMax = dayReports.length > 0 ? calcAverage(dayReports.map((r) => r.bodyWeight?.max)) : null;
      const bodyWtAvg = dayReports.length > 0 ? calcAverage(dayReports.map((r) => r.bodyWeight?.avg)) : null;

      const selectionPct = dayReports.length > 0
        ? calcAverage(dayReports.map((r) => calcSelectionRate(r.selectionEggs ?? 0, r.eggsProduced ?? 0)))
        : null;

      const tempMin = dayReports.length > 0 ? calcAverage(dayReports.map((r) => r.tempMin ?? r.temperature)) : null;
      const tempMax = dayReports.length > 0 ? calcAverage(dayReports.map((r) => r.tempMax ?? r.temperature)) : null;
      const tempAvg = dayReports.length > 0 ? calcAverage(dayReports.map((r) => r.temperature)) : null;

      // Estimated standard curve point for date index
      const stdProd = Number(getStandardProductionAtAge(standardCurveType, avgFlockAgeWeeks + Math.floor(idx / 7)).toFixed(1));

      return {
        fullDate: dStr,
        date: getShortDate(dStr),
        production: prod !== null ? Number(prod.toFixed(1)) : null,
        standardProduction: stdProd,
        mortality: mort !== null ? Number(mort.toFixed(1)) : null,
        mortalityCount,
        cullingCount,
        submitted,
        missing,
        feedKg: Number(feedKg.toFixed(1)),
        feedPerBirdG: feedPerBirdG !== null ? Number(feedPerBirdG.toFixed(1)) : null,
        eggWtMin: eggWtMin !== 0 ? eggWtMin : null,
        eggWtMax: eggWtMax !== 0 ? eggWtMax : null,
        eggWtAvg: eggWtAvg !== 0 ? eggWtAvg : null,
        bodyWtMin: bodyWtMin !== 0 ? bodyWtMin : null,
        bodyWtMax: bodyWtMax !== 0 ? bodyWtMax : null,
        bodyWtAvg: bodyWtAvg !== 0 ? bodyWtAvg : null,
        selectionPct: selectionPct !== null ? Number(selectionPct.toFixed(1)) : null,
        tempMin: tempMin !== 0 ? tempMin : null,
        tempMax: tempMax !== 0 ? tempMax : null,
        tempAvg: tempAvg !== 0 ? tempAvg : null,
      };
    });
  }, [startDate, endDate, reports, expectedFarms, standardCurveType, avgFlockAgeWeeks, submissionMatrix]);

  if (loading) return <LoadingState />;

  return (
    <div className="enterprise-dashboard">
      {reportsError && (
        <div className="alert alert--error" style={{ marginBottom: 16 }}>
          <AlertTriangle size={16} />
          <span>{reportsError}</span>
        </div>
      )}

      {/* CLEAN APP PAGE HEADER & GLOBAL FILTERS */}
      <div className="mgmt-page-header">
        <div>
          <h2>{role === 'admin' ? 'Admin Overview' : 'Supervisor Overview'}</h2>
          <p className="welcome-subtitle">Real-time farm operations and performance analytics</p>
        </div>

        <div className="mgmt-header-actions">
          <select
            className="form-input form-input--sm mgmt-filter-select"
            value={selectedFarmId}
            onChange={(e) => {
              setSelectedFarmId(e.target.value);
              setSelectedFlockId('');
            }}
          >
            <option value="">All Farms ({farms.length})</option>
            {farms.map((f) => (
              <option key={f.farmId} value={f.farmId}>{f.name ? `Farm ${f.farmId} (${f.name})` : `Farm ${f.farmId}`}</option>
            ))}
          </select>

          <select
            className="form-input form-input--sm mgmt-filter-select"
            value={selectedFlockId}
            onChange={(e) => setSelectedFlockId(e.target.value)}
          >
            <option value="">All Flocks ({flocks.length})</option>
            {flocks
              .filter((fl) => !selectedFarmId || fl.farmId === selectedFarmId)
              .map((fl) => (
                <option key={fl.flockId} value={fl.flockId}>{fl.flockName}</option>
              ))}
          </select>

          <DateFilter days={days} onChange={setDays} />
        </div>
      </div>

      {/* EXPORT DAILY REPORTS CARD FOR ADMIN ONLY */}
      {role === 'admin' && <ExportReportsCard />}

      {/* LEVEL 1: EXECUTIVE KPI SUMMARY GRID */}
      {(variant === 'overview' || variant === 'full') && (
        <>
          <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: 20 }}>
            <KpiCard
              title="Total Bird Population"
              value={totalBirdsLive.toLocaleString()}
              icon={<Layers size={20} />}
              onClick={() => setExpandedMetric({ type: 'birds', title: 'Total Bird Population', sub: 'Current live bird inventory and net change' })}
            />
            <KpiCard
              title="Avg Egg Production %"
              value={avgProd !== null ? `${avgProd}%` : '--'}
              icon={<Activity size={20} />}
              color={avgProd !== null && avgProd >= 70 ? '#15803d' : '#d97706'}
              onClick={() => setExpandedMetric({ type: 'production', title: 'Avg Egg Production %', sub: 'Calculated production rate against standard target' })}
            />
            <KpiCard
              title="Avg Mortality %"
              value={avgMort !== null ? `${avgMort}%` : '--'}
              icon={<HeartPulse size={20} />}
              color={avgMort !== null && avgMort > 2.0 ? '#dc2626' : '#15803d'}
              onClick={() => setExpandedMetric({ type: 'mortality', title: 'Avg Mortality %', sub: 'Daily mortality rate and culling counts' })}
            />
            <KpiCard
              title="Avg Feed / Bird"
              value={avgFeedPerBirdGrams !== null ? `${avgFeedPerBirdGrams.toFixed(0)} g/day` : '--'}
              icon={<Package size={20} />}
              onClick={() => setExpandedMetric({ type: 'feed', title: 'Avg Feed / Bird', sub: 'Daily feed consumption per bird in grams' })}
            />
            <KpiCard
              title="Avg Egg Weight"
              value={avgEggWeight !== null ? `${avgEggWeight.toFixed(1)} g` : '--'}
              icon={<Egg size={20} />}
              onClick={() => setExpandedMetric({ type: 'eggQuality', title: 'Avg Egg Weight', sub: 'Average sampled egg weight and selection percentage' })}
            />
            <KpiCard
              title="TOTAL SUBMISSION RATIO"
              value={`${receivedSubmissionsPeriod} / ${expectedSubmissionsPeriod}`}
              icon={<CheckCircle2 size={20} />}
              color={missingSubmissionsPeriod === 0 ? '#15803d' : '#d97706'}
              onClick={() => setExpandedMetric({ type: 'submission', title: 'Total Submission Ratio', sub: 'Submitted daily reports vs expected reports for active farms' })}
            />
          </div>

          {/* LEVEL 2: OPERATIONAL ALERTS & ATTENTION REQUIRED */}
          {alerts.length > 0 && (
            <div className="section-card" style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 16, color: '#1e293b' }}>
                  <ShieldAlert size={18} style={{ color: '#dc2626' }} />
                  Operational Alerts ({alerts.length})
                </h3>
              </div>
              <div className="ent-alerts-grid">
                {alerts.slice(0, 4).map((a) => (
                  <div 
                    key={a.id} 
                    className={`ent-alert-card ent-alert-card--${a.type} ${a.id.startsWith('missing_') ? 'ent-alert-card--clickable' : ''}`}
                    onClick={a.id.startsWith('missing_') ? () => setExpandedMetric({ type: 'submission', title: 'Missing Submission Details', sub: 'Review expected report paths and assignment details' }) : undefined}
                    style={{ cursor: a.id.startsWith('missing_') ? 'pointer' : 'default' }}
                  >
                    <div className="ent-alert-top">
                      <span className="ent-alert-title">{a.title}</span>
                    </div>
                    <p className="ent-alert-desc">{a.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* LEVEL 3: FARM PERFORMANCE RANKING & COMPARISON TABLE */}
          <div className="section-card" style={{ marginBottom: 24 }}>
            <div className="ent-card-header">
              <div>
                <h3>Farm Performance Comparison</h3>
                <p className="ent-card-sub">Ranked operational performance for the selected period</p>
              </div>
              <div className="ent-legend-bar">
                <span className="ent-status-tag" style={{ background: '#dcfce7', color: '#15803d' }}>EXCELLENT</span>
                <span className="ent-status-tag" style={{ background: '#ecfdf5', color: '#059669' }}>HEALTHY</span>
                <span className="ent-status-tag" style={{ background: '#fffbeb', color: '#d97706' }}>NEEDS ATTENTION</span>
                <span className="ent-status-tag" style={{ background: '#fef2f2', color: '#dc2626' }}>CRITICAL</span>
              </div>
            </div>

            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Farm ID</th>
                    <th>Name</th>
                    <th>Birds</th>
                    <th>Avg Production %</th>
                    <th>Avg Mortality %</th>
                    <th>Avg Feed (g/bird)</th>
                    <th>Selection %</th>
                    <th>Compliance %</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {farmRankings.map((fr, i) => (
                    <tr key={fr.farmId}>
                      <td style={{ fontWeight: 700, color: i === 0 ? '#d97706' : '#64748b' }}>#{i + 1}</td>
                      <td className="td-bold">{fr.farmId}</td>
                      <td>{fr.name}</td>
                      <td>{fr.liveBirds.toLocaleString()}</td>
                      <td style={{ fontWeight: 600, color: fr.pRate >= 70 ? '#15803d' : '#d97706' }}>{fr.pRate}%</td>
                      <td style={{ color: fr.mRate > 2.0 ? '#dc2626' : '#15803d' }}>{fr.mRate}%</td>
                      <td>{fr.fGrams > 0 ? `${fr.fGrams.toFixed(0)} g` : '--'}</td>
                      <td>{fr.sRate > 0 ? `${fr.sRate}%` : '--'}</td>
                      <td>{fr.compliance}%</td>
                      <td>
                        <span className="ent-status-tag" style={{ background: `${fr.statusColor}15`, color: fr.statusColor, border: `1px solid ${fr.statusColor}40` }}>
                          {fr.statusLabel}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {farmRankings.length === 0 && (
                    <tr>
                      <td colSpan={10} style={{ textAlign: 'center', color: '#94a3b8', padding: '1.5rem' }}>
                        No farm ranking data available for the selected period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* LEVEL 4: MULTI-DIMENSIONAL RECHARTS ANALYTICS GRID */}
      {(variant === 'analytics' || variant === 'full') && (
        <div className="ent-charts-grid">
        {/* GRAPH 1: PRODUCTION TREND VS STANDARD BASELINE */}
        <div
          className="ent-chart-card ent-chart-card--clickable"
          onClick={() => setExpandedMetric({
            type: 'production',
            title: 'Egg Production Trend vs Standard Target',
            sub: `Comparing actual egg production rate against ${standardCurveType.replace('_', ' ')} standard breeder curve`,
          })}
        >
          <div className="ent-chart-header">
            <div>
              <h3>Egg Production Trend vs Standard Target</h3>
              <p className="ent-chart-sub">Comparing actual production against {standardCurveType.replace('_', ' ')} standard curve baseline</p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
              <select
                className="form-input form-input--sm"
                value={standardCurveType}
                onChange={(e) => setStandardCurveType(e.target.value as any)}
              >
                <option value="CF_STD">CF STD (Cobb)</option>
                <option value="FR_STD">FR STD (Ross)</option>
              </select>
              <Maximize2 size={16} className="ent-expand-icon" />
            </div>
          </div>
          {prodVariance !== null && (
            <div className="ent-insight-bar" style={{ background: prodVariance >= 0 ? '#f0fdf4' : '#fffbeb', borderColor: prodVariance >= 0 ? '#bbf7d0' : '#fde68a' }}>
              <span>Target Baseline: <strong>{targetStdProdPct}%</strong></span>
              <span>Actual Avg: <strong>{avgProd}%</strong></span>
              <span style={{ color: prodVariance >= 0 ? '#15803d' : '#d97706', fontWeight: 600 }}>
                Variance: {prodVariance >= 0 ? `+${prodVariance}%` : `${prodVariance}%`}
              </span>
            </div>
          )}
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" />
              <Tooltip formatter={(value: any) => `${value}%`} />
              <Legend />
              <Line type="monotone" dataKey="production" stroke="#10b981" strokeWidth={2.5} name="Actual Production %" dot={{ r: 4 }} connectNulls />
              <Line type="monotone" dataKey="standardProduction" stroke="#64748b" strokeWidth={1.5} strokeDasharray="5 5" name="Standard Target %" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* GRAPH 2: HEALTH & MORTALITY ANALYTICS */}
        <div
          className="ent-chart-card ent-chart-card--clickable"
          onClick={() => setExpandedMetric({
            type: 'mortality',
            title: 'Mortality & Culling Tracking',
            sub: 'Daily dead bird count, culling count, and mortality % rate',
          })}
        >
          <div className="ent-chart-header">
            <div>
              <h3>Mortality & Culling Tracking</h3>
              <p className="ent-chart-sub">Daily dead bird count, culling count, and mortality % rate</p>
            </div>
            <Maximize2 size={16} className="ent-expand-icon" />
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} unit="%" />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="mortalityCount" fill="#ef4444" name="Mortality Count" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="left" dataKey="cullingCount" fill="#f59e0b" name="Culling Count" radius={[4, 4, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="mortality" stroke="#b91c1c" strokeWidth={2} name="Mortality Rate %" dot={{ r: 3 }} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* GRAPH 3: FEED CONSUMPTION & EFFICIENCY */}
        <div
          className="ent-chart-card ent-chart-card--clickable"
          onClick={() => setExpandedMetric({
            type: 'feed',
            title: 'Feed Consumption & Intake per Bird',
            sub: 'Daily feed consumed (Kg) and per-bird daily intake (Grams/bird/day)',
          })}
        >
          <div className="ent-chart-header">
            <div>
              <h3>Feed Consumption & Intake per Bird</h3>
              <p className="ent-chart-sub">Daily feed consumed (Kg) and per-bird daily intake (Grams/bird/day)</p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {fcrApprox !== null && (
                <div className="ent-stat-badge">
                  <span>Est. FCR: <strong>{fcrApprox} Kg/Doz</strong></span>
                </div>
              )}
              <Maximize2 size={16} className="ent-expand-icon" />
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 12 }} unit=" Kg" />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} unit=" g" />
              <Tooltip />
              <Legend />
              <Area yAxisId="left" type="monotone" dataKey="feedKg" stroke="#d97706" fill="#fef3c7" name="Total Feed (Kg)" />
              <Line yAxisId="right" type="monotone" dataKey="feedPerBirdG" stroke="#059669" strokeWidth={2} name="Feed / Bird (g)" dot={{ r: 3 }} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* GRAPH 4: EGG QUALITY & WEIGHT METRICS */}
        <div
          className="ent-chart-card ent-chart-card--clickable"
          onClick={() => setExpandedMetric({
            type: 'eggQuality',
            title: 'Egg Weight & Selection Quality',
            sub: 'Min, Max, Avg egg weights (g) and selection egg percentage',
          })}
        >
          <div className="ent-chart-header">
            <div>
              <h3>Egg Weight & Selection Quality</h3>
              <p className="ent-chart-sub">Min, Max, Avg egg weights (g) and selection egg percentage</p>
            </div>
            <Maximize2 size={16} className="ent-expand-icon" />
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="left" domain={[40, 80]} tick={{ fontSize: 12 }} unit=" g" />
              <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" />
              <Tooltip />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="eggWtAvg" stroke="#0284c7" strokeWidth={2} name="Avg Egg Wt (g)" dot={{ r: 3 }} connectNulls />
              <Line yAxisId="left" type="monotone" dataKey="eggWtMin" stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 3" name="Min Egg Wt" connectNulls />
              <Line yAxisId="left" type="monotone" dataKey="eggWtMax" stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 3" name="Max Egg Wt" connectNulls />
              <Line yAxisId="right" type="monotone" dataKey="selectionPct" stroke="#16a34a" strokeWidth={2} name="Selection %" dot={{ r: 3 }} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* GRAPH 5: BODY WEIGHT GROWTH CURVE */}
        <div
          className="ent-chart-card ent-chart-card--clickable"
          onClick={() => setExpandedMetric({
            type: 'bodyWeight',
            title: 'Flock Body Weight Progression',
            sub: 'Minimum, maximum, and average bird body weight (g)',
          })}
        >
          <div className="ent-chart-header">
            <div>
              <h3>Flock Body Weight Progression</h3>
              <p className="ent-chart-sub">Minimum, maximum, and average bird body weight (g)</p>
            </div>
            <Maximize2 size={16} className="ent-expand-icon" />
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} unit=" g" />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="bodyWtAvg" stroke="#8b5cf6" strokeWidth={2.5} name="Avg Body Wt (g)" dot={{ r: 4 }} connectNulls />
              <Line type="monotone" dataKey="bodyWtMin" stroke="#cbd5e1" strokeWidth={1} strokeDasharray="3 3" name="Min Body Wt" connectNulls />
              <Line type="monotone" dataKey="bodyWtMax" stroke="#cbd5e1" strokeWidth={1} strokeDasharray="3 3" name="Max Body Wt" connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* GRAPH 6: ENVIRONMENTAL TEMPERATURE MONITORING */}
        <div
          className="ent-chart-card ent-chart-card--clickable"
          onClick={() => setExpandedMetric({
            type: 'temperature',
            title: 'Environmental Temperature Monitoring',
            sub: 'Daily temperature range (°C) with acceptable limits (18°C – 30°C)',
          })}
        >
          <div className="ent-chart-header">
            <div>
              <h3>Environmental Temperature Monitoring</h3>
              <p className="ent-chart-sub">Daily temperature range (°C) with acceptable limits (18°C – 30°C)</p>
            </div>
            <Maximize2 size={16} className="ent-expand-icon" />
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis domain={[10, 45]} tick={{ fontSize: 12 }} unit="°C" />
              <Tooltip />
              <Legend />
              <ReferenceLine y={30} stroke="#dc2626" strokeDasharray="3 3" label={{ value: 'Max Comfort (30°C)', fill: '#dc2626', fontSize: 10 }} />
              <ReferenceLine y={18} stroke="#0284c7" strokeDasharray="3 3" label={{ value: 'Min Comfort (18°C)', fill: '#0284c7', fontSize: 10 }} />
              <Area type="monotone" dataKey="tempMax" stroke="#f59e0b" fill="#fef3c7" name="Max Temp (°C)" />
              <Line type="monotone" dataKey="tempAvg" stroke="#ea580c" strokeWidth={2} name="Avg Temp (°C)" dot={{ r: 3 }} connectNulls />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* GRAPH 7: SUBMISSION COMPLIANCE TIMELINE */}
        <div
          className="ent-chart-card ent-chart-card--clickable"
          style={{ gridColumn: '1 / -1' }}
          onClick={() => setExpandedMetric({
            type: 'submission',
            title: 'Daily Report Submission Compliance Timeline',
            sub: 'Daily breakdown of submitted vs missing reports for all active farms over selected period',
          })}
        >
          <div className="ent-chart-header">
            <div>
              <h3>Daily Report Submission Compliance Timeline</h3>
              <p className="ent-chart-sub">Daily breakdown of submitted vs missing reports for all active farms over selected period</p>
            </div>
            <Maximize2 size={16} className="ent-expand-icon" />
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="submitted" fill="#10b981" name="Submitted Reports" radius={[4, 4, 0, 0]} />
              <Bar dataKey="missing" fill="#fca5a5" name="Missing Reports" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      )}

      {/* UNIFIED METRIC & CHART DRILL-DOWN MODAL */}
      {expandedMetric && (
        <DashboardMetricDetailModal
          isOpen={Boolean(expandedMetric)}
          onClose={() => setExpandedMetric(null)}
          metricType={expandedMetric.type}
          title={expandedMetric.title}
          subtitle={expandedMetric.sub}
          chartData={chartData}
          days={days}
          farmFilter={selectedFarmId}
          flockFilter={selectedFlockId}
          activeFarms={activeFarms}
          farmInventories={farmInventories}
          reports={reports}
          submissionMatrix={submissionMatrix}
          standardCurveType={standardCurveType}
          onStandardCurveChange={setStandardCurveType}
          renderChartContent={() => {
            switch (expandedMetric.type) {
              case 'production':
                return (
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" />
                      <Tooltip formatter={(value: any) => `${value}%`} />
                      <Legend />
                      <Line type="monotone" dataKey="production" stroke="#10b981" strokeWidth={3} name="Actual Production %" dot={{ r: 5 }} connectNulls />
                      <Line type="monotone" dataKey="standardProduction" stroke="#64748b" strokeWidth={2} strokeDasharray="5 5" name="Standard Target %" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                );

              case 'mortality':
                return (
                  <ResponsiveContainer width="100%" height={400}>
                    <ComposedChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} unit="%" />
                      <Tooltip />
                      <Legend />
                      <Bar yAxisId="left" dataKey="mortalityCount" fill="#ef4444" name="Mortality Count" radius={[4, 4, 0, 0]} />
                      <Bar yAxisId="left" dataKey="cullingCount" fill="#f59e0b" name="Culling Count" radius={[4, 4, 0, 0]} />
                      <Line yAxisId="right" type="monotone" dataKey="mortality" stroke="#b91c1c" strokeWidth={2.5} name="Mortality Rate %" dot={{ r: 4 }} connectNulls />
                    </ComposedChart>
                  </ResponsiveContainer>
                );

              case 'feed':
                return (
                  <ResponsiveContainer width="100%" height={400}>
                    <ComposedChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 12 }} unit=" Kg" />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} unit=" g" />
                      <Tooltip />
                      <Legend />
                      <Area yAxisId="left" type="monotone" dataKey="feedKg" stroke="#d97706" fill="#fef3c7" name="Total Feed (Kg)" />
                      <Line yAxisId="right" type="monotone" dataKey="feedPerBirdG" stroke="#059669" strokeWidth={2.5} name="Feed / Bird (g)" dot={{ r: 4 }} connectNulls />
                    </ComposedChart>
                  </ResponsiveContainer>
                );

              case 'eggQuality':
                return (
                  <ResponsiveContainer width="100%" height={400}>
                    <ComposedChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis yAxisId="left" domain={[40, 80]} tick={{ fontSize: 12 }} unit=" g" />
                      <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" />
                      <Tooltip />
                      <Legend />
                      <Line yAxisId="left" type="monotone" dataKey="eggWtAvg" stroke="#0284c7" strokeWidth={2.5} name="Avg Egg Wt (g)" dot={{ r: 4 }} connectNulls />
                      <Line yAxisId="left" type="monotone" dataKey="eggWtMin" stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 3" name="Min Egg Wt" connectNulls />
                      <Line yAxisId="left" type="monotone" dataKey="eggWtMax" stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 3" name="Max Egg Wt" connectNulls />
                      <Line yAxisId="right" type="monotone" dataKey="selectionPct" stroke="#16a34a" strokeWidth={2.5} name="Selection %" dot={{ r: 4 }} connectNulls />
                    </ComposedChart>
                  </ResponsiveContainer>
                );

              case 'bodyWeight':
                return (
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} unit=" g" />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="bodyWtAvg" stroke="#8b5cf6" strokeWidth={3} name="Avg Body Wt (g)" dot={{ r: 5 }} connectNulls />
                      <Line type="monotone" dataKey="bodyWtMin" stroke="#cbd5e1" strokeWidth={1.5} strokeDasharray="3 3" name="Min Body Wt" connectNulls />
                      <Line type="monotone" dataKey="bodyWtMax" stroke="#cbd5e1" strokeWidth={1.5} strokeDasharray="3 3" name="Max Body Wt" connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                );

              case 'temperature':
                return (
                  <ResponsiveContainer width="100%" height={400}>
                    <AreaChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis domain={[10, 45]} tick={{ fontSize: 12 }} unit="°C" />
                      <Tooltip />
                      <Legend />
                      <ReferenceLine y={30} stroke="#dc2626" strokeDasharray="3 3" label={{ value: 'Max Comfort (30°C)', fill: '#dc2626', fontSize: 12 }} />
                      <ReferenceLine y={18} stroke="#0284c7" strokeDasharray="3 3" label={{ value: 'Min Comfort (18°C)', fill: '#0284c7', fontSize: 12 }} />
                      <Area type="monotone" dataKey="tempMax" stroke="#f59e0b" fill="#fef3c7" name="Max Temp (°C)" />
                      <Line type="monotone" dataKey="tempAvg" stroke="#ea580c" strokeWidth={2.5} name="Avg Temp (°C)" dot={{ r: 4 }} connectNulls />
                    </AreaChart>
                  </ResponsiveContainer>
                );

              case 'submission':
                return (
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="submitted" fill="#10b981" name="Submitted Reports" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="missing" fill="#fca5a5" name="Missing Reports" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                );

              default:
                return null;
            }
          }}
        />
      )}
    </div>
  );
}
