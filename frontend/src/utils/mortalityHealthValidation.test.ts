import { describe, it, expect } from 'vitest';
import {
  validateStep,
  isSeriousMortality,
  INITIAL_FARM_FORM_DATA,
  type FarmFormData,
} from './formValidation';
import {
  calcMortalityRate,
  calcProductionRate,
  getEligibleBirdCount,
  evaluateFarmHealth,
  calcPerformanceScore,
  compareByProductionGap,
  compareByFcr,
  compareByEggDamage,
  compareByMortality,
  compareBySelection,
  calculateFarmWeeklyKpi,
  type FarmWeeklyRankingKpi,
} from './kpiCalculations';
import { KPI_THRESHOLDS } from '../config/kpiThresholds';

describe('Mortality Validation, Farm Health Status & Performance Ranking Test Suite', () => {
  const baseFormData: FarmFormData = {
    ...INITIAL_FARM_FORM_DATA,
    feedQuantity: '250',
    mortality: '0',
    culling: '0',
    eggsProduced: '4000',
    selectionEggs: '3800',
    damagedEggs: '50',
    tempMin: '24',
    tempMax: '29',
    eggWeightMin: '52',
    eggWeightMax: '64',
    eggWeightAvg: '58',
    bodyWeightMin: '1600',
    bodyWeightMax: '1900',
    bodyWeightAvg: '1750',
    ammoniaPpm: '10',
    remarks: 'Normal routine',
  };

  // =========================================================================
  // 1. FARMER FORM STEP 0 MORTALITY VALIDATION SCENARIOS
  // =========================================================================
  describe('1. Farmer Mortality Validation Scenarios (Step 0)', () => {
    const flockSize = 1000;

    it('1.1 Mortality = 0 with positive bird count should be valid and not serious', () => {
      const data: FarmFormData = { ...baseFormData, mortality: '0', culling: '0' };
      const errors = validateStep(0, data, flockSize);
      expect(errors.mortality).toBeUndefined();

      const serious = isSeriousMortality('0', flockSize);
      expect(serious.isCritical).toBe(false);
      expect(serious.isWarning).toBe(false);
      expect(serious.isTotalFlockLoss).toBe(false);
      expect(serious.requiresConfirmation).toBe(false);
    });

    it('1.2 Mortality = 1 (normal minor loss) should be valid and not serious', () => {
      const data: FarmFormData = { ...baseFormData, mortality: '1', culling: '0' };
      const errors = validateStep(0, data, flockSize);
      expect(errors.mortality).toBeUndefined();

      const serious = isSeriousMortality('1', flockSize);
      expect(serious.isCritical).toBe(false);
      expect(serious.isWarning).toBe(false);
      expect(serious.isTotalFlockLoss).toBe(false);
      expect(serious.requiresConfirmation).toBe(false);
    });

    it('1.3 Mortality below flock count (e.g. 5 out of 1000) should be valid', () => {
      const data: FarmFormData = { ...baseFormData, mortality: '5', culling: '2' };
      const errors = validateStep(0, data, flockSize);
      expect(errors.mortality).toBeUndefined();

      const serious = isSeriousMortality('5', flockSize);
      expect(serious.isCritical).toBe(false);
      expect(serious.isTotalFlockLoss).toBe(false);
    });

    it('1.4 Mortality EQUAL to eligible bird count (100% loss) should require confirmation and flag total flock loss', () => {
      const data: FarmFormData = { ...baseFormData, mortality: '1000', culling: '0' };
      // It must be syntactically valid (not rejected outright as impossible) so confirmation modal can trigger
      const errors = validateStep(0, data, flockSize);
      expect(errors.mortality).toBeUndefined();

      const serious = isSeriousMortality('1000', flockSize);
      expect(serious.isTotalFlockLoss).toBe(true);
      expect(serious.isCritical).toBe(true);
      expect(serious.requiresConfirmation).toBe(true);
      expect(serious.ratePct).toBe(100);
      expect(serious.message).toContain('TOTAL FLOCK MORTALITY');
    });

    it('1.5 Mortality EXCEEDING bird count (e.g. 1001 out of 1000) must be rejected with strict error', () => {
      const data: FarmFormData = { ...baseFormData, mortality: '1001', culling: '0' };
      const errors = validateStep(0, data, flockSize);
      expect(errors.mortality).toBeDefined();
      expect(errors.mortality).toBe('validation.exceedsBirdCount');
    });

    it('1.6 Negative mortality (e.g. -5) must be rejected with strict error', () => {
      const data: FarmFormData = { ...baseFormData, mortality: '-5', culling: '0' };
      const errors = validateStep(0, data, flockSize);
      expect(errors.mortality).toBeDefined();
      expect(errors.mortality).toBe('validation.invalidWholeNumber');
    });

    it('1.7 Fractional/decimal mortality (e.g. 3.5 birds) must be rejected as non-integer', () => {
      const data: FarmFormData = { ...baseFormData, mortality: '3.5', culling: '0' };
      const errors = validateStep(0, data, flockSize);
      expect(errors.mortality).toBeDefined();
      expect(errors.mortality).toBe('validation.invalidWholeNumber');
    });

    it('1.8 When opening bird count is 0, any mortality > 0 must be rejected', () => {
      const data: FarmFormData = { ...baseFormData, mortality: '5', culling: '0' };
      const errors = validateStep(0, data, 0);
      expect(errors.mortality).toBeDefined();
      expect(errors.mortality).toBe('validation.noEligibleBirds');
    });

    it('1.9 Mortality + culling exceeding bird count must be rejected', () => {
      const data: FarmFormData = { ...baseFormData, mortality: '900', culling: '150' };
      // 900 + 150 = 1050 > 1000
      const errors = validateStep(0, data, flockSize);
      expect(errors.mortality).toBeDefined();
      expect(errors.mortality).toBe('validation.mortalityCullingExceeds');
    });

    it('1.10 Warning mortality threshold (5% - 10%) should trigger warning flag without blocking', () => {
      // 60 out of 1000 = 6%
      const data: FarmFormData = { ...baseFormData, mortality: '60', culling: '0' };
      const errors = validateStep(0, data, flockSize);
      expect(errors.mortality).toBeUndefined();

      const serious = isSeriousMortality('60', flockSize);
      expect(serious.isWarning).toBe(true);
      expect(serious.isCritical).toBe(false);
      expect(serious.isTotalFlockLoss).toBe(false);
      expect(serious.requiresConfirmation).toBe(false);
      expect(serious.ratePct).toBe(6);
    });

    it('1.11 Critical mortality threshold (>= 10%) should trigger critical flag without total flock loss', () => {
      // 120 out of 1000 = 12%
      const data: FarmFormData = { ...baseFormData, mortality: '120', culling: '0' };
      const errors = validateStep(0, data, flockSize);
      expect(errors.mortality).toBeUndefined();

      const serious = isSeriousMortality('120', flockSize);
      expect(serious.isWarning).toBe(false);
      expect(serious.isCritical).toBe(true);
      expect(serious.isTotalFlockLoss).toBe(false);
      expect(serious.requiresConfirmation).toBe(false);
      expect(serious.ratePct).toBe(12);
    });
  });

  // =========================================================================
  // 2. DENOMINATOR RECONSTRUCTION & ZERO-SAFE CALCULATION
  // =========================================================================
  describe('2. Denominator Reconstruction & Zero-Safe Calculation', () => {
    it('2.1 Should use openingBirdCount as primary eligible flock size', () => {
      const report = {
        openingBirdCount: 5000,
        closingBirdCount: 4950,
        mortality: 40,
        culling: 10,
        birdCount: 4950,
      };
      expect(getEligibleBirdCount(report)).toBe(5000);
      expect(calcMortalityRate(report.mortality, getEligibleBirdCount(report))).toBe(0.8);
    });

    it('2.2 Should correctly reconstruct denominator when openingBirdCount is missing and closing count is 0 (100% loss)', () => {
      // When 100% mortality occurred, previous code had birdCount: 0 which caused 1000/0 = 0%
      const report = {
        birdCount: 0,
        closingBirdCount: 0,
        mortality: 1000,
        culling: 0,
      };
      const eligible = getEligibleBirdCount(report);
      expect(eligible).toBe(1000); // 0 + 1000 = 1000
      expect(calcMortalityRate(report.mortality, eligible)).toBe(100);
    });

    it('2.3 Should handle zero mortality with zero birds gracefully without division by zero', () => {
      const report = {
        birdCount: 0,
        closingBirdCount: 0,
        mortality: 0,
        culling: 0,
      };
      const eligible = getEligibleBirdCount(report);
      expect(eligible).toBe(0);
      expect(calcMortalityRate(0, eligible)).toBe(0);
    });
  });

  // =========================================================================
  // 3. FARM HEALTH STATUS EVALUATION (STRICT PRECEDENCE GATES)
  // =========================================================================
  describe('3. Farm Health Status Precedence & Evaluation', () => {
    it('3.1 CRITICAL DEFECT TEST: High production + 100% mortality must evaluate to CRITICAL, not HEALTHY', () => {
      // The exact customer disaster scenario:
      // Farmer enters mortality = entire bird count (1000 birds died).
      // Production was good earlier that day (e.g. 850 eggs = 85%).
      const disasterReport = {
        farmId: 'AP12',
        submissionDate: '2026-09-30',
        openingBirdCount: 1000,
        closingBirdCount: 0,
        birdCount: 0,
        mortality: 1000,
        eggsProduced: 850,
        feedKg: 120,
        temperature: 28,
        ammoniaPpm: 12,
      };

      const health = evaluateFarmHealth({
        reports: [disasterReport],
        farmId: 'AP12',
      });

      expect(health.status).toBe('CRITICAL');
      expect(health.isTotalFlockLoss).toBe(true);
      expect(health.cappedScore).toBeLessThanOrEqual(30);
      expect(health.reasons.some((r) => r.toLowerCase().includes('total flock') && r.toLowerCase().includes('mortality'))).toBe(true);
    });

    it('3.2 High production + Critical mortality rate (e.g. 15% mortality) must evaluate to CRITICAL', () => {
      const criticalReport = {
        farmId: 'AP14',
        submissionDate: '2026-09-30',
        openingBirdCount: 1000,
        closingBirdCount: 850,
        birdCount: 850,
        mortality: 150, // 15%
        eggsProduced: 800,
        feedKg: 110,
        temperature: 27,
      };

      const health = evaluateFarmHealth({
        reports: [criticalReport],
        farmId: 'AP14',
      });

      expect(health.status).toBe('CRITICAL');
      expect(health.cappedScore).toBeLessThanOrEqual(30);
      expect(health.reasons.some((r) => r.toLowerCase().includes('mortality rate') && r.toLowerCase().includes('critical'))).toBe(true);
    });

    it('3.3 High production + Warning mortality rate (6%) must cap at NEEDS ATTENTION (cannot be HEALTHY)', () => {
      const warningReport = {
        farmId: 'AP15',
        submissionDate: '2026-09-30',
        openingBirdCount: 1000,
        closingBirdCount: 940,
        birdCount: 940,
        mortality: 60, // 6%
        eggsProduced: 850,
        feedKg: 115,
        temperature: 26,
      };

      const health = evaluateFarmHealth({
        reports: [warningReport],
        farmId: 'AP15',
      });

      expect(health.status).toBe('NEEDS ATTENTION');
      expect(health.cappedScore).toBeLessThan(65);
      expect(health.reasons.some((r) => r.includes('High mortality rate'))).toBe(true);
    });

    it('3.4 Normal healthy flock (0.3% mortality, 85% production) must evaluate to HEALTHY or EXCELLENT', () => {
      const healthyReport = {
        farmId: 'AP16',
        submissionDate: '2026-09-30',
        openingBirdCount: 1000,
        closingBirdCount: 997,
        birdCount: 997,
        mortality: 3, // 0.3%
        eggsProduced: 850,
        feedKg: 120,
        temperature: 26,
      };

      const health = evaluateFarmHealth({
        reports: [healthyReport],
        farmId: 'AP16',
      });

      expect(['HEALTHY', 'EXCELLENT']).toContain(health.status);
      expect(health.cappedScore).toBeGreaterThanOrEqual(65);
    });

    it('3.5 Impossible mortality data (mortality > eligible birds) must evaluate to INVALID / REVIEW', () => {
      const invalidReport = {
        farmId: 'AP17',
        submissionDate: '2026-09-30',
        openingBirdCount: 1000,
        closingBirdCount: 0,
        birdCount: 0,
        mortality: 1500, // impossible
        eggsProduced: 500,
      };

      const health = evaluateFarmHealth({
        reports: [invalidReport],
        farmId: 'AP17',
      });

      expect(health.status).toBe('INVALID / REVIEW');
      expect(health.cappedScore).toBe(0);
    });

    it('3.6 Empty / missing reports must evaluate to NO DATA, never silently HEALTHY', () => {
      const health = evaluateFarmHealth({
        reports: [],
        farmId: 'AP18',
      });

      expect(health.status).toBe('NO DATA');
      expect(health.cappedScore).toBe(0);
    });
  });

  // =========================================================================
  // 4. PERFORMANCE RANKING COMPARATORS WITH TOTAL FLOCK LOSS
  // =========================================================================
  describe('4. Performance Ranking Comparators with Total Flock Loss', () => {
    // Farm A: 90% production gap (+10%), but suffered 100% mortality loss
    const farmCatastrophe: FarmWeeklyRankingKpi = {
      farmId: 'FARM_CATASTROPHE',
      farmName: 'Catastrophe Farm',
      birdCount: 0,
      actualProductionPct: 90,
      feedConsumedKg: 1000,
      eggsProduced: 9000,
      avgEggWeightG: 60,
      eggsReceived: 9000,
      damageCount: 50,
      selectedEggs: 8900,
      mortalityBirds: 1000,
      productionGapPct: 10.0,
      fcr: 1.85,
      eggDamagePct: 0.5,
      mortalityPct: 100.0,
      selectionPct: 98.8,
      reportCount: 7,
      hasIncompleteData: false,
      missingFields: [],
    };

    // Farm B: 75% production gap (-5%), but healthy (0.5% mortality)
    const farmHealthy: FarmWeeklyRankingKpi = {
      farmId: 'FARM_HEALTHY',
      farmName: 'Healthy Farm',
      birdCount: 1000,
      actualProductionPct: 75,
      feedConsumedKg: 1100,
      eggsProduced: 7500,
      avgEggWeightG: 60,
      eggsReceived: 7500,
      damageCount: 100,
      selectedEggs: 7300,
      mortalityBirds: 5,
      productionGapPct: -5.0,
      fcr: 2.4,
      eggDamagePct: 1.3,
      mortalityPct: 0.5,
      selectionPct: 97.3,
      reportCount: 7,
      hasIncompleteData: false,
      missingFields: [],
    };

    it('4.1 compareByProductionGap should rank healthy farm above 100% mortality farm despite lower production', () => {
      const list = [farmCatastrophe, farmHealthy].sort(compareByProductionGap);
      expect(list[0].farmId).toBe('FARM_HEALTHY');
      expect(list[1].farmId).toBe('FARM_CATASTROPHE');
    });

    it('4.2 compareByFcr should rank healthy farm above 100% mortality farm', () => {
      const list = [farmCatastrophe, farmHealthy].sort(compareByFcr);
      expect(list[0].farmId).toBe('FARM_HEALTHY');
      expect(list[1].farmId).toBe('FARM_CATASTROPHE');
    });

    it('4.3 compareByEggDamage should rank healthy farm above 100% mortality farm', () => {
      const list = [farmCatastrophe, farmHealthy].sort(compareByEggDamage);
      expect(list[0].farmId).toBe('FARM_HEALTHY');
      expect(list[1].farmId).toBe('FARM_CATASTROPHE');
    });

    it('4.4 compareBySelection should rank healthy farm above 100% mortality farm', () => {
      const list = [farmCatastrophe, farmHealthy].sort(compareBySelection);
      expect(list[0].farmId).toBe('FARM_HEALTHY');
      expect(list[1].farmId).toBe('FARM_CATASTROPHE');
    });

    it('4.5 compareByMortality should rank lowest mortality first and 100% mortality last', () => {
      const list = [farmCatastrophe, farmHealthy].sort(compareByMortality);
      expect(list[0].farmId).toBe('FARM_HEALTHY');
      expect(list[1].farmId).toBe('FARM_CATASTROPHE');
    });
  });

  // =========================================================================
  // 5. WEEKLY KPI AGGREGATION WITH 100% MORTALITY
  // =========================================================================
  describe('5. Weekly KPI Aggregation with 100% Mortality', () => {
    it('5.1 calculateFarmWeeklyKpi should accurately calculate mortalityPct = 100% when closing bird count is 0', () => {
      const reports = [
        {
          submissionDate: '2026-09-25',
          openingBirdCount: 1000,
          closingBirdCount: 990,
          birdCount: 990,
          mortality: 10,
          feedKg: 100,
          eggsProduced: 800,
        },
        {
          submissionDate: '2026-09-26',
          openingBirdCount: 990,
          closingBirdCount: 0,
          birdCount: 0,
          mortality: 990, // total flock loss on day 2
          feedKg: 50,
          eggsProduced: 200,
        },
      ];

      const kpi = calculateFarmWeeklyKpi({
        farmId: 'AP12',
        farmName: 'Test Farm AP12',
        reports,
      });

      // Total mortality is 10 + 990 = 1000 birds
      // Initial eligible flock is 1000 birds
      // mortalityPct must be 100%
      expect(kpi.mortalityBirds).toBe(1000);
      expect(kpi.mortalityPct).toBe(100);
    });
  });
});
