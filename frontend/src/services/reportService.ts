const f = (window as any).firebase;

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getIstDate(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const y = parts.find((p) => p.type === 'year')?.value ?? '';
  const m = parts.find((p) => p.type === 'month')?.value ?? '';
  const d = parts.find((p) => p.type === 'day')?.value ?? '';
  return `${y}-${m}-${d}`;
}

export function formatDisplayDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d} ${months[parseInt(m, 10) - 1]} ${y}`;
}

export interface SubmitReportInput {
  farmId: string;
  birdCount: number;
  feedKg: number;
  mortality: number;
  culling: number;
  eggsProduced: number;
  selectionEggs: number;
  temperature: number;
  eggWeight: { min: number; max: number; avg: number };
  bodyWeight: { min: number; max: number; avg: number };
  remarks: string;
  ammoniaPpm: number;
  submittedBy: string;
}

export async function submitReport(input: SubmitReportInput): Promise<{ reportId: string }> {
  const db = f.firestore();
  const reportId = generateId();
  const submissionDate = getIstDate();
  const createdAt = new Date().toISOString();
  const lockDocId = `${input.farmId}_${submissionDate}`;

  const report = {
    reportId,
    farmId: input.farmId,
    birdCount: input.birdCount,
    feedKg: input.feedKg,
    mortality: input.mortality,
    culling: input.culling,
    eggsProduced: input.eggsProduced,
    selectionEggs: input.selectionEggs,
    temperature: input.temperature,
    eggWeight: input.eggWeight,
    bodyWeight: input.bodyWeight,
    remarks: input.remarks,
    ammoniaPpm: input.ammoniaPpm,
    submittedBy: input.submittedBy,
    submissionDate,
    submissionMethod: 'DIGITAL_FORM',
    createdAt,
  };

  await db.runTransaction(async (transaction: any) => {
    const lockRef = db.collection('dailyReportLocks').doc(lockDocId);
    const lockDoc = await transaction.get(lockRef);

    if (lockDoc.exists) {
      throw new Error('DUPLICATE_REPORT');
    }

    transaction.set(lockRef, {
      farmId: input.farmId,
      submissionDate,
      reportId,
      createdAt,
    });

    const reportRef = db.collection('dailyReports').doc(reportId);
    transaction.set(reportRef, report);
  });

  return { reportId };
}
