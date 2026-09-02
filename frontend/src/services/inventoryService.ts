const f = (window as any).firebase;

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
  const db = f.firestore();
  const snap = await db.collection('farms').doc(farmId).collection('inventory').doc('birds').get();
  if (!snap.exists) return null;
  const data = snap.data();
  return {
    initialBirdCount: Number(data.initialBirdCount ?? 0),
    currentBirdCount: Number(data.currentBirdCount ?? 0),
    lastUpdated: String(data.lastUpdated ?? ''),
    lastReportDate: String(data.lastReportDate ?? ''),
  };
}

export async function getFeedInventory(farmId: string): Promise<FeedInventory | null> {
  const db = f.firestore();
  const snap = await db.collection('farms').doc(farmId).collection('inventory').doc('feed').get();
  if (!snap.exists) return null;
  const data = snap.data();
  return {
    currentFeedStockKg: Number(data.currentFeedStockKg ?? 0),
    totalFeedLoadedKg: Number(data.totalFeedLoadedKg ?? 0),
    lastUpdated: String(data.lastUpdated ?? ''),
    lastTransactionDate: String(data.lastTransactionDate ?? ''),
  };
}

export async function initBirdInventory(farmId: string, initialCount: number): Promise<void> {
  const db = f.firestore();
  const now = new Date().toISOString();
  await db.collection('farms').doc(farmId).collection('inventory').doc('birds').set({
    initialBirdCount: initialCount,
    currentBirdCount: initialCount,
    lastUpdated: now,
    lastReportDate: '',
  }, { merge: true });
}

export async function initFeedInventory(farmId: string, initialStockKg: number): Promise<void> {
  const db = f.firestore();
  const now = new Date().toISOString();
  await db.collection('farms').doc(farmId).collection('inventory').doc('feed').set({
    currentFeedStockKg: initialStockKg,
    totalFeedLoadedKg: initialStockKg,
    lastUpdated: now,
    lastTransactionDate: '',
  }, { merge: true });
}

export async function updateBirdInventory(
  farmId: string,
  newCurrentBirdCount: number,
  reportDate: string,
): Promise<void> {
  const db = f.firestore();
  const now = new Date().toISOString();
  await db.collection('farms').doc(farmId).collection('inventory').doc('birds').set({
    currentBirdCount: newCurrentBirdCount,
    lastUpdated: now,
    lastReportDate: reportDate,
  }, { merge: true });
}

export async function updateFeedInventory(
  farmId: string,
  newFeedStockKg: number,
  reportDate: string,
): Promise<void> {
  const db = f.firestore();
  const now = new Date().toISOString();
  await db.collection('farms').doc(farmId).collection('inventory').doc('feed').set({
    currentFeedStockKg: newFeedStockKg,
    lastUpdated: now,
    lastTransactionDate: reportDate,
  }, { merge: true });
}

export async function addFeedLoad(
  farmId: string,
  feedLoadKg: number,
  loadedBy: string,
  notes: string = '',
): Promise<void> {
  const db = f.firestore();
  const now = new Date().toISOString();
  const reportDate = getIstDate();

  const feedRef = db.collection('farms').doc(farmId).collection('inventory').doc('feed');
  const txRef = db.collection('farms').doc(farmId).collection('inventory').doc('feedTransactions').collection('records').doc();

  await db.runTransaction(async (transaction: any) => {
    const feedSnap = await transaction.get(feedRef);
    if (!feedSnap.exists) {
      throw new Error('FEED_INVENTORY_NOT_FOUND');
    }
    const feedData = feedSnap.data();
    const currentStock = Number(feedData.currentFeedStockKg ?? 0);
    const totalLoaded = Number(feedData.totalFeedLoadedKg ?? 0);

    transaction.set(feedRef, {
      currentFeedStockKg: currentStock + feedLoadKg,
      totalFeedLoadedKg: totalLoaded + feedLoadKg,
      lastUpdated: now,
      lastTransactionDate: reportDate,
    }, { merge: true });

    transaction.set(txRef, {
      farmId,
      type: 'FEED_LOAD',
      feedKg: feedLoadKg,
      reportDate,
      createdAt: now,
      loadedBy,
      notes,
    });
  });
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
