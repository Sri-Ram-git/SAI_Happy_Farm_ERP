import { normalizeReport, type NormalizedReport } from '../utils/normalizeDailyReport';

const f = (window as any).firebase;

export type ReportDoc = NormalizedReport;

function dedupeAndSort(reports: NormalizedReport[]): NormalizedReport[] {
  const seen = new Map<string, NormalizedReport>();
  for (const r of reports) {
    if (!r.submissionDate) continue; // Keep even if farmId is missing, we'll resolve it dynamically
    const key = `${r.userId}_${r.submissionDate}_${r.flockId || 'noflock'}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, r);
    } else {
      // Prioritize Version 2 (or higher) / latest canonical report
      if (
        (r.submissionVersion || 1) > (existing.submissionVersion || 1) ||
        ((r.submissionVersion || 1) === (existing.submissionVersion || 1) && r.createdAt > existing.createdAt)
      ) {
        seen.set(key, r);
      }
    }
  }
  return Array.from(seen.values()).sort((a, b) => a.submissionDate.localeCompare(b.submissionDate));
}

function isParentDoc(data: Record<string, unknown>): boolean {
  return !!(data.userId && data.lastSubmissionDate && !data.submissionDate);
}

async function fetchNewFormatReports(
  startDate: string,
  endDate: string,
  farmIds?: string[],
): Promise<NormalizedReport[]> {
  const db = f.firestore();
  try {
    const snap = await db.collectionGroup('dailyLogs').get();
    let reports: NormalizedReport[] = [];
    snap.docs.forEach((d: any) => {
      const pathStr = d.ref.path || '';
      const parts = pathStr.split('/');
      let userIdOverride: string | undefined;
      if (parts.length >= 4 && parts[parts.length - 3] === 'dailyReports') {
        userIdOverride = parts[parts.length - 2];
      }
      
      const r = normalizeReport(d.id, d.data(), userIdOverride, pathStr);
      if (r.submissionDate && r.submissionDate >= startDate && r.submissionDate <= endDate) {
        console.log(`[Daily Report Loaded] Path: ${pathStr}`);
        reports.push(r);
      }
    });

    if (farmIds && farmIds.length > 0) {
      const farmSet = new Set(farmIds);
      reports = reports.filter((r) => farmSet.has(r.farmId));
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
  const newReports = await fetchNewFormatReports(startDate, endDate, farmIds);
  return dedupeAndSort(newReports);
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
    const filtered = Array.from(allReports.values()).filter(
      (r) => r.submissionDate >= startDate && r.submissionDate <= endDate
    );
    callback(dedupeAndSort(filtered));
  };

  // Single collectionGroup listener covers ALL dailyLogs across all users.
  // Using doc.ref.path as the Map key guarantees uniqueness across users
  // (path = "dailyReports/{userId}/dailyLogs/{date}_{flockId}").
  try {
    const unsub = db.collectionGroup('dailyLogs').onSnapshot(
      (snap: any) => {
        for (const docChange of snap.docChanges()) {
          const data = docChange.doc.data();
          if (isParentDoc(data)) continue;
          
          const pathStr = docChange.doc.ref.path || '';
          const parts = pathStr.split('/');
          let userIdOverride: string | undefined;
          if (parts.length >= 4 && parts[parts.length - 3] === 'dailyReports') {
            userIdOverride = parts[parts.length - 2];
          }

          const report = normalizeReport(docChange.doc.id, data, userIdOverride, pathStr);
          if (!report.submissionDate) continue;

          console.log(`[Daily Report Loaded] Path: ${pathStr}`);

          // Use full document path as key to avoid cross-user collisions.
          const key = pathStr;
          if (docChange.type === 'removed') {
            allReports.delete(key);
          } else {
            allReports.set(key, report);
          }
        }
        console.log(`[reportDataService] collectionGroup snapshot received: ${allReports.size} documents tracked`);
        emit();
      },
      (err: any) => {
        console.error('[reportDataService] collectionGroup(dailyLogs) listener error:', err.message || err);
        if (err.message && err.message.includes('index')) {
          console.error('[reportDataService] This error likely means a Firestore collection group index is required. Check the Firebase Console → Firestore → Indexes.');
        }
        onError?.(err);
      }
    );

    return () => {
      unsub();
    };
  } catch (err: any) {
    console.error('[reportDataService] collectionGroup listener creation error:', err);
    onError?.(err instanceof Error ? err : new Error(String(err)));
    return () => {};
  }
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

  const farmSet = new Set(farmIds);
  return subscribeToAllDailyReports(
    startDate,
    endDate,
    (all) => {
      const filtered = all.filter((r) => farmSet.has(r.farmId));
      callback(filtered);
    },
    onError
  );
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
