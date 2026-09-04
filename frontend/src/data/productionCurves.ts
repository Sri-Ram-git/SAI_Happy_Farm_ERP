/**
 * Standard production curve data for poultry breeds.
 * CF = Cobb Breeder Female, FR = Ross Breeder Female
 * Values represent expected egg production % by age in weeks.
 * 
 * NOTE: These are representative standard curves. Replace with your
 * actual CF STD / FR STD Excel data when available.
 */

export interface ProductionCurvePoint {
  ageWeeks: number;
  productionPct: number;
}

// CF STD - Cobb Breeder Female Standard Production Curve
export const CF_STD_CURVE: ProductionCurvePoint[] = [
  { ageWeeks: 20, productionPct: 0 },
  { ageWeeks: 21, productionPct: 2 },
  { ageWeeks: 22, productionPct: 8 },
  { ageWeeks: 23, productionPct: 22 },
  { ageWeeks: 24, productionPct: 42 },
  { ageWeeks: 25, productionPct: 62 },
  { ageWeeks: 26, productionPct: 76 },
  { ageWeeks: 27, productionPct: 83 },
  { ageWeeks: 28, productionPct: 85 },
  { ageWeeks: 29, productionPct: 85.5 },
  { ageWeeks: 30, productionPct: 85 },
  { ageWeeks: 31, productionPct: 84.5 },
  { ageWeeks: 32, productionPct: 84 },
  { ageWeeks: 33, productionPct: 83 },
  { ageWeeks: 34, productionPct: 82 },
  { ageWeeks: 35, productionPct: 81 },
  { ageWeeks: 36, productionPct: 80 },
  { ageWeeks: 37, productionPct: 79 },
  { ageWeeks: 38, productionPct: 78 },
  { ageWeeks: 39, productionPct: 77 },
  { ageWeeks: 40, productionPct: 76 },
  { ageWeeks: 41, productionPct: 74.5 },
  { ageWeeks: 42, productionPct: 73 },
  { ageWeeks: 43, productionPct: 71.5 },
  { ageWeeks: 44, productionPct: 70 },
  { ageWeeks: 45, productionPct: 68.5 },
  { ageWeeks: 46, productionPct: 67 },
  { ageWeeks: 47, productionPct: 65.5 },
  { ageWeeks: 48, productionPct: 64 },
  { ageWeeks: 49, productionPct: 62 },
  { ageWeeks: 50, productionPct: 60 },
  { ageWeeks: 51, productionPct: 58 },
  { ageWeeks: 52, productionPct: 56 },
  { ageWeeks: 53, productionPct: 54 },
  { ageWeeks: 54, productionPct: 52 },
  { ageWeeks: 55, productionPct: 50 },
  { ageWeeks: 56, productionPct: 48 },
  { ageWeeks: 57, productionPct: 46 },
  { ageWeeks: 58, productionPct: 44 },
  { ageWeeks: 59, productionPct: 42 },
  { ageWeeks: 60, productionPct: 40 },
  { ageWeeks: 61, productionPct: 38 },
  { ageWeeks: 62, productionPct: 36 },
  { ageWeeks: 63, productionPct: 34 },
  { ageWeeks: 64, productionPct: 32 },
  { ageWeeks: 65, productionPct: 30 },
];

// FR STD - Ross Breeder Female Standard Production Curve
export const FR_STD_CURVE: ProductionCurvePoint[] = [
  { ageWeeks: 20, productionPct: 0 },
  { ageWeeks: 21, productionPct: 3 },
  { ageWeeks: 22, productionPct: 12 },
  { ageWeeks: 23, productionPct: 30 },
  { ageWeeks: 24, productionPct: 52 },
  { ageWeeks: 25, productionPct: 70 },
  { ageWeeks: 26, productionPct: 80 },
  { ageWeeks: 27, productionPct: 84 },
  { ageWeeks: 28, productionPct: 85 },
  { ageWeeks: 29, productionPct: 84.5 },
  { ageWeeks: 30, productionPct: 84 },
  { ageWeeks: 31, productionPct: 83 },
  { ageWeeks: 32, productionPct: 82 },
  { ageWeeks: 33, productionPct: 81 },
  { ageWeeks: 34, productionPct: 80 },
  { ageWeeks: 35, productionPct: 79 },
  { ageWeeks: 36, productionPct: 77.5 },
  { ageWeeks: 37, productionPct: 76 },
  { ageWeeks: 38, productionPct: 75 },
  { ageWeeks: 39, productionPct: 73.5 },
  { ageWeeks: 40, productionPct: 72 },
  { ageWeeks: 41, productionPct: 70.5 },
  { ageWeeks: 42, productionPct: 69 },
  { ageWeeks: 43, productionPct: 67.5 },
  { ageWeeks: 44, productionPct: 66 },
  { ageWeeks: 45, productionPct: 64.5 },
  { ageWeeks: 46, productionPct: 63 },
  { ageWeeks: 47, productionPct: 61.5 },
  { ageWeeks: 48, productionPct: 60 },
  { ageWeeks: 49, productionPct: 58 },
  { ageWeeks: 50, productionPct: 56 },
  { ageWeeks: 51, productionPct: 54 },
  { ageWeeks: 52, productionPct: 52 },
  { ageWeeks: 53, productionPct: 50 },
  { ageWeeks: 54, productionPct: 48 },
  { ageWeeks: 55, productionPct: 46 },
  { ageWeeks: 56, productionPct: 44 },
  { ageWeeks: 57, productionPct: 42 },
  { ageWeeks: 58, productionPct: 40 },
  { ageWeeks: 59, productionPct: 38 },
  { ageWeeks: 60, productionPct: 36 },
  { ageWeeks: 61, productionPct: 34 },
  { ageWeeks: 62, productionPct: 32 },
  { ageWeeks: 63, productionPct: 30 },
  { ageWeeks: 64, productionPct: 28 },
  { ageWeeks: 65, productionPct: 26 },
];

export function getProductionCurve(type: 'CF_STD' | 'FR_STD'): ProductionCurvePoint[] {
  return type === 'CF_STD' ? CF_STD_CURVE : FR_STD_CURVE;
}

/**
 * Get the standard production % for a given age in weeks via linear interpolation.
 */
export function getStandardProductionAtAge(
  curveType: 'CF_STD' | 'FR_STD',
  ageWeeks: number,
): number {
  const curve = getProductionCurve(curveType);
  if (ageWeeks <= curve[0].ageWeeks) return curve[0].productionPct;
  if (ageWeeks >= curve[curve.length - 1].ageWeeks) return curve[curve.length - 1].productionPct;

  for (let i = 0; i < curve.length - 1; i++) {
    if (ageWeeks >= curve[i].ageWeeks && ageWeeks <= curve[i + 1].ageWeeks) {
      const frac = (ageWeeks - curve[i].ageWeeks) / (curve[i + 1].ageWeeks - curve[i].ageWeeks);
      return curve[i].productionPct + frac * (curve[i + 1].productionPct - curve[i].productionPct);
    }
  }
  return 0;
}
