import { db } from '../config/firebase';

export interface BirdInventory {
  initialBirdCount: number;
  currentBirdCount: number;
  lastUpdated: string;
  lastReportDate: string;
}

export interface FeedInventory {
  currentFeedStockKg: number;
  totalFeedLoadedKg: number;
  lastUpdated: string;
  lastTransactionDate: string;
}

export interface BirdTransaction {
  farmId: string;
  type: 'MORTALITY' | 'CULLING' | 'ADDITION' | 'INITIAL';
  count: number;
  reportDate: string;
  createdAt: string;
  notes?: string;
}

export interface FeedTransaction {
  farmId: string;
  type: 'FEED_LOAD' | 'FEED_USAGE';
  feedKg: number;
  reportDate: string;
  createdAt: string;
  notes?: string;
}

export async function getBirdInventory(farmId: string): Promise<BirdInventory | null> {
  const snap = await db.collection('farms').doc(farmId).get();
  if (!snap.exists) return null;
  const data = snap.data();
  if (data.currentBirdCount === undefined && data.initialBirdCount === undefined) return null;
  return {
    initialBirdCount: Number(data.initialBirdCount ?? 0),
    currentBirdCount: Number(data.currentBirdCount ?? 0),
    lastUpdated: String(data.inventoryUpdatedAt ?? data.updatedAt ?? ''),
    lastReportDate: String(data.lastReportDate ?? ''),
  };
}

export async function getFeedInventory(farmId: string): Promise<FeedInventory | null> {
  const snap = await db.collection('farms').doc(farmId).get();
  if (!snap.exists) return null;
  const data = snap.data();
  if (data.currentFeedKg === undefined && data.initialFeedKg === undefined) return null;
  return {
    currentFeedStockKg: Number(data.currentFeedKg ?? 0),
    totalFeedLoadedKg: Number(data.totalFeedLoadedKg ?? 0),
    lastUpdated: String(data.inventoryUpdatedAt ?? data.updatedAt ?? ''),
    lastTransactionDate: String(data.lastTransactionDate ?? ''),
  };
}

export async function initializeFarmInventory(
  farmId: string,
  initialBirdCount: number,
  initialFeedKg: number
): Promise<void> {
  const now = new Date().toISOString();
  await db.collection('farms').doc(farmId).set({
    initialBirdCount,
    currentBirdCount: initialBirdCount,
    initialFeedKg,
    currentFeedKg: initialFeedKg,
    totalFeedLoadedKg: initialFeedKg,
    totalFeedConsumedKg: 0,
    inventoryInitialized: true,
    inventoryInitializedAt: now,
    inventoryUpdatedAt: now,
    updatedAt: now,
  }, { merge: true });
}

export async function updateBirdInventory(
  farmId: string,
  newCurrentBirdCount: number,
  reportDate: string,
): Promise<void> {
  const now = new Date().toISOString();
  await db.collection('farms').doc(farmId).set({
    currentBirdCount: newCurrentBirdCount,
    lastReportDate: reportDate,
    inventoryUpdatedAt: now,
    updatedAt: now,
  }, { merge: true });
}

export async function updateFeedInventory(
  farmId: string,
  newFeedStockKg: number,
  reportDate: string,
): Promise<void> {
  const now = new Date().toISOString();
  await db.collection('farms').doc(farmId).set({
    currentFeedKg: newFeedStockKg,
    lastTransactionDate: reportDate,
    inventoryUpdatedAt: now,
    updatedAt: now,
  }, { merge: true });
}

export interface FeedLogDoc {
  logId: string;
  farmId: string;
  quantityKg: number;
  previousStockKg: number;
  newStockKg: number;
  loadedAt: string;
  recordedBy: string;
  notes?: string;
  type: 'FEED_LOAD';
}

