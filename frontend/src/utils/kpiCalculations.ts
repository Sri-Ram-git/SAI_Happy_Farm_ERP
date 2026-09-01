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
