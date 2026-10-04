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

  import('./notificationService').then(mod => {
    mod.evaluateFeedStockNotification(farmId, farmId, newFeedStockKg);
  });
}

export interface FeedLogDoc {
  logId: string;
  farmId: string;
  quantityKg: number;
  previousStockKg?: number;
  newStockKg?: number;
  loadedAt: string;
  recordedBy: string;
  notes?: string;
  type: 'FEED_LOAD';
  isHistorical?: boolean;
  importBatchId?: string;
}

export function normalizeFeedLogDoc(docId: string, data: any): FeedLogDoc {
  let loadedAtStr = '';
  const rawDate = data?.loadedAt || data?.createdAt || data?.reportDate || data?.date;
  if (typeof rawDate === 'string') {
    loadedAtStr = rawDate;
  } else if (rawDate && typeof rawDate.toDate === 'function') {
    try {
      loadedAtStr = rawDate.toDate().toISOString();
    } catch {
      loadedAtStr = '';
    }
  } else if (rawDate && typeof rawDate._seconds === 'number') {
    loadedAtStr = new Date(rawDate._seconds * 1000).toISOString();
  } else if (rawDate && typeof rawDate.seconds === 'number') {
    loadedAtStr = new Date(rawDate.seconds * 1000).toISOString();
  }

  const prevStock = typeof data?.previousStockKg === 'number'
    ? data.previousStockKg
    : (data?.previousStockKg !== undefined ? Number(data.previousStockKg) : undefined);

  const newStock = typeof data?.newStockKg === 'number'
    ? data.newStockKg
    : (data?.newStockKg !== undefined ? Number(data.newStockKg) : undefined);

  return {
    logId: docId,
    farmId: String(data?.farmId || ''),
    quantityKg: Number(data?.quantityKg ?? data?.feedKg ?? 0),
    previousStockKg: prevStock,
    newStockKg: newStock,
    loadedAt: loadedAtStr,
    recordedBy: String(data?.recordedBy || data?.loadedBy || data?.userId || 'Admin'),
    notes: data?.notes || data?.remarks || '',
    type: 'FEED_LOAD',
    isHistorical: Boolean(data?.isHistorical),
    importBatchId: data?.importBatchId,
  };
}

export async function addFeedLoad(
  farmId: string,
  feedLoadKg: number,
  loadedBy: string,
  notes: string = '',
): Promise<void> {
  if (!farmId) {
    throw new Error('FARM_ID_REQUIRED');
  }
  if (isNaN(feedLoadKg) || feedLoadKg <= 0) {
    throw new Error('INVALID_FEED_QUANTITY');
  }

  const now = new Date().toISOString();
  const reportDate = getIstDate();

  const farmRef = db.collection('farms').doc(farmId);
  const feedLogRef = db.collection('logs').doc(farmId).collection('feedLogs').doc();
  const txRef = db.collection('farms').doc(farmId).collection('feedTransactions').doc();

  const finalStock = await db.runTransaction(async (transaction: any) => {
    const farmSnap = await transaction.get(farmRef);
    if (!farmSnap.exists) {
      throw new Error('FARM_NOT_FOUND');
    }
    const farmData = farmSnap.data();
    const currentStock = Number(farmData.currentFeedKg ?? farmData.initialFeedKg ?? 0);
    const totalLoaded = Number(farmData.totalFeedLoadedKg ?? farmData.initialFeedKg ?? 0);
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
    return newStockKg;
  });

  import('./notificationService').then(mod => {
    mod.evaluateFeedStockNotification(farmId, farmId, finalStock);
  });
}

export async function getFeedLogsByFarm(farmId: string): Promise<FeedLogDoc[]> {
  if (!farmId) return [];
  const snap = await db.collection('logs').doc(farmId).collection('feedLogs').get();
  return snap.docs
    .map((doc: any) => normalizeFeedLogDoc(doc.id, doc.data()))
    .sort((a: FeedLogDoc, b: FeedLogDoc) => (b.loadedAt || '').localeCompare(a.loadedAt || ''));
}

export function subscribeToFeedLogsByFarm(
  farmId: string,
  callback: (logs: FeedLogDoc[]) => void,
  onError?: (error: Error) => void,
): () => void {
  if (!farmId) {
    callback([]);
    return () => {};
  }
  return db.collection('logs').doc(farmId).collection('feedLogs').onSnapshot(
    (snap: any) => {
      const logs = snap.docs
        .map((doc: any) => normalizeFeedLogDoc(doc.id, doc.data()))
        .sort((a: FeedLogDoc, b: FeedLogDoc) => (b.loadedAt || '').localeCompare(a.loadedAt || ''));
      callback(logs);
    },
    (err: any) => {
      console.error('[inventoryService] subscribeToFeedLogsByFarm error:', err.message || err);
      if (onError) {
        onError(err);
      } else {
        callback([]);
      }
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

