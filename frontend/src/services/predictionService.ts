import { getStandardProductionAtAge } from '../data/productionCurves';

export interface DailyDataPoint {
  date: string;
  eggsProduced: number;
  birdCount: number;
  productionPct: number;
  mortality?: number;
  culling?: number;
  closingBirdCount?: number;
  openingBirdCount?: number;
}

export interface PredictionPoint {
  date: string;
  ageWeeks: number;
  predictedPct: number;
  predictedEggs: number;
  expectedBirds: number;
  standardPct: number;
  upperPct: number;
  lowerPct: number;
}

/** Per-horizon accuracy metrics computed by calendar-aligned rolling-origin backtesting. */
export interface HorizonAccuracy {
  horizon: number;                 // forecast horizon in days (7, 14, 21, 30)
  mae: number;
  rmse: number;
  mape: number | null;            // null when zero actuals
  wape: number | null;            // Weighted Absolute Percentage Error, null when zero volume
  origins: number;                // count of distinct forecast origins
  evaluationPoints: number;       // total points matched and evaluated
  baselineMae: number;            // naive persistence baseline MAE
  maeImprovementPct: number | null; // percentage improvement over naive baseline
}

export interface PredictionResult {
  predictions: PredictionPoint[];
  accuracy: {
    mae: number;
    rmse: number;
    mape: number | null;
    wape: number | null;
    baselineMae?: number;
    maeImprovementPct?: number | null;
  } | null;
  horizonAccuracy: HorizonAccuracy[];
  dataQuality: 'insufficient' | 'preliminary' | 'reliable';
  submissionDensity: number;
  missingDays: number;
  daysSinceLastReport: number;
  lastActualPct: number;
  lastActualDate: string;
  populationAssumedConstant: boolean;
  projectedDailyMortalityRate: number;
  projectedDailyCullingRate: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Convert a YYYY-MM-DD date string to a UTC midnight timestamp (ms). */
export function dateToMs(dateStr: string): number {
  return new Date(dateStr + 'T00:00:00Z').getTime();
}

/** Return a YYYY-MM-DD string from a UTC ms timestamp. */
export function msToDateStr(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Two-tailed Student's t critical value for alpha = 0.05 (95% confidence).
 * Used for OLS prediction interval degrees of freedom df = n - 2.
 */
export function getStudentTCritical(df: number): number {
  if (df <= 0) return 12.706;
  const tTable: Record<number, number> = {
    1: 12.706,
    2: 4.303,
    3: 3.182,
    4: 2.776,
    5: 2.571,
    6: 2.447,
    7: 2.365,
    8: 2.306,
    9: 2.262,
    10: 2.228,
    11: 2.201,
    12: 2.179,
    13: 2.160,
    14: 2.145,
    15: 2.131,
    16: 2.120,
    17: 2.110,
    18: 2.101,
    19: 2.093,
    20: 2.086,
    25: 2.060,
    30: 2.042,
  };
  if (tTable[df]) return tTable[df];
  if (df < 25) {
    const lower = Math.floor(df);
    const upper = Math.ceil(df);
    const vLower = tTable[lower] ?? 2.086;
    const vUpper = tTable[upper] ?? 2.086;
    return parseFloat((vLower + (vUpper - vLower) * (df - lower)).toFixed(3));
  }
  if (df <= 30) return 2.042;
  // For df > 30, converges smoothly to standard normal 1.960: t ≈ 1.96 + 2.4/df
  return parseFloat((1.96 + 2.4 / df).toFixed(3));
}

/**
 * Incremental exponential trend damping:
 *   For d <= 7: slope * d
 *   For d > 7:  slope * [7 + sum_{k=1}^{d-7} 0.85^k]
 *
 * Guarantees monotonic progression towards an asymptotic stable plateau.
 * Neither positive nor negative trends artificially reverse direction.
 */
export function calculateDampedTrendEffect(slope: number, day: number): number {
  if (day <= 0) return 0;
  if (day <= 7) return slope * day;
  const excess = day - 7;
  // Closed-form geometric sum: 0.85 * (1 - 0.85^excess) / (1 - 0.85)
  const geometricSum = (0.85 * (1 - Math.pow(0.85, excess))) / 0.15;
  return slope * (7 + geometricSum);
}

/**
 * OLS linear regression on (x, y) pairs.
 * Returns { slope, intercept, seResidual, Sxx, xMean }.
 */
export function olsRegression(xs: number[], ys: number[]): {
  slope: number;
  intercept: number;
  seResidual: number;
  Sxx: number;
  xMean: number;
} {
  const n = xs.length;
  if (n < 2) return { slope: 0, intercept: ys[0] ?? 0, seResidual: 0, Sxx: 0, xMean: xs[0] ?? 0 };

  const xMean = xs.reduce((s, v) => s + v, 0) / n;
  const yMean = ys.reduce((s, v) => s + v, 0) / n;

  let Sxx = 0;
  let Sxy = 0;
  for (let i = 0; i < n; i++) {
    Sxx += (xs[i] - xMean) ** 2;
    Sxy += (xs[i] - xMean) * (ys[i] - yMean);
  }

  const slope = Sxx === 0 ? 0 : Sxy / Sxx;
  const intercept = yMean - slope * xMean;

  let rss = 0;
  for (let i = 0; i < n; i++) {
    rss += (ys[i] - (intercept + slope * xs[i])) ** 2;
  }
  const seResidual = n > 2 ? Math.sqrt(rss / (n - 2)) : 0;

  return { slope, intercept, seResidual, Sxx, xMean };
}

/**
 * Statistically correct OLS prediction interval half-width using Student's t distribution:
 *   PI = t_{0.025, n-2} * seResidual * sqrt(1 + 1/n + (x_h - xMean)^2 / Sxx)
 */
export function olsPredictionIntervalHalfWidth(
  seResidual: number,
  n: number,
  xh: number,
  xMean: number,
  Sxx: number,
): number {
  if (seResidual <= 0 || n < 3) return 5; // default ±5% when insufficient data
  const df = n - 2;
  const tCrit = getStudentTCritical(df);
  const leverageTerm = Sxx > 0 ? (xh - xMean) ** 2 / Sxx : 0;
  return tCrit * seResidual * Math.sqrt(1 + 1 / n + leverageTerm);
}

/**
 * Weighted moving average over the last `windowSize` values.
 * Weights are linear: oldest in window gets weight 1, most recent gets windowSize.
 */
export function weightedMovingAverage(values: number[], windowSize: number): number {
  const n = values.length;
  const start = Math.max(0, n - windowSize);
  let weightedSum = 0;
  let weightTotal = 0;
  for (let i = start; i < n; i++) {
    const weight = i - start + 1;
    weightedSum += values[i] * weight;
    weightTotal += weight;
  }
  return weightTotal > 0 ? weightedSum / weightTotal : 0;
}

interface ForecastPointParams {
  trainingPcts: number[];
  trainingCalendarXs: number[];
  lastObservedOffset: number;
  lastObservedDateMs: number;
  stepDays: number;
  dataQuality: 'insufficient' | 'preliminary' | 'reliable';
  hasFlockCurve: boolean;
  curveType?: 'CF_STD' | 'FR_STD';
  flockStartDateMs?: number;
}

/**
 * Shared deterministic forecasting function used identically by
 * live production generation and rolling-origin backtesting.
 */
export function computeForecastPoint(params: ForecastPointParams): {
  predictedPct: number;
  standardPct: number;
  ageWeeks: number;
  olsFit: number;
  slope: number;
  intercept: number;
  seResidual: number;
  Sxx: number;
  xMean: number;
  recentN: number;
} {
  const {
    trainingPcts,
    trainingCalendarXs,
    lastObservedOffset,
    lastObservedDateMs,
    stepDays,
    dataQuality,
    hasFlockCurve,
    curveType,
    flockStartDateMs,
  } = params;

  // 1. WMA baseline over training slice (last 7 observations)
  const wma = weightedMovingAverage(trainingPcts, Math.min(7, trainingPcts.length));

  // 2. OLS regression on training tail (up to 14 observations)
  const recentN = Math.min(14, trainingPcts.length);
  const tailPcts = trainingPcts.slice(-recentN);
  const tailXs = trainingCalendarXs.slice(-recentN);
  const reg = olsRegression(tailXs, tailPcts);

  const forecastOffset = lastObservedOffset + stepDays;
  const olsFit = reg.intercept + reg.slope * forecastOffset;

  // 3. Flock age calculation if placement date provided
  let ageWeeks = 0;
  if (flockStartDateMs) {
    const forecastDateMs = lastObservedDateMs + stepDays * 24 * 3600 * 1000;
    const diffMs = forecastDateMs - flockStartDateMs;
    ageWeeks = diffMs > 0 ? diffMs / (7 * 24 * 3600 * 1000) : 0;
  }

  // 4. Incremental trend damping
  const dampedTrend = recentN >= 7 ? calculateDampedTrendEffect(reg.slope, stepDays) : 0;

  let predictedPct: number;
  let standardPct = 0;

  if (hasFlockCurve && curveType && ageWeeks > 0) {
    standardPct = getStandardProductionAtAge(curveType, ageWeeks);
    const trendPct = wma + dampedTrend;
    const blendWeight = dataQuality === 'reliable' ? 0.7 : dataQuality === 'preliminary' ? 0.5 : 0.3;
    predictedPct = blendWeight * trendPct + (1 - blendWeight) * standardPct;
  } else {
    predictedPct = wma + dampedTrend;
  }

  predictedPct = Math.max(0, Math.min(100, predictedPct));

  return {
    predictedPct: parseFloat(predictedPct.toFixed(1)),
    standardPct: parseFloat(standardPct.toFixed(1)),
    ageWeeks: parseFloat(ageWeeks.toFixed(1)),
    olsFit,
    slope: reg.slope,
    intercept: reg.intercept,
    seResidual: reg.seResidual,
    Sxx: reg.Sxx,
    xMean: reg.xMean,
    recentN,
  };
}

/**
 * Calendar-aligned rolling-origin backtesting.
 * Matches predictions with actuals only when calendar dates match exactly.
 * Evaluates the same model logic as the live forecast.
 */
function rollingOriginBacktest(params: {
  productionPcts: number[];
  calendarOffsets: number[];
  firstMs: number;
  hasFlockCurve: boolean;
  curveType?: 'CF_STD' | 'FR_STD';
  flockStartDateMs?: number;
}): HorizonAccuracy[] {
  const {
    productionPcts,
    calendarOffsets,
    firstMs,
    hasFlockCurve,
    curveType,
    flockStartDateMs,
  } = params;

  const n = productionPcts.length;
  const horizons = [7, 14, 21, 30];
  const results: HorizonAccuracy[] = [];
  const minTrain = 7;

  // Build calendar-day offset to actual production % lookup map
  const actualsMap = new Map<number, number>();
  for (let i = 0; i < n; i++) {
    actualsMap.set(calendarOffsets[i], productionPcts[i]);
  }

  for (const h of horizons) {
    if (n < minTrain + h) continue;

    let sumAE = 0;
    let sumSE = 0;
    let sumAPE = 0;
    let sumAbsActual = 0;
    let sumAbsError = 0;
    let validAPE = 0;
    let evalPoints = 0;
    let sumBaselineAE = 0;
    const uniqueOrigins = new Set<number>();

    for (let origin = minTrain; origin <= n - h; origin++) {
      const trainPcts = productionPcts.slice(0, origin);
      const trainXs = calendarOffsets.slice(0, origin);
      const originOffset = calendarOffsets[origin - 1];
      const originDateMs = firstMs + originOffset * 24 * 3600 * 1000;
      const baselineVal = trainPcts[trainPcts.length - 1]; // naive persistence baseline

      const originQuality: PredictionResult['dataQuality'] =
        trainPcts.length >= 14 ? 'reliable' : 'preliminary';

      let matchedForThisOrigin = 0;

      for (let step = 1; step <= h; step++) {
        const targetOffset = originOffset + step;
        if (!actualsMap.has(targetOffset)) {
          // Date with no submission — skip cleanly without substituting
          continue;
        }

        const actual = actualsMap.get(targetOffset)!;

        // Predict using identical model logic
        const { predictedPct } = computeForecastPoint({
          trainingPcts: trainPcts,
          trainingCalendarXs: trainXs,
          lastObservedOffset: originOffset,
          lastObservedDateMs: originDateMs,
          stepDays: step,
          dataQuality: originQuality,
          hasFlockCurve,
          curveType,
          flockStartDateMs,
        });

        const err = Math.abs(actual - predictedPct);
        const baselineErr = Math.abs(actual - baselineVal);

        sumAE += err;
        sumSE += err ** 2;
        sumAbsActual += Math.abs(actual);
        sumAbsError += err;
        sumBaselineAE += baselineErr;
        evalPoints++;
        matchedForThisOrigin++;

        if (actual > 0) {
          sumAPE += (err / actual) * 100;
          validAPE++;
        }
      }

      if (matchedForThisOrigin > 0) {
        uniqueOrigins.add(origin);
      }
    }

    if (evalPoints === 0 || uniqueOrigins.size === 0) continue;

    const mae = parseFloat((sumAE / evalPoints).toFixed(2));
    const rmse = parseFloat(Math.sqrt(sumSE / evalPoints).toFixed(2));
    const baselineMae = parseFloat((sumBaselineAE / evalPoints).toFixed(2));
    const mape = validAPE > 0 ? parseFloat((sumAPE / validAPE).toFixed(2)) : null;
    const wape = sumAbsActual > 0 ? parseFloat(((sumAbsError / sumAbsActual) * 100).toFixed(2)) : null;
    const maeImprovementPct =
      baselineMae > 0 ? parseFloat((((baselineMae - mae) / baselineMae) * 100).toFixed(1)) : null;

    results.push({
      horizon: h,
      mae,
      rmse,
      mape,
      wape,
      origins: uniqueOrigins.size,
      evaluationPoints: evalPoints,
      baselineMae,
      maeImprovementPct,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate egg production predictions for a farm flock.
 *
 * Algorithm:
 *   1. Deduplicate multiple same-day reports authoritatively.
 *   2. Detect calendar gaps and days elapsed since latest submission.
 *   3. Fit WMA and OLS on actual calendar offsets.
 *   4. Apply incremental trend damping (no artificial reversals).
 *   5. Blend with standard production curves if flock metadata supplied.
 *   6. Compute OLS prediction intervals centered on OLS using Student's t critical values.
 *   7. Project bird population with historical mortality/culling without double-counting.
 *   8. Evaluate accuracy using calendar-aligned rolling-origin backtesting against a naive baseline.
 */
export function generatePredictions(params: {
  historicalData: DailyDataPoint[];
  currentBirds: number;
  flockStartDate?: string;
  curveType?: 'CF_STD' | 'FR_STD';
  forecastDays: number;
  dailyMortalityRate?: number;
  dailyCullingRate?: number;
}): PredictionResult {
  const {
    historicalData,
    currentBirds,
    flockStartDate,
    curveType,
    forecastDays,
    dailyMortalityRate,
    dailyCullingRate,
  } = params;

  // -------------------------------------------------------------------------
  // 1. Filter, deduplicate by date, and sort ascending
  // -------------------------------------------------------------------------
  const validData = historicalData.filter((d) => {
    const bc = Number(d.birdCount);
    const eggs = Number(d.eggsProduced);
    return Number.isFinite(bc) && bc > 0 && Number.isFinite(eggs) && eggs >= 0 && Boolean(d.date);
  });

  // Authoritatively deduplicate by date (keep last occurrence / highest production)
  const byDate = new Map<string, DailyDataPoint>();
  for (const item of validData) {
    const existing = byDate.get(item.date);
    if (!existing || item.eggsProduced >= existing.eggsProduced) {
      byDate.set(item.date, item);
    }
  }

  const sorted = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));

  if (sorted.length === 0) {
    return {
      predictions: [],
      accuracy: null,
      horizonAccuracy: [],
      dataQuality: 'insufficient',
      submissionDensity: 0,
      missingDays: 0,
      daysSinceLastReport: 0,
      lastActualPct: 0,
      lastActualDate: '',
      populationAssumedConstant: true,
      projectedDailyMortalityRate: 0,
      projectedDailyCullingRate: 0,
    };
  }

  // -------------------------------------------------------------------------
  // 2. Detect missing submission days & days since latest report
  // -------------------------------------------------------------------------
  const firstMs = dateToMs(sorted[0].date);
  const lastMs = dateToMs(sorted[sorted.length - 1].date);
  const calendarSpanDays = Math.round((lastMs - firstMs) / (24 * 3600 * 1000)) + 1;
  const missingDays = Math.max(0, calendarSpanDays - sorted.length);
  const submissionDensity =
    calendarSpanDays > 0 ? parseFloat((sorted.length / calendarSpanDays).toFixed(2)) : 1;

  // Days elapsed between latest report and today (UTC)
  const todayMs = dateToMs(new Date().toISOString().slice(0, 10));
  const daysSinceLastReport = Math.max(0, Math.round((todayMs - lastMs) / (24 * 3600 * 1000)));

  // Data quality classification
  const dataQuality: PredictionResult['dataQuality'] =
    sorted.length >= 14 && submissionDensity >= 0.7
      ? 'reliable'
      : sorted.length >= 7
      ? 'preliminary'
      : 'insufficient';

  // -------------------------------------------------------------------------
  // 3. Compute production percentages and calendar offsets for OLS
  // -------------------------------------------------------------------------
  const productionPcts = sorted.map((d) => (d.eggsProduced / d.birdCount) * 100);
  const lastActualPct = productionPcts[productionPcts.length - 1];
  const lastActualDate = sorted[sorted.length - 1].date;

  const calendarOffsets = sorted.map((d) =>
    Math.round((dateToMs(d.date) - firstMs) / (24 * 3600 * 1000)),
  );

  // -------------------------------------------------------------------------
  // 4. Flock metadata preparation
  // -------------------------------------------------------------------------
  const hasFlockCurve = Boolean(flockStartDate && curveType);
  const flockStartDateMs = flockStartDate ? dateToMs(flockStartDate) : undefined;
  const lastObservedOffset = calendarOffsets[calendarOffsets.length - 1];
  const lastObservedDateMs = dateToMs(lastActualDate);

  // -------------------------------------------------------------------------
  // 5. Population projection & attrition estimation
  // -------------------------------------------------------------------------
  // Calculate empirical mortality & culling rates if not explicitly passed
  let projectedMortalityRate = dailyMortalityRate ?? 0;
  let projectedCullingRate = dailyCullingRate ?? 0;

  if (dailyMortalityRate === undefined || dailyCullingRate === undefined) {
    const recentTail = sorted.slice(-14);
    let totalMort = 0;
    let totalCull = 0;
    let totalBirdsRisk = 0;

    for (const r of recentTail) {
      if (r.birdCount > 0) {
        totalMort += Math.max(0, Number(r.mortality) || 0);
        totalCull += Math.max(0, Number(r.culling) || 0);
        totalBirdsRisk += r.birdCount;
      }
    }

    if (totalBirdsRisk > 0) {
      if (dailyMortalityRate === undefined) {
        projectedMortalityRate = totalMort > 0 ? totalMort / totalBirdsRisk : 0;
      }
      if (dailyCullingRate === undefined) {
        projectedCullingRate = totalCull > 0 ? totalCull / totalBirdsRisk : 0;
      }
    }
  }

  const dailyAttritionRate = projectedMortalityRate + projectedCullingRate;
  const populationAssumedConstant = dailyAttritionRate <= 0;

  // -------------------------------------------------------------------------
  // 6. Generate daily predictions
  // -------------------------------------------------------------------------
  const predictions: PredictionPoint[] = [];
  let runningBirds = currentBirds;

  for (let day = 1; day <= forecastDays; day++) {
    const forecastDateMs = lastObservedDateMs + day * 24 * 3600 * 1000;
    const dateStr = msToDateStr(forecastDateMs);

    const forecast = computeForecastPoint({
      trainingPcts: productionPcts,
      trainingCalendarXs: calendarOffsets,
      lastObservedOffset,
      lastObservedDateMs,
      stepDays: day,
      dataQuality,
      hasFlockCurve,
      curveType,
      flockStartDateMs,
    });

    // OLS prediction interval centered on OLS regression estimate
    const forecastOffset = lastObservedOffset + day;
    const halfWidth = olsPredictionIntervalHalfWidth(
      forecast.seResidual,
      forecast.recentN,
      forecastOffset,
      forecast.xMean,
      forecast.Sxx,
    );
    const upperPct = Math.min(100, Math.max(0, parseFloat((forecast.olsFit + halfWidth).toFixed(1))));
    const lowerPct = Math.max(0, Math.min(100, parseFloat((forecast.olsFit - halfWidth).toFixed(1))));

    // Sequential bird population decay without double-counting past mortality
    if (!populationAssumedConstant) {
      runningBirds = Math.max(0, Math.round(runningBirds * (1 - dailyAttritionRate)));
    }

    const predictedEggs = Math.round((forecast.predictedPct / 100) * runningBirds);

    predictions.push({
      date: dateStr,
      ageWeeks: forecast.ageWeeks,
      predictedPct: forecast.predictedPct,
      predictedEggs,
      expectedBirds: runningBirds,
      standardPct: forecast.standardPct,
      upperPct,
      lowerPct,
    });
  }

  // -------------------------------------------------------------------------
  // 7. Calendar-aligned rolling-origin backtesting
  // -------------------------------------------------------------------------
  const horizonAccuracy = rollingOriginBacktest({
    productionPcts,
    calendarOffsets,
    firstMs,
    hasFlockCurve,
    curveType,
    flockStartDateMs,
  });

  // Overall accuracy from primary horizon (7-day if available, or first available)
  let accuracy: PredictionResult['accuracy'] = null;
  if (horizonAccuracy.length > 0) {
    const primary = horizonAccuracy[0];
    accuracy = {
      mae: primary.mae,
      rmse: primary.rmse,
      mape: primary.mape,
      wape: primary.wape,
      baselineMae: primary.baselineMae,
      maeImprovementPct: primary.maeImprovementPct,
    };
  }

  return {
    predictions,
    accuracy,
    horizonAccuracy,
    dataQuality,
    submissionDensity,
    missingDays,
    daysSinceLastReport,
    lastActualPct: parseFloat(lastActualPct.toFixed(1)),
    lastActualDate,
    populationAssumedConstant,
    projectedDailyMortalityRate: parseFloat(projectedMortalityRate.toFixed(4)),
    projectedDailyCullingRate: parseFloat(projectedCullingRate.toFixed(4)),
  };
}
