import { KPI_THRESHOLDS } from '../config/kpiThresholds';

export function safeDivide(numerator: number, denominator: number): number {
  if (!denominator || denominator === 0 || isNaN(numerator) || isNaN(denominator)) return 0;
  return numerator / denominator;
}

export function getEligibleBirdCount(report: {
  openingBirdCount?: number | null;
  closingBirdCount?: number | null;
  birdCount?: number | null;
  mortality?: number | null;
  culling?: number | null;
  noOfBirds?: number | null;
  currentBirdCount?: number | null;
  initialBirdCount?: number | null;
  birds?: number | null;
  totalBirds?: number | null;
}): number {
  if (!report) return 0;
  if (report.openingBirdCount != null && Number.isFinite(report.openingBirdCount) && report.openingBirdCount > 0) {
    return Number(report.openingBirdCount);
  }
  const mort = Number(report.mortality) || 0;
  const cull = Number(report.culling) || 0;
  const closing = report.closingBirdCount != null && Number.isFinite(report.closingBirdCount)
    ? Number(report.closingBirdCount)
    : (report.birdCount != null && Number.isFinite(report.birdCount)
      ? Number(report.birdCount)
      : (report.currentBirdCount != null && Number.isFinite(report.currentBirdCount)
        ? Number(report.currentBirdCount)
        : (report.noOfBirds != null && Number.isFinite(report.noOfBirds)
          ? Number(report.noOfBirds)
          : (report.birds != null && Number.isFinite(report.birds)
            ? Number(report.birds)
            : (report.totalBirds != null && Number.isFinite(report.totalBirds)
              ? Number(report.totalBirds)
              : (report.initialBirdCount != null && Number.isFinite(report.initialBirdCount)
                ? Number(report.initialBirdCount)
                : 0))))));

  if (closing + mort + cull > 0) {
    return closing + mort + cull;
  }
  return closing > 0 ? closing : 0;
}

export function calcProductionRate(eggsProduced: number, birdCount: number): number {
  return parseFloat((safeDivide(eggsProduced, birdCount) * 100).toFixed(1));
}