export async function addFeedLoad(
  farmId: string,
  feedLoadKg: number,
  loadedBy: string,
  notes: string = '',
): Promise<void> {
  const now = new Date().toISOString();
  const reportDate = getIstDate();

  const farmRef = db.collection('farms').doc(farmId);
  const feedLogRef = db.collection('logs').doc(farmId).collection('feedLogs').doc();
  const txRef = db.collection('farms').doc(farmId).collection('feedTransactions').doc();

  await db.runTransaction(async (transaction: any) => {
    const farmSnap = await transaction.get(farmRef);
    if (!farmSnap.exists) {
      throw new Error('FARM_NOT_FOUND');
    }
    const farmData = farmSnap.data();
    const currentStock = Number(farmData.currentFeedKg ?? 0);
    const totalLoaded = Number(farmData.totalFeedLoadedKg ?? 0);
    const newStockKg = currentStock + feedLoadKg;
    const newTotalLoadedKg = totalLoaded + feedLoadKg;

    // 1. Update master farm document
    transaction.set(farmRef, {
      currentFeedKg: newStockKg,
      totalFeedLoadedKg: newTotalLoadedKg,
      inventoryUpdatedAt: now,
      lastTransactionDate: reportDate,
      updatedAt: now,
    }, { merge: true });

    // 2. Write to farm-wise feed log: logs/{farmId}/feedLogs/{feedLogId}
    transaction.set(feedLogRef, {
      logId: feedLogRef.id,
      farmId,
      quantityKg: feedLoadKg,
      previousStockKg: currentStock,
      newStockKg,
      loadedAt: now,
      recordedBy: loadedBy,
      notes: notes || '',
      type: 'FEED_LOAD',
    });

    // 3. Keep legacy feedTransaction for backward compatibility
    transaction.set(txRef, {
      farmId,
      type: 'FEED_LOAD',
      feedKg: feedLoadKg,
      reportDate,
      createdAt: now,
      loadedBy,
      notes: notes || '',
    });
  });
}

export async function getFeedLogsByFarm(farmId: string): Promise<FeedLogDoc[]> {
  if (!farmId) return [];
  const snap = await db.collection('logs').doc(farmId).collection('feedLogs').get();
  return snap.docs
    .map((doc: any) => ({ logId: doc.id, ...doc.data() } as FeedLogDoc))
    .sort((a: FeedLogDoc, b: FeedLogDoc) => (b.loadedAt || '').localeCompare(a.loadedAt || ''));
}

export function subscribeToFeedLogsByFarm(
  farmId: string,
  callback: (logs: FeedLogDoc[]) => void,
): () => void {
  if (!farmId) {
    callback([]);
    return () => {};
  }
  return db.collection('logs').doc(farmId).collection('feedLogs').onSnapshot(
    (snap: any) => {
      const logs = snap.docs
        .map((doc: any) => ({ logId: doc.id, ...doc.data() } as FeedLogDoc))
        .sort((a: FeedLogDoc, b: FeedLogDoc) => (b.loadedAt || '').localeCompare(a.loadedAt || ''));
      callback(logs);
    },
    (err: any) => {
      console.error('[inventoryService] subscribeToFeedLogsByFarm error:', err.message || err);
      callback([]);
    },
  );
}

function getIstDate(): string {
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

export function subscribeToAllBirdInventories(
  farmIds: string[],
  callback: (inventories: Map<string, BirdInventory>) => void,
): () => void {
  const unsubscribes: (() => void)[] = [];
  const results = new Map<string, BirdInventory>();

  if (farmIds.length === 0) {
    callback(results);
    return () => {};
  }

  for (const farmId of farmIds) {
    const unsub = db.collection('farms').doc(farmId).onSnapshot((snap: any) => {
      if (snap.exists) {
        const data = snap.data();
        if (data.currentBirdCount !== undefined || data.initialBirdCount !== undefined) {
          results.set(farmId, {
            initialBirdCount: Number(data.initialBirdCount ?? 0),
            currentBirdCount: Number(data.currentBirdCount ?? 0),
            lastUpdated: String(data.inventoryUpdatedAt ?? data.updatedAt ?? ''),
            lastReportDate: String(data.lastReportDate ?? ''),
          });
        }
      }
      // Emit on EVERY snapshot change so dashboard updates in real-time
      callback(new Map(results));
    });
    unsubscribes.push(unsub);
  }

  return () => {
    unsubscribes.forEach((unsub) => unsub());
  };
}
