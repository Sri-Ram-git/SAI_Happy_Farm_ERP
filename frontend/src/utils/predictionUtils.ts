export interface TrendResult {
  direction: 'improving' | 'stable' | 'declining';
  slope: number;
  confidence: 'low' | 'medium' | 'high';
  forecast: number | null;
  dataPoints: number;
}

export function calculateTrend(values: (number | undefined | null)[]): TrendResult {
  const valid = values.filter((v): v is number => v != null && !isNaN(v) && isFinite(v));

  if (valid.length < 3) {
    return { direction: 'stable', slope: 0, confidence: 'low', forecast: null, dataPoints: valid.length };
  }

  const n = valid.length;
  const xMean = (n - 1) / 2;
  const yMean = valid.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (valid[i]! - yMean);
    den += (i - xMean) * (i - xMean);
  }

  const slope = den === 0 ? 0 : num / den;
  const forecast = valid[n - 1] + slope;
  const avgChange = Math.abs(slope);
  const lastVal = valid[n - 1];

  let direction: 'improving' | 'stable' | 'declining' = 'stable';
  if (lastVal !== undefined) {
    const changePct = lastVal !== 0 ? (avgChange / Math.abs(lastVal)) * 100 : 0;
    if (slope > 0 && changePct > 2) direction = 'improving';
    else if (slope < 0 && changePct > 2) direction = 'declining';
  }

  let confidence: 'low' | 'medium' | 'high' = 'low';
  if (n >= 14) confidence = 'high';
  else if (n >= 7) confidence = 'medium';

  return {
    direction,
    slope: parseFloat(slope.toFixed(2)),
    confidence,
    forecast: parseFloat(forecast.toFixed(1)),
    dataPoints: n,
  };
}

export function calculateMovingAverage(values: (number | undefined | null)[], window: number = 7): (number | null)[] {
  const result: (number | null)[] = [];
  const valid = values.map((v) => (v != null && !isNaN(v) ? v : null));

  for (let i = 0; i < valid.length; i++) {
    const start = Math.max(0, i - window + 1);
    const windowVals = valid.slice(start, i + 1).filter((v): v is number => v !== null);
    result.push(windowVals.length > 0 ? parseFloat((windowVals.reduce((a, b) => a + b, 0) / windowVals.length).toFixed(1)) : null);
  }

  return result;
}

/**
 * Holt's linear trend exponential smoothing benchmark.
 * alpha: level smoothing factor (default 0.2)
 * beta: trend smoothing factor (default 0.1)
 */
export function holtLinearForecast(
  values: number[],
  forecastSteps: number = 7,
  alpha: number = 0.2,
  beta: number = 0.1,
): number[] {
  if (values.length === 0) return [];
  if (values.length === 1) return Array(forecastSteps).fill(values[0]);

  let level = values[0];
  let trend = values[1] - values[0];

  for (let t = 1; t < values.length; t++) {
    const prevLevel = level;
    level = alpha * values[t] + (1 - alpha) * (prevLevel + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
  }

  const forecast: number[] = [];
  for (let h = 1; h <= forecastSteps; h++) {
    forecast.push(parseFloat((level + h * trend).toFixed(1)));
  }
  return forecast;
}
