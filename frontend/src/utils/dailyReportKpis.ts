/**
 * Shared daily-report KPI helpers used by farmer-portal writes, historical import,
 * dashboard reads and production-curve export payload assembly.
 *
 * Keep this file in sync with backend/src/utils/dailyReportKpis.ts.
 */

export type KpiProvenance = 'imported' | 'calculated';

export interface DailyKpiInputs {
  eggsProduced?: number | null;
  selectionEggs?: number | null;
  birdCount?: number | null;
  mortality?: number | null;
  feedKg?: number | null;
  selectionPct?: number | null;
  actualProductionPct?: number | null;
  mortalityPct?: number | null;
  feedGramsPerBird?: number | null;
}

export interface DailyKpiProvenance {
  selectionPct: KpiProvenance | null;
  actualProductionPct: KpiProvenance | null;
  mortalityPct: KpiProvenance | null;
  feedGramsPerBird: KpiProvenance | null;
}

export interface DailyKpiResult {
  selectionPct: number | null;
  actualProductionPct: number | null;
  mortalityPct: number | null;
  feedGramsPerBird: number | null;
  kpiProvenance: DailyKpiProvenance;
}

function isPresentNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Ratio as a percentage. Missing inputs or a zero denominator stay missing (not 0). */
export function ratioPercent(numerator?: number | null, denominator?: number | null): number | null {
  if (!isPresentNumber(numerator) || !isPresentNumber(denominator) || denominator === 0) {
    return null;
  }
  return (numerator / denominator) * 100;
}

export function calcActualProductionPct(eggsProduced?: number | null, birdCount?: number | null): number | null {
  return ratioPercent(eggsProduced, birdCount);
}

export function calcSelectionPct(selectionEggs?: number | null, eggsProduced?: number | null): number | null {
  return ratioPercent(selectionEggs, eggsProduced);
}

export function calcMortalityPct(mortality?: number | null, birdCount?: number | null): number | null {
  return ratioPercent(mortality, birdCount);
}

export function calcFeedGramsPerBird(feedKg?: number | null, birdCount?: number | null): number | null {
  if (!isPresentNumber(feedKg) || !isPresentNumber(birdCount) || birdCount === 0) {
    return null;
  }
  return (feedKg * 1000) / birdCount;
}

/**
 * Excel AVERAGE: ignore blanks/null/NaN, include numeric zeroes.
 * Returns null when there are no numeric values (#DIV/0! equivalent).
 */
export function averageLikeExcel(values: Array<number | null | undefined>): number | null {
  const numeric = values.filter((v): v is number => isPresentNumber(v));
  if (numeric.length === 0) return null;
  return numeric.reduce((sum, v) => sum + v, 0) / numeric.length;
}

function pickValue(
  imported: number | null | undefined,
  calculated: number | null,
  preferImported: boolean,
): { value: number | null; source: KpiProvenance | null } {
  if (preferImported && isPresentNumber(imported)) {
    return { value: imported, source: 'imported' };
  }
  if (isPresentNumber(calculated)) {
    return { value: calculated, source: 'calculated' };
  }
  if (isPresentNumber(imported)) {
    return { value: imported, source: 'imported' };
  }
  return { value: null, source: null };
}

/**
 * @param preferImported When true (historical import), keep valid source measurements.
 *                       When false (farmer portal), always calculate from operational inputs,
 *                       except feedGramsPerBird which may be supplied by the form.
 */
export function deriveDailyKpis(input: DailyKpiInputs, preferImported = true): DailyKpiResult {
  const eligibleBirds = isPresentNumber(input.birdCount) ? input.birdCount : null;

  const selection = pickValue(
    input.selectionPct,
    calcSelectionPct(input.selectionEggs, input.eggsProduced),
    preferImported,
  );
  const actual = pickValue(
    input.actualProductionPct,
    calcActualProductionPct(input.eggsProduced, eligibleBirds),
    preferImported,
  );
  const mortality = pickValue(
    input.mortalityPct,
    calcMortalityPct(input.mortality, eligibleBirds),
    preferImported,
  );
  const feed = pickValue(
    input.feedGramsPerBird,
    calcFeedGramsPerBird(input.feedKg, eligibleBirds),
    true,
  );

  return {
    selectionPct: selection.value,
    actualProductionPct: actual.value,
    mortalityPct: mortality.value,
    feedGramsPerBird: feed.value,
    kpiProvenance: {
      selectionPct: selection.source,
      actualProductionPct: actual.source,
      mortalityPct: mortality.source,
      feedGramsPerBird: feed.source,
    },
  };
}

export function dailyKpiFieldsForWrite(kpis: DailyKpiResult): {
  selectionPct: number | null;
  actualProductionPct: number | null;
  mortalityPct: number | null;
  feedGramsPerBird: number | null;
  kpiProvenance: DailyKpiProvenance;
} {
  return {
    selectionPct: kpis.selectionPct,
    actualProductionPct: kpis.actualProductionPct,
    mortalityPct: kpis.mortalityPct,
    feedGramsPerBird: kpis.feedGramsPerBird,
    kpiProvenance: kpis.kpiProvenance,
  };
}
