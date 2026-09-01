import { normalizeReport, type NormalizedReport } from '../utils/normalizeDailyReport';

const f = (window as any).firebase;

export type ReportDoc = NormalizedReport;

function subscribeToQuery(
  baseQuery: any,
  callback: (reports: NormalizedReport[]) => void,
  onError?: (error: Error) => void,
): () => void {
  return baseQuery.onSnapshot(
    (snap: any) => {
      const reports = snap.docs.map((doc: any) => normalizeReport(doc.id, doc.data()));
      callback(reports);
    },
    (err: Error) => {
      console.error('[reportDataService] Snapshot error:', err);
      if (onError) onError(err);
    },
  );
}

export function subscribeToAllDailyReports(
  startDate: string,
  endDate: string,
  callback: (reports: NormalizedReport[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const db = f.firestore();
  const q = db.collection('dailyReports')
    .where('submissionDate', '>=', startDate)
    .where('submissionDate', '<=', endDate);
  return subscribeToQuery(q, callback, onError);
}

export function subscribeToDailyReportsByFarms(
  farmIds: string[],
  startDate: string,
  endDate: string,
  callback: (reports: NormalizedReport[]) => void,
  onError?: (error: Error) => void,
): () => void {
  if (farmIds.length === 0) {
    callback([]);
    return () => {};
  }
  const db = f.firestore();

  const batchSize = 10;
  const unsubs: (() => void)[] = [];
  const allReports = new Map<string, NormalizedReport>();

  const emit = () => {
    callback(Array.from(allReports.values()).sort((a, b) => a.submissionDate.localeCompare(b.submissionDate)));
  };

  for (let i = 0; i < farmIds.length; i += batchSize) {
    const batch = farmIds.slice(i, i + batchSize);
    const q = db.collection('dailyReports')
      .where('farmId', 'in', batch)
      .where('submissionDate', '>=', startDate)
      .where('submissionDate', '<=', endDate);

    const unsub = q.onSnapshot(
      (snap: any) => {
        for (const docChange of snap.docChanges()) {
          const report = normalizeReport(docChange.doc.id, docChange.doc.data());
          if (docChange.type === 'removed') {
            allReports.delete(report.id);
          } else {
            allReports.set(report.id, report);
          }
        }
        emit();
      },
      (err: Error) => {
        console.error('[reportDataService] Batch snapshot error:', err);
        if (onError) onError(err);
      },
    );
    unsubs.push(unsub);
  }

  return () => { unsubs.forEach((u) => u()); };
}

export function subscribeToDailyReportsByFarm(
  farmId: string,
  startDate: string,
  endDate: string,
  callback: (reports: NormalizedReport[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const db = f.firestore();
  const q = db.collection('dailyReports')
    .where('farmId', '==', farmId)
    .where('submissionDate', '>=', startDate)
    .where('submissionDate', '<=', endDate);
  return subscribeToQuery(
    q,
    (reports) => callback(reports.sort((a, b) => a.submissionDate.localeCompare(b.submissionDate))),
    onError,
  );
}

export function subscribeToDailyReportsByDate(
  submissionDate: string,
  callback: (reports: NormalizedReport[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const db = f.firestore();
  const q = db.collection('dailyReports').where('submissionDate', '==', submissionDate);
  return subscribeToQuery(q, callback, onError);
}

export async function getReportsByFarm(
  farmId: string,
  startDate: string,
  endDate: string,
): Promise<NormalizedReport[]> {
  const db = f.firestore();
  const snap = await db.collection('dailyReports')
    .where('farmId', '==', farmId)
    .where('submissionDate', '>=', startDate)
    .where('submissionDate', '<=', endDate)
    .get();
  return snap.docs.map((d: any) => normalizeReport(d.id, d.data())).sort((a: NormalizedReport, b: NormalizedReport) => a.submissionDate.localeCompare(b.submissionDate));
}

export async function getReportsByFarms(
  farmIds: string[],
  startDate: string,
  endDate: string,
): Promise<NormalizedReport[]> {
  if (farmIds.length === 0) return [];
  const db = f.firestore();
  const results: NormalizedReport[] = [];
  const batchSize = 10;
  for (let i = 0; i < farmIds.length; i += batchSize) {
    const batch = farmIds.slice(i, i + batchSize);
    const snap = await db.collection('dailyReports')
      .where('farmId', 'in', batch)
      .where('submissionDate', '>=', startDate)
      .where('submissionDate', '<=', endDate)
      .get();
    for (const doc of snap.docs) {
      results.push(normalizeReport(doc.id, doc.data()));
    }
  }
  return results.sort((a: NormalizedReport, b: NormalizedReport) => a.submissionDate.localeCompare(b.submissionDate));
}

export async function getAllReports(
  startDate: string,
  endDate: string,
): Promise<NormalizedReport[]> {
  const db = f.firestore();
  const snap = await db.collection('dailyReports')
    .where('submissionDate', '>=', startDate)
    .where('submissionDate', '<=', endDate)
    .get();
  return snap.docs.map((d: any) => normalizeReport(d.id, d.data())).sort((a: NormalizedReport, b: NormalizedReport) => a.submissionDate.localeCompare(b.submissionDate));
}

export async function getReportsByDate(submissionDate: string): Promise<NormalizedReport[]> {
  const db = f.firestore();
  const snap = await db.collection('dailyReports')
    .where('submissionDate', '==', submissionDate)
    .get();
  return snap.docs.map((d: any) => normalizeReport(d.id, d.data()));
}
