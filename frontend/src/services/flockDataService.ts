import { db } from '../config/firebase';

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
  batchNumber?: number;
  isInitialFlock?: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FlockLogDoc {
  logId: string;
  farmId: string;
  flockId: string;
  flockName: string;
  initialBirds: number;
  currentBirds: number;
  startDate: string;
  breedType: string;
  status: string;
  batchNumber?: number;
  isInitialFlock?: boolean;
  notes?: string;
  createdAt: string;
  type?: 'FLOCK_CREATION';
}

export async function getFlockById(flockId: string): Promise<FlockDoc | null> {
  const doc = await db.collection('flocks').doc(flockId).get();
  if (!doc.exists) return null;
  return { flockId: doc.id, ...doc.data() } as FlockDoc;
}

export async function getFlocksByFarmId(farmId: string): Promise<FlockDoc[]> {
  const snap = await db.collection('flocks')
    .where('farmId', '==', farmId)
    .get();
  return snap.docs
    .map((doc: any) => ({ flockId: doc.id, ...doc.data() } as FlockDoc))
    .sort((a: FlockDoc, b: FlockDoc) => (a.createdAt || '').localeCompare(b.createdAt || ''));
}

export function subscribeToFlocksByFarm(
  farmId: string,
  callback: (flocks: FlockDoc[]) => void,
): () => void {
  return db.collection('flocks')
    .where('farmId', '==', farmId)
    .onSnapshot(
      (snap: any) => {
        const flocks = snap.docs
          .map((doc: any) => ({
            flockId: doc.id,
            ...doc.data(),
          } as FlockDoc))
          .sort((a: FlockDoc, b: FlockDoc) => (a.createdAt || '').localeCompare(b.createdAt || ''));
        callback(flocks);
      },
      (err: any) => {
        console.error('[flockDataService] subscribeToFlocksByFarm error:', err.message || err);
      },
    );
}

export function subscribeToAllFlocks(callback: (flocks: FlockDoc[]) => void): () => void {
  return db.collection('flocks').onSnapshot(
    (snap: any) => {
      const flocks = snap.docs
        .map((doc: any) => ({
          flockId: doc.id,
          ...doc.data(),
        } as FlockDoc))
        .sort((a: FlockDoc, b: FlockDoc) => (a.createdAt || '').localeCompare(b.createdAt || ''));
      callback(flocks);
    },
    (err: any) => {
      console.error('[flockDataService] subscribeToAllFlocks error:', err.message || err);
    },
  );
}

export async function createFlock(data: {
  farmId: string;
  flockName?: string;
  initialBirds: number;
  startDate: string;
  breedType?: string;
  productionCurve?: 'CF_STD' | 'FR_STD';
  notes?: string;
}): Promise<string> {
  const now = new Date().toISOString();
  const startMs = new Date(data.startDate + 'T00:00:00+05:30').getTime();
  const nowMs = Date.now();
  const ageWeeks = Math.max(0, Math.floor((nowMs - startMs) / (7 * 24 * 3600 * 1000)));

  // Query existing flocks for this farm to determine per-farm sequence
  const existingFlocksSnap = await db.collection('flocks')
    .where('farmId', '==', data.farmId)
    .get();

  const farmFlockCount = existingFlocksSnap.size;
  const batchNumber = farmFlockCount + 1;
  const isInitialFlock = farmFlockCount === 0;

  const resolvedFlockName = data.flockName?.trim()
    ? data.flockName.trim()
    : isInitialFlock
      ? 'Flock 1'
      : `Flock ${batchNumber}`;

  const flockRef = db.collection('flocks').doc();
  const farmRef = db.collection('farms').doc(data.farmId);
  const birdTxRef = farmRef.collection('birdTransactions').doc();

  // Atomically persist new flock doc, update master farm inventory, and log bird transaction
  await db.runTransaction(async (transaction: any) => {
    const farmSnap = await transaction.get(farmRef);
    const farmData = farmSnap.exists ? farmSnap.data() : null;

    const farmDocInitialBirds = Number(farmData?.initialBirdCount ?? farmData?.totalBirds ?? 0);
    const farmDocCurrentBirds = Number(farmData?.currentBirdCount ?? farmData?.currentBirds ?? farmDocInitialBirds);

    let flockInitialBirds: number;
    let flockCurrentBirds: number;
    let newFarmCurrentBirds: number;
    let newFarmInitialBirds: number;

    if (isInitialFlock) {
      // THE EXACT BUSINESS RULE:
      // When establishing the initial flock for an existing farm, initialBirds MUST come directly
      // from the farm document's initialBirdCount (e.g. 2000), NOT currentBirdCount (e.g. 1986).
      flockInitialBirds = farmDocInitialBirds > 0
        ? farmDocInitialBirds
        : (data.initialBirds && data.initialBirds > 0 ? data.initialBirds : farmDocCurrentBirds);

      // Current birds of the flock corresponds to current remaining count (e.g. 1986)
      flockCurrentBirds = farmDocCurrentBirds > 0 ? farmDocCurrentBirds : flockInitialBirds;

      // Initial flock creation MUST NOT modify, double, or recalculate farms/{farmId}.currentBirdCount
      // currentBirdCount remains e.g. 1986
      newFarmCurrentBirds = farmDocCurrentBirds > 0 ? farmDocCurrentBirds : flockInitialBirds;
      newFarmInitialBirds = farmDocInitialBirds > 0 ? farmDocInitialBirds : flockInitialBirds;
    } else {
      // Subsequent new bird batch arrival (e.g. Flock 2 with 300 birds):
      const batchBirds = Number(data.initialBirds ?? 0);
      if (batchBirds <= 0) {
        throw new Error('Please enter a valid bird count for the new flock batch.');
      }
      flockInitialBirds = batchBirds;
      flockCurrentBirds = batchBirds;

      // Adds new birds to existing farm current bird population (e.g. 1986 + 300 = 2286)
      newFarmCurrentBirds = farmDocCurrentBirds + batchBirds;
      newFarmInitialBirds = farmDocInitialBirds > 0 ? farmDocInitialBirds : farmDocCurrentBirds;
    }

    const initialMortality = Math.max(0, flockInitialBirds - flockCurrentBirds);

    // 1. Create Flock doc
    transaction.set(flockRef, {
      flockId: flockRef.id,
      farmId: data.farmId,
      flockName: resolvedFlockName,
      initialBirds: flockInitialBirds,
      currentBirds: flockCurrentBirds,
      totalMortality: initialMortality,
      totalCulling: 0,
      totalEggs: 0,
      startDate: data.startDate,
      currentAgeWeeks: ageWeeks,
      breedType: data.breedType || 'BV-300',
      productionCurve: data.productionCurve || 'CF_STD',
      status: 'active',
      batchNumber,
      isInitialFlock,
      notes: data.notes || '',
      createdAt: now,
      updatedAt: now,
    });

    // 2. Update Master Farm Inventory
    transaction.set(farmRef, {
      currentBirdCount: newFarmCurrentBirds,
      initialBirdCount: newFarmInitialBirds,
      inventoryInitialized: true,
      inventoryInitializedAt: farmData?.inventoryInitializedAt || now,
      inventoryUpdatedAt: now,
      updatedAt: now,
    }, { merge: true });

    // 3. Record Bird Transaction Audit
    transaction.set(birdTxRef, {
      farmId: data.farmId,
      flockId: flockRef.id,
      type: isInitialFlock ? 'INITIAL' : 'ADDITION',
      count: flockInitialBirds,
      reportDate: data.startDate,
      createdAt: now,
      notes: data.notes || (isInitialFlock ? 'Initial flock creation from farm inventory' : `Flock batch ${batchNumber} addition`),
    });

    // 4. Record Farm-wise Flock Log: logs/{farmId}/flockLogs/{flockLogId}
    const flockLogRef = db.collection('logs').doc(data.farmId).collection('flockLogs').doc(flockRef.id);
    transaction.set(flockLogRef, {
      logId: flockRef.id,
      farmId: data.farmId,
      flockId: flockRef.id,
      flockName: resolvedFlockName,
      initialBirds: flockInitialBirds,
      currentBirds: flockCurrentBirds,
      startDate: data.startDate,
      breedType: data.breedType || 'BV-300',
      status: 'active',
      batchNumber,
      isInitialFlock,
      createdAt: now,
      notes: data.notes || '',
      type: 'FLOCK_CREATION',
    });
  });

  return flockRef.id;
}

