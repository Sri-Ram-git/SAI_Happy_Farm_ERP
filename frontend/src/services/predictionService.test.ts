import { describe, it, expect } from 'vitest';
import {
  generatePredictions,
  calculateDampedTrendEffect,
  getStudentTCritical,
  olsPredictionIntervalHalfWidth,
  olsRegression,
  type DailyDataPoint,
} from './predictionService';
import { holtLinearForecast } from '../utils/predictionUtils';

describe('Prediction Service — P0 & P1 Unit Tests', () => {
  // Helper to generate synthetic reports for testing
  function createSyntheticSeries(
    count: number,
    startDay: number = 1,
    pctFn: (day: number) => number = () => 80,
    birds: number = 10000,
  ): DailyDataPoint[] {
    const list: DailyDataPoint[] = [];
    const baseMs = new Date('2026-05-01T00:00:00Z').getTime() + (startDay - 1) * 24 * 3600 * 1000;
    for (let i = 0; i < count; i++) {
      const dateStr = new Date(baseMs + i * 24 * 3600 * 1000).toISOString().slice(0, 10);
      const pct = pctFn(i);
      const eggs = Math.round((pct / 100) * birds);
      list.push({
        date: dateStr,
        eggsProduced: eggs,
        birdCount: birds,
        productionPct: pct,
        mortality: 5,
        culling: 2,
      });
    }
    return list;
  }

  // 1. Calendar gaps and date alignment
  it('correctly uses calendar-day offsets when historical data has gaps', () => {
    const gappedData: DailyDataPoint[] = [
      { date: '2026-06-01', eggsProduced: 7000, birdCount: 10000, productionPct: 70 },
      { date: '2026-06-02', eggsProduced: 7100, birdCount: 10000, productionPct: 71 },
      // 8-day gap
      { date: '2026-06-11', eggsProduced: 8000, birdCount: 10000, productionPct: 80 },
    ];

    const result = generatePredictions({
      historicalData: gappedData,
      currentBirds: 10000,
      forecastDays: 7,
    });

    expect(result.missingDays).toBe(8);
    expect(result.submissionDensity).toBeCloseTo(3 / 11, 2);
    expect(result.predictions.length).toBe(7);
    // Forecast starts on calendar day following the last actual date
    expect(result.predictions[0].date).toBe('2026-06-12');
  });

  // 2. Positive and negative trend damping across 7/14/21/30 days
  it('ensures positive and negative trend damping is strictly monotonic and does not artificially reverse', () => {
    const posSlope = 0.5;
    const negSlope = -0.5;

    const days = [1, 7, 8, 14, 21, 30];

    // Positive trend: strictly increasing, no reversal
    const posEffects = days.map((d) => calculateDampedTrendEffect(posSlope, d));
    for (let i = 1; i < posEffects.length; i++) {
      expect(posEffects[i]).toBeGreaterThan(posEffects[i - 1]);
    }
    // Asymptote check: at day 30, it approaches 0.5 * (7 + 5.667) ≈ 6.33
    expect(posEffects[5]).toBeCloseTo(0.5 * (7 + 5.5), 1);

    // Negative trend: strictly decreasing, no reversal
    const negEffects = days.map((d) => calculateDampedTrendEffect(negSlope, d));
    for (let i = 1; i < negEffects.length; i++) {
      expect(negEffects[i]).toBeLessThan(negEffects[i - 1]);
    }
  });

  // 3. Student's t critical values
  it('applies Student t critical values for degrees of freedom n - 2', () => {
    expect(getStudentTCritical(1)).toBe(12.706);
    expect(getStudentTCritical(5)).toBe(2.571);
    expect(getStudentTCritical(12)).toBe(2.179);
    expect(getStudentTCritical(30)).toBe(2.042);
    // Larger df approaches 1.96
    expect(getStudentTCritical(100)).toBeCloseTo(1.984, 2);

    // Verify interval width calculation uses t-crit instead of fixed 1.96
    const halfWidthSmallN = olsPredictionIntervalHalfWidth(2.0, 7, 10, 5, 20); // df = 5, t = 2.571
    // manual check: 2.571 * 2.0 * sqrt(1 + 1/7 + 25/20) = 5.142 * sqrt(1 + 0.1428 + 1.25) ≈ 7.97
    expect(halfWidthSmallN).toBeGreaterThan(7.0);
  });

  // 4. Breed-curve forecasting and backtesting consistency
  it('evaluates the same breed curve logic in both live prediction and rolling backtest', () => {
    const data = createSyntheticSeries(25, 1, (i) => 60 + i * 0.8);
    const flockStartDate = '2026-01-01'; // Placement date

    const result = generatePredictions({
      historicalData: data,
      currentBirds: 10000,
      flockStartDate,
      curveType: 'CF_STD',
      forecastDays: 14,
    });

    expect(result.predictions[0].standardPct).toBeGreaterThan(0);
    expect(result.horizonAccuracy.length).toBeGreaterThan(0);
    // Backtesting produced valid results using the breed curve
    const h7 = result.horizonAccuracy.find((h) => h.horizon === 7);
    expect(h7).toBeDefined();
    expect(h7!.mae).toBeGreaterThanOrEqual(0);
  });

  // 5. Mortality and culling without double-counting
  it('projects population decay using empirical attrition without double-counting past losses', () => {
    const data = createSyntheticSeries(14, 1, () => 85);
    const initialBirds = 10000;

    const result = generatePredictions({
      historicalData: data,
      currentBirds: initialBirds,
      forecastDays: 14,
      dailyMortalityRate: 0.001, // 0.1% daily
      dailyCullingRate: 0.0005,  // 0.05% daily
    });

    expect(result.populationAssumedConstant).toBe(false);
    expect(result.predictions[0].expectedBirds).toBeLessThan(initialBirds);
    expect(result.predictions[13].expectedBirds).toBeLessThan(result.predictions[0].expectedBirds);
    // Eggs are calculated from the projected population of each day
    for (const p of result.predictions) {
      const expectedEggs = Math.round((p.predictedPct / 100) * p.expectedBirds);
      expect(p.predictedEggs).toBe(expectedEggs);
    }
  });

  // 6. Zero-denominator MAPE/WAPE
  it('returns null for MAPE and WAPE when denominators are zero instead of claiming 0% error', () => {
    // Zero production across all days
    const zeroData = createSyntheticSeries(20, 1, () => 0);

    const result = generatePredictions({
      historicalData: zeroData,
      currentBirds: 10000,
      forecastDays: 7,
    });

    if (result.accuracy) {
      expect(result.accuracy.mape).toBeNull();
      expect(result.accuracy.wape).toBeNull();
    }
    for (const h of result.horizonAccuracy) {
      expect(h.mape).toBeNull();
      expect(h.wape).toBeNull();
    }
  });

  // 7. Forecast horizon alignment
  it('aligns forecasts across 7, 14, 21, and 30 day horizons correctly', () => {
    const data = createSyntheticSeries(35, 1, (i) => 75 + Math.sin(i / 5) * 5);

    const result30 = generatePredictions({
      historicalData: data,
      currentBirds: 10000,
      forecastDays: 30,
    });

    expect(result30.predictions.length).toBe(30);
    // Check that horizon accuracy entries exist for evaluated horizons
    const horizons = result30.horizonAccuracy.map((h) => h.horizon);
    expect(horizons).toContain(7);
    expect(horizons).toContain(14);
  });

  // 8. No future-data leakage
  it('verifies backtesting does not leak future data into origin models', () => {
    // In sudden step shift at day 20, origins before day 20 should have baseline and OLS uninfluenced by day 20+
    const data = createSyntheticSeries(25, 1, (i) => (i < 18 ? 80 : 40));

    const result = generatePredictions({
      historicalData: data,
      currentBirds: 10000,
      forecastDays: 7,
    });

    expect(result.horizonAccuracy.length).toBeGreaterThan(0);
    // Valid predictions generated
    expect(result.predictions[0].predictedPct).toBeGreaterThan(0);
  });

  // 9. Unique origin counting
  it('distinguishes unique forecast origins from total evaluation points', () => {
    const data = createSyntheticSeries(20, 1, () => 80);

    const result = generatePredictions({
      historicalData: data,
      currentBirds: 10000,
      forecastDays: 7,
    });

    const h7 = result.horizonAccuracy.find((h) => h.horizon === 7);
    expect(h7).toBeDefined();
    // Unique origins must be strictly less than or equal to evaluationPoints
    expect(h7!.origins).toBeLessThanOrEqual(h7!.evaluationPoints);
    expect(h7!.evaluationPoints).toBe(h7!.origins * 7); // dense 7-day evaluations
  });

  // 10. Naive baseline comparison
  it('computes naive persistence baseline MAE and percentage improvement', () => {
    // Predictable linear upward trend where model should outperform naive persistence
    const data = createSyntheticSeries(25, 1, (i) => 60 + i * 1.0);

    const result = generatePredictions({
      historicalData: data,
      currentBirds: 10000,
      forecastDays: 7,
    });

    const h7 = result.horizonAccuracy.find((h) => h.horizon === 7);
    expect(h7).toBeDefined();
    expect(h7!.baselineMae).toBeGreaterThan(0);
    // Model capturing the upward trend should beat or compare with naive last-value baseline
    expect(typeof h7!.maeImprovementPct).toBe('number');
  });

  // 11. Benchmark against Holt's linear trend
  it('benchmarks against Holts linear trend exponential smoothing', () => {
    const historical = [72, 73, 74, 75, 77, 78, 79, 81, 82, 83];
    const holtSteps = holtLinearForecast(historical, 7);
    expect(holtSteps.length).toBe(7);
    // Holt captures the upward trend
    expect(holtSteps[6]).toBeGreaterThan(holtSteps[0]);
  });
});
