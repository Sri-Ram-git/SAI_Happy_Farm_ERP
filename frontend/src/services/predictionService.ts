import { getStandardProductionAtAge } from '../data/productionCurves';

export interface DailyDataPoint {
  date: string;
  eggsProduced: number;
  birdCount: number;
  productionPct: number;
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

export interface PredictionResult {
  predictions: PredictionPoint[];
  accuracy: {
    mae: number;
    rmse: number;
    mape: number;
  } | null;
  dataQuality: 'insufficient' | 'preliminary' | 'reliable';
  lastActualPct: number;
  lastActualDate: string;
}

/**
 * Generate egg production predictions for a flock.
 *
 * Uses weighted moving average + linear regression on recent data,
 * blended with the standard production curve based on flock age.
 */
export function generatePredictions(params: {
  historicalData: DailyDataPoint[];
  currentBirds: number;
  flockStartDate: string;
  curveType: 'CF_STD' | 'FR_STD';
  forecastDays: number;
  dailyMortalityRate?: number;
}): PredictionResult {
  const {
    historicalData,
    currentBirds,
    flockStartDate,
    curveType,
    forecastDays,
    dailyMortalityRate = 0.001,
  } = params;

  // Sort by date ascending
  const sorted = [...historicalData]
    .filter((d) => d.birdCount > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (sorted.length === 0) {
    return {
      predictions: [],
      accuracy: null,
      dataQuality: 'insufficient',
      lastActualPct: 0,
      lastActualDate: '',
    };
  }

  const dataQuality: PredictionResult['dataQuality'] =
    sorted.length >= 14 ? 'reliable' : sorted.length >= 7 ? 'preliminary' : 'insufficient';

  // Calculate production percentages
  const productionPcts = sorted.map((d) => (d.eggsProduced / d.birdCount) * 100);
  const lastActualPct = productionPcts[productionPcts.length - 1];
  const lastActualDate = sorted[sorted.length - 1].date;

  // Weighted moving average (recent data weighted more)
  const windowSize = Math.min(7, productionPcts.length);
  let weightedSum = 0;
  let weightTotal = 0;
  for (let i = productionPcts.length - windowSize; i < productionPcts.length; i++) {
    const weight = i - (productionPcts.length - windowSize) + 1;
    weightedSum += productionPcts[i] * weight;
    weightTotal += weight;
  }
  const wma = weightedSum / weightTotal;

  // Linear regression on recent data for trend
  const recentN = Math.min(14, productionPcts.length);
  const recentData = productionPcts.slice(-recentN);
  const xMean = (recentN - 1) / 2;
  const yMean = recentData.reduce((s, v) => s + v, 0) / recentN;

  let num = 0;
  let den = 0;
  for (let i = 0; i < recentN; i++) {
    num += (i - xMean) * (recentData[i] - yMean);
    den += (i - xMean) * (i - xMean);
  }
  const slope = den === 0 ? 0 : num / den;

  // Calculate standard error for prediction intervals
  let residualSum = 0;
  for (let i = 0; i < recentN; i++) {
    const predicted = yMean + slope * (i - xMean);
    residualSum += (recentData[i] - predicted) ** 2;
  }
  const standardError = recentN > 2 ? Math.sqrt(residualSum / (recentN - 2)) : 5;

  // Calculate flock age in weeks from start date
  const startMs = new Date(flockStartDate + 'T00:00:00+05:30').getTime();
  const lastDateMs = new Date(lastActualDate + 'T00:00:00+05:30').getTime();
  const currentAgeWeeks = (lastDateMs - startMs) / (7 * 24 * 3600 * 1000);

  // Generate predictions
  const predictions: PredictionPoint[] = [];
  let runningBirds = currentBirds;

  for (let day = 1; day <= forecastDays; day++) {
    const forecastDate = new Date(lastDateMs + day * 24 * 3600 * 1000);
    const dateStr = forecastDate.toISOString().slice(0, 10);
    const ageWeeks = currentAgeWeeks + day / 7;

    // Standard production at this age
    const standardPct = getStandardProductionAtAge(curveType, ageWeeks);

    // Trend projection
    const trendPct = wma + slope * day;

    // Blend: 60% trend, 40% standard curve (adjustable)
    const blendWeight = dataQuality === 'reliable' ? 0.7 : dataQuality === 'preliminary' ? 0.5 : 0.3;
    let predictedPct = blendWeight * trendPct + (1 - blendWeight) * standardPct;
    predictedPct = Math.max(0, Math.min(100, predictedPct));

    // Prediction intervals widen with forecast horizon
    const intervalWidth = standardError * Math.sqrt(1 + day / recentN) * 1.96;
    const upperPct = Math.min(100, predictedPct + intervalWidth);
    const lowerPct = Math.max(0, predictedPct - intervalWidth);

    // Estimate bird count (slight daily mortality)
    runningBirds = Math.max(0, Math.round(runningBirds * (1 - dailyMortalityRate)));
    const predictedEggs = Math.round((predictedPct / 100) * runningBirds);

    predictions.push({
      date: dateStr,
      ageWeeks: parseFloat(ageWeeks.toFixed(1)),
      predictedPct: parseFloat(predictedPct.toFixed(1)),
      predictedEggs,
      expectedBirds: runningBirds,
      standardPct: parseFloat(standardPct.toFixed(1)),
      upperPct: parseFloat(upperPct.toFixed(1)),
      lowerPct: parseFloat(lowerPct.toFixed(1)),
    });
  }

  // Calculate accuracy metrics using leave-one-out on recent data
  let accuracy: PredictionResult['accuracy'] = null;
  if (sorted.length >= 7) {
    const testSize = Math.min(7, Math.floor(sorted.length / 3));
    const trainData = productionPcts.slice(0, -testSize);
    const testData = productionPcts.slice(-testSize);

    // Simple predictions for test set using training data trend
    const trainMean = trainData.reduce((s, v) => s + v, 0) / trainData.length;
    let tNum = 0;
    let tDen = 0;
    const tXMean = (trainData.length - 1) / 2;
    for (let i = 0; i < trainData.length; i++) {
      tNum += (i - tXMean) * (trainData[i] - trainMean);
      tDen += (i - tXMean) * (i - tXMean);
    }
    const tSlope = tDen === 0 ? 0 : tNum / tDen;

    let sumAE = 0;
    let sumSE = 0;
    let sumAPE = 0;
    let validPE = 0;

    for (let i = 0; i < testSize; i++) {
      const predicted = trainMean + tSlope * (trainData.length + i - tXMean);
      const actual = testData[i];
      const error = Math.abs(actual - predicted);
      sumAE += error;
      sumSE += error ** 2;
      if (actual > 0) {
        sumAPE += (error / actual) * 100;
        validPE++;
      }
    }

    accuracy = {
      mae: parseFloat((sumAE / testSize).toFixed(2)),
      rmse: parseFloat(Math.sqrt(sumSE / testSize).toFixed(2)),
      mape: validPE > 0 ? parseFloat((sumAPE / validPE).toFixed(2)) : 0,
    };
  }

  return {
    predictions,
    accuracy,
    dataQuality,
    lastActualPct: parseFloat(lastActualPct.toFixed(1)),
    lastActualDate,
  };
}
