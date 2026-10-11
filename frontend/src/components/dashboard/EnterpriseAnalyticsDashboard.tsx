import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { KpiCard } from './KpiCard';
import { LoadingState } from './LoadingState';
import { EmptyState } from './EmptyState';
import { DateFilter } from './DateFilter';
import { type ReportDoc } from '../../services/reportDataService';
import { type FarmDoc, subscribeToFarms } from '../../services/farmDataService';
import { type UserDoc, subscribeToAllUsers } from '../../services/userDataService';
import { type BirdInventory, subscribeToAllBirdInventories } from '../../services/inventoryService';
import { type FlockDoc, subscribeToAllFlocks } from '../../services/flockDataService';
import { DashboardMetricDetailModal } from './DashboardMetricDetailModal';
import { ExportReportsCard } from './ExportReportsCard';
import { NotificationBell } from './NotificationBell';
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
  evaluateFarmHealth,
  getEligibleBirdCount,
  calcTotalBirdPopulation,
} from '../../utils/kpiCalculations';
import { KPI_THRESHOLDS } from '../../config/kpiThresholds';
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

function FeedChartCustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '10px 14px',
        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.08)',
        fontSize: '12px',
        minWidth: '220px',
        pointerEvents: 'none',
      }}
    >
      <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '8px', borderBottom: '1px solid #f1f5f9', paddingBottom: '4px' }}>
        {data.fullDate ? formatDisplayDate(data.fullDate) : label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#7c3aed', display: 'inline-block' }} />
            Actual Egg Production:
          </span>
          <strong style={{ color: '#7c3aed' }}>
            {data.production !== null && data.production !== undefined ? `${data.production}%` : 'No Data'}
          </strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#0d9488', display: 'inline-block' }} />
            Feed per Bird:
          </span>
          <strong style={{ color: '#0d9488' }}>
            {data.feedPerBirdG !== null && data.feedPerBirdG !== undefined ? `${data.feedPerBirdG.toFixed(0)} g/day` : 'No Data'}
          </strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563eb', display: 'inline-block' }} />
            Total Feed:
          </span>
          <strong style={{ color: '#2563eb' }}>
            {data.feedKg !== null && data.feedKg !== undefined ? `${data.feedKg.toLocaleString()} kg` : 'No Data'}
          </strong>
        </div>
      </div>
    </div>
  );
}

function TemperatureChartCustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0]?.payload;
  if (!data) return null;

  const temp = data.tempAvg;
  let statusText = 'Comfortable (18°C – 30°C)';
  let statusColor = '#15803d';
  let statusBg = '#dcfce7';

  if (temp !== null && temp !== undefined) {
    if (temp > 34) {
      statusText = 'Extreme Heat (> 34°C)';
      statusColor = '#dc2626';
      statusBg = '#fee2e2';
    } else if (temp > 30) {
      statusText = 'Warm Spikes (30°C – 34°C)';
      statusColor = '#d97706';
      statusBg = '#fef3c7';
    } else if (temp < 18) {
      statusText = 'Cold Drop (< 18°C)';
      statusColor = '#0284c7';
      statusBg = '#e0f2fe';
    }
  }

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '10px 14px',
        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.08)',
        fontSize: '12px',
        minWidth: '230px',
        pointerEvents: 'none',
      }}
    >
      <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '8px', borderBottom: '1px solid #f1f5f9', paddingBottom: '4px' }}>
        {data.fullDate ? formatDisplayDate(data.fullDate) : label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#7c3aed', display: 'inline-block' }} />
            Actual Egg Production:
          </span>
          <strong style={{ color: '#7c3aed' }}>
            {data.production !== null && data.production !== undefined ? `${data.production}%` : 'No Data'}
          </strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ea580c', display: 'inline-block' }} />
            Average Temp:
          </span>
          <strong style={{ color: '#ea580c' }}>
            {data.tempAvg !== null && data.tempAvg !== undefined ? `${data.tempAvg.toFixed(1)}°C` : 'No Data'}
          </strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
            Maximum Temp:
          </span>
          <strong style={{ color: '#f59e0b' }}>
            {data.tempMax !== null && data.tempMax !== undefined ? `${data.tempMax.toFixed(1)}°C` : 'No Data'}
          </strong>
        </div>
        <div style={{ marginTop: '4px', paddingTop: '6px', borderTop: '1px dashed #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: '#64748b' }}>Comfort Range:</span>
          {temp !== null && temp !== undefined ? (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: statusColor,
                background: statusBg,
                padding: '2px 6px',
                borderRadius: '4px',
              }}
            >
              {statusText}
            </span>
          ) : (
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>18°C – 30°C</span>
          )}
        </div>
      </div>
    </div>
  );
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

  // Mobile viewport tracker for responsive modal charts
  const [isMobileScreen, setIsMobileScreen] = useState(() => {
    return typeof window !== 'undefined' ? (window.innerWidth <= 768 || window.innerHeight <= 550) : false;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobileScreen(window.innerWidth <= 768 || window.innerHeight <= 550);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getModalChartHeight = (type: ChartType): number => {
    if (!isMobileScreen) return 400;
    switch (type) {
      case 'submission':
        return 200; // simple bar chart: ~190-220px
      case 'temperature':
        return 210; // area/line chart: ~190-230px
      case 'production':
      case 'bodyWeight':
        return 215; // line chart: ~190-230px
      case 'mortality':
      case 'feed':
      case 'eggQuality':
        return 230; // dual axes charts: ~210-240px
      default:
        return 215;
    }
  };

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

    const unsubFarms = subscribeToFarms(role === 'supervisor' ? assignedFarmIds : undefined, (frms) => {
      setFarms(frms);

      if (!initialDataLoaded) {
        const activeIds = frms.filter((f) => f.active !== false).map((f) => f.farmId);
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
      if (role !== 'supervisor' && variant !== 'overview' && selectedFlockId && r.flockId !== selectedFlockId) return false;
      return true;
    });
  }, [rawReports, selectedFarmId, selectedFlockId, users, variant, role]);

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
    return calcTotalBirdPopulation({
      selectedFarmId,
      farms,
      farmInventories,
      todayReports,
      historicalReports: rawReports,
    });
  }, [selectedFarmId, farms, farmInventories, todayReports, rawReports]);

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



  // Farm Ranking & Multi-KPI Comparison
  const farmRankings = useMemo(() => {
    return activeFarms.map((farm) => {
      const farmReps = reports.filter((r) => r.farmId === farm.farmId);
      const farmTodayRep = todayReports.find((r) => r.farmId === farm.farmId);
      const liveBirds = farmInventories.get(farm.farmId)?.currentBirdCount || farmTodayRep?.closingBirdCount || (farm as any).currentBirds || 0;

      const health = evaluateFarmHealth({
        reports: farmReps,
        days,
        liveBirds,
      });

      return {
        farmId: farm.farmId,
        name: farm.name || `Farm ${farm.farmId}`,
        liveBirds,
        pRate: health.productionRate,
        mRate: health.mortalityRate,
        fGrams: health.feedGramsPerBird,
        sRate: health.selectionRate,
        compliance: health.compliance,
        score: health.score,
        statusLabel: health.statusLabel,
        statusColor: health.statusColor,
        isCritical: health.isCritical,
        isInvalid: health.isInvalid,
        hasTotalFlockLoss: health.hasTotalFlockLoss,
        reason: health.reason,
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
      const feedKg = dayReports.length > 0
        ? dayReports.reduce((s, r) => s + (r.feedKg ?? 0), 0)
        : null;

      const feedPerBirdG = dayReports.length > 0
        ? calcAverage(dayReports.map((r) => { const b = r.openingBirdCount || r.birdCount; return b > 0 ? (r.feedKg * 1000) / b : null; }))
        : null;

      const eggWtMin = dayReports.length > 0 ? calcAverage(dayReports.map((r) => r.eggWeight?.min)) : null;
      const eggWtMax = dayReports.length > 0 ? calcAverage(dayReports.map((r) => r.eggWeight?.max)) : null;
      const eggWtAvg = dayReports.length > 0 ? calcAverage(dayReports.map((r) => r.eggWeight?.avg)) : null;

      const bodyWtMin = dayReports.length > 0 ? calcAverage(dayReports.map((r) => r.bodyWeight?.min)) : null;
      const bodyWtMax = dayReports.length > 0 ? calcAverage(dayReports.map((r) => r.bodyWeight?.max)) : null;
      const bodyWtAvg = dayReports.length > 0 ? calcAverage(dayReports.map((r) => r.bodyWeight?.avg)) : null;

      const selectionCount = dayReports.reduce((s, r) => s + (Number(r.selectionEggs) || 0), 0);
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
        feedKg: feedKg !== null ? Number(feedKg.toFixed(1)) : null,
        feedPerBirdG: feedPerBirdG !== null ? Number(feedPerBirdG.toFixed(1)) : null,
        eggWtMin: eggWtMin !== 0 && eggWtMin !== null ? Number(eggWtMin.toFixed(1)) : null,
        eggWtMax: eggWtMax !== 0 && eggWtMax !== null ? Number(eggWtMax.toFixed(1)) : null,
        eggWtAvg: eggWtAvg !== 0 && eggWtAvg !== null ? Number(eggWtAvg.toFixed(1)) : null,
        bodyWtMin: bodyWtMin !== 0 && bodyWtMin !== null ? Number(bodyWtMin.toFixed(0)) : null,
        bodyWtMax: bodyWtMax !== 0 && bodyWtMax !== null ? Number(bodyWtMax.toFixed(0)) : null,
        bodyWtAvg: bodyWtAvg !== 0 && bodyWtAvg !== null ? Number(bodyWtAvg.toFixed(0)) : null,
        selectionCount,
        selectionPct: selectionPct !== null ? Number(selectionPct.toFixed(1)) : null,
        tempMin: tempMin !== null ? Number(tempMin.toFixed(1)) : null,
        tempMax: tempMax !== null ? Number(tempMax.toFixed(1)) : null,
        tempAvg: tempAvg !== null ? Number(tempAvg.toFixed(1)) : null,
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
          <h2>
            {variant === 'analytics'
              ? (role === 'admin' ? 'Admin Analytics' : 'Supervisor Analytics')
              : (role === 'admin' ? 'Admin Overview' : 'Supervisor Overview')}
          </h2>
          <p className="welcome-subtitle">
            {variant === 'analytics'
              ? 'Deep-dive operational metrics, trends, and performance analytics'
              : 'Real-time farm operations and performance analytics'}
          </p>
        </div>

        <div className="mgmt-header-actions">
          {variant === 'overview' && <NotificationBell role={role} />}
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

          {variant === 'analytics' && (
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
          )}

          <DateFilter days={days} onChange={setDays} />
        </div>
      </div>

      {/* EXPORT DAILY REPORTS CARD FOR ADMIN ONLY */}
      {role === 'admin' && <ExportReportsCard />}

      {/* LEVEL 1: EXECUTIVE KPI SUMMARY GRID */}
      {(variant === 'overview' || variant === 'full') && (
        <>
          <div className="kpi-grid" style={{ marginBottom: 20 }}>
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
              onClick={() => setExpandedMetric({ type: 'mortality', title: 'Avg Mortality %', sub: 'Daily mortality rate and dead bird counts' })}
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
                      <td style={{ color: fr.mRate >= (KPI_THRESHOLDS.mortalityRateWarning ?? 5) ? '#dc2626' : '#15803d', fontWeight: fr.mRate >= (KPI_THRESHOLDS.mortalityRateWarning ?? 5) ? 700 : 400 }}>
                        {fr.mRate}% {fr.hasTotalFlockLoss ? '(100% LOSS)' : ''}
                      </td>
                      <td>{fr.fGrams > 0 ? `${fr.fGrams.toFixed(0)} g` : '--'}</td>
                      <td>{fr.sRate > 0 ? `${fr.sRate}%` : '--'}</td>
                      <td>{fr.compliance}%</td>
                      <td>
                        <span
                          className="ent-status-tag"
                          style={{
                            background: `${fr.statusColor}15`,
                            color: fr.statusColor,
                            border: `1px solid ${fr.statusColor}40`,
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                          title={fr.reason}
                        >
                          {fr.isCritical && <AlertTriangle size={12} />}
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
            title: 'Mortality Tracking',
            sub: 'Daily dead bird count and mortality % rate',
          })}
        >
          <div className="ent-chart-header">
            <div>
              <h3>Mortality Tracking</h3>
              <p className="ent-chart-sub">Daily dead bird count and mortality % rate</p>
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
            sub: 'Daily feed intake (g/day) and total feed (Kg) compared with actual production %',
          })}
        >
          <div className="ent-chart-header">
            <div>
              <h3>Feed Consumption & Intake per Bird</h3>
              <p className="ent-chart-sub">Daily feed intake (g/day) and total feed (Kg) compared with actual production %</p>
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

          {/* Primary Comparison Chart: Actual Egg Production vs Feed Intake per Bird */}
          <div style={{ width: '100%', height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }} syncId="feedChartSync">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} minTickGap={16} />
                <YAxis
                  yAxisId="feedPerBird"
                  orientation="left"
                  tick={{ fontSize: 11, fill: '#0d9488' }}
                  unit=" g"
                  width={44}
                />
                <YAxis
                  yAxisId="prod"
                  orientation="right"
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: '#7c3aed' }}
                  unit="%"
                  width={38}
                />
                <Tooltip content={<FeedChartCustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: 2 }} iconType="circle" iconSize={8} />
                <Line
                  yAxisId="feedPerBird"
                  type="monotone"
                  dataKey="feedPerBirdG"
                  stroke="#0d9488"
                  strokeWidth={2}
                  name="Feed per Bird (g/day)"
                  dot={{ r: 2.5, fill: '#0d9488' }}
                  activeDot={{ r: 4 }}
                  connectNulls
                />
                <Line
                  yAxisId="prod"
                  type="monotone"
                  dataKey="production"
                  stroke="#7c3aed"
                  strokeWidth={2.5}
                  name="Actual Egg Production (%)"
                  dot={{ r: 3, fill: '#7c3aed' }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Compact Secondary Trend: Total Daily Feed Consumed (Kg) */}
          <div style={{ width: '100%', height: 85, marginTop: '6px', borderTop: '1px solid #f1f5f9', paddingTop: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px', paddingLeft: '4px', paddingRight: '4px' }}>
              <span style={{ fontSize: '10px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Total Feed Consumed (Kg)
              </span>
              <span style={{ fontSize: '10px', color: '#64748b' }}>
                Period Total: <strong style={{ color: '#2563eb' }}>{totalFeedKg.toLocaleString()} Kg</strong>
              </span>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 2, right: 54, left: 0, bottom: 0 }} syncId="feedChartSync">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} minTickGap={16} />
                <YAxis
                  yAxisId="feedKg"
                  orientation="left"
                  tick={{ fontSize: 10, fill: '#2563eb' }}
                  unit=" kg"
                  width={44}
                />
                <Tooltip content={<FeedChartCustomTooltip />} />
                <Bar
                  yAxisId="feedKg"
                  dataKey="feedKg"
                  fill="#93c5fd"
                  stroke="#2563eb"
                  strokeWidth={1}
                  radius={[2, 2, 0, 0]}
                  name="Total Feed (Kg)"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* GRAPH 4: EGG SELECTION (SUPERVISOR) OR EGG QUALITY & WEIGHT (ADMIN) */}
        <div
          className="ent-chart-card ent-chart-card--clickable"
          onClick={() => setExpandedMetric({
            type: 'eggQuality',
            title: role === 'supervisor' ? 'Egg Selection Analytics' : 'Egg Weight & Selection Quality',
            sub: role === 'supervisor' ? 'Daily selected eggs quantity and selection % rate' : 'Min, Max, Avg egg weights (g) and selection egg percentage',
          })}
        >
          <div className="ent-chart-header">
            <div>
              <h3>{role === 'supervisor' ? 'Egg Selection Analytics' : 'Egg Weight & Selection Quality'}</h3>
              <p className="ent-chart-sub">{role === 'supervisor' ? 'Daily selected eggs quantity and selection % rate' : 'Min, Max, Avg egg weights (g) and selection egg percentage'}</p>
            </div>
            <Maximize2 size={16} className="ent-expand-icon" />
          </div>
          <ResponsiveContainer width="100%" height={280}>
            {role === 'supervisor' ? (
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="selectionCount" fill="#16a34a" name="Selected Eggs" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="selectionPct" stroke="#059669" strokeWidth={2} name="Selection %" dot={{ r: 3 }} connectNulls />
              </ComposedChart>
            ) : (
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
            )}
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
            sub: 'Daily temperature range (°C) with comfort limits (18°C – 30°C) compared with actual production %',
          })}
        >
          <div className="ent-chart-header">
            <div>
              <h3>Environmental Temperature Monitoring</h3>
              <p className="ent-chart-sub">Daily temperature range (°C) with comfort limits (18°C – 30°C) compared with actual production %</p>
            </div>
            <Maximize2 size={16} className="ent-expand-icon" />
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} minTickGap={16} />
              <YAxis yAxisId="left" domain={[10, 45]} tick={{ fontSize: 11, fill: '#ea580c' }} unit="°C" width={42} />
              <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 11, fill: '#7c3aed' }} unit="%" width={38} />
              <Tooltip content={<TemperatureChartCustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: 4 }} iconType="circle" iconSize={8} />
              <ReferenceLine yAxisId="left" y={30} stroke="#f87171" strokeDasharray="4 4" strokeWidth={1.2} label={{ value: '30°C Max Comfort', position: 'insideTopLeft', fill: '#dc2626', fontSize: 10, fontWeight: 500 }} />
              <ReferenceLine yAxisId="left" y={18} stroke="#38bdf8" strokeDasharray="4 4" strokeWidth={1.2} label={{ value: '18°C Min Comfort', position: 'insideBottomLeft', fill: '#0284c7', fontSize: 10, fontWeight: 500 }} />
              <Line yAxisId="left" type="monotone" dataKey="tempMax" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 4" name="Maximum Temperature (°C)" dot={{ r: 2, fill: '#f59e0b' }} connectNulls />
              <Line yAxisId="left" type="monotone" dataKey="tempAvg" stroke="#ea580c" strokeWidth={2.2} name="Average Temperature (°C)" dot={{ r: 3, fill: '#ea580c' }} activeDot={{ r: 5 }} connectNulls />
              <Line yAxisId="right" type="monotone" dataKey="production" stroke="#7c3aed" strokeWidth={2.5} name="Actual Egg Production (%)" dot={{ r: 3, fill: '#7c3aed' }} activeDot={{ r: 5 }} connectNulls />
            </ComposedChart>
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
          flockFilter={role === 'supervisor' || variant === 'overview' ? '' : selectedFlockId}
          activeFarms={activeFarms}
          farmInventories={farmInventories}
          reports={reports}
          submissionMatrix={submissionMatrix}
          standardCurveType={standardCurveType}
          onStandardCurveChange={setStandardCurveType}
          role={role}
          renderChartContent={() => {
            const chartHeight = getModalChartHeight(expandedMetric.type);
            const chartMargin = isMobileScreen
              ? { top: 6, right: 6, bottom: 0, left: -14 }
              : { top: 10, right: 16, bottom: 5, left: 0 };
            const axisTick = { fontSize: isMobileScreen ? 10 : 12 };
            const legendStyle = { fontSize: isMobileScreen ? 11 : 12, paddingTop: 4 };

            switch (expandedMetric.type) {
              case 'production':
                return (
                  <div className={`chart-modal-frame chart-modal-frame--${expandedMetric.type}`}>
                    <ResponsiveContainer width="100%" height={chartHeight}>
                      <LineChart data={chartData} margin={chartMargin}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="date" tick={axisTick} />
                        <YAxis domain={[0, 100]} tick={axisTick} unit="%" />
                        <Tooltip formatter={(value: any) => `${value}%`} />
                        <Legend wrapperStyle={legendStyle} />
                        <Line type="monotone" dataKey="production" stroke="#10b981" strokeWidth={isMobileScreen ? 2 : 3} name="Actual Production %" dot={{ r: isMobileScreen ? 3 : 5 }} connectNulls />
                        <Line type="monotone" dataKey="standardProduction" stroke="#64748b" strokeWidth={isMobileScreen ? 1.5 : 2} strokeDasharray="5 5" name="Standard Target %" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                );

              case 'mortality':
                return (
                  <div className={`chart-modal-frame chart-modal-frame--${expandedMetric.type}`}>
                    <ResponsiveContainer width="100%" height={chartHeight}>
                      <ComposedChart data={chartData} margin={chartMargin}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="date" tick={axisTick} />
                        <YAxis yAxisId="left" tick={axisTick} />
                        <YAxis yAxisId="right" orientation="right" tick={axisTick} unit="%" />
                        <Tooltip />
                        <Legend wrapperStyle={legendStyle} />
                        <Bar yAxisId="left" dataKey="mortalityCount" fill="#ef4444" name="Mortality Count" radius={[4, 4, 0, 0]} />
                        <Line yAxisId="right" type="monotone" dataKey="mortality" stroke="#b91c1c" strokeWidth={2} name="Mortality Rate %" dot={{ r: isMobileScreen ? 3 : 4 }} connectNulls />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                );

              case 'feed':
                return (
                  <div className={`chart-modal-frame chart-modal-frame--${expandedMetric.type}`}>
                    {/* Primary Comparison Chart: Production vs Feed per Bird */}
                    <div style={{ width: '100%', height: isMobileScreen ? 200 : 260 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData} margin={chartMargin} syncId="feedModalSync">
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="date" tick={axisTick} minTickGap={16} />
                          <YAxis yAxisId="feedPerBird" orientation="left" tick={{ ...axisTick, fill: '#0d9488' }} unit=" g" width={isMobileScreen ? 36 : 46} />
                          <YAxis yAxisId="prod" orientation="right" domain={[0, 100]} tick={{ ...axisTick, fill: '#7c3aed' }} unit="%" width={isMobileScreen ? 32 : 40} />
                          <Tooltip content={<FeedChartCustomTooltip />} />
                          <Legend wrapperStyle={legendStyle} iconType="circle" iconSize={isMobileScreen ? 6 : 8} />
                          <Line yAxisId="feedPerBird" type="monotone" dataKey="feedPerBirdG" stroke="#0d9488" strokeWidth={2} name="Feed per Bird (g/day)" dot={{ r: isMobileScreen ? 2 : 3, fill: '#0d9488' }} activeDot={{ r: isMobileScreen ? 3 : 5 }} connectNulls />
                          <Line yAxisId="prod" type="monotone" dataKey="production" stroke="#7c3aed" strokeWidth={2.5} name="Actual Egg Production (%)" dot={{ r: isMobileScreen ? 2.5 : 3.5, fill: '#7c3aed' }} activeDot={{ r: isMobileScreen ? 4 : 6 }} connectNulls />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Secondary Trend: Total Feed Consumed (Kg) */}
                    <div style={{ width: '100%', height: isMobileScreen ? 90 : 130, marginTop: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', paddingLeft: '4px', paddingRight: '4px' }}>
                        <span style={{ fontSize: isMobileScreen ? '10px' : '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Total Feed Consumed (Kg)
                        </span>
                        <span style={{ fontSize: isMobileScreen ? '10px' : '11px', color: '#64748b' }}>
                          Period Total: <strong style={{ color: '#2563eb' }}>{totalFeedKg.toLocaleString()} Kg</strong>
                        </span>
                      </div>
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                          data={chartData}
                          margin={{
                            ...chartMargin,
                            right: isMobileScreen ? chartMargin.right + 32 : chartMargin.right + 40,
                          }}
                          syncId="feedModalSync"
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis dataKey="date" tick={axisTick} tickLine={false} minTickGap={16} />
                          <YAxis yAxisId="feedKg" orientation="left" tick={{ ...axisTick, fill: '#2563eb' }} unit=" kg" width={isMobileScreen ? 36 : 46} />
                          <Tooltip content={<FeedChartCustomTooltip />} />
                          <Bar yAxisId="feedKg" dataKey="feedKg" fill="#93c5fd" stroke="#2563eb" strokeWidth={1} radius={[2, 2, 0, 0]} name="Total Feed (Kg)" />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                );

              case 'eggQuality':
                if (role === 'supervisor') {
                  return (
                    <div className={`chart-modal-frame chart-modal-frame--${expandedMetric.type}`}>
                      <ResponsiveContainer width="100%" height={chartHeight}>
                        <ComposedChart data={chartData} margin={chartMargin}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="date" tick={axisTick} />
                          <YAxis yAxisId="left" tick={axisTick} />
                          <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={axisTick} unit="%" />
                          <Tooltip />
                          <Legend wrapperStyle={legendStyle} />
                          <Bar yAxisId="left" dataKey="selectionCount" fill="#16a34a" name="Selected Eggs" radius={[4, 4, 0, 0]} />
                          <Line yAxisId="right" type="monotone" dataKey="selectionPct" stroke="#059669" strokeWidth={2} name="Selection %" dot={{ r: isMobileScreen ? 3 : 4 }} connectNulls />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  );
                }

                return (
                  <div className={`chart-modal-frame chart-modal-frame--${expandedMetric.type}`}>
                    <ResponsiveContainer width="100%" height={chartHeight}>
                      <ComposedChart data={chartData} margin={chartMargin}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="date" tick={axisTick} />
                        <YAxis yAxisId="left" domain={[40, 80]} tick={axisTick} unit=" g" />
                        <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={axisTick} unit="%" />
                        <Tooltip />
                        <Legend wrapperStyle={legendStyle} />
                        <Line yAxisId="left" type="monotone" dataKey="eggWtAvg" stroke="#0284c7" strokeWidth={2} name="Avg Egg Wt (g)" dot={{ r: isMobileScreen ? 3 : 4 }} connectNulls />
                        <Line yAxisId="left" type="monotone" dataKey="eggWtMin" stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 3" name="Min Egg Wt" connectNulls />
                        <Line yAxisId="left" type="monotone" dataKey="eggWtMax" stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 3" name="Max Egg Wt" connectNulls />
                        <Line yAxisId="right" type="monotone" dataKey="selectionPct" stroke="#16a34a" strokeWidth={2} name="Selection %" dot={{ r: isMobileScreen ? 3 : 4 }} connectNulls />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                );

              case 'bodyWeight':
                return (
                  <div className={`chart-modal-frame chart-modal-frame--${expandedMetric.type}`}>
                    <ResponsiveContainer width="100%" height={chartHeight}>
                      <LineChart data={chartData} margin={chartMargin}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="date" tick={axisTick} />
                        <YAxis tick={axisTick} unit=" g" />
                        <Tooltip />
                        <Legend wrapperStyle={legendStyle} />
                        <Line type="monotone" dataKey="bodyWtAvg" stroke="#8b5cf6" strokeWidth={isMobileScreen ? 2 : 3} name="Avg Body Wt (g)" dot={{ r: isMobileScreen ? 3 : 5 }} connectNulls />
                        <Line type="monotone" dataKey="bodyWtMin" stroke="#cbd5e1" strokeWidth={1.5} strokeDasharray="3 3" name="Min Body Wt" connectNulls />
                        <Line type="monotone" dataKey="bodyWtMax" stroke="#cbd5e1" strokeWidth={1.5} strokeDasharray="3 3" name="Max Body Wt" connectNulls />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                );

              case 'temperature':
                return (
                  <div className={`chart-modal-frame chart-modal-frame--${expandedMetric.type}`}>
                    <ResponsiveContainer width="100%" height={chartHeight}>
                      <ComposedChart data={chartData} margin={chartMargin}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="date" tick={axisTick} minTickGap={16} />
                        <YAxis yAxisId="left" domain={[10, 45]} tick={{ ...axisTick, fill: '#ea580c' }} unit="°C" width={isMobileScreen ? 36 : 46} />
                        <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ ...axisTick, fill: '#7c3aed' }} unit="%" width={isMobileScreen ? 32 : 40} />
                        <Tooltip content={<TemperatureChartCustomTooltip />} />
                        <Legend wrapperStyle={legendStyle} iconType="circle" iconSize={isMobileScreen ? 6 : 8} />
                        <ReferenceLine yAxisId="left" y={30} stroke="#f87171" strokeDasharray="4 4" strokeWidth={1.2} label={{ value: '30°C Max Comfort', position: 'insideTopLeft', fill: '#dc2626', fontSize: isMobileScreen ? 9 : 11, fontWeight: 500 }} />
                        <ReferenceLine yAxisId="left" y={18} stroke="#38bdf8" strokeDasharray="4 4" strokeWidth={1.2} label={{ value: '18°C Min Comfort', position: 'insideBottomLeft', fill: '#0284c7', fontSize: isMobileScreen ? 9 : 11, fontWeight: 500 }} />
                        <Line yAxisId="left" type="monotone" dataKey="tempMax" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 4" name="Maximum Temperature (°C)" dot={{ r: isMobileScreen ? 2 : 2.5, fill: '#f59e0b' }} connectNulls />
                        <Line yAxisId="left" type="monotone" dataKey="tempAvg" stroke="#ea580c" strokeWidth={2.2} name="Average Temperature (°C)" dot={{ r: isMobileScreen ? 2.5 : 3.5, fill: '#ea580c' }} activeDot={{ r: isMobileScreen ? 4 : 5 }} connectNulls />
                        <Line yAxisId="right" type="monotone" dataKey="production" stroke="#7c3aed" strokeWidth={2.5} name="Actual Egg Production (%)" dot={{ r: isMobileScreen ? 2.5 : 3.5, fill: '#7c3aed' }} activeDot={{ r: isMobileScreen ? 4 : 6 }} connectNulls />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                );

              case 'submission':
                return (
                  <div className={`chart-modal-frame chart-modal-frame--${expandedMetric.type}`}>
                    <ResponsiveContainer width="100%" height={chartHeight}>
                      <BarChart data={chartData} margin={chartMargin}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="date" tick={axisTick} />
                        <YAxis tick={axisTick} />
                        <Tooltip />
                        <Legend wrapperStyle={legendStyle} />
                        <Bar dataKey="submitted" fill="#10b981" name="Submitted Reports" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="missing" fill="#fca5a5" name="Missing Reports" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
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
