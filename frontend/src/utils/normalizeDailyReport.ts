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
  floorEggs?: number;
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
    farmId: String(data.farmId ?? '').trim(),
    flockId: String(data.flockId ?? ''),
    submissionVersion: toNum(data.submissionVersion || 1),
    status: String(data.status ?? (data.isDraft ? 'draft' : 'submitted')),
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
    damagedEggs: toNum(data.damagedEggs),
    floorEggs: toNum(data.floorEggs),
    temperature: toNumOrNull(data.temperature),
    tempMin: toNumOrNull(data.tempMin),
    tempMax: toNumOrNull(data.tempMax),
    eggWeight: toWeightObj(data.eggWeight),
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
