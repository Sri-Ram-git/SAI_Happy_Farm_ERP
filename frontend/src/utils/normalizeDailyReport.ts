export interface NormalizedReport {
  id: string;
  reportId: string;
  userId: string;
  farmId: string;
  birdCount: number;
  feedKg: number;
  mortality: number;
  culling: number;
  eggsProduced: number;
  selectionEggs: number;
  temperature: number | null;
  eggWeight: { min: number; max: number; avg: number };
  bodyWeight: { min: number; max: number; avg: number };
  remarks: string;
  ammoniaPpm: number | null;
  submittedBy: string;
  submissionDate: string;
  submissionMethod: string;
  createdAt: string;
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

export function normalizeReport(docId: string, data: Record<string, unknown>): NormalizedReport {
  return {
    id: docId,
    reportId: String(data.reportId ?? docId),
    userId: String(data.userId ?? data.submittedBy ?? ''),
    farmId: String(data.farmId ?? ''),
    birdCount: toNum(data.birdCount),
    feedKg: toNum(data.feedKg),
    mortality: toNum(data.mortality),
    culling: toNum(data.culling),
    eggsProduced: toNum(data.eggsProduced),
    selectionEggs: toNum(data.selectionEggs),
    temperature: toNumOrNull(data.temperature),
    eggWeight: toWeightObj(data.eggWeight),
    bodyWeight: toWeightObj(data.bodyWeight),
    remarks: String(data.remarks ?? ''),
    ammoniaPpm: toNumOrNull(data.ammoniaPpm),
    submittedBy: String(data.submittedBy ?? ''),
    submissionDate: String(data.submissionDate ?? ''),
    submissionMethod: String(data.submissionMethod ?? ''),
    createdAt: String(data.createdAt ?? data.submittedAt ?? ''),
  };
}
