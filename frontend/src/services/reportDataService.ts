import { normalizeReport, type NormalizedReport } from '../utils/normalizeDailyReport';

const f = (window as any).firebase;

export type ReportDoc = NormalizedReport;

function dedupeAndSort(reports: NormalizedReport[]): NormalizedReport[] {
  const seen = new Map<string, NormalizedReport>();
  for (const r of reports) {
    const key = `${r.farmId}_${r.submissionDate}`;
    if (!seen.has(key)) {
      seen.set(key, r);
    }
  }
  return Array.from(seen.values()).sort((a, b) => a.submissionDate.localeCompare(b.submissionDate));
}

function isOldFormatDoc(docData: Record<string, unknown>): boolean {
  return !docData.userId && !docData.submittedBy && !docData.submissionDate;
}

async function fetchOldFormatReports(
  startDate: string,
  endDate: string,
  farmIds?: string[],
): Promise<NormalizedReport[]> {
  const db = f.firestore();
  try {
    let q = db.collection('dailyReports')
      .where('submissionDate', '>=', startDate)
      .where('submissionDate', '<=', endDate);

    const snap = await q.get();
    let reports = snap.docs
      .map((d: any) => {
        const data = d.data();
        if (data.userId || data.lastSubmissionDate) return null;
        return normalizeReport(d.id, data);
      })
      .filter((r: NormalizedReport | null): r is NormalizedReport => r !== null);

    if (farmIds && farmIds.length > 0) {
      const farmSet = new Set(farmIds);
      reports = reports.filter((r: NormalizedReport) => farmSet.has(r.farmId));
    }

    return reports;
  } catch (err) {
    console.warn('[reportDataService] Old format query failed:', err);
    return [];
  }
}

async function fetchNewFormatReports(
  startDate: string,
  endDate: string,
  farmIds?: string[],
): Promise<NormalizedReport[]> {
  const db = f.firestore();
  try {
    const q = db.collectionGroup('dailyLogs')
      .where('submissionDate', '>=', startDate)
      .where('submissionDate', '<=', endDate);

    const snap = await q.get();
    let reports: NormalizedReport[] = snap.docs.map((d: any) => normalizeReport(d.id, d.data()));

    if (farmIds && farmIds.length > 0) {
      const farmSet = new Set(farmIds);
      reports = reports.filter((r: NormalizedReport) => farmSet.has(r.farmId));
    }

    return reports;
  } catch (err: any) {
    console.error('[reportDataService] collectionGroup(dailyLogs) query FAILED:', err.message || err);
    return [];
  }
}

async function fetchAllReportsMerged(
  startDate: string,
  endDate: string,
  farmIds?: string[],
): Promise<NormalizedReport[]> {
  const [oldReports, newReports] = await Promise.all([
    fetchOldFormatReports(startDate, endDate, farmIds),
    fetchNewFormatReports(startDate, endDate, farmIds),
  ]);
  return dedupeAndSort([...oldReports, ...newReports]);
}

