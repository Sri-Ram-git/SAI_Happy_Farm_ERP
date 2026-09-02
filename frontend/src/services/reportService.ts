const f = (window as any).firebase;

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
  const userId = input.submittedBy;
  const submissionDate = getIstDate();
  const now = new Date().toISOString();

  const parentRef = db.collection('dailyReports').doc(userId);
  const dailyLogRef = db.collection('dailyReports').doc(userId).collection('dailyLogs').doc(submissionDate);

  await db.runTransaction(async (transaction: any) => {
    const existingLog = await transaction.get(dailyLogRef);

    if (existingLog.exists) {
      throw new Error('DUPLICATE_REPORT');
    }

    const openingBirdCount = input.birdCount;
    const closingBirdCount = openingBirdCount - input.mortality - input.culling;

    transaction.set(parentRef, {
      userId,
      farmId: input.farmId,
      lastSubmissionDate: submissionDate,
      updatedAt: now,
    }, { merge: true });

    transaction.set(dailyLogRef, {
      userId,
      submittedBy: userId,
      farmId: input.farmId,
      submissionDate,
      submissionMethod: 'DIGITAL_FORM',
      submittedAt: now,
      updatedAt: now,
      openingBirdCount,
      closingBirdCount,
      birdCount: closingBirdCount,
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
    }, { merge: true });

    if (input.mortality > 0) {
      const birdTxRef = db.collection('farms').doc(input.farmId).collection('birdTransactions').doc();
      transaction.set(birdTxRef, {
        farmId: input.farmId,
        type: 'MORTALITY',
        count: input.mortality,
        reportDate: submissionDate,
        createdAt: now,
        userId,
      });
    }

    if (input.culling > 0) {
      const birdTxRef = db.collection('farms').doc(input.farmId).collection('birdTransactions').doc();
      transaction.set(birdTxRef, {
        farmId: input.farmId,
        type: 'CULLING',
        count: input.culling,
        reportDate: submissionDate,
        createdAt: now,
        userId,
      });
    }

    if (input.feedKg > 0) {
      const feedTxRef = db.collection('farms').doc(input.farmId).collection('feedTransactions').doc();
      transaction.set(feedTxRef, {
        farmId: input.farmId,
        type: 'FEED_USAGE',
        feedKg: input.feedKg,
        reportDate: submissionDate,
        createdAt: now,
        userId,
      });
    }
  });

  return { reportId: `${userId}_${submissionDate}` };
}
