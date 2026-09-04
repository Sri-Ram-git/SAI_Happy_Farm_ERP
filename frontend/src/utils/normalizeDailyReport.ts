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

function toWeightObj(v: unknown): { min: number; max: number; avg: number } {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const obj = v as Record<string, unknown>;
    return { min: toNum(obj.min), max: toNum(obj.max), avg: toNum(obj.avg) };
  }
  return { min: 0, max: 0, avg: 0 };
}

export function normalizeReport(
  docId: string, 
  data: Record<string, unknown>,
  overrideUserId?: string,
  rawPath?: string
): NormalizedReport {
  const birdCount = toNum(data.birdCount || data.closingBirdCount || data.openingBirdCount);
  const openingBirdCount = toNum(data.openingBirdCount || data.birdCount);
  const closingBirdCount = toNum(data.closingBirdCount || data.birdCount);

  return {
    id: docId,
    reportId: String(data.reportId ?? docId),
    userId: String(overrideUserId ?? data.userId ?? data.submittedBy ?? ''),
    farmId: String(data.farmId ?? ''),
    flockId: String(data.flockId ?? ''),
    submissionVersion: toNum(data.submissionVersion || 1),
    status: String(data.status ?? 'submitted'),
    birdCount,
    openingBirdCount,
    closingBirdCount,
    feedKg: toNum(data.feedKg),
    openingFeedKg: toNum(data.openingFeedKg),
    closingFeedKg: toNum(data.closingFeedKg),
    mortality: toNum(data.mortality),
    culling: toNum(data.culling),
    eggsProduced: toNum(data.eggsProduced),
    selectionEggs: toNum(data.selectionEggs),
    temperature: toNumOrNull(data.temperature),
    tempMin: toNumOrNull(data.tempMin),
    tempMax: toNumOrNull(data.tempMax),
    eggWeight: toWeightObj(data.eggWeight),
    bodyWeight: toWeightObj(data.bodyWeight),
    remarks: String(data.remarks ?? ''),
    ammoniaPpm: toNumOrNull(data.ammoniaPpm),
    submittedBy: String(data.submittedBy ?? ''),
    submissionDate: (() => {
      const field = String(data.submissionDate ?? '');
      if (field) return field;
      const match = docId.match(/^(\d{4}-\d{2}-\d{2})/);
      return match ? match[1] : '';
    })(),
    submissionMethod: String(data.submissionMethod ?? ''),
    createdAt: String(data.createdAt ?? data.submittedAt ?? ''),
    rawFirestorePath: rawPath,
  };
}
