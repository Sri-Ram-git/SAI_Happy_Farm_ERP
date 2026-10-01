import { describe, it, expect } from 'vitest';
import {
  calcProductionGap,
  calcFcr,
  calcEggDamagePercentage,
  calcMortalityPercentage,
  calcSelectionPercentage,
  calculateFarmWeeklyKpi,
  compareByProductionGap,
  compareByFcr,
  compareByEggDamage,
  compareByMortality,
  compareBySelection,
  RANKING_WEIGHTS,
  type FarmWeeklyRankingKpi,
} from './kpiCalculations';

const makeFarm = (overrides: Partial<FarmWeeklyRankingKpi>): FarmWeeklyRankingKpi => ({
  farmId: 'F1',
  farmName: 'Farm 1',
  birdCount: 5000,
  actualProductionPct: 85,
  feedConsumedKg: 500,
  eggsProduced: 4000,
  avgEggWeightG: 60,
  eggsReceived: 4000,
  damageCount: 40,
  selectedEggs: 3600,
  mortalityBirds: 15,
  productionGapPct: 5.0,
  fcr: 2.08,
  eggDamagePct: 1.0,
  mortalityPct: 0.3,
  selectionPct: 90.0,
  reportCount: 7,
  hasIncompleteData: false,
  missingFields: [],
  ...overrides,
});