function subscribeToCollectionGroup(
  startDate: string,
  endDate: string,
  callback: (reports: NormalizedReport[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const db = f.firestore();
  let q: any;
  try {
    q = db.collectionGroup('dailyLogs')
      .where('submissionDate', '>=', startDate)
      .where('submissionDate', '<=', endDate);
  } catch (err: any) {
    console.error('[reportDataService] Failed to create collectionGroup query:', err.message || err);
    callback([]);
    return () => {};
  }

  return q.onSnapshot(
    (snap: any) => {
      const reports = snap.docs.map((d: any) => normalizeReport(d.id, d.data()));
      callback(reports);
    },
    (err: Error) => {
      console.error('[reportDataService] collectionGroup onSnapshot ERROR:', err.message || err);
      callback([]);
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
  const allReports = new Map<string, NormalizedReport>();

  const emit = () => {
    callback(dedupeAndSort(Array.from(allReports.values())));
  };

  let oldQ: any;
  try {
    oldQ = db.collection('dailyReports')
      .where('submissionDate', '>=', startDate)
      .where('submissionDate', '<=', endDate);
  } catch (err) {
    oldQ = null;
  }

  const unsubOld = oldQ ? oldQ.onSnapshot(
    (snap: any) => {
      for (const docChange of snap.docChanges()) {
        const data = docChange.doc.data();
        if (data.userId || data.lastSubmissionDate) continue;
        const report = normalizeReport(docChange.doc.id, data);
        const key = `${report.farmId}_${report.submissionDate}`;
        if (docChange.type === 'removed') {
          allReports.delete(key);
        } else {
          allReports.set(key, report);
        }
      }
      emit();
    },
    (err: Error) => {
      console.warn('[reportDataService] Old format snapshot error:', err.message || err);
    },
  ) : () => {};

  const unsubNew = subscribeToCollectionGroup(
    startDate,
    endDate,
    (newReports) => {
      for (const r of newReports) {
        const key = `${r.farmId}_${r.submissionDate}`;
        allReports.set(key, r);
      }
      emit();
    },
    onError,
  );

  return () => { unsubOld(); unsubNew(); };
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
  const farmSet = new Set(farmIds);
  const allReports = new Map<string, NormalizedReport>();

  const emit = () => {
    callback(dedupeAndSort(Array.from(allReports.values())));
  };

  const batchSize = 10;
  const unsubs: (() => void)[] = [];

  for (let i = 0; i < farmIds.length; i += batchSize) {
    const batch = farmIds.slice(i, i + batchSize);
    let q: any;
    try {
      q = db.collection('dailyReports')
        .where('farmId', 'in', batch)
        .where('submissionDate', '>=', startDate)
        .where('submissionDate', '<=', endDate);
    } catch (err) {
      continue;
    }

    const unsub = q.onSnapshot(
      (snap: any) => {
        for (const docChange of snap.docChanges()) {
          const data = docChange.doc.data();
          if (data.userId || data.lastSubmissionDate) continue;
          const report = normalizeReport(docChange.doc.id, data);
          const key = `${report.farmId}_${report.submissionDate}`;
          if (docChange.type === 'removed') {
            allReports.delete(key);
          } else {
            allReports.set(key, report);
          }
        }
        emit();
      },
      (err: Error) => {
        console.warn('[reportDataService] Old format batch error:', err.message || err);
      },
    );
    unsubs.push(unsub);
  }

  const unsubNew = subscribeToCollectionGroup(
    startDate,
    endDate,
    (newReports) => {
      for (const r of newReports) {
        if (!farmSet.has(r.farmId)) continue;
        const key = `${r.farmId}_${r.submissionDate}`;
        allReports.set(key, r);
      }
      emit();
    },
    onError,
  );

  unsubs.push(unsubNew);

  return () => { unsubs.forEach((u) => u()); };
}

export function subscribeToDailyReportsByFarm(
  farmId: string,
  startDate: string,
  endDate: string,
  callback: (reports: NormalizedReport[]) => void,
  onError?: (error: Error) => void,
): () => void {
  return subscribeToDailyReportsByFarms([farmId], startDate, endDate, callback, onError);
}

export function subscribeToDailyReportsByDate(
  submissionDate: string,
  callback: (reports: NormalizedReport[]) => void,
  onError?: (error: Error) => void,
): () => void {
  return subscribeToAllDailyReports(submissionDate, submissionDate, callback, onError);
}

export async function getReportsByFarm(
  farmId: string,
  startDate: string,
  endDate: string,
): Promise<NormalizedReport[]> {
  return fetchAllReportsMerged(startDate, endDate, [farmId]);
}

export async function getReportsByFarms(
  farmIds: string[],
  startDate: string,
  endDate: string,
): Promise<NormalizedReport[]> {
  return fetchAllReportsMerged(startDate, endDate, farmIds);
}

export async function getAllReports(
  startDate: string,
  endDate: string,
): Promise<NormalizedReport[]> {
  return fetchAllReportsMerged(startDate, endDate);
}

export async function getReportsByDate(submissionDate: string): Promise<NormalizedReport[]> {
  return fetchAllReportsMerged(submissionDate, submissionDate);
}