export function calcMortalityRate(mortality: number, birdCount: number): number {
  if (!birdCount || birdCount <= 0 || isNaN(birdCount) || isNaN(mortality) || mortality < 0) return 0;
  return parseFloat(((mortality / birdCount) * 100).toFixed(1));
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

export type FarmHealthStatusLabel =
  | 'EXCELLENT'
  | 'HEALTHY'
  | 'NEEDS ATTENTION'
  | 'CRITICAL'
  | 'INVALID / REVIEW'
  | 'NO DATA';

export interface FarmHealthEvaluation {
  statusLabel: FarmHealthStatusLabel;
  status: FarmHealthStatusLabel;
  statusColor: string;
  isCritical: boolean;
  isInvalid: boolean;
  score: number;
  cappedScore: number;
  reason?: string;
  reasons: string[];
  mortalityRate: number;
  productionRate: number;
  feedGramsPerBird: number;
  selectionRate: number;
  compliance: number;
  hasTotalFlockLoss: boolean;
  isTotalFlockLoss: boolean;
}

export function evaluateFarmHealth(params: {
  reports: any[];
  days?: number;
  liveBirds?: number;
  farmId?: string;
}): FarmHealthEvaluation {
  const { reports, days = 7 } = params;

  if (!reports || reports.length === 0) {
    const reason = 'No daily reports submitted for selected period.';
    return {
      statusLabel: 'NO DATA',
      status: 'NO DATA',
      statusColor: '#94a3b8',
      isCritical: false,
      isInvalid: false,
      score: 0,
      cappedScore: 0,
      reason,
      reasons: [reason],
      mortalityRate: 0,
      productionRate: 0,
      feedGramsPerBird: 0,
      selectionRate: 0,
      compliance: 0,
      hasTotalFlockLoss: false,
      isTotalFlockLoss: false,
    };
  }

  // Precedence 1: Check for invalid or impossible data
  let hasInvalidData = false;
  let invalidReason = '';

  for (const r of reports) {
    const eligible = getEligibleBirdCount(r);
    const mort = Number(r.mortality);
    const cull = Number(r.culling);

    if (mort < 0 || cull < 0) {
      hasInvalidData = true;
      invalidReason = 'Negative mortality or culling count detected.';
      break;
    }
    if (eligible > 0 && mort > eligible) {
      hasInvalidData = true;
      invalidReason = `Reported mortality (${mort}) exceeds eligible bird count (${eligible}).`;
      break;
    }
    if (eligible > 0 && mort + cull > eligible) {
      hasInvalidData = true;
      invalidReason = `Combined mortality and culling (${mort + cull}) exceeds eligible bird count (${eligible}).`;
      break;
    }
  }

  if (hasInvalidData) {
    return {
      statusLabel: 'INVALID / REVIEW',
      status: 'INVALID / REVIEW',
      statusColor: '#dc2626',
      isCritical: true,
      isInvalid: true,
      score: 0,
      cappedScore: 0,
      reason: invalidReason,
      reasons: [invalidReason],
      mortalityRate: 0,
      productionRate: 0,
      feedGramsPerBird: 0,
      selectionRate: 0,
      compliance: 0,
      hasTotalFlockLoss: false,
      isTotalFlockLoss: false,
    };
  }

  // Precedence 2: Compute aggregate rates using authoritative eligible counts
  const pRates = reports.map((r) => {
    const b = getEligibleBirdCount(r);
    return b > 0 ? calcProductionRate(r.eggsProduced ?? 0, b) : null;
  });
  const mRates = reports.map((r) => {
    const b = getEligibleBirdCount(r);
    return b > 0 ? calcMortalityRate(r.mortality ?? 0, b) : null;
  });
  const fGramsList = reports.map((r) => {
    const b = getEligibleBirdCount(r);
    return b > 0 ? ((Number(r.feedKg) || 0) * 1000) / b : null;
  });
  const sRates = reports.map((r) => calcSelectionRate(r.selectionEggs ?? 0, r.eggsProduced ?? 0));

  const pRate = calcAverage(pRates);
  const mRate = calcAverage(mRates);
  const fGrams = calcAverage(fGramsList);
  const sRate = calcAverage(sRates);
  const compliance = Math.min(100, Math.round((reports.length / Math.max(1, days)) * 100));

  // Check explicit fatal critical conditions:
  // (a) Single day total flock loss (mortality == eligible)
  // (b) Cumulative mortality across reporting days >= initial/eligible count
  const hasDailyTotalFlockLoss = reports.some((r) => {
    const eligible = getEligibleBirdCount(r);
    return eligible > 0 && Number(r.mortality) >= eligible;
  });

  const totalMortality = reports.reduce((s, r) => s + (Number(r.mortality) || 0), 0);
  const maxEligibleFlock = reports.reduce((max, r) => Math.max(max, getEligibleBirdCount(r)), 0);
  const hasCumulativeTotalLoss = maxEligibleFlock > 0 && totalMortality >= maxEligibleFlock;
  const hasTotalFlockLoss = hasDailyTotalFlockLoss || hasCumulativeTotalLoss;

  const isCriticalMortalityThreshold = mRate >= (KPI_THRESHOLDS.mortalityRateCritical ?? 10);

  // Precedence 3: Explicit Critical Condition (Good production MUST NEVER override this)
  if (hasTotalFlockLoss || isCriticalMortalityThreshold) {
    const criticalReason = hasTotalFlockLoss
      ? 'CRITICAL ALERT: Total flock loss (100% mortality) reported. Operational disaster takes precedence over all other metrics.'
      : `CRITICAL ALERT: Average mortality rate (${mRate}%) exceeds critical threshold (${KPI_THRESHOLDS.mortalityRateCritical ?? 10}%).`;

    const score = hasTotalFlockLoss ? 0 : Math.min(30, Math.max(0, 100 - mRate * 5));
    return {
      statusLabel: 'CRITICAL',
      status: 'CRITICAL',
      statusColor: '#dc2626',
      isCritical: true,
      isInvalid: false,
      score,
      cappedScore: score,
      reason: criticalReason,
      reasons: [criticalReason],
      mortalityRate: mRate,
      productionRate: pRate,
      feedGramsPerBird: fGrams,
      selectionRate: sRate,
      compliance,
      hasTotalFlockLoss,
      isTotalFlockLoss: hasTotalFlockLoss,
    };
  }

  // Precedence 4: High Mortality Warning (5% <= mRate < 10%)
  const isHighMortalityWarning = mRate >= (KPI_THRESHOLDS.mortalityRateWarning ?? 5);

  const rawScore = calcPerformanceScore({
    productionRate: pRate,
    mortalityRate: mRate,
    feedPerBird: fGrams,
    submissionCompliance: compliance,
  });

  if (isHighMortalityWarning) {
    const warnReason = `High mortality rate (${mRate}%) requires operational attention. Status capped at NEEDS ATTENTION.`;
    const score = Math.min(rawScore.total, 64.9);
    return {
      statusLabel: 'NEEDS ATTENTION',
      status: 'NEEDS ATTENTION',
      statusColor: '#d97706',
      isCritical: false,
      isInvalid: false,
      score,
      cappedScore: score,
      reason: warnReason,
      reasons: [warnReason],
      mortalityRate: mRate,
      productionRate: pRate,
      feedGramsPerBird: fGrams,
      selectionRate: sRate,
      compliance,
      hasTotalFlockLoss: false,
      isTotalFlockLoss: false,
    };
  }

  // Precedence 5: Standard performance score evaluation
  let statusLabel: FarmHealthStatusLabel = 'HEALTHY';
  let statusColor = '#059669';

  if (rawScore.total >= 80) {
    statusLabel = 'EXCELLENT';
    statusColor = '#15803d';
  } else if (rawScore.total >= 65) {
    statusLabel = 'HEALTHY';
    statusColor = '#059669';
  } else if (rawScore.total >= 50) {
    statusLabel = 'NEEDS ATTENTION';
    statusColor = '#d97706';
  } else {
    statusLabel = 'CRITICAL';
    statusColor = '#dc2626';
  }

  return {
    statusLabel,
    status: statusLabel,
    statusColor,
    isCritical: statusLabel === 'CRITICAL',
    isInvalid: false,
    score: rawScore.total,
    cappedScore: rawScore.total,
    reason: undefined,
    reasons: [],
    mortalityRate: mRate,
    productionRate: pRate,
    feedGramsPerBird: fGrams,
    selectionRate: sRate,
    compliance,
    hasTotalFlockLoss: false,
    isTotalFlockLoss: false,
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

  const productionRates = reports.map((r) => {
    const b = getEligibleBirdCount(r);
    return b > 0 ? calcProductionRate(r.eggsProduced ?? 0, b) : null;
  });
  const mortalityRates = reports.map((r) => {
    const b = getEligibleBirdCount(r);
    return b > 0 ? calcMortalityRate(r.mortality ?? 0, b) : null;
  });
  const cullingRates = reports.map((r) => {
    const b = getEligibleBirdCount(r);
    return b > 0 ? calcCullingRate(r.culling ?? 0, b) : null;
  });
  const selectionRates = reports.map((r) => calcSelectionRate(r.selectionEggs ?? 0, r.eggsProduced ?? 0));
  const feedPerBirds = reports.map((r) => {
    const b = getEligibleBirdCount(r);
    return b > 0 ? calcFeedPerBird(r.feedKg ?? 0, b) : null;
  });
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
    totalBirds: reports.reduce((s, r) => s + (getEligibleBirdCount(r) || (r.birdCount ?? 0)), 0),
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

  // Unavailable reasons if null
  kpiReasons?: {
    productionGap?: string;
    fcr?: string;
    eggDamage?: string;
    mortality?: string;
    selection?: string;
  };

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
      kpiReasons: {
        productionGap: 'No reports submitted',
        fcr: 'No reports submitted',
        eggDamage: 'No reports submitted',
        mortality: 'No reports submitted',
        selection: 'No reports submitted',
      },
      reportCount: 0,
      hasIncompleteData: true,
      missingFields: ['reports'],
    };
  }

  // Aggregate sums over reporting period with robust field aliasing
  const totalFeedKg = reports.reduce((s, r) => s + (Number(r.feedKg ?? r.feedConsumedKg ?? r.feedConsumed ?? r.feed) || 0), 0);
  const totalEggs = reports.reduce((s, r) => s + (Number(r.eggsProduced ?? r.production ?? r.totalEggs ?? r.eggs) || 0), 0);
  const totalSelectedEggs = reports.reduce((s, r) => s + (Number(r.selectionEggs ?? r.selectedEggs ?? r.selection) || 0), 0);
  const totalDamagedEggs = reports.reduce((s, r) => s + (Number(r.damagedEggs ?? r.damageCount ?? r.damageEggs ?? r.brokenEggs) || 0), 0);
  const totalMortality = reports.reduce((s, r) => s + (Number(r.mortality ?? r.mortalityBirds ?? r.deadBirds) || 0), 0);

  // Latest closing bird count or opening bird count average
  const latestReport = reports[reports.length - 1];
  const birdCount = Number(
    latestReport?.closingBirdCount ??
    latestReport?.birdCount ??
    latestReport?.currentBirdCount ??
    latestReport?.noOfBirds ??
    latestReport?.birds ??
    latestReport?.totalBirds ??
    latestReport?.openingBirdCount ??
    0
  );

  // Authoritative starting/eligible flock size for weekly mortality denominator:
  const firstReport = reports[0];
  const maxEligibleFlock = reports.reduce((max, r) => Math.max(max, getEligibleBirdCount(r)), 0);
  const eligibleBirds = (firstReport ? getEligibleBirdCount(firstReport) : 0) || maxEligibleFlock || (birdCount > 0 ? birdCount : totalMortality);

  // Average egg weight across reporting days where egg weight was sampled
  const eggWeights = reports
    .map((r) => {
      if (typeof r.eggWeight === 'number' && r.eggWeight > 0) return r.eggWeight;
      if (r.eggWeight?.avg != null && r.eggWeight.avg > 0) return r.eggWeight.avg;
      if (r.eggWeight?.average != null && r.eggWeight.average > 0) return r.eggWeight.average;
      if (r.avgEggWeight != null && r.avgEggWeight > 0) return r.avgEggWeight;
      if (r.avgEggWeightG != null && r.avgEggWeightG > 0) return r.avgEggWeightG;
      if (r.eggWeightAvg != null && r.eggWeightAvg > 0) return r.eggWeightAvg;
      return null;
    })
    .filter((w): w is number => w != null && w > 0 && !isNaN(w));
  const avgEggWeightG = eggWeights.length > 0 ? calcAverage(eggWeights) : null;

  // Actual production % = average of daily production rates or explicit actualProductionPct / actPct
  const validProductionRates = reports
    .map((r) => {
      const explicitPct = r.actualProductionPct ?? r.actPct;
      if (explicitPct != null && !isNaN(Number(explicitPct)) && Number(explicitPct) >= 0) {
        return Number(explicitPct);
      }
      const b = getEligibleBirdCount(r);
      const eggs = Number(r.eggsProduced ?? r.production ?? r.totalEggs ?? r.eggs ?? 0);
      return b > 0 ? calcProductionRate(eggs, b) : null;
    })
    .filter((p): p is number => p != null);
  const actualProductionPct = validProductionRates.length > 0 ? calcAverage(validProductionRates) : null;

  // Eggs received convention: eggsProduced if explicit eggsReceived not present
  const explicitReceived = reports.reduce((s, r) => s + (Number(r.eggsReceived ?? r.receivedEggs) || 0), 0);
  const eggsReceived = explicitReceived > 0 ? explicitReceived : totalEggs;

  if (actualProductionPct === null) missingFields.push('actualProduction');
  if (totalFeedKg <= 0) missingFields.push('feedConsumed');
  if (avgEggWeightG === null) missingFields.push('eggWeight');
  if (birdCount <= 0 && totalMortality === 0) missingFields.push('birdCount');

  // Compute 5 Documented KPIs
  const productionGapPct = calcProductionGap(actualProductionPct, standardProductionPct);
  const fcr = calcFcr(totalFeedKg, totalEggs, avgEggWeightG);
  const eggDamagePct = calcEggDamagePercentage(totalDamagedEggs, eggsReceived);
  const mortalityPct = calcMortalityPercentage(totalMortality, eligibleBirds);
  const selectionPct = calcSelectionPercentage(totalSelectedEggs, totalEggs);

  // Determine unavailable reasons
  const kpiReasons: FarmWeeklyRankingKpi['kpiReasons'] = {};
  if (productionGapPct === null) {
    kpiReasons.productionGap = eligibleBirds <= 0 ? 'No bird count recorded' : 'No egg production recorded';
  }
  if (fcr === null) {
    if (totalFeedKg <= 0) {
      kpiReasons.fcr = 'No feed consumed recorded';
    } else if (totalEggs <= 0) {
      kpiReasons.fcr = 'No eggs produced';
    } else if (avgEggWeightG === null) {
      kpiReasons.fcr = 'Missing egg weight';
    } else {
      kpiReasons.fcr = 'Insufficient data';
    }
  }
  if (eggDamagePct === null) {
    kpiReasons.eggDamage = eggsReceived <= 0 ? 'No eggs received' : 'No damage data';
  }
  if (mortalityPct === null) {
    kpiReasons.mortality = eligibleBirds <= 0 ? 'No bird count recorded' : 'No mortality data';
  }
  if (selectionPct === null) {
    kpiReasons.selection = totalEggs <= 0 ? 'No eggs produced' : 'No selection data';
  }

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
    kpiReasons,
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

function hasTotalFlockLossKpi(k: FarmWeeklyRankingKpi): boolean {
  return k.mortalityPct !== null && k.mortalityPct >= 100;
}

/**
 * 1. Production Gap tie: resolved by FCR; lower FCR wins.
 * Primary: Higher Production Gap is preferred. Total flock loss (100% mortality) cannot outrank viable farms.
 */
export function compareByProductionGap(a: FarmWeeklyRankingKpi, b: FarmWeeklyRankingKpi): number {
  if (hasTotalFlockLossKpi(a) && !hasTotalFlockLossKpi(b)) return 1;
  if (!hasTotalFlockLossKpi(a) && hasTotalFlockLossKpi(b)) return -1;

  if (a.productionGapPct === null && b.productionGapPct === null) return a.farmId.localeCompare(b.farmId);
  if (a.productionGapPct === null) return 1;
  if (b.productionGapPct === null) return -1;

  if (!isClose(a.productionGapPct, b.productionGapPct)) {
    return b.productionGapPct - a.productionGapPct; // Higher is better
  }

  // Tie-breaker: Lower FCR wins
  if (a.fcr === null && b.fcr === null) return a.farmId.localeCompare(b.farmId);
  if (a.fcr === null) return 1;
  if (b.fcr === null) return -1;
  if (!isClose(a.fcr, b.fcr)) {
    return a.fcr - b.fcr; // Lower is better
  }
  return a.farmId.localeCompare(b.farmId);
}

/**
 * 2. FCR tie: resolved by Production Gap; higher gap wins.
 * Primary: Lower FCR is preferred. Total flock loss (100% mortality) cannot outrank viable farms.
 */
export function compareByFcr(a: FarmWeeklyRankingKpi, b: FarmWeeklyRankingKpi): number {
  if (hasTotalFlockLossKpi(a) && !hasTotalFlockLossKpi(b)) return 1;
  if (!hasTotalFlockLossKpi(a) && hasTotalFlockLossKpi(b)) return -1;

  if (a.fcr === null && b.fcr === null) return a.farmId.localeCompare(b.farmId);
  if (a.fcr === null) return 1;
  if (b.fcr === null) return -1;

  if (!isClose(a.fcr, b.fcr)) {
    return a.fcr - b.fcr; // Lower is better
  }

  // Tie-breaker: Higher Production Gap wins
  if (a.productionGapPct === null && b.productionGapPct === null) return a.farmId.localeCompare(b.farmId);
  if (a.productionGapPct === null) return 1;
  if (b.productionGapPct === null) return -1;
  if (!isClose(a.productionGapPct, b.productionGapPct)) {
    return b.productionGapPct - a.productionGapPct; // Higher is better
  }
  return a.farmId.localeCompare(b.farmId);
}

/**
 * 3. Egg Damage tie: resolved by Selection %; higher selection wins.
 * Primary: Lower Egg Damage % is preferred. Total flock loss (100% mortality) cannot outrank viable farms.
 */
export function compareByEggDamage(a: FarmWeeklyRankingKpi, b: FarmWeeklyRankingKpi): number {
  if (hasTotalFlockLossKpi(a) && !hasTotalFlockLossKpi(b)) return 1;
  if (!hasTotalFlockLossKpi(a) && hasTotalFlockLossKpi(b)) return -1;

  if (a.eggDamagePct === null && b.eggDamagePct === null) return a.farmId.localeCompare(b.farmId);
  if (a.eggDamagePct === null) return 1;
  if (b.eggDamagePct === null) return -1;

  if (!isClose(a.eggDamagePct, b.eggDamagePct)) {
    return a.eggDamagePct - b.eggDamagePct; // Lower is better
  }

  // Tie-breaker: Higher Selection % wins
  if (a.selectionPct === null && b.selectionPct === null) return a.farmId.localeCompare(b.farmId);
  if (a.selectionPct === null) return 1;
  if (b.selectionPct === null) return -1;
  if (!isClose(a.selectionPct, b.selectionPct)) {
    return b.selectionPct - a.selectionPct; // Higher is better
  }
  return a.farmId.localeCompare(b.farmId);
}

/**
 * 4. Mortality tie: resolved by Production Gap; higher gap wins.
 * Primary: Lower Mortality % is preferred.
 */
export function compareByMortality(a: FarmWeeklyRankingKpi, b: FarmWeeklyRankingKpi): number {
  if (a.mortalityPct === null && b.mortalityPct === null) return a.farmId.localeCompare(b.farmId);
  if (a.mortalityPct === null) return 1;
  if (b.mortalityPct === null) return -1;

  if (!isClose(a.mortalityPct, b.mortalityPct)) {
    return a.mortalityPct - b.mortalityPct; // Lower is better
  }

  // Tie-breaker: Higher Production Gap wins
  if (a.productionGapPct === null && b.productionGapPct === null) return a.farmId.localeCompare(b.farmId);
  if (a.productionGapPct === null) return 1;
  if (b.productionGapPct === null) return -1;
  if (!isClose(a.productionGapPct, b.productionGapPct)) {
    return b.productionGapPct - a.productionGapPct; // Higher is better
  }
  return a.farmId.localeCompare(b.farmId);
}

/**
 * 5. Selection tie: resolved by FCR; lower FCR wins.
 * Primary: Higher Selection % is preferred. Total flock loss (100% mortality) cannot outrank viable farms.
 */
export function compareBySelection(a: FarmWeeklyRankingKpi, b: FarmWeeklyRankingKpi): number {
  if (hasTotalFlockLossKpi(a) && !hasTotalFlockLossKpi(b)) return 1;
  if (!hasTotalFlockLossKpi(a) && hasTotalFlockLossKpi(b)) return -1;

  if (a.selectionPct === null && b.selectionPct === null) return a.farmId.localeCompare(b.farmId);
  if (a.selectionPct === null) return 1;
  if (b.selectionPct === null) return -1;

  if (!isClose(a.selectionPct, b.selectionPct)) {
    return b.selectionPct - a.selectionPct; // Higher is better
  }

  // Tie-breaker: Lower FCR wins
  if (a.fcr === null && b.fcr === null) return a.farmId.localeCompare(b.farmId);
  if (a.fcr === null) return 1;
  if (b.fcr === null) return -1;
  if (!isClose(a.fcr, b.fcr)) {
    return a.fcr - b.fcr; // Lower is better
  }
  return a.farmId.localeCompare(b.farmId);
}

