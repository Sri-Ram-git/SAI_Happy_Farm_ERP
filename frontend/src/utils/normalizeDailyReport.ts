export interface NormalizedReport {
  id: string;
  reportId: string;
  userId: string;
  farmId: string;
  flockId: string;
  submissionVersion: number;
  status: string;
  birdCount: number;
  openingBirdCount: number;
  closingBirdCount: number;
  feedKg: number;
  openingFeedKg: number;
  closingFeedKg: number;
  mortality: number;
  culling: number;
  eggsProduced: number;
  selectionEggs: number;
  damagedEggs?: number;
  eggsReceived?: number;
  floorEggs?: number;
  weekNumber?: number;
  weekLabel?: string;
  feedGramsPerBird?: number;
  actualProductionPct?: number;
  standardProductionPct?: number;
  temperature: number | null;
  tempMin: number | null;
  tempMax: number | null;
  eggWeight: { min: number; max: number; avg: number };
  bodyWeight: { min: number; max: number; avg: number };
  remarks: string;
  ammoniaPpm: number | null;
  submittedBy: string;
  submissionDate: string;
  submissionMethod: string;
  createdAt: string;
  rawFirestorePath?: string;
}

function toNum(v: unknown): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function toNumOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toWeightObj(v: unknown, data?: Record<string, unknown>): { min: number; max: number; avg: number } {
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
    return { min: v, max: v, avg: v };
  }
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const obj = v as Record<string, unknown>;
    const avg = toNum(obj.avg ?? obj.average ?? obj.eggWeightAvg);
    const min = toNum(obj.min ?? obj.minimum);
    const max = toNum(obj.max ?? obj.maximum);
    return {
      min: min || avg,
      max: max || avg,
      avg: avg || (min && max ? Number(((min + max) / 2).toFixed(1)) : (min || max)),
    };
  }
  if (data) {
    const fallbackAvg = toNum(data.avgEggWeight ?? data.eggWeightAvg ?? data.averageEggWeight);
    if (fallbackAvg > 0) {
      const min = toNum(data.eggWeightMin) || fallbackAvg;
      const max = toNum(data.eggWeightMax) || fallbackAvg;
      return { min, max, avg: fallbackAvg };
    }
  }
  return { min: 0, max: 0, avg: 0 };
}

export function normalizeReport(
  docId: string, 
  data: Record<string, unknown>,
  overrideUserId?: string,
  rawPath?: string
): NormalizedReport {
  let resolvedFarmId = String(data.farmId ?? data.farm_id ?? data.farmCode ?? '').trim();
  if (!resolvedFarmId) {
    const match = docId.match(/^([A-Za-z0-9_-]+)_\d{4}-\d{2}-\d{2}/);
    if (match) resolvedFarmId = match[1];
  }

  const birdCount = toNum(
    data.birdCount ?? data.closingBirdCount ?? data.openingBirdCount ?? data.noOfBirds ?? data.currentBirdCount ?? data.totalBirds
  );
  const openingBirdCount = toNum(
    data.openingBirdCount ?? data.birdCount ?? data.noOfBirds ?? data.initialBirdCount
  );
  const closingBirdCount = toNum(
    data.closingBirdCount ?? data.birdCount ?? data.noOfBirds ?? data.currentBirdCount
  );

  return {
    id: docId,
    reportId: String(data.reportId ?? docId),
    userId: String(overrideUserId ?? data.userId ?? data.submittedBy ?? ''),
    farmId: resolvedFarmId,
    flockId: String(data.flockId ?? ''),
    submissionVersion: toNum(data.submissionVersion || 1),
    status: String(data.status ?? (data.isDraft ? 'draft' : 'submitted')),
    birdCount,
    openingBirdCount,
    closingBirdCount,
    feedKg: toNum(data.feedKg ?? data.feedKgs ?? data.feedConsumedKg ?? data.feed),
    openingFeedKg: toNum(data.openingFeedKg),
    closingFeedKg: toNum(data.closingFeedKg),
    mortality: toNum(data.mortality ?? data.mortalityBirds ?? data.deadBirds),
    culling: toNum(data.culling),
    eggsProduced: toNum(data.eggsProduced ?? data.production ?? data.totalEggs ?? data.eggs),
    selectionEggs: toNum(data.selectionEggs ?? data.selectedEggs ?? data.selection),
    damagedEggs: toNum(data.damagedEggs ?? data.damageCount ?? data.damageEggs ?? data.damage),
    eggsReceived: data.eggsReceived != null ? toNum(data.eggsReceived) : (data.receivedEggs != null ? toNum(data.receivedEggs) : undefined),
    floorEggs: toNum(data.floorEggs),
    weekNumber: data.weekNumber != null ? toNum(data.weekNumber) : undefined,
    weekLabel:
      typeof data.weekLabel === 'string'
        ? data.weekLabel
        : data.weekNumber != null
        ? String(data.weekNumber)
        : undefined,
    feedGramsPerBird: data.feedGramsPerBird != null ? toNum(data.feedGramsPerBird) : undefined,
    actualProductionPct: data.actualProductionPct != null ? toNum(data.actualProductionPct) : (data.actPct != null ? toNum(data.actPct) : (data.actualProdPct != null ? toNum(data.actualProdPct) : undefined)),
    standardProductionPct: data.standardProductionPct != null ? toNum(data.standardProductionPct) : undefined,
    temperature: toNumOrNull(data.temperature),
    tempMin: toNumOrNull(data.tempMin),
    tempMax: toNumOrNull(data.tempMax),
    eggWeight: toWeightObj(data.eggWeight, data),
    bodyWeight: toWeightObj(data.bodyWeight),
    remarks: String(data.remarks ?? ''),
    ammoniaPpm: toNumOrNull(data.ammoniaPpm),
    submittedBy: String(data.submittedBy ?? ''),
    submissionDate: (() => {
      const raw = data.submissionDate ?? data.reportDate ?? data.date ?? data.logDate;
      if (raw) {
        if (typeof raw === 'string') {
          const trimmed = raw.trim();
          if (trimmed.includes('T')) return trimmed.split('T')[0];
          if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
          return trimmed;
        }
        if (typeof (raw as any)?.toDate === 'function') {
          const d = (raw as any).toDate();
          return d.toISOString().split('T')[0];
        }
      }
      const match = docId.match(/^(\d{4}-\d{2}-\d{2})/);
      if (match) return match[1];

      const fallbackRaw = data.createdAt ?? data.submittedAt;
      if (fallbackRaw && typeof fallbackRaw === 'string' && fallbackRaw.includes('T')) {
        return fallbackRaw.split('T')[0];
      }
      return '';
    })(),
    submissionMethod: String(data.submissionMethod ?? ''),
    createdAt: String(data.createdAt ?? data.submittedAt ?? ''),
    rawFirestorePath: rawPath,
  };
}
