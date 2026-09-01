const f = (window as any).firebase;

export interface ReportDoc {
  reportId: string;
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
  submissionDate: string;
  submissionMethod: string;
  createdAt: string;
}

export async function getReportsByFarm(farmId: string, startDate: string, endDate: string): Promise<ReportDoc[]> {
  const db = f.firestore();
  const snap = await db.collection('dailyReports')
    .where('farmId', '==', farmId)
    .where('submissionDate', '>=', startDate)
    .where('submissionDate', '<=', endDate)
    .orderBy('submissionDate', 'asc')
    .get();
  return snap.docs.map((d: any) => d.data() as ReportDoc);
}

export async function getReportsByFarms(farmIds: string[], startDate: string, endDate: string): Promise<ReportDoc[]> {
  if (farmIds.length === 0) return [];
  const db = f.firestore();
  const results: ReportDoc[] = [];
  const batchSize = 10;
  for (let i = 0; i < farmIds.length; i += batchSize) {
    const batch = farmIds.slice(i, i + batchSize);
    const snap = await db.collection('dailyReports')
      .where('farmId', 'in', batch)
      .where('submissionDate', '>=', startDate)
      .where('submissionDate', '<=', endDate)
      .orderBy('submissionDate', 'asc')
      .get();
    for (const doc of snap.docs) {
      results.push(doc.data() as ReportDoc);
    }
  }
  return results;
}

export async function getReportsByDate(submissionDate: string): Promise<ReportDoc[]> {
  const db = f.firestore();
  const snap = await db.collection('dailyReports')
    .where('submissionDate', '==', submissionDate)
    .get();
  return snap.docs.map((d: any) => d.data() as ReportDoc);
}

export async function getAllReports(startDate: string, endDate: string): Promise<ReportDoc[]> {
  const db = f.firestore();
  const snap = await db.collection('dailyReports')
    .where('submissionDate', '>=', startDate)
    .where('submissionDate', '<=', endDate)
    .orderBy('submissionDate', 'asc')
    .get();
  return snap.docs.map((d: any) => d.data() as ReportDoc);
}
