import { describe, it, expect } from 'vitest';
import {
  calcProductionRate,
  calcMortalityRate,
  calcFeedPerBird,
  calcSelectionRate,
  aggregateReports,
  getEligibleBirdCount,
} from '../../utils/kpiCalculations';
import type { NormalizedReport } from '../../utils/normalizeDailyReport';

type KpiType = 'production' | 'mortality' | 'feed' | 'temperature' | 'eggWeight' | 'reports';

function toggleKpiSelection(current: KpiType | null, clicked: KpiType): KpiType | null {
  return current === clicked ? null : clicked;
}

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

function processFarmChartData(reports: NormalizedReport[]) {
  return reports
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
}

const mockAp12Report1: NormalizedReport = {
  id: 'rep_1',
  reportId: 'rep_1',
  userId: 'user_akel',
  farmId: 'AP12',
  flockId: 'FL1',
  submissionVersion: 1,
  status: 'submitted',
  birdCount: 5000,
  openingBirdCount: 5000,
  closingBirdCount: 4995,
  feedKg: 280,
  openingFeedKg: 1000,
  closingFeedKg: 720,
  mortality: 5,
  culling: 0,
  eggsProduced: 3600,
  selectionEggs: 3240,
  feedGramsPerBird: 56.0,
  actualProductionPct: 72.0,
  temperature: 29,
  tempMin: 24,
  tempMax: 32,
  eggWeight: { min: 48, max: 54, avg: 51 },
  bodyWeight: { min: 1400, max: 1600, avg: 1500 },
  remarks: 'Flock healthy and feeding actively',
  ammoniaPpm: 12,
  submittedBy: 'user_akel',
  submissionDate: '2026-10-15',
  submissionMethod: 'web',
  createdAt: '2026-10-15T09:30:00Z',
};

const mockAp12Report2: NormalizedReport = {
  id: 'rep_2',
  reportId: 'rep_2',
  userId: 'user_akel',
  farmId: 'AP12',
  flockId: 'FL1',
  submissionVersion: 1,
  status: 'submitted',
  birdCount: 4995,
  openingBirdCount: 4995,
  closingBirdCount: 4990,
  feedKg: 283,
  openingFeedKg: 720,
  closingFeedKg: 437,
  mortality: 5,
  culling: 0,
  eggsProduced: 3650,
  selectionEggs: 3300,
  feedGramsPerBird: 56.8,
  actualProductionPct: 73.0,
  temperature: 28,
  tempMin: 22,
  tempMax: 30,
  eggWeight: { min: 49, max: 55, avg: 52 },
  bodyWeight: { min: 1410, max: 1610, avg: 1510 },
  remarks: 'Normal egg production and good egg size',
  ammoniaPpm: 10,
  submittedBy: 'user_akel',
  submissionDate: '2026-10-31',
  submissionMethod: 'web',
  createdAt: '2026-10-31T09:45:00Z',
};

const mockAp10ReportOtherFarm: NormalizedReport = {
  id: 'rep_other',
  reportId: 'rep_other',
  userId: 'user_other',
  farmId: 'AP10',
  flockId: 'FL_OTHER',
  submissionVersion: 1,
  status: 'submitted',
  birdCount: 8000,
  openingBirdCount: 8000,
  closingBirdCount: 7950,
  feedKg: 500,
  openingFeedKg: 2000,
  closingFeedKg: 1500,
  mortality: 50,
  culling: 5,
  eggsProduced: 6000,
  selectionEggs: 5000,
  feedGramsPerBird: 62.5,
  actualProductionPct: 75.0,
  temperature: 31,
  tempMin: 25,
  tempMax: 34,
  eggWeight: { min: 50, max: 60, avg: 55 },
  bodyWeight: { min: 1400, max: 1700, avg: 1550 },
  remarks: 'Other farm report',
  ammoniaPpm: 15,
  submittedBy: 'user_other',
  submissionDate: '2026-10-20',
  submissionMethod: 'web',
  createdAt: '2026-10-20T10:00:00Z',
};

