export function safeDivide(numerator: number, denominator: number): number {
  if (!denominator || denominator === 0 || isNaN(numerator) || isNaN(denominator)) return 0;
  return numerator / denominator;
}

export function calcProductionRate(eggsProduced: number, birdCount: number): number {
  return parseFloat((safeDivide(eggsProduced, birdCount) * 100).toFixed(1));
}

export function calcMortalityRate(mortality: number, birdCount: number): number {
  return parseFloat((safeDivide(mortality, birdCount) * 100).toFixed(1));
}

export function calcCullingRate(culling: number, birdCount: number): number {
  return parseFloat((safeDivide(culling, birdCount) * 100).toFixed(1));
}

export function calcSelectionRate(selectionEggs: number, eggsProduced: number): number {
  return parseFloat((safeDivide(selectionEggs, eggsProduced) * 100).toFixed(1));
}

export function calcFeedPerBird(feedKg: number, birdCount: number): number {
  return parseFloat(safeDivide(feedKg * 1000, birdCount).toFixed(1));
}

export function calcAverage(values: (number | undefined | null)[]): number {
  const valid = values.filter((v): v is number => v != null && !isNaN(v) && isFinite(v));
  if (valid.length === 0) return 0;
  return parseFloat((valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(1));
}

export function calcSubmissionCompliance(submittedDays: number, expectedDays: number): number {
  return parseFloat((safeDivide(submittedDays, expectedDays) * 100).toFixed(1));
}

export function calcPerformanceScore(params: {
  productionRate: number;
  mortalityRate: number;
  feedPerBird: number;
  submissionCompliance: number;
  weights?: { production: number; mortality: number; feedEfficiency: number; submissionCompliance: number };
}): { total: number; production: number; mortality: number; feedEfficiency: number; compliance: number } {
  const w = params.weights ?? { production: 40, mortality: 25, feedEfficiency: 15, submissionCompliance: 20 };

  const productionScore = Math.min(params.productionRate / 100 * w.production, w.production);
  const mortalityScore = Math.max(0, w.mortality - (params.mortalityRate / 20 * w.mortality));
  const feedScore = params.feedPerBird > 0 ? Math.max(0, w.feedEfficiency - (Math.abs(params.feedPerBird - 120) / 120 * w.feedEfficiency)) : w.feedEfficiency * 0.5;
  const complianceScore = params.submissionCompliance / 100 * w.submissionCompliance;

  return {
    total: parseFloat((productionScore + mortalityScore + feedScore + complianceScore).toFixed(1)),
    production: parseFloat(productionScore.toFixed(1)),
    mortality: parseFloat(mortalityScore.toFixed(1)),
    feedEfficiency: parseFloat(feedScore.toFixed(1)),
    compliance: parseFloat(complianceScore.toFixed(1)),
  };
}

export function aggregateReports(reports: any[]): {
  avgProductionRate: number;
  avgMortalityRate: number;
  avgCullingRate: number;
  avgSelectionRate: number;
  avgFeedPerBird: number;
  avgTemperature: number;
  avgEggWeight: number;
  avgBodyWeight: number;
  avgAmmonia: number;
  totalBirds: number;
  totalReports: number;
} {
  if (!reports || reports.length === 0) {
    return { avgProductionRate: 0, avgMortalityRate: 0, avgCullingRate: 0, avgSelectionRate: 0, avgFeedPerBird: 0, avgTemperature: 0, avgEggWeight: 0, avgBodyWeight: 0, avgAmmonia: 0, totalBirds: 0, totalReports: 0 };
  }

  const productionRates = reports.map((r) => calcProductionRate(r.eggsProduced ?? 0, r.birdCount ?? 0));
  const mortalityRates = reports.map((r) => calcMortalityRate(r.mortality ?? 0, r.birdCount ?? 0));
  const cullingRates = reports.map((r) => calcCullingRate(r.culling ?? 0, r.birdCount ?? 0));
  const selectionRates = reports.map((r) => calcSelectionRate(r.selectionEggs ?? 0, r.eggsProduced ?? 0));
  const feedPerBirds = reports.map((r) => calcFeedPerBird(r.feedKg ?? 0, r.birdCount ?? 0));
  const temps = reports.map((r) => r.temperature);
  const eggWeights = reports.map((r) => r.eggWeight?.avg);
  const bodyWeights = reports.map((r) => r.bodyWeight?.avg);
  const ammoinias = reports.map((r) => r.ammoniaPpm);

  return {
    avgProductionRate: calcAverage(productionRates),
    avgMortalityRate: calcAverage(mortalityRates),
    avgCullingRate: calcAverage(cullingRates),
    avgSelectionRate: calcAverage(selectionRates),
    avgFeedPerBird: calcAverage(feedPerBirds),
    avgTemperature: calcAverage(temps),
    avgEggWeight: calcAverage(eggWeights),
    avgBodyWeight: calcAverage(bodyWeights),
    avgAmmonia: calcAverage(ammoinias),
    totalBirds: reports.reduce((s, r) => s + (r.birdCount ?? 0), 0),
    totalReports: reports.length,
  };
}

// -------------------------------------------------------------
// SUPERVISOR 5-PARAMETER PERFORMANCE RANKING ENGINE & WORKFLOW
// -------------------------------------------------------------

export interface SupervisorRankingParams {
  actualProductionPct: number | null;
  feedConsumedKg: number;
  eggsProduced: number;
  avgEggWeightG: number | null;
  eggsReceived: number;
  damageCount: number;
  selectedEggs: number;
  mortalityBirds: number;
  birdCount: number;
}

export interface FarmWeeklyRankingKpi {
  farmId: string;
  farmName: string;
  // Raw Aggregates (Sheet 1: Weekly Data)
  birdCount: number;
  actualProductionPct: number | null;
  feedConsumedKg: number;
  eggsProduced: number;
  avgEggWeightG: number | null;
  eggsReceived: number;
  damageCount: number;
  selectedEggs: number;
  mortalityBirds: number;

  // 5 Documented Ranking KPIs
  productionGapPct: number | null; // Weight 35%, preferred direction: Higher
  fcr: number | null;              // Weight 25%, preferred direction: Lower
  eggDamagePct: number | null;     // Weight 20%, preferred direction: Lower
  mortalityPct: number | null;     // Weight 10%, preferred direction: Lower
  selectionPct: number | null;     // Weight 10%, preferred direction: Higher

  // Reporting Integrity
  reportCount: number;
  hasIncompleteData: boolean;
  missingFields: string[];
}

export const RANKING_WEIGHTS = {
  productionGap: 35,
  fcr: 25,
  eggDamage: 20,
  mortality: 10,
  selection: 10,
} as const;

export function calcProductionGap(actualProductionPct: number | null, standardPct = 80): number | null {
  if (actualProductionPct === null || isNaN(actualProductionPct) || !isFinite(actualProductionPct)) {
    return null;
  }
  return parseFloat((actualProductionPct - standardPct).toFixed(1));
}

export function calcFcr(feedConsumedKg: number, eggsProduced: number, avgEggWeightG: number | null): number | null {
  if (!avgEggWeightG || avgEggWeightG <= 0 || eggsProduced <= 0 || feedConsumedKg <= 0) {
    return null;
  }
  const eggMassKg = (eggsProduced * avgEggWeightG) / 1000;
  if (eggMassKg <= 0 || isNaN(eggMassKg) || !isFinite(eggMassKg)) {
    return null;
  }
  return parseFloat((feedConsumedKg / eggMassKg).toFixed(2));
}

export function calcEggDamagePercentage(damageCount: number, eggsReceived: number): number | null {
  if (eggsReceived <= 0 || isNaN(eggsReceived) || isNaN(damageCount) || damageCount < 0) {
    return null;
  }
  return parseFloat(((damageCount / eggsReceived) * 100).toFixed(1));
}

export function calcMortalityPercentage(mortalityBirds: number, birdCount: number): number | null {
  if (birdCount <= 0 || isNaN(birdCount) || isNaN(mortalityBirds) || mortalityBirds < 0) {
    return null;
  }
  return parseFloat(((mortalityBirds / birdCount) * 100).toFixed(1));
}

export function calcSelectionPercentage(selectedEggs: number, eggsProduced: number): number | null {
  if (eggsProduced <= 0 || isNaN(eggsProduced) || isNaN(selectedEggs) || selectedEggs < 0) {
    return null;
  }
  return parseFloat(((selectedEggs / eggsProduced) * 100).toFixed(1));
}

export function calculateFarmWeeklyKpi(params: {
  farmId: string;
  farmName: string;
  reports: any[];
  standardProductionPct?: number;
}): FarmWeeklyRankingKpi {
  const { farmId, farmName, reports, standardProductionPct = 80 } = params;
  const missingFields: string[] = [];

  if (!reports || reports.length === 0) {
    return {
      farmId,
      farmName,
      birdCount: 0,
      actualProductionPct: null,
      feedConsumedKg: 0,
      eggsProduced: 0,
      avgEggWeightG: null,
      eggsReceived: 0,
      damageCount: 0,
      selectedEggs: 0,
      mortalityBirds: 0,
      productionGapPct: null,
      fcr: null,
      eggDamagePct: null,
      mortalityPct: null,
      selectionPct: null,
      reportCount: 0,
      hasIncompleteData: true,
      missingFields: ['reports'],
    };
  }

  // Aggregate sums over reporting period
  const totalFeedKg = reports.reduce((s, r) => s + (Number(r.feedKg) || 0), 0);
  const totalEggs = reports.reduce((s, r) => s + (Number(r.eggsProduced) || 0), 0);
  const totalSelectedEggs = reports.reduce((s, r) => s + (Number(r.selectionEggs) || 0), 0);
  const totalDamagedEggs = reports.reduce((s, r) => s + (Number(r.damagedEggs) || 0), 0);
  const totalMortality = reports.reduce((s, r) => s + (Number(r.mortality) || 0), 0);

  // Latest closing bird count or opening bird count average
  const latestReport = reports[reports.length - 1];
  const birdCount = Number(latestReport?.closingBirdCount || latestReport?.birdCount || latestReport?.openingBirdCount || 0);

  // Average egg weight across reporting days where egg weight was sampled
  const eggWeights = reports.map((r) => r.eggWeight?.avg).filter((w): w is number => w != null && w > 0 && !isNaN(w));
  const avgEggWeightG = eggWeights.length > 0 ? calcAverage(eggWeights) : null;

  // Actual production % = (total eggs produced / (birdCount * days)) * 100 or average of daily production rates
  const validProductionRates = reports
    .map((r) => {
      const b = Number(r.openingBirdCount || r.birdCount || 0);
      return b > 0 ? calcProductionRate(Number(r.eggsProduced || 0), b) : null;
    })
    .filter((p): p is number => p != null);
  const actualProductionPct = validProductionRates.length > 0 ? calcAverage(validProductionRates) : null;

  // Eggs received convention: eggsProduced if explicit eggsReceived not present
  const explicitReceived = reports.reduce((s, r) => s + (Number(r.eggsReceived) || 0), 0);
  const eggsReceived = explicitReceived > 0 ? explicitReceived : totalEggs;

  if (actualProductionPct === null) missingFields.push('actualProduction');
  if (totalFeedKg <= 0) missingFields.push('feedConsumed');
  if (avgEggWeightG === null) missingFields.push('eggWeight');
  if (birdCount <= 0) missingFields.push('birdCount');

  // Compute 5 Documented KPIs
  const productionGapPct = calcProductionGap(actualProductionPct, standardProductionPct);
  const fcr = calcFcr(totalFeedKg, totalEggs, avgEggWeightG);
  const eggDamagePct = calcEggDamagePercentage(totalDamagedEggs, eggsReceived);
  const mortalityPct = calcMortalityPercentage(totalMortality, birdCount);
  const selectionPct = calcSelectionPercentage(totalSelectedEggs, totalEggs);

  return {
    farmId,
    farmName,
    birdCount,
    actualProductionPct,
    feedConsumedKg: totalFeedKg,
    eggsProduced: totalEggs,
    avgEggWeightG,
    eggsReceived,
    damageCount: totalDamagedEggs,
    selectedEggs: totalSelectedEggs,
    mortalityBirds: totalMortality,
    productionGapPct,
    fcr,
    eggDamagePct,
    mortalityPct,
    selectionPct,
    reportCount: reports.length,
    hasIncompleteData: missingFields.length > 0,
    missingFields,
  };
}

// -------------------------------------------------------------
// DOCUMENTED PARAMETER TIE-BREAKER COMPARATORS (PHASE 1.6)
// -------------------------------------------------------------
const TIE_TOLERANCE = 0.0001;

function isClose(a: number | null, b: number | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return Math.abs(a - b) < TIE_TOLERANCE;
}

/**
 * 1. Production Gap tie: resolved by FCR; lower FCR wins.
 * Primary: Higher Production Gap is preferred.
 */
export function compareByProductionGap(a: FarmWeeklyRankingKpi, b: FarmWeeklyRankingKpi): number {
  if (a.productionGapPct === null && b.productionGapPct === null) return 0;
  if (a.productionGapPct === null) return 1;
  if (b.productionGapPct === null) return -1;

  if (!isClose(a.productionGapPct, b.productionGapPct)) {
    return b.productionGapPct - a.productionGapPct; // Higher is better
  }

  // Tie-breaker: Lower FCR wins
  if (a.fcr === null && b.fcr === null) return 0;
  if (a.fcr === null) return 1;
  if (b.fcr === null) return -1;
  return a.fcr - b.fcr; // Lower is better
}

/**
 * 2. FCR tie: resolved by Production Gap; higher gap wins.
 * Primary: Lower FCR is preferred.
 */
export function compareByFcr(a: FarmWeeklyRankingKpi, b: FarmWeeklyRankingKpi): number {
  if (a.fcr === null && b.fcr === null) return 0;
  if (a.fcr === null) return 1;
  if (b.fcr === null) return -1;

  if (!isClose(a.fcr, b.fcr)) {
    return a.fcr - b.fcr; // Lower is better
  }

  // Tie-breaker: Higher Production Gap wins
  if (a.productionGapPct === null && b.productionGapPct === null) return 0;
  if (a.productionGapPct === null) return 1;
  if (b.productionGapPct === null) return -1;
  return b.productionGapPct - a.productionGapPct; // Higher is better
}

/**
 * 3. Egg Damage tie: resolved by Selection %; higher selection wins.
 * Primary: Lower Egg Damage % is preferred.
 */
export function compareByEggDamage(a: FarmWeeklyRankingKpi, b: FarmWeeklyRankingKpi): number {
  if (a.eggDamagePct === null && b.eggDamagePct === null) return 0;
  if (a.eggDamagePct === null) return 1;
  if (b.eggDamagePct === null) return -1;

  if (!isClose(a.eggDamagePct, b.eggDamagePct)) {
    return a.eggDamagePct - b.eggDamagePct; // Lower is better
  }

  // Tie-breaker: Higher Selection % wins
  if (a.selectionPct === null && b.selectionPct === null) return 0;
  if (a.selectionPct === null) return 1;
  if (b.selectionPct === null) return -1;
  return b.selectionPct - a.selectionPct; // Higher is better
}

/**
 * 4. Mortality tie: resolved by Production Gap; higher gap wins.
 * Primary: Lower Mortality % is preferred.
 */
export function compareByMortality(a: FarmWeeklyRankingKpi, b: FarmWeeklyRankingKpi): number {
  if (a.mortalityPct === null && b.mortalityPct === null) return 0;
  if (a.mortalityPct === null) return 1;
  if (b.mortalityPct === null) return -1;

  if (!isClose(a.mortalityPct, b.mortalityPct)) {
    return a.mortalityPct - b.mortalityPct; // Lower is better
  }

  // Tie-breaker: Higher Production Gap wins
  if (a.productionGapPct === null && b.productionGapPct === null) return 0;
  if (a.productionGapPct === null) return 1;
  if (b.productionGapPct === null) return -1;
  return b.productionGapPct - a.productionGapPct; // Higher is better
}

/**
 * 5. Selection tie: resolved by FCR; lower FCR wins.
 * Primary: Higher Selection % is preferred.
 */
export function compareBySelection(a: FarmWeeklyRankingKpi, b: FarmWeeklyRankingKpi): number {
  if (a.selectionPct === null && b.selectionPct === null) return 0;
  if (a.selectionPct === null) return 1;
  if (b.selectionPct === null) return -1;

  if (!isClose(a.selectionPct, b.selectionPct)) {
    return b.selectionPct - a.selectionPct; // Higher is better
  }

  // Tie-breaker: Lower FCR wins
  if (a.fcr === null && b.fcr === null) return 0;
  if (a.fcr === null) return 1;
  if (b.fcr === null) return -1;
  return a.fcr - b.fcr; // Lower is better
}