export async function getFlockLogsByFarm(farmId: string): Promise<FlockLogDoc[]> {
  if (!farmId) return [];
  const snap = await db.collection('logs').doc(farmId).collection('flockLogs').get();
  return snap.docs
    .map((doc: any) => ({ logId: doc.id, ...doc.data() } as FlockLogDoc))
    .sort((a: FlockLogDoc, b: FlockLogDoc) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

export function subscribeToFlockLogsByFarm(
  farmId: string,
  callback: (logs: FlockLogDoc[]) => void,
): () => void {
  if (!farmId) {
    callback([]);
    return () => {};
  }
  return db.collection('logs').doc(farmId).collection('flockLogs').onSnapshot(
    (snap: any) => {
      const logs = snap.docs
        .map((doc: any) => ({ logId: doc.id, ...doc.data() } as FlockLogDoc))
        .sort((a: FlockLogDoc, b: FlockLogDoc) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      callback(logs);
    },
    (err: any) => {
      console.error('[flockDataService] subscribeToFlockLogsByFarm error:', err.message || err);
      callback([]);
    },
  );
}

export async function syncExistingFlocksToLogs(): Promise<void> {
  const flocksSnap = await db.collection('flocks').get();
  for (const doc of flocksSnap.docs) {
    const flock = doc.data();
    if (flock.farmId) {
      const logRef = db.collection('logs').doc(flock.farmId).collection('flockLogs').doc(doc.id);
      const logSnap = await logRef.get();
      if (!logSnap.exists) {
        await logRef.set({
          logId: doc.id,
          farmId: flock.farmId,
          flockId: doc.id,
          flockName: flock.flockName || 'Flock 1',
          initialBirds: flock.initialBirds || 0,
          currentBirds: flock.currentBirds || 0,
          startDate: flock.startDate || '',
          breedType: flock.breedType || 'BV-300',
          status: flock.status || 'active',
          batchNumber: flock.batchNumber || 1,
          isInitialFlock: !!flock.isInitialFlock,
          createdAt: flock.createdAt || new Date().toISOString(),
          notes: flock.notes || '',
          type: 'FLOCK_CREATION',
        });
      }
    }
  }
}

export async function updateFlock(flockId: string, updates: Partial<FlockDoc>): Promise<void> {
  const now = new Date().toISOString();
  await db.collection('flocks').doc(flockId).update({
    ...updates,
    updatedAt: now,
  });
}

export function calculateFlockAgeWeeks(startDate: string): number {
  if (!startDate) return 0;
  const startMs = new Date(startDate + 'T00:00:00+05:30').getTime();
  if (isNaN(startMs)) return 0;
  const nowMs = Date.now();
  return Math.max(0, Math.floor((nowMs - startMs) / (7 * 24 * 3600 * 1000)));
}
