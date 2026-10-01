import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
  Trophy,
  FileSpreadsheet,
  Download,
  Calendar,
  Layers,
  AlertTriangle,
  Info,
  CheckCircle2,
  SlidersHorizontal,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/dashboard/DashboardLayout';
import { LoadingState } from '../../components/dashboard/LoadingState';
import { EmptyState } from '../../components/dashboard/EmptyState';
import { DateFilter } from '../../components/dashboard/DateFilter';
import { useDailyReportsByFarms } from '../../hooks/useDailyReports';
import { getFarmsByIds, type FarmDoc } from '../../services/farmDataService';
import { getIstDate, getDaysAgo, formatDisplayDate } from '../../utils/dateUtils';
import { getWeekDates } from '../../services/excelExportService';
import { calculateReportingWeek } from '../../services/reportService';
import {
  calculateFarmWeeklyKpi,
  compareByProductionGap,
  compareByFcr,
  compareByEggDamage,
  compareByMortality,
  compareBySelection,
  RANKING_WEIGHTS,
  type FarmWeeklyRankingKpi,
} from '../../utils/kpiCalculations';

type ActiveTab = 'ranking' | 'weekly_data' | 'summary';
type RankingMetric = 'productionGap' | 'fcr' | 'eggDamage' | 'mortality' | 'selection';

