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

function isParentDoc(data: Record<string, unknown>): boolean {
  return !!(data.userId && data.lastSubmissionDate && !data.submissionDate);
}

async function fetchOldFormatReports(
  startDate: string,
  endDate: string,
  farmIds?: string[],
): Promise<NormalizedReport[]> {
  const db = f.firestore();
  try {
    const q = db.collection('dailyReports')
      .where('submissionDate', '>=', startDate)
      .where('submissionDate', '<=', endDate);

    const snap = await q.get();
    let reports = snap.docs
      .map((d: any) => {
        const data = d.data();
        if (isParentDoc(data)) return null;
        if (data.submissionDate) return normalizeReport(d.id, data);
        return null;
      })
      .filter((r: NormalizedReport | null): r is NormalizedReport => r !== null);

    if (farmIds && farmIds.length > 0) {
      const farmSet = new Set(farmIds);
      reports = reports.filter((r: NormalizedReport) => farmSet.has(r.farmId));
    }

    return reports;
  } catch (err: any) {
    console.warn('[reportDataService] Old format query failed:', err.message || err);
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
      reports = reports.filter((r) => farmSet.has(r.farmId));
    }

    return reports;
  } catch (err: any) {
    console.error('[reportDataService] collectionGroup(dailyLogs) query FAILED:', err.message || err);
    if (err.message?.includes('index')) {
      console.error('[reportDataService] HINT: Create a Firestore index for dailyLogs collection group on submissionDate field.');
    }
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
    onError?.(new Error(`collectionGroup query creation failed: ${err.message}`));
    callback([]);
    return () => {};
  }

  return q.onSnapshot(
    (snap: any) => {
      const reports = snap.docs.map((d: any) => normalizeReport(d.id, d.data()));
      console.log(`[reportDataService] collectionGroup dailyLogs returned ${reports.length} reports`);
      callback(reports);
    },
    (err: any) => {
      console.error('[reportDataService] collectionGroup onSnapshot ERROR:', err.message || err);
      if (err.message?.includes('index')) {
        console.error('[reportDataService] HINT: Create a Firestore composite index for dailyLogs collection group.');
        console.error('[reportDataService] Go to Firebase Console > Firestore > Indexes > Add Index');
        console.error('[reportDataService] Collection: dailyLogs, Fields: submissionDate ASC');
      }
      onError?.(new Error(`collectionGroup query failed: ${err.message}`));
      callback([]);
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
  let oldQFailed = false;
  let newQFailed = false;

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
        if (isParentDoc(data)) continue;
        if (!data.submissionDate) continue;
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
    (err: any) => {
      console.warn('[reportDataService] Old format snapshot error:', err.message || err);
      oldQFailed = true;
      if (oldQFailed && newQFailed && allReports.size === 0) {
        onError?.(new Error('All report queries failed. Check console for details.'));
      }
    },
  ) : () => { oldQFailed = true; };

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
    (err) => {
      newQFailed = true;
      if (oldQFailed && allReports.size === 0) {
        onError?.(err);
      }
    },
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
  let oldQFailed = false;
  let newQFailed = false;

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
          if (isParentDoc(data)) continue;
          if (!data.submissionDate) continue;
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
      (err: any) => {
        console.warn('[reportDataService] Old format batch error:', err.message || err);
        oldQFailed = true;
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
    (err) => {
      newQFailed = true;
      if (oldQFailed && allReports.size === 0) {
        onError?.(err);
      }
    },
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