describe('Supervisor Farm Performance Ranking Suite (Phase 1)', () => {
  describe('1.1 & 1.3 Ranking Formulas & Direction', () => {
    it('should verify parameter weights sum to 100%', () => {
      const sum =
        RANKING_WEIGHTS.productionGap +
        RANKING_WEIGHTS.fcr +
        RANKING_WEIGHTS.eggDamage +
        RANKING_WEIGHTS.mortality +
        RANKING_WEIGHTS.selection;
      expect(sum).toBe(100);
      expect(RANKING_WEIGHTS.productionGap).toBe(35);
      expect(RANKING_WEIGHTS.fcr).toBe(25);
      expect(RANKING_WEIGHTS.eggDamage).toBe(20);
      expect(RANKING_WEIGHTS.mortality).toBe(10);
      expect(RANKING_WEIGHTS.selection).toBe(10);
    });

    it('Production Gap %: should compute Actual Production % - 80% standard', () => {
      // 85% actual - 80% std = +5.0%
      expect(calcProductionGap(85)).toBe(5.0);
      // 76.5% actual - 80% std = -3.5%
      expect(calcProductionGap(76.5)).toBe(-3.5);
      // 80.0% actual - 80% std = 0.0%
      expect(calcProductionGap(80)).toBe(0.0);
      // Null/invalid handling
      expect(calcProductionGap(null)).toBeNull();
    });

    it('FCR: should compute Feed Consumed (kg) / (Eggs Produced * Avg Egg Wt (g) / 1000)', () => {
      // 500 kg feed, 4000 eggs, 60g avg egg wt -> (4000 * 60) / 1000 = 240 kg eggs
      // FCR = 500 / 240 = 2.08
      expect(calcFcr(500, 4000, 60)).toBe(2.08);

      // 600 kg feed, 5000 eggs, 55g avg egg wt -> (5000 * 55) / 1000 = 275 kg eggs
      // FCR = 600 / 275 = 2.18
      expect(calcFcr(600, 5000, 55)).toBe(2.18);

      // Safe handling of 0 or invalid inputs
      expect(calcFcr(0, 4000, 60)).toBeNull();
      expect(calcFcr(500, 0, 60)).toBeNull();
      expect(calcFcr(500, 4000, 0)).toBeNull();
      expect(calcFcr(500, 4000, null)).toBeNull();
    });

    it('Egg Damage %: should compute Damage Count / Eggs Received * 100', () => {
      // 40 damaged out of 4000 received = 1.0%
      expect(calcEggDamagePercentage(40, 4000)).toBe(1.0);
      // 75 damaged out of 3000 received = 2.5%
      expect(calcEggDamagePercentage(75, 3000)).toBe(2.5);

      // Safe handling
      expect(calcEggDamagePercentage(0, 4000)).toBe(0.0);
      expect(calcEggDamagePercentage(40, 0)).toBeNull();
      expect(calcEggDamagePercentage(-5, 1000)).toBeNull();
    });

    it('Mortality %: should compute Mortality Birds / Bird Count * 100', () => {
      // 15 dead birds out of 5000 birds = 0.3%
      expect(calcMortalityPercentage(15, 5000)).toBe(0.3);
      // 25 dead birds out of 1000 birds = 2.5%
      expect(calcMortalityPercentage(25, 1000)).toBe(2.5);

      // Safe handling
      expect(calcMortalityPercentage(0, 5000)).toBe(0.0);
      expect(calcMortalityPercentage(10, 0)).toBeNull();
      expect(calcMortalityPercentage(-2, 5000)).toBeNull();
    });

    it('Selection %: should compute Selected Eggs / Eggs Produced * 100', () => {
      // 3600 selected out of 4000 eggs = 90.0%
      expect(calcSelectionPercentage(3600, 4000)).toBe(90.0);
      // 4250 selected out of 5000 eggs = 85.0%
      expect(calcSelectionPercentage(4250, 5000)).toBe(85.0);

      // Safe handling
      expect(calcSelectionPercentage(0, 4000)).toBe(0.0);
      expect(calcSelectionPercentage(3600, 0)).toBeNull();
      expect(calcSelectionPercentage(-10, 4000)).toBeNull();
    });
  });

  describe('1.6 Documented Tie-Breakers', () => {

    it('1. Production Gap tie: resolved by FCR; lower FCR wins', () => {
      const farmA = makeFarm({ farmId: 'A', productionGapPct: 5.0, fcr: 2.15 });
      const farmB = makeFarm({ farmId: 'B', productionGapPct: 5.0, fcr: 1.95 });

      // B has lower FCR -> B ranks higher (comparator negative means A comes after B)
      expect(compareByProductionGap(farmA, farmB)).toBeGreaterThan(0);
      expect(compareByProductionGap(farmB, farmA)).toBeLessThan(0);

      // When gap is not tied, higher gap wins
      const farmC = makeFarm({ farmId: 'C', productionGapPct: 6.0, fcr: 2.30 });
      expect(compareByProductionGap(farmC, farmA)).toBeLessThan(0);
    });

    it('2. FCR tie: resolved by Production Gap; higher gap wins', () => {
      const farmA = makeFarm({ farmId: 'A', fcr: 2.0, productionGapPct: 3.5 });
      const farmB = makeFarm({ farmId: 'B', fcr: 2.0, productionGapPct: 5.5 });

      // B has higher gap -> B ranks higher
      expect(compareByFcr(farmA, farmB)).toBeGreaterThan(0);
      expect(compareByFcr(farmB, farmA)).toBeLessThan(0);

      // When FCR is not tied, lower FCR wins
      const farmC = makeFarm({ farmId: 'C', fcr: 1.85, productionGapPct: 2.0 });
      expect(compareByFcr(farmC, farmA)).toBeLessThan(0);
    });

    it('3. Egg Damage tie: resolved by Selection %; higher selection wins', () => {
      const farmA = makeFarm({ farmId: 'A', eggDamagePct: 1.5, selectionPct: 88.0 });
      const farmB = makeFarm({ farmId: 'B', eggDamagePct: 1.5, selectionPct: 92.0 });

      // B has higher selection % -> B ranks higher
      expect(compareByEggDamage(farmA, farmB)).toBeGreaterThan(0);
      expect(compareByEggDamage(farmB, farmA)).toBeLessThan(0);

      // When damage is not tied, lower damage wins
      const farmC = makeFarm({ farmId: 'C', eggDamagePct: 1.0, selectionPct: 80.0 });
      expect(compareByEggDamage(farmC, farmA)).toBeLessThan(0);
    });

    it('4. Mortality tie: resolved by Production Gap; higher gap wins', () => {
      const farmA = makeFarm({ farmId: 'A', mortalityPct: 0.5, productionGapPct: 2.0 });
      const farmB = makeFarm({ farmId: 'B', mortalityPct: 0.5, productionGapPct: 4.5 });

      // B has higher gap -> B ranks higher
      expect(compareByMortality(farmA, farmB)).toBeGreaterThan(0);
      expect(compareByMortality(farmB, farmA)).toBeLessThan(0);

      // When mortality is not tied, lower mortality wins
      const farmC = makeFarm({ farmId: 'C', mortalityPct: 0.2, productionGapPct: 1.0 });
      expect(compareByMortality(farmC, farmA)).toBeLessThan(0);
    });

    it('5. Selection tie: resolved by FCR; lower FCR wins', () => {
      const farmA = makeFarm({ farmId: 'A', selectionPct: 90.0, fcr: 2.20 });
      const farmB = makeFarm({ farmId: 'B', selectionPct: 90.0, fcr: 2.05 });

      // B has lower FCR -> B ranks higher
      expect(compareBySelection(farmA, farmB)).toBeGreaterThan(0);
      expect(compareBySelection(farmB, farmA)).toBeLessThan(0);

      // When selection is not tied, higher selection wins
      const farmC = makeFarm({ farmId: 'C', selectionPct: 94.0, fcr: 2.50 });
      expect(compareBySelection(farmC, farmA)).toBeLessThan(0);
    });
  });

  describe('Aggregation & Data Completeness', () => {
    it('should aggregate reports into weekly KPIs correctly', () => {
      const mockReports = [
        {
          submissionDate: '2026-09-22',
          openingBirdCount: 5000,
          closingBirdCount: 4995,
          feedKg: 500,
          eggsProduced: 4200,
          selectionEggs: 3800,
          damagedEggs: 40,
          mortality: 5,
          eggWeight: { min: 55, max: 65, avg: 60 },
        },
        {
          submissionDate: '2026-09-23',
          openingBirdCount: 4995,
          closingBirdCount: 4990,
          feedKg: 510,
          eggsProduced: 4250,
          selectionEggs: 3900,
          damagedEggs: 35,
          mortality: 5,
          eggWeight: { min: 56, max: 64, avg: 60 },
        },
      ];

      const kpis = calculateFarmWeeklyKpi({
        farmId: 'AP12',
        farmName: 'Farm AP12',
        reports: mockReports,
      });

      expect(kpis.farmId).toBe('AP12');
      expect(kpis.feedConsumedKg).toBe(1010);
      expect(kpis.eggsProduced).toBe(8450);
      expect(kpis.mortalityBirds).toBe(10);
      expect(kpis.selectedEggs).toBe(7700);
      expect(kpis.damageCount).toBe(75);
      expect(kpis.avgEggWeightG).toBe(60);
      expect(kpis.fcr).toBeDefined();
      expect(kpis.productionGapPct).toBeDefined();
      expect(kpis.hasIncompleteData).toBe(false);
    });

    it('should aggregate reports with field aliases and populated kpiReasons', () => {
      const aliasedReports = [
        {
          date: '2026-09-25',
          birdCount: 4500,
          feedConsumedKg: 450,
          production: 3800,
          selectedEggs: 3400,
          damageCount: 30,
          deadBirds: 4,
          avgEggWeight: 58,
          eggsReceived: 3800,
        },
        {
          date: '2026-09-26',
          currentBirdCount: 4496,
          feedKg: 460,
          totalEggs: 3850,
          selection: 3450,
          damageEggs: 25,
          mortality: 3,
          eggWeightAvg: 58,
          receivedEggs: 3850,
        },
      ];

      const kpis = calculateFarmWeeklyKpi({
        farmId: 'AP99',
        farmName: 'Farm AP99',
        reports: aliasedReports,
        standardProductionPct: 80,
      });

      expect(kpis.farmId).toBe('AP99');
      expect(kpis.feedConsumedKg).toBe(910);
      expect(kpis.eggsProduced).toBe(7650);
      expect(kpis.selectedEggs).toBe(6850);
      expect(kpis.damageCount).toBe(55);
      expect(kpis.mortalityBirds).toBe(7);
      expect(kpis.avgEggWeightG).toBe(58);
      expect(kpis.productionGapPct).not.toBeNull();
      expect(kpis.fcr).not.toBeNull();
      expect(kpis.eggDamagePct).not.toBeNull();
      expect(kpis.mortalityPct).not.toBeNull();
      expect(kpis.selectionPct).not.toBeNull();
      expect(kpis.kpiReasons?.productionGap).toBeUndefined();
    });

    it('should provide informative kpiReasons when specific metrics cannot be calculated', () => {
      const missingEggWeightReports = [
        {
          date: '2026-09-25',
          birdCount: 5000,
          feedKg: 500,
          eggsProduced: 4000,
          mortality: 5,
          selectionEggs: 3500,
          damagedEggs: 20,
          // eggWeight intentionally omitted
        },
      ];

      const kpis = calculateFarmWeeklyKpi({
        farmId: 'AP88',
        farmName: 'Farm AP88',
        reports: missingEggWeightReports,
      });

      expect(kpis.fcr).toBeNull();
      expect(kpis.kpiReasons?.fcr).toBe('Missing egg weight');
      expect(kpis.productionGapPct).not.toBeNull();
      expect(kpis.selectionPct).not.toBeNull();
      expect(kpis.mortalityPct).not.toBeNull();
    });

    it('should support configurable standardProductionPct', () => {
      const reports = [
        {
          date: '2026-09-25',
          birdCount: 1000,
          feedKg: 100,
          eggsProduced: 850, // 85% production
          eggWeight: 60,
        },
      ];

      const kpi80 = calculateFarmWeeklyKpi({
        farmId: 'A1',
        farmName: 'Farm A1',
        reports,
        standardProductionPct: 80,
      });
      // 85% - 80% = +5.0%
      expect(kpi80.productionGapPct).toBe(5.0);

      const kpi82 = calculateFarmWeeklyKpi({
        farmId: 'A1',
        farmName: 'Farm A1',
        reports,
        standardProductionPct: 82,
      });
      // 85% - 82% = +3.0%
      expect(kpi82.productionGapPct).toBe(3.0);
    });

    it('should sort null KPI values to the bottom and resolve identical values with farmId fallback', () => {
      const farmWithVal = makeFarm({ farmId: 'B_VAL', fcr: 2.1 });
      const farmWithNull = makeFarm({ farmId: 'A_NULL', fcr: null });
      const farmWithNull2 = makeFarm({ farmId: 'Z_NULL', fcr: null });

      // In FCR comparison, valid FCR comes before null FCR
      expect(compareByFcr(farmWithVal, farmWithNull)).toBeLessThan(0);
      expect(compareByFcr(farmWithNull, farmWithVal)).toBeGreaterThan(0);

      // Between two nulls, deterministic fallback by farmId
      expect(compareByFcr(farmWithNull, farmWithNull2)).toBeLessThan(0);
      expect(compareByFcr(farmWithNull2, farmWithNull)).toBeGreaterThan(0);
    });
  });
});