export function SupervisorRankingsPage() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();

  // Mode & Navigation state
  const [activeTab, setActiveTab] = useState<ActiveTab>('ranking');
  const [activeMetric, setActiveMetric] = useState<RankingMetric>('productionGap');

  // Date Filtering: Presets (Today: 1, 7 Days: 7, 30 Days: 30, 90 Days: 90) vs Custom Calendar
  const [presetDays, setPresetDays] = useState<number | null>(7);
  const [selectedDate, setSelectedDate] = useState<string>(getIstDate());
  const [farms, setFarms] = useState<FarmDoc[]>([]);
  const [farmsLoading, setFarmsLoading] = useState(true);

  // Compute Monday-Sunday week bounds and week number for calendar fallback
  const weekInfo = useMemo(() => getWeekDates(selectedDate), [selectedDate]);
  const reportingWeek = useMemo(() => {
    return calculateReportingWeek(userProfile?.createdAt || '2026-01-01', selectedDate, 3);
  }, [userProfile?.createdAt, selectedDate]);

  // Compute effective date range based on active preset or calendar selection
  const { startDate, endDate, expectedDays, periodTitle, periodSubtitle } = useMemo(() => {
    if (presetDays !== null) {
      const start = getDaysAgo(presetDays === 1 ? 0 : presetDays - 1);
      const end = getIstDate();
      const title = presetDays === 1 ? `Today (${formatDisplayDate(end)})` : `${presetDays} Days`;
      const subtitle = `${formatDisplayDate(start)} — ${formatDisplayDate(end)}`;
      return { startDate: start, endDate: end, expectedDays: presetDays, periodTitle: title, periodSubtitle: subtitle };
    } else {
      const start = weekInfo.startDate;
      const end = weekInfo.endDate;
      const title = reportingWeek.label;
      const subtitle = weekInfo.label;
      return { startDate: start, endDate: end, expectedDays: 7, periodTitle: title, periodSubtitle: subtitle };
    }
  }, [presetDays, selectedDate, weekInfo, reportingWeek]);

  const assignedFarmIds = useMemo(() => userProfile?.farmIds ?? [], [userProfile?.farmIds]);

  // Load daily reports for assigned farms within the active date range
  const { reports, loading: reportsLoading, error: reportsError } = useDailyReportsByFarms(
    assignedFarmIds,
    startDate,
    endDate
  );

  useEffect(() => {
    if (assignedFarmIds.length === 0) {
      setFarmsLoading(false);
      return;
    }
    setFarmsLoading(true);
    getFarmsByIds(assignedFarmIds)
      .then((loaded) => {
        setFarms(loaded);
      })
      .catch((err) => console.error('[SupervisorRankings] Failed to load farms:', err))
      .finally(() => setFarmsLoading(false));
  }, [assignedFarmIds.join(',')]);

  // Compute 5 KPIs and raw weekly inputs for each farm
  const farmKpis: FarmWeeklyRankingKpi[] = useMemo(() => {
    return farms.map((farm) => {
      const farmReports = reports.filter((r) => r.farmId?.trim().toUpperCase() === farm.farmId?.trim().toUpperCase());
      return calculateFarmWeeklyKpi({
        farmId: farm.farmId,
        farmName: farm.name || `Farm ${farm.farmId}`,
        reports: farmReports,
        standardProductionPct: 80,
      });
    });
  }, [farms, reports]);

  // Sorted rankings based on active parameter and documented tie-breakers
  const sortedRankings = useMemo(() => {
    const list = [...farmKpis];
    switch (activeMetric) {
      case 'productionGap':
        return list.sort(compareByProductionGap);
      case 'fcr':
        return list.sort(compareByFcr);
      case 'eggDamage':
        return list.sort(compareByEggDamage);
      case 'mortality':
        return list.sort(compareByMortality);
      case 'selection':
        return list.sort(compareBySelection);
      default:
        return list;
    }
  }, [farmKpis, activeMetric]);

  // Summary Dashboard aggregate calculations
  const summaryAggregates = useMemo(() => {
    const totalFarms = farms.length;
    const reportingFarms = farmKpis.filter((k) => k.reportCount > 0).length;
    const totalBirds = farmKpis.reduce((s, k) => s + k.birdCount, 0);
    const totalFeedKg = farmKpis.reduce((s, k) => s + k.feedConsumedKg, 0);
    const totalEggs = farmKpis.reduce((s, k) => s + k.eggsProduced, 0);
    const totalSelectedEggs = farmKpis.reduce((s, k) => s + k.selectedEggs, 0);
    const totalDamagedEggs = farmKpis.reduce((s, k) => s + k.damageCount, 0);
    const totalMortality = farmKpis.reduce((s, k) => s + k.mortalityBirds, 0);

    const validProductionGaps = farmKpis.map((k) => k.productionGapPct).filter((v): v is number => v !== null);
    const validFcrs = farmKpis.map((k) => k.fcr).filter((v): v is number => v !== null);
    const validDamages = farmKpis.map((k) => k.eggDamagePct).filter((v): v is number => v !== null);
    const validMortalities = farmKpis.map((k) => k.mortalityPct).filter((v): v is number => v !== null);
    const validSelections = farmKpis.map((k) => k.selectionPct).filter((v): v is number => v !== null);

    const avg = (arr: number[]) => (arr.length > 0 ? parseFloat((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)) : null);

    return {
      totalFarms,
      reportingFarms,
      totalBirds,
      totalFeedKg: Math.round(totalFeedKg),
      totalEggs,
      totalSelectedEggs,
      totalDamagedEggs,
      totalMortality,
      avgProductionGap: avg(validProductionGaps),
      avgFcr: validFcrs.length > 0 ? parseFloat((validFcrs.reduce((a, b) => a + b, 0) / validFcrs.length).toFixed(2)) : null,
      avgEggDamage: avg(validDamages),
      avgMortality: avg(validMortalities),
      avgSelection: avg(validSelections),
    };
  }, [farms, farmKpis]);

  // Export to Excel workflow (Phase 3.5)
  const handleExportSpreadsheet = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Weekly Data (Source Inputs & Formula Results)
      const weeklyDataAoa = [
        ['FARM PERFORMANCE REPORT — SOURCE INPUTS & FORMULA OUTPUTS'],
        ['Report Period', periodTitle, 'Date Range', `${startDate} to ${endDate}`, 'Cycle/Preset', presetDays ? `${presetDays} Days Preset` : weekInfo.label],
        [],
        [
          'Farm ID',
          'Farm Name',
          'Bird Count (D)',
          'Actual Prod % (G)',
          'Feed Consumed (kg) (H)',
          'Eggs Produced (I)',
          'Avg Egg Wt (g) (J)',
          'Eggs Received (L)',
          'Damage Count (M)',
          'Selected Eggs (O)',
          'Mortality Birds (Q)',
          'Production Gap % (35%)',
          'FCR (25%)',
          'Egg Damage % (20%)',
          'Mortality % (10%)',
          'Selection % (10%)',
          'Data Status',
        ],
        ...farmKpis.map((k) => [
          k.farmId,
          k.farmName,
          k.birdCount,
          k.actualProductionPct !== null ? `${k.actualProductionPct}%` : 'N/A',
          k.feedConsumedKg,
          k.eggsProduced,
          k.avgEggWeightG !== null ? k.avgEggWeightG : 'N/A',
          k.eggsReceived,
          k.damageCount,
          k.selectedEggs,
          k.mortalityBirds,
          k.productionGapPct !== null ? `${k.productionGapPct >= 0 ? '+' : ''}${k.productionGapPct}%` : 'N/A',
          k.fcr !== null ? k.fcr : 'N/A',
          k.eggDamagePct !== null ? `${k.eggDamagePct}%` : 'N/A',
          k.mortalityPct !== null ? `${k.mortalityPct}%` : 'N/A',
          k.selectionPct !== null ? `${k.selectionPct}%` : 'N/A',
          k.hasIncompleteData ? `Incomplete (${k.missingFields.join(', ')})` : 'Complete',
        ]),
      ];
      const wsWeeklyData = XLSX.utils.aoa_to_sheet(weeklyDataAoa);
      XLSX.utils.book_append_sheet(wb, wsWeeklyData, 'Weekly Data');

      // Sheet 2: Final Ranking
      const rankingAoa = [
        ['SUPERVISOR FARM PERFORMANCE RANKING'],
        ['Primary Sorting Metric', getMetricTitle(activeMetric)],
        ['Documented Tie-Breaker', getTieBreakerText(activeMetric)],
        ['Reporting Period', `${periodTitle} (${periodSubtitle})`],
        ['Business Rule Notice', 'Overall composite ranking pending verified multi-metric normalization scale.'],
        [],
        [
          'Rank',
          'Farm ID',
          'Farm Name',
          'Production Gap % (35%)',
          'FCR (25%)',
          'Egg Damage % (20%)',
          'Mortality % (10%)',
          'Selection % (10%)',
          'Reports Submitted',
        ],
        ...sortedRankings.map((k, idx) => [
          `#${idx + 1}`,
          k.farmId,
          k.farmName,
          k.productionGapPct !== null ? `${k.productionGapPct >= 0 ? '+' : ''}${k.productionGapPct}%` : 'N/A',
          k.fcr !== null ? k.fcr : 'N/A',
          k.eggDamagePct !== null ? `${k.eggDamagePct}%` : 'N/A',
          k.mortalityPct !== null ? `${k.mortalityPct}%` : 'N/A',
          k.selectionPct !== null ? `${k.selectionPct}%` : 'N/A',
          `${k.reportCount} / ${expectedDays} days`,
        ]),
      ];
      const wsRanking = XLSX.utils.aoa_to_sheet(rankingAoa);
      XLSX.utils.book_append_sheet(wb, wsRanking, 'Final Ranking');

      // Sheet 3: Summary Dashboard
      const summaryAoa = [
        ['PERFORMANCE SUMMARY DASHBOARD'],
        ['Reporting Period', `${periodTitle} (${periodSubtitle})`],
        ['Date Range', `${startDate} to ${endDate}`],
        [],
        ['Metric Description', 'Aggregate Value', 'Unit'],
        ['Total Assigned Farms', summaryAggregates.totalFarms, 'Farms'],
        ['Farms Reporting in Period', summaryAggregates.reportingFarms, 'Farms'],
        ['Total Bird Population', summaryAggregates.totalBirds, 'Birds'],
        ['Total Feed Consumed', summaryAggregates.totalFeedKg, 'Kg'],
        ['Total Eggs Produced', summaryAggregates.totalEggs, 'Eggs'],
        ['Total Selected Eggs', summaryAggregates.totalSelectedEggs, 'Eggs'],
        ['Total Damaged Eggs', summaryAggregates.totalDamagedEggs, 'Eggs'],
        ['Total Dead Birds (Mortality)', summaryAggregates.totalMortality, 'Birds'],
        ['Average Production Gap %', summaryAggregates.avgProductionGap !== null ? `${summaryAggregates.avgProductionGap}%` : 'N/A', '%'],
        ['Average FCR', summaryAggregates.avgFcr !== null ? summaryAggregates.avgFcr : 'N/A', 'Ratio'],
        ['Average Egg Damage %', summaryAggregates.avgEggDamage !== null ? `${summaryAggregates.avgEggDamage}%` : 'N/A', '%'],
        ['Average Mortality %', summaryAggregates.avgMortality !== null ? `${summaryAggregates.avgMortality}%` : 'N/A', '%'],
        ['Average Selection %', summaryAggregates.avgSelection !== null ? `${summaryAggregates.avgSelection}%` : 'N/A', '%'],
      ];
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryAoa);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary Dashboard');

      const filename = `Supervisor_Farm_Rankings_${startDate}_to_${endDate}.xlsx`;
      XLSX.writeFile(wb, filename);
    } catch (err) {
      console.error('[SupervisorRankings] Export spreadsheet error:', err);
      alert('Failed to export report spreadsheet. Check console for details.');
    }
  };

  const loading = farmsLoading || reportsLoading;

  if (loading) {
    return (
      <DashboardLayout role="supervisor" userName={userProfile?.name}>
        <LoadingState />
      </DashboardLayout>
    );
  }

  if (assignedFarmIds.length === 0) {
    return (
      <DashboardLayout role="supervisor" userName={userProfile?.name}>
        <EmptyState message="No farms assigned to your supervisor account." />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="supervisor" userName={userProfile?.name}>
      <div className="mgmt-page">
        {/* HEADER & DATE CONTROLS */}
        <div className="mgmt-page-header" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Trophy size={24} style={{ color: '#f59e0b' }} />
              <span>Farm Performance & Rankings</span>
            </h2>
            <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: 13 }}>
              Period: <strong style={{ color: '#0f172a' }}>{periodTitle}</strong> ({periodSubtitle})
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <DateFilter days={presetDays ?? 0} onChange={(d) => setPresetDays(d)} />

            <div
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #cbd5e1', borderRadius: 6, padding: '4px 10px' }}
              title="Select custom week ending date"
            >
              <Calendar size={15} style={{ color: '#64748b' }} />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setPresetDays(null);
                  setSelectedDate(e.target.value);
                }}
                style={{ border: 'none', outline: 'none', fontSize: 13, background: 'transparent', cursor: 'pointer' }}
              />
            </div>

            <button
              type="button"
              className="btn btn--primary"
              onClick={handleExportSpreadsheet}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', fontSize: 13, fontWeight: 600 }}
            >
              <Download size={15} />
              <span>Export Report (.xlsx)</span>
            </button>
          </div>
        </div>

        {reportsError && (
          <div className="alert alert--error" style={{ marginBottom: 16 }}>
            <AlertTriangle size={16} />
            <span>{reportsError}</span>
          </div>
        )}

        {/* WORKFLOW TABS */}
        <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #e2e8f0', marginBottom: 16 }}>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'ranking' ? 'tab-btn--active' : ''}`}
            onClick={() => setActiveTab('ranking')}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: 'transparent',
              borderBottom: activeTab === 'ranking' ? '2px solid #0284c7' : '2px solid transparent',
              color: activeTab === 'ranking' ? '#0284c7' : '#64748b',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Trophy size={16} />
            <span>1. Performance Ranking</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'weekly_data' ? 'tab-btn--active' : ''}`}
            onClick={() => setActiveTab('weekly_data')}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: 'transparent',
              borderBottom: activeTab === 'weekly_data' ? '2px solid #0284c7' : '2px solid transparent',
              color: activeTab === 'weekly_data' ? '#0284c7' : '#64748b',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <FileSpreadsheet size={16} />
            <span>2. Weekly Data (Source Inputs)</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'summary' ? 'tab-btn--active' : ''}`}
            onClick={() => setActiveTab('summary')}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: 'transparent',
              borderBottom: activeTab === 'summary' ? '2px solid #0284c7' : '2px solid transparent',
              color: activeTab === 'summary' ? '#0284c7' : '#64748b',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Layers size={16} />
            <span>3. Summary Dashboard</span>
          </button>
        </div>

        {/* TAB 1: PERFORMANCE RANKING */}
        {activeTab === 'ranking' && (
          <div>
            {/* BUSINESS RULE NOTICE BANNER (PHASE 1.4) */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderLeft: '4px solid #0284c7',
                padding: '12px 16px',
                borderRadius: 6,
                marginBottom: 16,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
              }}
            >
              <Info size={18} style={{ color: '#0284c7', marginTop: 2, flexShrink: 0 }} />
              <div style={{ fontSize: 13, color: '#334155' }}>
                <strong>Customer Specification Compliance:</strong> Showing 5 individual KPIs with documented weights. Overall combined ranking requires business-rule clarification on multi-metric normalization scale. Select any parameter below to rank farms using its verified tie-breaker.
              </div>
            </div>

            {/* PARAMETER SELECTOR BAR */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', gap: 4 }}>
                <SlidersHorizontal size={14} />
                <span>Rank By:</span>
              </span>
              <button
                type="button"
                className={`filter-chip ${activeMetric === 'productionGap' ? 'filter-chip--active' : ''}`}
                onClick={() => setActiveMetric('productionGap')}
                style={chipStyle(activeMetric === 'productionGap')}
              >
                Production Gap % (35%) · Tie: FCR
              </button>
              <button
                type="button"
                className={`filter-chip ${activeMetric === 'fcr' ? 'filter-chip--active' : ''}`}
                onClick={() => setActiveMetric('fcr')}
                style={chipStyle(activeMetric === 'fcr')}
              >
                FCR (25%) · Tie: Prod Gap
              </button>
              <button
                type="button"
                className={`filter-chip ${activeMetric === 'eggDamage' ? 'filter-chip--active' : ''}`}
                onClick={() => setActiveMetric('eggDamage')}
                style={chipStyle(activeMetric === 'eggDamage')}
              >
                Egg Damage % (20%) · Tie: Selection %
              </button>
              <button
                type="button"
                className={`filter-chip ${activeMetric === 'mortality' ? 'filter-chip--active' : ''}`}
                onClick={() => setActiveMetric('mortality')}
                style={chipStyle(activeMetric === 'mortality')}
              >
                Mortality % (10%) · Tie: Prod Gap
              </button>
              <button
                type="button"
                className={`filter-chip ${activeMetric === 'selection' ? 'filter-chip--active' : ''}`}
                onClick={() => setActiveMetric('selection')}
                style={chipStyle(activeMetric === 'selection')}
              >
                Selection % (10%) · Tie: FCR
              </button>
            </div>

            {/* RANKINGS DATA TABLE */}
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 60 }}>Rank</th>
                    <th>Farm</th>
                    <th style={{ background: activeMetric === 'productionGap' ? '#f0f9ff' : undefined }}>
                      Production Gap % ({RANKING_WEIGHTS.productionGap}%)
                      <div style={{ fontSize: 11, fontWeight: 400, color: '#64748b' }}>Target 80% [↑ Higher]</div>
                    </th>
                    <th style={{ background: activeMetric === 'fcr' ? '#f0f9ff' : undefined }}>
                      FCR ({RANKING_WEIGHTS.fcr}%)
                      <div style={{ fontSize: 11, fontWeight: 400, color: '#64748b' }}>Kg/Kg [↓ Lower]</div>
                    </th>
                    <th style={{ background: activeMetric === 'eggDamage' ? '#f0f9ff' : undefined }}>
                      Egg Damage % ({RANKING_WEIGHTS.eggDamage}%)
                      <div style={{ fontSize: 11, fontWeight: 400, color: '#64748b' }}>[↓ Lower]</div>
                    </th>
                    <th style={{ background: activeMetric === 'mortality' ? '#f0f9ff' : undefined }}>
                      Mortality % ({RANKING_WEIGHTS.mortality}%)
                      <div style={{ fontSize: 11, fontWeight: 400, color: '#64748b' }}>[↓ Lower]</div>
                    </th>
                    <th style={{ background: activeMetric === 'selection' ? '#f0f9ff' : undefined }}>
                      Selection % ({RANKING_WEIGHTS.selection}%)
                      <div style={{ fontSize: 11, fontWeight: 400, color: '#64748b' }}>[↑ Higher]</div>
                    </th>
                    <th>Submissions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRankings.map((k, i) => (
                    <tr
                      key={k.farmId}
                      className="clickable-row"
                      onClick={() => navigate(`/supervisor/farms/${k.farmId}`)}
                    >
                      <td className="td-bold" style={{ fontSize: 14 }}>
                        #{i + 1}
                      </td>
                      <td>
                        <div className="td-bold" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>{k.farmId}</span>
                          {k.mortalityPct !== null && k.mortalityPct >= 100 && (
                            <span style={{ fontSize: 10, background: '#fee2e2', color: '#dc2626', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>
                              CRITICAL LOSS
                            </span>
                          )}
                        </div>
                        <div className="td-muted">{k.farmName}</div>
                      </td>
                      <td style={{ background: activeMetric === 'productionGap' ? '#f0f9ff' : undefined }}>
                        {k.productionGapPct !== null ? (
                          <span style={{ fontWeight: 600, color: k.productionGapPct >= 0 ? '#15803d' : '#dc2626' }}>
                            {k.productionGapPct >= 0 ? `+${k.productionGapPct}%` : `${k.productionGapPct}%`}
                          </span>
                        ) : (
                          <span className="text-muted" title={k.kpiReasons?.productionGap || 'No data'} style={{ cursor: 'help' }}>
                            --
                          </span>
                        )}
                      </td>
                      <td style={{ background: activeMetric === 'fcr' ? '#f0f9ff' : undefined }}>
                        {k.fcr !== null ? (
                          <span style={{ fontWeight: 600, color: k.fcr <= 2.2 ? '#15803d' : '#d97706' }}>
                            {k.fcr}
                          </span>
                        ) : (
                          <span className="text-muted" title={k.kpiReasons?.fcr || 'No data'} style={{ cursor: 'help' }}>
                            --
                          </span>
                        )}
                      </td>
                      <td style={{ background: activeMetric === 'eggDamage' ? '#f0f9ff' : undefined }}>
                        {k.eggDamagePct !== null ? (
                          <span style={{ fontWeight: 600, color: k.eggDamagePct <= 2.0 ? '#15803d' : '#dc2626' }}>
                            {k.eggDamagePct}%
                          </span>
                        ) : (
                          <span className="text-muted" title={k.kpiReasons?.eggDamage || 'No data'} style={{ cursor: 'help' }}>
                            --
                          </span>
                        )}
                      </td>
                      <td style={{ background: activeMetric === 'mortality' ? '#f0f9ff' : undefined }}>
                        {k.mortalityPct !== null ? (
                          <span style={{ fontWeight: 600, color: k.mortalityPct <= 1.0 ? '#15803d' : '#dc2626' }}>
                            {k.mortalityPct}%
                            {k.mortalityPct >= 100 && ' (100% LOSS)'}
                          </span>
                        ) : (
                          <span className="text-muted" title={k.kpiReasons?.mortality || 'No data'} style={{ cursor: 'help' }}>
                            --
                          </span>
                        )}
                      </td>
                      <td style={{ background: activeMetric === 'selection' ? '#f0f9ff' : undefined }}>
                        {k.selectionPct !== null ? (
                          <span style={{ fontWeight: 600, color: k.selectionPct >= 85 ? '#15803d' : '#d97706' }}>
                            {k.selectionPct}%
                          </span>
                        ) : (
                          <span className="text-muted" title={k.kpiReasons?.selection || 'No data'} style={{ cursor: 'help' }}>
                            --
                          </span>
                        )}
                      </td>
                      <td>
                        <span style={{ fontSize: 12, color: k.reportCount >= expectedDays ? '#15803d' : '#d97706' }}>
                          {k.reportCount} / {expectedDays} days
                        </span>
                      </td>
                    </tr>
                  ))}
                  {sortedRankings.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: 24, color: '#64748b' }}>
                        No farm reports found for the selected reporting period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: WEEKLY DATA (SOURCE INPUTS VS FORMULA OUTPUTS) */}
        {activeTab === 'weekly_data' && (
          <div>
            <div
              style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderLeft: '4px solid #16a34a',
                padding: '12px 16px',
                borderRadius: 6,
                marginBottom: 16,
              }}
            >
              <div style={{ fontSize: 13, color: '#166534' }}>
                <strong>Spreadsheet Alignment:</strong> Corresponds to Sheet 1: Weekly Data. Columns D through Q contain designated weekly inputs aggregated across submitted reports. Formula-driven KPI results are separated and non-editable.
              </div>
            </div>

            <div className="table-container" style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ minWidth: 1100 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th colSpan={3} style={{ textAlign: 'center', borderBottom: '2px solid #cbd5e1' }}>Farm Info</th>
                    <th colSpan={8} style={{ textAlign: 'center', background: '#f0fdf4', borderBottom: '2px solid #86efac' }}>Designated Source Inputs</th>
                    <th colSpan={5} style={{ textAlign: 'center', background: '#eff6ff', borderBottom: '2px solid #93c5fd' }}>Formula-Driven Outputs</th>
                  </tr>
                  <tr>
                    <th>Farm ID</th>
                    <th>Farm Name</th>
                    <th>Reports ({expectedDays}d)</th>
                    <th>Bird Count (D)</th>
                    <th>Actual Prod % (G)</th>
                    <th>Feed (Kg) (H)</th>
                    <th>Eggs Produced (I)</th>
                    <th>Avg Egg Wt (J)</th>
                    <th>Eggs Received (L)</th>
                    <th>Damage (M)</th>
                    <th>Selected (O)</th>
                    <th>Production Gap</th>
                    <th>FCR</th>
                    <th>Damage %</th>
                    <th>Mortality %</th>
                    <th>Selection %</th>
                  </tr>
                </thead>
                <tbody>
                  {farmKpis.map((k) => (
                    <tr key={k.farmId}>
                      <td className="td-bold">{k.farmId}</td>
                      <td>{k.farmName}</td>
                      <td>
                        <span style={{ color: k.reportCount >= expectedDays ? '#15803d' : '#d97706', fontWeight: 600 }}>
                          {k.reportCount} / {expectedDays}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{k.birdCount.toLocaleString()}</td>
                      <td>{k.actualProductionPct !== null ? `${k.actualProductionPct}%` : <span className="text-muted" title={k.kpiReasons?.productionGap || 'No data'} style={{ cursor: 'help' }}>--</span>}</td>
                      <td>{k.feedConsumedKg.toLocaleString()}</td>
                      <td>{k.eggsProduced.toLocaleString()}</td>
                      <td>{k.avgEggWeightG !== null ? `${k.avgEggWeightG} g` : <span className="text-muted" title={k.kpiReasons?.fcr || 'Missing egg weight'} style={{ cursor: 'help' }}>--</span>}</td>
                      <td>{k.eggsReceived.toLocaleString()}</td>
                      <td style={{ color: k.damageCount > 0 ? '#dc2626' : undefined }}>{k.damageCount.toLocaleString()}</td>
                      <td>{k.selectedEggs.toLocaleString()}</td>
                      <td style={{ fontWeight: 600, color: k.productionGapPct !== null && k.productionGapPct >= 0 ? '#15803d' : '#dc2626' }}>
                        {k.productionGapPct !== null ? `${k.productionGapPct >= 0 ? '+' : ''}${k.productionGapPct}%` : <span className="text-muted" title={k.kpiReasons?.productionGap || 'No data'} style={{ cursor: 'help' }}>--</span>}
                      </td>
                      <td style={{ fontWeight: 600 }}>{k.fcr !== null ? k.fcr : <span className="text-muted" title={k.kpiReasons?.fcr || 'No data'} style={{ cursor: 'help' }}>--</span>}</td>
                      <td>{k.eggDamagePct !== null ? `${k.eggDamagePct}%` : <span className="text-muted" title={k.kpiReasons?.eggDamage || 'No data'} style={{ cursor: 'help' }}>--</span>}</td>
                      <td style={{ color: k.mortalityPct !== null && k.mortalityPct > 10 ? '#dc2626' : undefined, fontWeight: k.mortalityPct !== null && k.mortalityPct >= 100 ? 700 : undefined }}>
                        {k.mortalityPct !== null ? `${k.mortalityPct}%${k.mortalityPct >= 100 ? ' (100% LOSS)' : ''}` : <span className="text-muted" title={k.kpiReasons?.mortality || 'No data'} style={{ cursor: 'help' }}>--</span>}
                      </td>
                      <td>{k.selectionPct !== null ? `${k.selectionPct}%` : <span className="text-muted" title={k.kpiReasons?.selection || 'No data'} style={{ cursor: 'help' }}>--</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: SUMMARY DASHBOARD */}
        {activeTab === 'summary' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
              <div className="kpi-card" style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Total Bird Population</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>{summaryAggregates.totalBirds.toLocaleString()}</div>
                <div style={{ fontSize: 12, color: '#15803d', marginTop: 2 }}>{summaryAggregates.reportingFarms} of {summaryAggregates.totalFarms} farms reporting</div>
              </div>

              <div className="kpi-card" style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Total Feed Consumed</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#d97706', marginTop: 4 }}>{summaryAggregates.totalFeedKg.toLocaleString()} Kg</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Across all active flocks</div>
              </div>

              <div className="kpi-card" style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Total Eggs Produced</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#10b981', marginTop: 4 }}>{summaryAggregates.totalEggs.toLocaleString()}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Selected: {summaryAggregates.totalSelectedEggs.toLocaleString()}</div>
              </div>

              <div className="kpi-card" style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Average FCR</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#0284c7', marginTop: 4 }}>{summaryAggregates.avgFcr !== null ? summaryAggregates.avgFcr : 'N/A'}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Weight 25% · Lower is better</div>
              </div>

              <div className="kpi-card" style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Avg Production Gap</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: summaryAggregates.avgProductionGap !== null && summaryAggregates.avgProductionGap >= 0 ? '#15803d' : '#dc2626', marginTop: 4 }}>
                  {summaryAggregates.avgProductionGap !== null ? `${summaryAggregates.avgProductionGap >= 0 ? '+' : ''}${summaryAggregates.avgProductionGap}%` : 'N/A'}
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Vs 80% Standard Target</div>
              </div>

              <div className="kpi-card" style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Avg Selection Rate</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#16a34a', marginTop: 4 }}>
                  {summaryAggregates.avgSelection !== null ? `${summaryAggregates.avgSelection}%` : 'N/A'}
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Damaged: {summaryAggregates.avgEggDamage ?? 0}%</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function chipStyle(active: boolean): React.CSSProperties {
  return {
    padding: '6px 12px',
    borderRadius: 20,
    border: active ? '1px solid #0284c7' : '1px solid #cbd5e1',
    background: active ? '#f0f9ff' : '#fff',
    color: active ? '#0284c7' : '#475569',
    fontSize: 12,
    fontWeight: active ? 600 : 500,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  };
}

function getMetricTitle(metric: RankingMetric): string {
  switch (metric) {
    case 'productionGap':
      return 'Production Gap % (Weight 35%, Higher Better)';
    case 'fcr':
      return 'FCR (Weight 25%, Lower Better)';
    case 'eggDamage':
      return 'Egg Damage % (Weight 20%, Lower Better)';
    case 'mortality':
      return 'Mortality % (Weight 10%, Lower Better)';
    case 'selection':
      return 'Selection % (Weight 10%, Higher Better)';
  }
}

function getTieBreakerText(metric: RankingMetric): string {
  switch (metric) {
    case 'productionGap':
      return 'Tie broken by lower FCR';
    case 'fcr':
      return 'Tie broken by higher Production Gap %';
    case 'eggDamage':
      return 'Tie broken by higher Selection %';
    case 'mortality':
      return 'Tie broken by higher Production Gap %';
    case 'selection':
      return 'Tie broken by lower FCR';
  }
}