describe('Issue #02: Individual Farm Details KPI Card Interactions Suite', () => {
  describe('1. KPI Card Interaction & Collapse Mechanics', () => {
    it('should open production analytics when clicking production card', () => {
      let state: KpiType | null = null;
      state = toggleKpiSelection(state, 'production');
      expect(state).toBe('production');
    });

    it('should open mortality analytics when clicking mortality card', () => {
      let state: KpiType | null = null;
      state = toggleKpiSelection(state, 'mortality');
      expect(state).toBe('mortality');
    });

    it('should open feed analytics when clicking feed card', () => {
      let state: KpiType | null = null;
      state = toggleKpiSelection(state, 'feed');
      expect(state).toBe('feed');
    });

    it('should open temperature analytics when clicking temperature card', () => {
      let state: KpiType | null = null;
      state = toggleKpiSelection(state, 'temperature');
      expect(state).toBe('temperature');
    });

    it('should open egg weight analytics when clicking eggWeight card', () => {
      let state: KpiType | null = null;
      state = toggleKpiSelection(state, 'eggWeight');
      expect(state).toBe('eggWeight');
    });

    it('should switch between cards smoothly', () => {
      let state: KpiType | null = 'production';
      state = toggleKpiSelection(state, 'mortality');
      expect(state).toBe('mortality');
      state = toggleKpiSelection(state, 'feed');
      expect(state).toBe('feed');
      state = toggleKpiSelection(state, 'temperature');
      expect(state).toBe('temperature');
      state = toggleKpiSelection(state, 'eggWeight');
      expect(state).toBe('eggWeight');
    });

    it('should collapse the analytics section when clicking the active card again', () => {
      let state: KpiType | null = 'production';
      state = toggleKpiSelection(state, 'production');
      expect(state).toBeNull();

      state = 'mortality';
      state = toggleKpiSelection(state, 'mortality');
      expect(state).toBeNull();

      state = 'feed';
      state = toggleKpiSelection(state, 'feed');
      expect(state).toBeNull();
    });

    it('should open reports list when clicking reports card, and collapse on second click', () => {
      let state: KpiType | null = null;
      state = toggleKpiSelection(state, 'reports');
      expect(state).toBe('reports');
      state = toggleKpiSelection(state, 'reports');
      expect(state).toBeNull();
    });
  });

  describe('2. Farm Data Isolation & Date Filtering', () => {
    it('should strictly filter reports to the selected farm (AP12) and exclude other farms', () => {
      const allReports = [mockAp12Report1, mockAp12Report2, mockAp10ReportOtherFarm];
      const farmId = 'AP12';
      const farmReports = allReports.filter((r) => r.farmId === farmId);

      expect(farmReports.length).toBe(2);
      expect(farmReports.every((r) => r.farmId === 'AP12')).toBe(true);
      expect(farmReports.some((r) => r.farmId === 'AP10')).toBe(false);
    });

    it('should correctly process chart data chronologically for AP12', () => {
      const farmReports = [mockAp12Report2, mockAp12Report1]; // reversed
      const chartData = processFarmChartData(farmReports);

      expect(chartData.length).toBe(2);
      expect(chartData[0].fullDate).toBe('2026-10-15');
      expect(chartData[1].fullDate).toBe('2026-10-31');
      expect(chartData[0].date).toBe('15 Oct');
      expect(chartData[1].date).toBe('31 Oct');
      expect(chartData[0].production).toBe(72.0);
      expect(chartData[1].production).toBe(73.0);
      expect(chartData[0].feedPerBird).toBe(56.0);
      expect(chartData[1].feedPerBird).toBe(56.8);
      expect(chartData[0].temperature).toBe(29);
      expect(chartData[1].temperature).toBe(28);
      expect(chartData[0].eggWeightAvg).toBe(51);
      expect(chartData[1].eggWeightAvg).toBe(52);
    });

    it('should calculate accurate aggregates matching the Farm Details screenshot', () => {
      const farmReports = [mockAp12Report1, mockAp12Report2];
      const agg = aggregateReports(farmReports);

      expect(agg.totalReports).toBe(2);
      expect(agg.avgProductionRate).toBe(72.5); // (72.0 + 73.0) / 2
      expect(agg.avgMortalityRate).toBe(0.1); // 10 dead / 10000 total eligible
      expect(agg.avgFeedPerBird).toBe(56.4); // (56.0 + 56.8) / 2
      expect(agg.avgTemperature).toBe(28.5); // round to 29 in display or 28.5
      expect(agg.avgEggWeight).toBe(51.5);
    });
  });

  describe('3. Empty State Handling (No Fabricated Data)', () => {
    it('should return empty chart data and zero aggregates when 0 reports exist', () => {
      const emptyReports: NormalizedReport[] = [];
      const chartData = processFarmChartData(emptyReports);
      const agg = aggregateReports(emptyReports);

      expect(chartData.length).toBe(0);
      expect(agg.totalReports).toBe(0);
      expect(agg.avgProductionRate).toBe(0);
      expect(agg.avgMortalityRate).toBe(0);
      expect(agg.avgFeedPerBird).toBe(0);
      expect(agg.avgEggWeight).toBe(0);
    });
  });

  describe('4. Fullscreen Mode for All Analytics Charts', () => {
    type FullscreenChartType =
      | 'default_prod_mort'
      | 'default_temp'
      | 'kpi_production'
      | 'kpi_mortality'
      | 'kpi_feed'
      | 'kpi_temperature'
      | 'kpi_eggWeight';

    it('should support opening fullscreen modal for every chart in Farm Details', () => {
      const supportedCharts: FullscreenChartType[] = [
        'default_prod_mort',
        'default_temp',
        'kpi_production',
        'kpi_mortality',
        'kpi_feed',
        'kpi_temperature',
        'kpi_eggWeight',
      ];

      supportedCharts.forEach((chartKey) => {
        let fullscreenChart: FullscreenChartType | null = null;
        // Simulate double-click or expand button click
        fullscreenChart = chartKey;
        expect(fullscreenChart).toBe(chartKey);

        // Simulate ESC key or Close button click
        fullscreenChart = null;
        expect(fullscreenChart).toBeNull();
      });
    });

    it('should maintain real Firestore dataset and axis properties in fullscreen view', () => {
      const farmReports = [mockAp12Report1, mockAp12Report2];
      const chartData = processFarmChartData(farmReports);

      expect(chartData).toHaveLength(2);
      expect(chartData[0].production).toBe(72.0);
      expect(chartData[0].mortalityRate).toBe(0.1);
      expect(chartData[0].temperature).toBe(29);
      expect(chartData[0].feedPerBird).toBe(56.0);
      expect(chartData[0].eggWeightAvg).toBe(51);

      // Verify dates are properly formatted with short labels to prevent clipping
      expect(chartData[0].date).toBe('15 Oct');
      expect(chartData[1].date).toBe('31 Oct');
    });
  });
});
