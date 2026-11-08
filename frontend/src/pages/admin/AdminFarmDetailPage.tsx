import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/dashboard/DashboardLayout';
import { KpiCard } from '../../components/dashboard/KpiCard';
import { LoadingState } from '../../components/dashboard/LoadingState';
import { EmptyState } from '../../components/dashboard/EmptyState';
import { DateFilter } from '../../components/dashboard/DateFilter';
import { type ReportDoc } from '../../services/reportDataService';
import { getFarmById, type FarmDoc } from '../../services/farmDataService';
import { getUserByUid, getActiveFarmers, type UserDoc } from '../../services/userDataService';
import { getIstDate, getDaysAgo, formatDisplayDate, formatTime } from '../../utils/dateUtils';
import {
  calcProductionRate,
  calcMortalityRate,
  calcFeedPerBird,
  calcSelectionRate,
  aggregateReports,
  getEligibleBirdCount,
} from '../../utils/kpiCalculations';
import { useDailyReportsByFarms } from '../../hooks/useDailyReports';
import { KPI_THRESHOLDS } from '../../config/kpiThresholds';
import {
  LineChart,
  Line,
  ComposedChart,
  Bar,
  ReferenceLine,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  ArrowLeft,
  AlertTriangle,
  Activity,
  HeartPulse,
  Package,
  Thermometer,
  Egg,
  FileText,
  Eye,
  X,
  Info,
  Maximize2,
} from 'lucide-react';
import { ReportDetailDrawer } from '../../components/dashboard/ReportDetailDrawer';

type KpiType = 'production' | 'mortality' | 'feed' | 'temperature' | 'eggWeight' | 'reports';

type FullscreenChartType =
  | 'default_prod_mort'
  | 'default_temp'
  | 'kpi_production'
  | 'kpi_mortality'
  | 'kpi_feed'
  | 'kpi_temperature'
  | 'kpi_eggWeight';

function formatShortDate(isoDate: string): string {
  if (!isoDate) return '';
  const clean = isoDate.split('T')[0];
  const parts = clean.split('-');
  if (parts.length < 3) return clean;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  if (m >= 0 && m < 12 && !isNaN(d)) {
    return `${d} ${months[m]}`;
  }
  return clean.slice(5);
}

function ProfessionalChartTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '12px 14px',
        boxShadow: '0 14px 32px rgba(15, 23, 42, 0.16)',
        fontSize: '12px',
        minWidth: '200px',
        zIndex: 50,
      }}
    >
      <div
        style={{
          fontWeight: 700,
          color: '#0f172a',
          marginBottom: '8px',
          borderBottom: '1px solid #f1f5f9',
          paddingBottom: '4px',
        }}
      >
        {data.fullDate ? formatDisplayDate(data.fullDate) : label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {payload.map((entry: any, index: number) => {
          if (entry.value === null || entry.value === undefined) return null;
          return (
            <div key={`item-${index}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569' }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: entry.color || entry.fill,
                    display: 'inline-block',
                  }}
                />
                {entry.name}:
              </span>
              <strong style={{ color: entry.color || entry.fill || '#0f172a' }}>
                {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
                {entry.unit ? ` ${entry.unit}` : ''}
              </strong>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type ChartSummaryItem = { label: string; value: string; tone?: 'default' | 'positive' | 'warning' };

function ChartSummary({ items }: { items: ChartSummaryItem[] }) {
  const visibleItems = items.filter((item) => item.value !== '—');
  if (!visibleItems.length) return null;
  return (
    <div className="farm-chart-summary" aria-label="Chart summary">
      {visibleItems.map((item) => (
        <div className={`farm-chart-summary__item farm-chart-summary__item--${item.tone || 'default'}`} key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

function summarizeSeries(data: Array<Record<string, any>>, key: string, unit: string): ChartSummaryItem[] {
  const values = data.map((point) => point[key]).filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (!values.length) return [];
  const latest = [...data].reverse().find((point) => typeof point[key] === 'number' && Number.isFinite(point[key]))?.[key];
  const format = (value: number) => `${value.toFixed(1)}${unit}`;
  return [
    { label: 'Average', value: format(values.reduce((sum, value) => sum + value, 0) / values.length) },
    { label: 'Minimum', value: format(Math.min(...values)) },
    { label: 'Maximum', value: format(Math.max(...values)) },
    { label: 'Latest', value: typeof latest === 'number' ? format(latest) : '—', tone: 'positive' },
  ];
}

export function AdminFarmDetailPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [days, setDays] = useState(30);
  const [farm, setFarm] = useState<FarmDoc | null>(null);
  const [farmer, setFarmer] = useState<UserDoc | null>(null);
  const [farmLoading, setFarmLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<ReportDoc | null>(null);
  const [selectedKpi, setSelectedKpi] = useState<KpiType | null>(null);
  const [fullscreenChart, setFullscreenChart] = useState<FullscreenChartType | null>(null);

  const reportHistoryRef = useRef<HTMLDivElement>(null);
  const dedicatedSectionRef = useRef<HTMLDivElement>(null);

  const farmIdArray = farmId ? [farmId] : [];
  const { reports, loading: reportsLoading, error } = useDailyReportsByFarms(farmIdArray, getDaysAgo(days), getIstDate());
  const loading = farmLoading || reportsLoading;

  useEffect(() => {
    if (!farmId) return;
    let mounted = true;
    (async () => {
      try {
        const f = await getFarmById(farmId);
        if (mounted) setFarm(f);
      } catch (err) {
        console.error('[AdminFarmDetail] Load error:', err);
      } finally {
        if (mounted) setFarmLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [farmId]);

  useEffect(() => {
    if (!farmId) return;
    let mounted = true;
    (async () => {
      try {
        if (reports.length > 0 && reports[0]?.submittedBy) {
          const u = await getUserByUid(reports[0].submittedBy);
          if (mounted && u) {
            setFarmer(u);
            return;
          }
        }
        // Fallback: look up active farmer assigned to this farm
        const activeFarmers = await getActiveFarmers();
        const assigned = activeFarmers.find((f) => f.farmIds?.includes(farmId));
        if (mounted && assigned) {
          setFarmer(assigned);
        }
      } catch (err) {
        console.error('[AdminFarmDetail] Farmer load error:', err);
      }
    })();
    return () => { mounted = false; };
  }, [farmId, reports.length > 0 ? reports[0].submittedBy : '']);

  // Handle ESC key and prevent body scroll when fullscreen modal is open
  useEffect(() => {
    if (!fullscreenChart) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFullscreenChart(null);
      }
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [fullscreenChart]);

  const handleKpiClick = (kpi: KpiType) => {
    if (kpi === 'reports') {
      const willSelect = selectedKpi !== 'reports';
      setSelectedKpi((prev) => (prev === 'reports' ? null : 'reports'));
      if (willSelect) {
        setTimeout(() => {
          reportHistoryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 80);
      }
      return;
    }

    const willSelect = selectedKpi !== kpi;
    setSelectedKpi((prev) => (prev === kpi ? null : kpi));
    if (willSelect) {
      setTimeout(() => {
        dedicatedSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 80);
    }
  };

  const chartData = reports
    .map((r) => {
      const base = getEligibleBirdCount(r);
      const prodRate = r.actualProductionPct ?? (base > 0 ? calcProductionRate(r.eggsProduced ?? 0, base) : 0);
      const mortRate = base > 0 ? calcMortalityRate(r.mortality ?? 0, base) : 0;
      const feedGrams = r.feedGramsPerBird ?? (base > 0 ? calcFeedPerBird(r.feedKg ?? 0, base) : 0);
      const selectionRate = r.eggsProduced && r.eggsProduced > 0 ? calcSelectionRate(r.selectionEggs ?? 0, r.eggsProduced) : 0;

      const eggWtAvg = r.eggWeight?.avg && r.eggWeight.avg > 0 ? r.eggWeight.avg : null;
      const eggWtMin = r.eggWeight?.min && r.eggWeight.min > 0 ? r.eggWeight.min : null;
      const eggWtMax = r.eggWeight?.max && r.eggWeight.max > 0 ? r.eggWeight.max : null;

      const tempVal = r.temperature ?? (r.tempMax && r.tempMin ? (r.tempMax + r.tempMin) / 2 : null);

      return {
        date: r.submissionDate ? formatShortDate(r.submissionDate) : '',
        fullDate: r.submissionDate || '',
        production: Number(prodRate.toFixed(1)),
        eggsProduced: r.eggsProduced ?? 0,
        mortalityRate: Number(mortRate.toFixed(1)),
        mortalityCount: r.mortality ?? 0,
        cullingCount: r.culling ?? 0,
        temperature: tempVal !== null ? Number(tempVal.toFixed(1)) : null,
        tempMin: r.tempMin !== null && r.tempMin !== undefined ? Number(r.tempMin) : null,
        tempMax: r.tempMax !== null && r.tempMax !== undefined ? Number(r.tempMax) : null,
        feedPerBird: Number(feedGrams.toFixed(1)),
        feedKg: r.feedKg ?? 0,
        eggWeightAvg: eggWtAvg !== null ? Number(eggWtAvg.toFixed(1)) : null,
        eggWeightMin: eggWtMin !== null ? Number(eggWtMin.toFixed(1)) : null,
        eggWeightMax: eggWtMax !== null ? Number(eggWtMax.toFixed(1)) : null,
        selectionPct: Number(selectionRate.toFixed(1)),
      };
    })
    .sort((a, b) => (a.fullDate > b.fullDate ? 1 : a.fullDate < b.fullDate ? -1 : 0));

  const agg = aggregateReports(reports);
  const todayReport = reports.find((r) => r.submissionDate === getIstDate());

  const totalEggs = reports.reduce((sum, r) => sum + (r.eggsProduced ?? 0), 0);
  const totalMortality = reports.reduce((sum, r) => sum + (r.mortality ?? 0), 0);
  const totalCulling = reports.reduce((sum, r) => sum + (r.culling ?? 0), 0);
  const totalFeedKg = parseFloat(reports.reduce((sum, r) => sum + (r.feedKg ?? 0), 0).toFixed(1));

  // Determine dynamic domain for mortality rate so sub-1% differences remain distinctly visible
  const maxMortRate = Math.max(...chartData.map((d) => d.mortalityRate), 1.0);
  const mortalityDomainRight = [0, Math.ceil(maxMortRate * 1.5)];
  const chartTickInterval = chartData.length > 60 ? Math.ceil(chartData.length / 8) - 1 : chartData.length > 30 ? 4 : chartData.length > 14 ? 2 : 0;

  const attentionItems: string[] = [];
  const hasTotalFlockLoss = reports.some((r) => {
    const b = getEligibleBirdCount(r);
    return b > 0 && (r.mortality ?? 0) >= b;
  });
  if (hasTotalFlockLoss) attentionItems.push('CRITICAL: Total flock mortality (100%) reported');
  if (agg.avgMortalityRate >= KPI_THRESHOLDS.mortalityRateCritical) attentionItems.push(`Critical mortality rate (${agg.avgMortalityRate}%)`);
  else if (agg.avgMortalityRate >= KPI_THRESHOLDS.mortalityRateWarning) attentionItems.push(`High mortality rate (${agg.avgMortalityRate}%)`);
  if (agg.avgTemperature > KPI_THRESHOLDS.temperatureCritical) attentionItems.push('High temperature');
  if (agg.avgAmmonia > KPI_THRESHOLDS.ammoniaCritical) attentionItems.push('High ammonia');
  if (!todayReport) attentionItems.push('No report submitted today');

  if (loading) return <DashboardLayout role="admin" userName={userProfile?.name}><LoadingState /></DashboardLayout>;
  if (!farm) return <DashboardLayout role="admin" userName={userProfile?.name}><EmptyState message="Farm not found." /></DashboardLayout>;

  return (
    <DashboardLayout role="admin" userName={userProfile?.name}>
      <div className="mgmt-page">
        {error && <div className="alert alert--error" style={{ marginBottom: 16 }}>{error}</div>}
        <button className="btn-back" onClick={() => navigate('/admin/farms')}>
          <ArrowLeft size={16} /> <span>Back to Farms</span>
        </button>

        {/* 1. FARM HEADING & ATTENTION BANNER */}
        <div className="farm-detail-header">
          <h2>{farm.farmId}</h2>
          <p>{farm.name || 'Unnamed Farm'} | Farmer: {farmer?.name || 'Unknown'}</p>
          {attentionItems.length > 0 && (
            <div className="attention-banner" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={16} /> <span>Attention: {attentionItems.join(', ')}</span>
            </div>
          )}
        </div>

        {/* 2. DATE-RANGE SELECTOR */}
        <DateFilter days={days} onChange={setDays} />

        {/* 3. SIX INTERACTIVE KPI CARDS */}
        <div className="kpi-grid">
          <KpiCard
            title="Avg Production"
            value={`${agg.avgProductionRate}%`}
            icon={<Activity size={18} />}
            onClick={() => handleKpiClick('production')}
            isSelected={selectedKpi === 'production'}
          />
          <KpiCard
            title="Avg Mortality"
            value={`${agg.avgMortalityRate}%`}
            icon={<HeartPulse size={18} />}
            color={agg.avgMortalityRate > 10 ? '#dc2626' : undefined}
            onClick={() => handleKpiClick('mortality')}
            isSelected={selectedKpi === 'mortality'}
          />
          <KpiCard
            title="Avg Feed/Bird"
            value={`${agg.avgFeedPerBird}g`}
            icon={<Package size={18} />}
            onClick={() => handleKpiClick('feed')}
            isSelected={selectedKpi === 'feed'}
          />
          <KpiCard
            title="Avg Temperature"
            value={`${agg.avgTemperature}°C`}
            icon={<Thermometer size={18} />}
            onClick={() => handleKpiClick('temperature')}
            isSelected={selectedKpi === 'temperature'}
          />
          <KpiCard
            title="Avg Egg Weight"
            value={`${agg.avgEggWeight}g`}
            icon={<Egg size={18} />}
            onClick={() => handleKpiClick('eggWeight')}
            isSelected={selectedKpi === 'eggWeight'}
          />
          <KpiCard
            title="Reports"
            value={agg.totalReports}
            icon={<FileText size={18} />}
            onClick={() => handleKpiClick('reports')}
            isSelected={selectedKpi === 'reports'}
          />
        </div>

        {/* 4. DEFAULT ANALYTICS SECTION (PRODUCTION & MORTALITY AND TEMPERATURE CHARTS) */}
        <div className="chart-grid">
          {/* CHART A: PRODUCTION & MORTALITY TREND */}
          <div
            className="chart-card farm-chart-card--interactive"
            onDoubleClick={() => setFullscreenChart('default_prod_mort')}
            title="Double-click to expand to fullscreen"
          >
            <div className="chart-card-header">
              <div>
                <h3>Production & Mortality Trend</h3>
                <p className="chart-card-sub">Daily actual egg production rate (%) vs mortality rate (%) · Double-click to expand</p>
              </div>
              <div className="farm-chart-header-actions">
                <div className="farm-analytics-badges">
                  <span className="farm-analytics-badge farm-analytics-badge--primary">Prod: {agg.avgProductionRate}%</span>
                  <span
                    className="farm-analytics-badge"
                    style={{
                      color: agg.avgMortalityRate > 10 ? '#dc2626' : '#64748b',
                      borderColor: agg.avgMortalityRate > 10 ? '#fca5a5' : '#e2e8f0',
                      background: agg.avgMortalityRate > 10 ? '#fee2e2' : '#f1f5f9',
                    }}
                  >
                    Mort: {agg.avgMortalityRate}%
                  </span>
                </div>
                <button
                  type="button"
                  className="farm-chart-expand-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFullscreenChart('default_prod_mort');
                  }}
                  title="Expand to Fullscreen (or double-click chart)"
                  aria-label="Expand chart to fullscreen"
                >
                  <Maximize2 size={13} />
                  <span>Fullscreen</span>
                </button>
              </div>
            </div>

            <ChartSummary items={summarizeSeries(chartData, 'production', '%')} />

            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={chartData} margin={{ top: 12, right: 24, left: -10, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickMargin={8}
                    padding={{ left: 24, right: 24 }}
                    interval={chartTickInterval}
                  />
                  <YAxis
                    yAxisId="left"
                    domain={[0, 100]}
                    tick={{ fontSize: 11, fill: '#15803d' }}
                    unit="%"
                    width={40}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={mortalityDomainRight}
                    tick={{ fontSize: 11, fill: '#dc2626' }}
                    unit="%"
                    width={40}
                  />
                  <Tooltip content={<ProfessionalChartTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }}
                    iconType="circle"
                    iconSize={8}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="production"
                    stroke="#15803d"
                    strokeWidth={2.5}
                    name="Production %"
                    unit="%"
                    dot={{ r: 4, fill: '#15803d' }}
                    activeDot={{ r: 6 }}
                    connectNulls
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="mortalityRate"
                    stroke="#dc2626"
                    strokeWidth={2.2}
                    name="Mortality %"
                    unit="%"
                    dot={{ r: 4, fill: '#dc2626' }}
                    activeDot={{ r: 6 }}
                    connectNulls
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="chart-empty-state">
                <Info size={20} />
                <span>No production records recorded for the selected period.</span>
              </div>
            )}
          </div>

          {/* CHART B: TEMPERATURE TREND */}
          <div
            className="chart-card farm-chart-card--interactive"
            onDoubleClick={() => setFullscreenChart('default_temp')}
            title="Double-click to expand to fullscreen"
          >
            <div className="chart-card-header">
              <div>
                <h3>Temperature Trend</h3>
                <p className="chart-card-sub">Daily shed temperature readings with comfort thresholds (18°C – 30°C) · Double-click to expand</p>
              </div>
              <div className="farm-chart-header-actions">
                <div className="farm-analytics-badges">
                  <span className="farm-analytics-badge farm-analytics-badge--primary">Avg: {agg.avgTemperature}°C</span>
                  <span className="farm-analytics-badge">Comfort: 18°C – 30°C</span>
                </div>
                <button
                  type="button"
                  className="farm-chart-expand-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFullscreenChart('default_temp');
                  }}
                  title="Expand to Fullscreen (or double-click chart)"
                  aria-label="Expand chart to fullscreen"
                >
                  <Maximize2 size={13} />
                  <span>Fullscreen</span>
                </button>
              </div>
            </div>

            <ChartSummary items={summarizeSeries(chartData, 'temperature', '°C')} />

            {chartData.length > 0 && chartData.some((d) => d.temperature !== null) ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartData} margin={{ top: 12, right: 24, left: -10, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickMargin={8}
                    padding={{ left: 24, right: 24 }}
                    interval={chartTickInterval}
                  />
                  <YAxis
                    domain={[10, 45]}
                    tick={{ fontSize: 11, fill: '#ea580c' }}
                    unit="°C"
                    width={40}
                  />
                  <Tooltip content={<ProfessionalChartTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }}
                    iconType="circle"
                    iconSize={8}
                  />
                  <ReferenceLine
                    y={30}
                    stroke="#f87171"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    label={{ value: '30°C Max Comfort', position: 'insideTopLeft', fill: '#dc2626', fontSize: 10, fontWeight: 500 }}
                  />
                  <ReferenceLine
                    y={18}
                    stroke="#38bdf8"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    label={{ value: '18°C Min Comfort', position: 'insideBottomLeft', fill: '#0284c7', fontSize: 10, fontWeight: 500 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="temperature"
                    stroke="#ea580c"
                    strokeWidth={2.5}
                    name="Temperature (°C)"
                    unit="°C"
                    dot={{ r: 4, fill: '#ea580c' }}
                    activeDot={{ r: 6 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="chart-empty-state">
                <Info size={20} />
                <span>No temperature readings recorded for the selected period.</span>
              </div>
            )}
          </div>
        </div>

        {/* 5. ADDITIONAL DEDICATED ANALYTICS (EXPANDS BELOW DEFAULT CHARTS WHEN A KPI CARD IS CLICKED) */}
        {selectedKpi && selectedKpi !== 'reports' && (
          <div ref={dedicatedSectionRef} className="section-card farm-kpi-analytics-card" style={{ marginBottom: 24 }}>
            {selectedKpi === 'production' && (
              <div
                className="farm-chart-card--interactive"
                onDoubleClick={() => setFullscreenChart('kpi_production')}
                title="Double-click to expand to fullscreen"
              >
                <div className="farm-analytics-header">
                  <div>
                    <h3>Egg Production Volume & Target Breakdown</h3>
                    <p className="farm-analytics-sub">Daily eggs collected (bars) and actual production rate (%) against 80% baseline · Double-click to expand</p>
                    <ChartSummary items={summarizeSeries(chartData, 'production', '%')} />
                  </div>
                  <div className="farm-chart-header-actions">
                    <div className="farm-analytics-badges">
                      <span className="farm-analytics-badge farm-analytics-badge--primary">Avg: {agg.avgProductionRate}%</span>
                      <span className="farm-analytics-badge">Total Eggs: {totalEggs.toLocaleString()}</span>
                      <span className="farm-analytics-badge">Target: 80%</span>
                    </div>
                    <button
                      type="button"
                      className="farm-chart-expand-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFullscreenChart('kpi_production');
                      }}
                      title="Expand to Fullscreen (or double-click chart)"
                    >
                      <Maximize2 size={13} />
                      <span>Fullscreen</span>
                    </button>
                    <button type="button" className="farm-analytics-close-btn" onClick={() => setSelectedKpi(null)} title="Collapse analytics">
                      <X size={14} /> <span>Collapse</span>
                    </button>
                  </div>
                </div>
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <ComposedChart data={chartData} margin={{ top: 12, right: 24, left: -6, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} tickMargin={8} padding={{ left: 24, right: 24 }} interval="preserveStartEnd" />
                      <YAxis yAxisId="left" domain={[0, 100]} tick={{ fontSize: 11, fill: '#15803d' }} unit="%" width={40} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#059669' }} width={55} />
                      <Tooltip content={<ProfessionalChartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} iconType="circle" iconSize={8} />
                      <Bar yAxisId="right" dataKey="eggsProduced" fill="#dcfce7" stroke="#15803d" strokeWidth={1} name="Eggs Collected" radius={[4, 4, 0, 0]} />
                      <Line yAxisId="left" type="monotone" dataKey="production" stroke="#15803d" strokeWidth={2.5} name="Production %" unit="%" dot={{ r: 4 }} connectNulls />
                      <ReferenceLine yAxisId="left" y={80} stroke="#16a34a" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: 'Target 80%', fill: '#16a34a', fontSize: 11, position: 'insideTopLeft' }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState message="No production records for the selected period." />
                )}
              </div>
            )}

            {selectedKpi === 'mortality' && (
              <div
                className="farm-chart-card--interactive"
                onDoubleClick={() => setFullscreenChart('kpi_mortality')}
                title="Double-click to expand to fullscreen"
              >
                <div className="farm-analytics-header">
                  <div>
                    <h3>Flock Health & Mortality Breakdown</h3>
                    <p className="farm-analytics-sub">Daily dead bird count, culling count, and mortality rate (%) against critical limit · Double-click to expand</p>
                    <ChartSummary items={summarizeSeries(chartData, 'mortalityRate', '%')} />
                  </div>
                  <div className="farm-chart-header-actions">
                    <div className="farm-analytics-badges">
                      <span
                        className="farm-analytics-badge"
                        style={{
                          background: agg.avgMortalityRate > 10 ? '#fee2e2' : '#f1f5f9',
                          color: agg.avgMortalityRate > 10 ? '#dc2626' : undefined,
                          borderColor: agg.avgMortalityRate > 10 ? '#fca5a5' : undefined,
                        }}
                      >
                        Avg Mortality: {agg.avgMortalityRate}%
                      </span>
                      <span className="farm-analytics-badge">Total Dead: {totalMortality.toLocaleString()}</span>
                      {totalCulling > 0 && <span className="farm-analytics-badge">Total Culled: {totalCulling.toLocaleString()}</span>}
                    </div>
                    <button
                      type="button"
                      className="farm-chart-expand-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFullscreenChart('kpi_mortality');
                      }}
                      title="Expand to Fullscreen (or double-click chart)"
                    >
                      <Maximize2 size={13} />
                      <span>Fullscreen</span>
                    </button>
                    <button type="button" className="farm-analytics-close-btn" onClick={() => setSelectedKpi(null)} title="Collapse analytics">
                      <X size={14} /> <span>Collapse</span>
                    </button>
                  </div>
                </div>
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <ComposedChart data={chartData} margin={{ top: 12, right: 24, left: -6, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} tickMargin={8} padding={{ left: 24, right: 24 }} interval="preserveStartEnd" />
                      <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#ef4444' }} width={40} />
                      <YAxis yAxisId="right" orientation="right" domain={mortalityDomainRight} tick={{ fontSize: 11, fill: '#b91c1c' }} unit="%" width={40} />
                      <Tooltip content={<ProfessionalChartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} iconType="circle" iconSize={8} />
                      <Bar yAxisId="left" dataKey="mortalityCount" fill="#ef4444" name="Dead Bird Count" radius={[4, 4, 0, 0]} />
                      {chartData.some((d) => d.cullingCount > 0) && (
                        <Bar yAxisId="left" dataKey="cullingCount" fill="#f59e0b" name="Culled Count" radius={[4, 4, 0, 0]} />
                      )}
                      <Line yAxisId="right" type="monotone" dataKey="mortalityRate" stroke="#b91c1c" strokeWidth={2.2} name="Mortality Rate %" unit="%" dot={{ r: 4 }} connectNulls />
                      <ReferenceLine yAxisId="right" y={KPI_THRESHOLDS.mortalityRateCritical} stroke="#dc2626" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: 'Critical (10%)', fill: '#dc2626', fontSize: 11, position: 'insideTopLeft' }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState message="No mortality records for the selected period." />
                )}
              </div>
            )}

            {selectedKpi === 'feed' && (
              <div
                className="farm-chart-card--interactive"
                onDoubleClick={() => setFullscreenChart('kpi_feed')}
                title="Double-click to expand to fullscreen"
              >
                <div className="farm-analytics-header">
                  <div>
                    <h3>Feed Consumption & Intake Efficiency</h3>
                    <p className="farm-analytics-sub">Daily feed intake per bird (g/day) compared against total feed distributed (Kg) · Double-click to expand</p>
                    <ChartSummary items={summarizeSeries(chartData, 'feedPerBird', 'g')} />
                  </div>
                  <div className="farm-chart-header-actions">
                    <div className="farm-analytics-badges">
                      <span className="farm-analytics-badge farm-analytics-badge--primary">Avg Intake: {agg.avgFeedPerBird}g/bird</span>
                      <span className="farm-analytics-badge">Total Feed: {totalFeedKg.toLocaleString()} Kg</span>
                    </div>
                    <button
                      type="button"
                      className="farm-chart-expand-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFullscreenChart('kpi_feed');
                      }}
                      title="Expand to Fullscreen (or double-click chart)"
                    >
                      <Maximize2 size={13} />
                      <span>Fullscreen</span>
                    </button>
                    <button type="button" className="farm-analytics-close-btn" onClick={() => setSelectedKpi(null)} title="Collapse analytics">
                      <X size={14} /> <span>Collapse</span>
                    </button>
                  </div>
                </div>
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <ComposedChart data={chartData} margin={{ top: 12, right: 24, left: -6, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} tickMargin={8} padding={{ left: 24, right: 24 }} interval="preserveStartEnd" />
                      <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#0d9488' }} unit=" g" width={45} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#2563eb' }} unit=" Kg" width={55} />
                      <Tooltip content={<ProfessionalChartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} iconType="circle" iconSize={8} />
                      <Line yAxisId="left" type="monotone" dataKey="feedPerBird" stroke="#0d9488" strokeWidth={2.5} name="Feed per Bird (g)" unit="g" dot={{ r: 4 }} connectNulls />
                      <Bar yAxisId="right" dataKey="feedKg" fill="#93c5fd" stroke="#2563eb" strokeWidth={1} name="Total Feed (Kg)" unit="Kg" radius={[4, 4, 0, 0]} />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState message="No feed records for the selected period." />
                )}
              </div>
            )}

            {selectedKpi === 'temperature' && (
              <div
                className="farm-chart-card--interactive"
                onDoubleClick={() => setFullscreenChart('kpi_temperature')}
                title="Double-click to expand to fullscreen"
              >
                <div className="farm-analytics-header">
                  <div>
                    <h3>Detailed Environmental Temperature Monitoring</h3>
                    <p className="farm-analytics-sub">Daily shed temperature ranges with maximum, minimum, and average readings · Double-click to expand</p>
                    <ChartSummary items={summarizeSeries(chartData, 'temperature', '°C')} />
                  </div>
                  <div className="farm-chart-header-actions">
                    <div className="farm-analytics-badges">
                      <span className="farm-analytics-badge farm-analytics-badge--primary">Avg: {agg.avgTemperature}°C</span>
                      <span className="farm-analytics-badge">Comfort Zone: 18°C – 30°C</span>
                    </div>
                    <button
                      type="button"
                      className="farm-chart-expand-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFullscreenChart('kpi_temperature');
                      }}
                      title="Expand to Fullscreen (or double-click chart)"
                    >
                      <Maximize2 size={13} />
                      <span>Fullscreen</span>
                    </button>
                    <button type="button" className="farm-analytics-close-btn" onClick={() => setSelectedKpi(null)} title="Collapse analytics">
                      <X size={14} /> <span>Collapse</span>
                    </button>
                  </div>
                </div>
                {chartData.length > 0 && chartData.some((d) => d.temperature !== null) ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={chartData} margin={{ top: 12, right: 24, left: -6, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} tickMargin={8} padding={{ left: 24, right: 24 }} interval="preserveStartEnd" />
                      <YAxis domain={[10, 45]} tick={{ fontSize: 11, fill: '#ea580c' }} unit="°C" width={40} />
                      <Tooltip content={<ProfessionalChartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} iconType="circle" iconSize={8} />
                      <ReferenceLine y={30} stroke="#f87171" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: '30°C Max Comfort', position: 'insideTopLeft', fill: '#dc2626', fontSize: 11 }} />
                      <ReferenceLine y={18} stroke="#38bdf8" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: '18°C Min Comfort', position: 'insideBottomLeft', fill: '#0284c7', fontSize: 11 }} />
                      <Line type="monotone" dataKey="temperature" stroke="#ea580c" strokeWidth={2.5} name="Average Temp (°C)" unit="°C" dot={{ r: 4 }} connectNulls />
                      {chartData.some((d) => d.tempMax !== null) && (
                        <Line type="monotone" dataKey="tempMax" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 4" name="Max Temp (°C)" unit="°C" dot={{ r: 2 }} connectNulls />
                      )}
                      {chartData.some((d) => d.tempMin !== null) && (
                        <Line type="monotone" dataKey="tempMin" stroke="#0284c7" strokeWidth={1.5} strokeDasharray="4 4" name="Min Temp (°C)" unit="°C" dot={{ r: 2 }} connectNulls />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState message="No temperature records for the selected period." />
                )}
              </div>
            )}

            {selectedKpi === 'eggWeight' && (
              <div
                className="farm-chart-card--interactive"
                onDoubleClick={() => setFullscreenChart('kpi_eggWeight')}
                title="Double-click to expand to fullscreen"
              >
                <div className="farm-analytics-header">
                  <div>
                    <h3>Egg Weight & Selection Quality Analytics</h3>
                    <p className="farm-analytics-sub">Daily sampled egg weight (g) and selection rate percentage for Farm {farm.farmId} · Double-click to expand</p>
                    <ChartSummary items={summarizeSeries(chartData, 'eggWeightAvg', 'g')} />
                  </div>
                  <div className="farm-chart-header-actions">
                    <div className="farm-analytics-badges">
                      <span className="farm-analytics-badge farm-analytics-badge--primary">Avg Weight: {agg.avgEggWeight}g</span>
                      <span className="farm-analytics-badge">Avg Selection: {agg.avgSelectionRate}%</span>
                    </div>
                    <button
                      type="button"
                      className="farm-chart-expand-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFullscreenChart('kpi_eggWeight');
                      }}
                      title="Expand to Fullscreen (or double-click chart)"
                    >
                      <Maximize2 size={13} />
                      <span>Fullscreen</span>
                    </button>
                    <button type="button" className="farm-analytics-close-btn" onClick={() => setSelectedKpi(null)} title="Collapse analytics">
                      <X size={14} /> <span>Collapse</span>
                    </button>
                  </div>
                </div>
                {chartData.length > 0 && chartData.some((d) => d.eggWeightAvg !== null || d.selectionPct > 0) ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <ComposedChart data={chartData} margin={{ top: 12, right: 24, left: -6, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} tickMargin={8} padding={{ left: 24, right: 24 }} interval="preserveStartEnd" />
                      <YAxis yAxisId="left" domain={['auto', 'auto']} tick={{ fontSize: 11, fill: '#0284c7' }} unit=" g" width={45} />
                      <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 11, fill: '#16a34a' }} unit="%" width={40} />
                      <Tooltip content={<ProfessionalChartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} iconType="circle" iconSize={8} />
                      <Line yAxisId="left" type="monotone" dataKey="eggWeightAvg" stroke="#0284c7" strokeWidth={2.5} name="Avg Egg Wt (g)" unit="g" dot={{ r: 4 }} connectNulls />
                      {chartData.some((d) => d.eggWeightMin !== null) && (
                        <Line yAxisId="left" type="monotone" dataKey="eggWeightMin" stroke="#94a3b8" strokeWidth={1.2} strokeDasharray="3 3" name="Min Egg Wt (g)" unit="g" connectNulls />
                      )}
                      {chartData.some((d) => d.eggWeightMax !== null) && (
                        <Line yAxisId="left" type="monotone" dataKey="eggWeightMax" stroke="#94a3b8" strokeWidth={1.2} strokeDasharray="3 3" name="Max Egg Wt (g)" unit="g" connectNulls />
                      )}
                      <Line yAxisId="right" type="monotone" dataKey="selectionPct" stroke="#16a34a" strokeWidth={2} name="Selection %" unit="%" dot={{ r: 3 }} connectNulls />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState message="No egg weight or selection records for the selected period." />
                )}
              </div>
            )}
          </div>
        )}

        {/* 6. REPORT HISTORY SECTION (ALWAYS VISIBLE AT BOTTOM, HIGHLIGHTED WHEN REPORTS KPI IS CLICKED) */}
        <div
          ref={reportHistoryRef}
          id="farm-report-history"
          className={`section-card ${selectedKpi === 'reports' ? 'farm-reports-highlight' : ''}`}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--gray-900)' }}>Report History</h3>
              <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--gray-500)' }}>
                Showing {reports.length} daily reports submitted for {days === 1 ? 'today' : `the last ${days} days`}
              </p>
            </div>
            {selectedKpi === 'reports' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="farm-analytics-badge farm-analytics-badge--primary">Active Filter: Submissions</span>
                <button
                  type="button"
                  className="farm-analytics-close-btn"
                  onClick={() => setSelectedKpi(null)}
                  title="Clear Reports selection"
                >
                  <X size={13} /> <span>Dismiss</span>
                </button>
              </div>
            )}
          </div>

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
                  <th>Remarks</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {[...reports].reverse().map((r) => {
                  const eligible = getEligibleBirdCount(r);
                  const mortRate = eligible > 0 ? calcMortalityRate(r.mortality ?? 0, eligible) : 0;
                  const isCriticalMort = mortRate >= (KPI_THRESHOLDS.mortalityRateCritical ?? 10) || (eligible > 0 && (r.mortality ?? 0) >= eligible);
                  const hasRemarks = Boolean(r.remarks && r.remarks.trim().length > 0);
                  return (
                    <tr key={r.reportId}>
                      <td>{formatDisplayDate(r.submissionDate)}</td>
                      <td>{eligible || r.birdCount}</td>
                      <td>{eligible > 0 ? calcProductionRate(r.eggsProduced ?? 0, eligible) : 0}%</td>
                      <td className={isCriticalMort ? 'text-danger' : ''} style={{ fontWeight: isCriticalMort ? 700 : undefined }}>
                        {mortRate}%
                        {eligible > 0 && (r.mortality ?? 0) >= eligible ? ' (100% LOSS)' : ''}
                      </td>
                      <td>{eligible > 0 ? calcFeedPerBird(r.feedKg ?? 0, eligible) : 0}g</td>
                      <td>{r.temperature !== null && r.temperature !== undefined ? `${r.temperature}°C` : '--'}</td>
                      <td>{formatTime(r.createdAt)}</td>
                      <td style={{ maxWidth: 220 }}>
                        {hasRemarks ? (
                          <div className="remarks-cell-preview" title={r.remarks}>
                            {r.remarks}
                          </div>
                        ) : (
                          <span className="remarks-cell-empty">No remarks provided</span>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-row-action"
                          onClick={() => setSelectedReport(r)}
                          title="View full report and farmer remarks"
                        >
                          <Eye size={13} />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {reports.length === 0 && <EmptyState message="No reports found for this period." />}
        </div>

        {/* 7. FULLSCREEN MODAL / OVERLAY FOR EXPANDED CHART INSPECTION */}
        {fullscreenChart && (
          <div
            className="farm-fullscreen-backdrop"
            onClick={() => setFullscreenChart(null)}
            role="dialog"
            aria-modal="true"
          >
            <div className="farm-fullscreen-dialog" onClick={(e) => e.stopPropagation()}>
              {/* MODAL HEADER */}
              <div className="farm-fullscreen-header">
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--gray-900)' }}>
                    {fullscreenChart === 'default_prod_mort' && 'Production & Mortality Trend — Fullscreen View'}
                    {fullscreenChart === 'default_temp' && 'Environmental Temperature Trend — Fullscreen View'}
                    {fullscreenChart === 'kpi_production' && 'Egg Production Volume & Target Breakdown — Fullscreen View'}
                    {fullscreenChart === 'kpi_mortality' && 'Flock Health & Mortality Breakdown — Fullscreen View'}
                    {fullscreenChart === 'kpi_feed' && 'Feed Consumption & Intake Efficiency — Fullscreen View'}
                    {fullscreenChart === 'kpi_temperature' && 'Detailed Environmental Temperature Monitoring — Fullscreen View'}
                    {fullscreenChart === 'kpi_eggWeight' && 'Egg Weight & Selection Quality Analytics — Fullscreen View'}
                  </h3>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--gray-500)' }}>
                    Farm {farm.farmId} ({farm.name || 'Unnamed Farm'}) · Period: {days === 1 ? 'Today' : `Last ${days} Days`} · Press ESC to exit
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <div className="farm-analytics-badges">
                    {fullscreenChart === 'default_prod_mort' && (
                      <>
                        <span className="farm-analytics-badge farm-analytics-badge--primary">Avg Prod: {agg.avgProductionRate}%</span>
                        <span className="farm-analytics-badge">Avg Mort: {agg.avgMortalityRate}%</span>
                        <span className="farm-analytics-badge">Reports: {reports.length}</span>
                      </>
                    )}
                    {fullscreenChart === 'default_temp' && (
                      <>
                        <span className="farm-analytics-badge farm-analytics-badge--primary">Avg: {agg.avgTemperature}°C</span>
                        <span className="farm-analytics-badge">Comfort Zone: 18°C – 30°C</span>
                      </>
                    )}
                    {fullscreenChart === 'kpi_production' && (
                      <>
                        <span className="farm-analytics-badge farm-analytics-badge--primary">Avg Prod: {agg.avgProductionRate}%</span>
                        <span className="farm-analytics-badge">Total Eggs: {totalEggs.toLocaleString()}</span>
                        <span className="farm-analytics-badge">Target: 80%</span>
                      </>
                    )}
                    {fullscreenChart === 'kpi_mortality' && (
                      <>
                        <span className="farm-analytics-badge" style={{ color: agg.avgMortalityRate > 10 ? '#dc2626' : undefined }}>
                          Avg Mort: {agg.avgMortalityRate}%
                        </span>
                        <span className="farm-analytics-badge">Dead Birds: {totalMortality.toLocaleString()}</span>
                        {totalCulling > 0 && <span className="farm-analytics-badge">Culled: {totalCulling.toLocaleString()}</span>}
                      </>
                    )}
                    {fullscreenChart === 'kpi_feed' && (
                      <>
                        <span className="farm-analytics-badge farm-analytics-badge--primary">Avg Intake: {agg.avgFeedPerBird}g/bird</span>
                        <span className="farm-analytics-badge">Total Feed: {totalFeedKg.toLocaleString()} Kg</span>
                      </>
                    )}
                    {fullscreenChart === 'kpi_temperature' && (
                      <>
                        <span className="farm-analytics-badge farm-analytics-badge--primary">Avg: {agg.avgTemperature}°C</span>
                        <span className="farm-analytics-badge">Range: 18°C – 30°C</span>
                      </>
                    )}
                    {fullscreenChart === 'kpi_eggWeight' && (
                      <>
                        <span className="farm-analytics-badge farm-analytics-badge--primary">Avg Weight: {agg.avgEggWeight}g</span>
                        <span className="farm-analytics-badge">Selection Rate: {agg.avgSelectionRate}%</span>
                      </>
                    )}
                  </div>

                  <button
                    type="button"
                    className="chart-modal-close"
                    onClick={() => setFullscreenChart(null)}
                    aria-label="Close fullscreen view"
                    title="Close (ESC)"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* MODAL BODY WITH GENUINELY RESIZED RECHARTS CONTAINER */}
              <div className="farm-fullscreen-body">
                <div className="farm-fullscreen-chart-frame">
                  {chartData.length === 0 ? (
                    <EmptyState message="No records available for the selected period." />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%" minHeight={480}>
                      {fullscreenChart === 'default_prod_mort' ? (
                        <ComposedChart data={chartData} margin={{ top: 16, right: 32, left: 0, bottom: 16 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} tickMargin={10} padding={{ left: 28, right: 28 }} interval="preserveStartEnd" />
                          <YAxis yAxisId="left" domain={[0, 100]} tick={{ fontSize: 12, fill: '#15803d' }} unit="%" width={50} />
                          <YAxis yAxisId="right" orientation="right" domain={mortalityDomainRight} tick={{ fontSize: 12, fill: '#dc2626' }} unit="%" width={50} />
                          <Tooltip content={<ProfessionalChartTooltip />} />
                          <Legend wrapperStyle={{ fontSize: '13px', paddingTop: '10px' }} iconType="circle" iconSize={10} />
                          <Line yAxisId="left" type="monotone" dataKey="production" stroke="#15803d" strokeWidth={3} name="Production %" unit="%" dot={{ r: 5, fill: '#15803d' }} activeDot={{ r: 8 }} connectNulls />
                          <Line yAxisId="right" type="monotone" dataKey="mortalityRate" stroke="#dc2626" strokeWidth={2.6} name="Mortality %" unit="%" dot={{ r: 5, fill: '#dc2626' }} activeDot={{ r: 8 }} connectNulls />
                        </ComposedChart>
                      ) : fullscreenChart === 'default_temp' ? (
                        <LineChart data={chartData} margin={{ top: 16, right: 32, left: 0, bottom: 16 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} tickMargin={10} padding={{ left: 28, right: 28 }} interval="preserveStartEnd" />
                          <YAxis domain={[10, 45]} tick={{ fontSize: 12, fill: '#ea580c' }} unit="°C" width={50} />
                          <Tooltip content={<ProfessionalChartTooltip />} />
                          <Legend wrapperStyle={{ fontSize: '13px', paddingTop: '10px' }} iconType="circle" iconSize={10} />
                          <ReferenceLine y={30} stroke="#f87171" strokeDasharray="4 4" strokeWidth={1.8} label={{ value: '30°C Max Comfort', position: 'insideTopLeft', fill: '#dc2626', fontSize: 12, fontWeight: 600 }} />
                          <ReferenceLine y={18} stroke="#38bdf8" strokeDasharray="4 4" strokeWidth={1.8} label={{ value: '18°C Min Comfort', position: 'insideBottomLeft', fill: '#0284c7', fontSize: 12, fontWeight: 600 }} />
                          <Line type="monotone" dataKey="temperature" stroke="#ea580c" strokeWidth={3} name="Temperature (°C)" unit="°C" dot={{ r: 5, fill: '#ea580c' }} activeDot={{ r: 8 }} connectNulls />
                        </LineChart>
                      ) : fullscreenChart === 'kpi_production' ? (
                        <ComposedChart data={chartData} margin={{ top: 16, right: 32, left: 0, bottom: 16 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} tickMargin={10} padding={{ left: 28, right: 28 }} interval="preserveStartEnd" />
                          <YAxis yAxisId="left" domain={[0, 100]} tick={{ fontSize: 12, fill: '#15803d' }} unit="%" width={50} />
                          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: '#059669' }} width={65} />
                          <Tooltip content={<ProfessionalChartTooltip />} />
                          <Legend wrapperStyle={{ fontSize: '13px', paddingTop: '10px' }} iconType="circle" iconSize={10} />
                          <Bar yAxisId="right" dataKey="eggsProduced" fill="#dcfce7" stroke="#15803d" strokeWidth={1.5} name="Eggs Collected" radius={[6, 6, 0, 0]} />
                          <Line yAxisId="left" type="monotone" dataKey="production" stroke="#15803d" strokeWidth={3} name="Production %" unit="%" dot={{ r: 5 }} activeDot={{ r: 8 }} connectNulls />
                          <ReferenceLine yAxisId="left" y={80} stroke="#16a34a" strokeDasharray="4 4" strokeWidth={1.8} label={{ value: 'Target 80%', fill: '#16a34a', fontSize: 12, fontWeight: 600, position: 'insideTopLeft' }} />
                        </ComposedChart>
                      ) : fullscreenChart === 'kpi_mortality' ? (
                        <ComposedChart data={chartData} margin={{ top: 16, right: 32, left: 0, bottom: 16 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} tickMargin={10} padding={{ left: 28, right: 28 }} interval="preserveStartEnd" />
                          <YAxis yAxisId="left" tick={{ fontSize: 12, fill: '#ef4444' }} width={50} />
                          <YAxis yAxisId="right" orientation="right" domain={mortalityDomainRight} tick={{ fontSize: 12, fill: '#b91c1c' }} unit="%" width={50} />
                          <Tooltip content={<ProfessionalChartTooltip />} />
                          <Legend wrapperStyle={{ fontSize: '13px', paddingTop: '10px' }} iconType="circle" iconSize={10} />
                          <Bar yAxisId="left" dataKey="mortalityCount" fill="#ef4444" name="Dead Bird Count" radius={[6, 6, 0, 0]} />
                          {chartData.some((d) => d.cullingCount > 0) && (
                            <Bar yAxisId="left" dataKey="cullingCount" fill="#f59e0b" name="Culled Count" radius={[6, 6, 0, 0]} />
                          )}
                          <Line yAxisId="right" type="monotone" dataKey="mortalityRate" stroke="#b91c1c" strokeWidth={2.8} name="Mortality Rate %" unit="%" dot={{ r: 5 }} activeDot={{ r: 8 }} connectNulls />
                          <ReferenceLine yAxisId="right" y={KPI_THRESHOLDS.mortalityRateCritical} stroke="#dc2626" strokeDasharray="4 4" strokeWidth={1.8} label={{ value: 'Critical (10%)', fill: '#dc2626', fontSize: 12, fontWeight: 600, position: 'insideTopLeft' }} />
                        </ComposedChart>
                      ) : fullscreenChart === 'kpi_feed' ? (
                        <ComposedChart data={chartData} margin={{ top: 16, right: 32, left: 0, bottom: 16 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} tickMargin={10} padding={{ left: 28, right: 28 }} interval="preserveStartEnd" />
                          <YAxis yAxisId="left" tick={{ fontSize: 12, fill: '#0d9488' }} unit=" g" width={55} />
                          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: '#2563eb' }} unit=" Kg" width={65} />
                          <Tooltip content={<ProfessionalChartTooltip />} />
                          <Legend wrapperStyle={{ fontSize: '13px', paddingTop: '10px' }} iconType="circle" iconSize={10} />
                          <Line yAxisId="left" type="monotone" dataKey="feedPerBird" stroke="#0d9488" strokeWidth={3} name="Feed per Bird (g)" unit="g" dot={{ r: 5 }} activeDot={{ r: 8 }} connectNulls />
                          <Bar yAxisId="right" dataKey="feedKg" fill="#93c5fd" stroke="#2563eb" strokeWidth={1.5} name="Total Feed (Kg)" unit="Kg" radius={[6, 6, 0, 0]} />
                        </ComposedChart>
                      ) : fullscreenChart === 'kpi_temperature' ? (
                        <LineChart data={chartData} margin={{ top: 16, right: 32, left: 0, bottom: 16 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} tickMargin={10} padding={{ left: 28, right: 28 }} interval="preserveStartEnd" />
                          <YAxis domain={[10, 45]} tick={{ fontSize: 12, fill: '#ea580c' }} unit="°C" width={50} />
                          <Tooltip content={<ProfessionalChartTooltip />} />
                          <Legend wrapperStyle={{ fontSize: '13px', paddingTop: '10px' }} iconType="circle" iconSize={10} />
                          <ReferenceLine y={30} stroke="#f87171" strokeDasharray="4 4" strokeWidth={1.8} label={{ value: '30°C Max Comfort', position: 'insideTopLeft', fill: '#dc2626', fontSize: 12, fontWeight: 600 }} />
                          <ReferenceLine y={18} stroke="#38bdf8" strokeDasharray="4 4" strokeWidth={1.8} label={{ value: '18°C Min Comfort', position: 'insideBottomLeft', fill: '#0284c7', fontSize: 12, fontWeight: 600 }} />
                          <Line type="monotone" dataKey="temperature" stroke="#ea580c" strokeWidth={3} name="Average Temp (°C)" unit="°C" dot={{ r: 5 }} activeDot={{ r: 8 }} connectNulls />
                          {chartData.some((d) => d.tempMax !== null) && (
                            <Line type="monotone" dataKey="tempMax" stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 4" name="Max Temp (°C)" unit="°C" dot={{ r: 3 }} connectNulls />
                          )}
                          {chartData.some((d) => d.tempMin !== null) && (
                            <Line type="monotone" dataKey="tempMin" stroke="#0284c7" strokeWidth={2} strokeDasharray="4 4" name="Min Temp (°C)" unit="°C" dot={{ r: 3 }} connectNulls />
                          )}
                        </LineChart>
                      ) : fullscreenChart === 'kpi_eggWeight' ? (
                        <ComposedChart data={chartData} margin={{ top: 16, right: 32, left: 0, bottom: 16 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} tickMargin={10} padding={{ left: 28, right: 28 }} interval="preserveStartEnd" />
                          <YAxis yAxisId="left" domain={['auto', 'auto']} tick={{ fontSize: 12, fill: '#0284c7' }} unit=" g" width={55} />
                          <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 12, fill: '#16a34a' }} unit="%" width={50} />
                          <Tooltip content={<ProfessionalChartTooltip />} />
                          <Legend wrapperStyle={{ fontSize: '13px', paddingTop: '10px' }} iconType="circle" iconSize={10} />
                          <Line yAxisId="left" type="monotone" dataKey="eggWeightAvg" stroke="#0284c7" strokeWidth={3} name="Avg Egg Wt (g)" unit="g" dot={{ r: 5 }} activeDot={{ r: 8 }} connectNulls />
                          {chartData.some((d) => d.eggWeightMin !== null) && (
                            <Line yAxisId="left" type="monotone" dataKey="eggWeightMin" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="3 3" name="Min Egg Wt (g)" unit="g" connectNulls />
                          )}
                          {chartData.some((d) => d.eggWeightMax !== null) && (
                            <Line yAxisId="left" type="monotone" dataKey="eggWeightMax" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="3 3" name="Max Egg Wt (g)" unit="g" connectNulls />
                          )}
                          <Line yAxisId="right" type="monotone" dataKey="selectionPct" stroke="#16a34a" strokeWidth={2.8} name="Selection %" unit="%" dot={{ r: 5 }} activeDot={{ r: 8 }} connectNulls />
                        </ComposedChart>
                      ) : null}
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <ReportDetailDrawer
          open={Boolean(selectedReport)}
          onClose={() => setSelectedReport(null)}
          report={selectedReport}
          farm={farm}
          farmer={farmer}
          role="admin"
        />
      </div>
    </DashboardLayout>
  );
}
