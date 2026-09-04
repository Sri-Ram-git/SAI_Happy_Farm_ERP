const f = (window as any).firebase;

export interface FlockDoc {
  flockId: string;
  farmId: string;
  flockName: string;
  initialBirds: number;
  currentBirds: number;
  totalMortality: number;
  totalCulling: number;
  totalEggs: number;
  startDate: string;
  currentAgeWeeks: number;
  breedType: string;
  productionCurve: 'CF_STD' | 'FR_STD';
  status: 'active' | 'completed';
  createdAt: string;
  updatedAt: string;
}

export async function getFlockById(flockId: string): Promise<FlockDoc | null> {
  const db = f.firestore();
  const doc = await db.collection('flocks').doc(flockId).get();
  if (!doc.exists) return null;
  return { flockId: doc.id, ...doc.data() } as FlockDoc;
}

export async function getFlocksByFarmId(farmId: string): Promise<FlockDoc[]> {
  const db = f.firestore();
  const snap = await db.collection('flocks')
    .where('farmId', '==', farmId)
    .where('status', '==', 'active')
    .get();
  return snap.docs.map((doc: any) => ({ flockId: doc.id, ...doc.data() } as FlockDoc));
}

export function subscribeToFlocksByFarm(
  farmId: string,
  callback: (flocks: FlockDoc[]) => void,
): () => void {
  const db = f.firestore();
  return db.collection('flocks')
    .where('farmId', '==', farmId)
    .where('status', '==', 'active')
    .onSnapshot(
      (snap: any) => {
        const flocks = snap.docs.map((doc: any) => ({
          flockId: doc.id,
          ...doc.data(),
        } as FlockDoc));
        callback(flocks);
      },
      (err: any) => {
        console.error('[flockDataService] subscribeToFlocksByFarm error:', err.message || err);
      },
    );
}

export function subscribeToAllFlocks(callback: (flocks: FlockDoc[]) => void): () => void {
  const db = f.firestore();
  return db.collection('flocks').onSnapshot(
    (snap: any) => {
      const flocks = snap.docs.map((doc: any) => ({
        flockId: doc.id,
        ...doc.data(),
      } as FlockDoc));
      callback(flocks);
    },
    (err: any) => {
      console.error('[flockDataService] subscribeToAllFlocks error:', err.message || err);
    },
  );
}

export async function createFlock(data: {
  farmId: string;
  flockName: string;
  initialBirds: number;
  startDate: string;
  breedType: string;
  productionCurve: 'CF_STD' | 'FR_STD';
}): Promise<string> {
  const db = f.firestore();
  const now = new Date().toISOString();
  const startMs = new Date(data.startDate + 'T00:00:00+05:30').getTime();
  const nowMs = Date.now();
  const ageWeeks = Math.max(0, Math.floor((nowMs - startMs) / (7 * 24 * 3600 * 1000)));

  const ref = await db.collection('flocks').add({
    farmId: data.farmId,
    flockName: data.flockName,
    initialBirds: data.initialBirds,
    currentBirds: data.initialBirds,
    totalMortality: 0,
    totalCulling: 0,
    totalEggs: 0,
    startDate: data.startDate,
    currentAgeWeeks: ageWeeks,
    breedType: data.breedType,
    productionCurve: data.productionCurve,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

export async function updateFlock(flockId: string, updates: Partial<FlockDoc>): Promise<void> {
  const db = f.firestore();
  const now = new Date().toISOString();
  await db.collection('flocks').doc(flockId).update({
    ...updates,
    updatedAt: now,
  });
}

export function calculateFlockAgeWeeks(startDate: string): number {
  const startMs = new Date(startDate + 'T00:00:00+05:30').getTime();
  const nowMs = Date.now();
  return Math.max(0, Math.floor((nowMs - startMs) / (7 * 24 * 3600 * 1000)));
}
