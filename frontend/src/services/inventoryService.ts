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
  createdByUid?: string;
  createdByRole?: string;
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

  const rawCreator = data?.createdByUid || data?.recordedBy || data?.loadedBy || data?.userId;
  const createdByUid = typeof data?.createdByUid === 'string' && data.createdByUid.trim()
    ? data.createdByUid.trim()
    : (typeof rawCreator === 'string' && rawCreator.trim() && rawCreator.trim().toLowerCase() !== 'admin'
        ? rawCreator.trim()
        : undefined);
  const createdByRole = data?.createdByRole ? String(data.createdByRole) : undefined;

  return {
    logId: docId,
    farmId: String(data?.farmId || ''),
    quantityKg: Number(data?.quantityKg ?? data?.feedKg ?? 0),
    previousStockKg: prevStock,
    newStockKg: newStock,
    loadedAt: loadedAtStr,
    recordedBy: String(data?.recordedBy || data?.loadedBy || data?.userId || 'Admin'),
    createdByUid,
    createdByRole,
    notes: data?.notes || data?.remarks || '',
    type: 'FEED_LOAD',
    isHistorical: Boolean(data?.isHistorical),
    importBatchId: data?.importBatchId,
  };
}

export const MAX_FEED_QUANTITY_KG = 9999999.99;
export const MAX_FEED_STOCK_KG = 9999999.99;

export function isValidFeedQuantityInput(val: string): boolean {
  if (val === '') return true;
  const pattern = /^(?:\d{1,7}(?:\.\d{0,2})?|\.\d{0,2})$/;
  if (!pattern.test(val)) return false;
  const num = Number(val);
  if (!Number.isFinite(num) || num > MAX_FEED_QUANTITY_KG) {
    return false;
  }
  return true;
}

export function validateFeedQuantity(
  val: string | number,
  currentStock: number = 0,
): { valid: boolean; error?: string; quantity?: number; resultingStock?: number } {
  const str = String(val).trim();
  if (!str) {
    return { valid: false, error: 'Please enter a feed quantity in Kg.' };
  }

  const pattern = /^(?:\d{1,7}(?:\.\d{1,2})?|\.\d{1,2})$/;
  if (!pattern.test(str)) {
    return {
      valid: false,
      error: 'Feed quantity must have at most 7 digits and 2 decimal places (max 9,999,999.99 Kg).',
    };
  }

  const num = Number(str);
  if (!Number.isFinite(num) || isNaN(num)) {
    return { valid: false, error: 'Please enter a valid numeric feed quantity.' };
  }

  if (num <= 0) {
    return { valid: false, error: 'Feed quantity must be greater than 0 Kg.' };
  }

  if (num > MAX_FEED_QUANTITY_KG) {
    return { valid: false, error: 'Feed quantity cannot exceed 9,999,999.99 Kg.' };
  }

  const quantity = Number(num.toFixed(2));
  const resultingStock = Number((currentStock + quantity).toFixed(2));

  if (!Number.isFinite(resultingStock)) {
    return { valid: false, error: 'Resulting feed stock is invalid.' };
  }

  if (resultingStock > MAX_FEED_STOCK_KG) {
    return {
      valid: false,
      error: `Resulting feed stock (${resultingStock.toLocaleString()} Kg) would exceed the maximum allowable limit of ${MAX_FEED_STOCK_KG.toLocaleString()} Kg.`,
    };
  }

  return { valid: true, quantity, resultingStock };
}

export async function addFeedLoad(
  farmId: string,
  feedLoadKg: number,
  loadedBy: string,
  notes: string = '',
  userRole?: string,
  userFarmIds?: string[],
): Promise<void> {
  if (!farmId) {
    throw new Error('FARM_ID_REQUIRED');
  }
  if (!Number.isFinite(feedLoadKg) || isNaN(feedLoadKg) || feedLoadKg <= 0) {
    throw new Error('INVALID_FEED_QUANTITY');
  }
  if (feedLoadKg > MAX_FEED_QUANTITY_KG) {
    throw new Error('FEED_QUANTITY_EXCEEDS_LIMIT');
  }
  if (userRole && userRole !== 'admin') {
    if (userRole !== 'supervisor' || !userFarmIds || !userFarmIds.includes(farmId)) {
      throw new Error('PERMISSION_DENIED');
    }
  }

  feedLoadKg = Number(feedLoadKg.toFixed(2));
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
    const newStockKg = Number((currentStock + feedLoadKg).toFixed(2));
    const newTotalLoadedKg = Number((totalLoaded + feedLoadKg).toFixed(2));

    if (!Number.isFinite(newStockKg) || newStockKg < 0) {
      throw new Error('INVALID_STOCK_VALUE');
    }
    if (newStockKg > MAX_FEED_STOCK_KG) {
      throw new Error('RESULTING_STOCK_EXCEEDS_LIMIT');
    }

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
      createdByUid: loadedBy,
      createdByRole: userRole || 'admin',
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

    // 4. Record audit log entry in auditLogs collection
    const auditRef = db.collection('auditLogs').doc();
    transaction.set(auditRef, {
      eventType: 'FEED_LOAD_CREATED',
      action: 'CREATE',
      userId: loadedBy,
      uid: loadedBy,
      farmId,
      resourceId: feedLogRef.id,
      timestamp: now,
      requestId: `fl_add_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      metadata: {
        logId: feedLogRef.id,
        farmId,
        quantityKg: feedLoadKg,
        previousStockKg: currentStock,
        newStockKg,
        notes: notes || '',
        creatorUid: loadedBy,
        actorUid: loadedBy,
        actorRole: userRole || 'admin',
      },
    });

    return newStockKg;
  });

  import('./notificationService').then(mod => {
    mod.evaluateFeedStockNotification(farmId, farmId, finalStock);
  });
}

export async function updateFeedLoad(
  farmId: string,
  logId: string,
  newQuantityKg: number,
  notes: string = '',
  updatedBy: string = 'Admin',
  userRole?: string,
  userFarmIds?: string[],
): Promise<{ newStockKg: number; previousStockKg: number; diff: number }> {
  if (!farmId) {
    throw new Error('FARM_ID_REQUIRED');
  }
  if (!logId) {
    throw new Error('LOG_ID_REQUIRED');
  }
  if (!Number.isFinite(newQuantityKg) || isNaN(newQuantityKg) || newQuantityKg <= 0) {
    throw new Error('INVALID_FEED_QUANTITY');
  }
  if (newQuantityKg > MAX_FEED_QUANTITY_KG) {
    throw new Error('FEED_QUANTITY_EXCEEDS_LIMIT');
  }
  if (userRole && userRole !== 'admin') {
    if (userRole !== 'supervisor' || !userFarmIds || !userFarmIds.includes(farmId)) {
      throw new Error('PERMISSION_DENIED');
    }
  }

  newQuantityKg = Number(newQuantityKg.toFixed(2));
  const now = new Date().toISOString();
  const farmRef = db.collection('farms').doc(farmId);
  const feedLogRef = db.collection('logs').doc(farmId).collection('feedLogs').doc(logId);

  const result = await db.runTransaction(async (transaction: any) => {
    const [farmSnap, logSnap] = await Promise.all([
      transaction.get(farmRef),
      transaction.get(feedLogRef),
    ]);

    if (!farmSnap.exists) {
      throw new Error('FARM_NOT_FOUND');
    }
    if (!logSnap.exists) {
      throw new Error('FEED_LOG_NOT_FOUND');
    }

    const farmData = farmSnap.data();
    const logData = logSnap.data();

    // Verify record ownership:
    // Conflicting or missing metadata locks the record permanently.
    const cUid = typeof logData.createdByUid === 'string' && logData.createdByUid.trim() ? logData.createdByUid.trim() : null;
    const rBy = typeof (logData.recordedBy || logData.loadedBy || logData.userId) === 'string' &&
      String(logData.recordedBy || logData.loadedBy || logData.userId).trim().toLowerCase() !== 'admin'
        ? String(logData.recordedBy || logData.loadedBy || logData.userId).trim()
        : null;

    let creatorUid = '';
    if (cUid != null && rBy != null) {
      if (cUid !== rBy) {
        // Conflicting ownership metadata -> lock record
        throw new Error('UNVERIFIED_RECORD_OWNERSHIP');
      }
      creatorUid = cUid;
    } else if (cUid != null) {
      creatorUid = cUid;
    } else if (rBy != null) {
      creatorUid = rBy;
    }

    if (!creatorUid) {
      throw new Error('UNVERIFIED_RECORD_OWNERSHIP');
    }

    if (creatorUid !== updatedBy) {
      throw new Error('PERMISSION_DENIED_NOT_CREATOR');
    }

    const oldQty = Number(logData.quantityKg ?? logData.feedKg ?? 0);
    const diff = Number((newQuantityKg - oldQty).toFixed(2));

    const currentStock = Number(farmData.currentFeedKg ?? farmData.initialFeedKg ?? 0);
    const totalLoaded = Number(farmData.totalFeedLoadedKg ?? farmData.initialFeedKg ?? 0);

    const newStockKg = Number((currentStock + diff).toFixed(2));
    const newTotalLoadedKg = Math.max(0, Number((totalLoaded + diff).toFixed(2)));

    if (!Number.isFinite(newStockKg) || newStockKg < 0) {
      throw new Error('INSUFFICIENT_STOCK_FOR_UPDATE');
    }
    if (newStockKg > MAX_FEED_STOCK_KG) {
      throw new Error('RESULTING_STOCK_EXCEEDS_LIMIT');
    }

    // 1. Update farm doc
    transaction.set(farmRef, {
      currentFeedKg: newStockKg,
      totalFeedLoadedKg: newTotalLoadedKg,
      inventoryUpdatedAt: now,
      updatedAt: now,
    }, { merge: true });

    // 2. Update feed log doc
    const updatedLog: Record<string, any> = {
      quantityKg: newQuantityKg,
      notes: notes || '',
      updatedAt: now,
      updatedBy,
    };
    if (logData.newStockKg !== undefined) {
      updatedLog.newStockKg = Number((Number(logData.newStockKg) + diff).toFixed(2));
    }
    // Maintain creator UID immutability
    if (logData.createdByUid) {
      updatedLog.createdByUid = logData.createdByUid;
    } else {
      updatedLog.createdByUid = creatorUid;
    }
    if (logData.recordedBy) {
      updatedLog.recordedBy = logData.recordedBy;
    } else {
      updatedLog.recordedBy = creatorUid;
    }
    transaction.set(feedLogRef, updatedLog, { merge: true });

    // 3. Keep legacy feedTransaction for backward compatibility
    const txRef = db.collection('farms').doc(farmId).collection('feedTransactions').doc();
    transaction.set(txRef, {
      farmId,
      type: 'FEED_LOAD_CORRECTION',
      feedKg: diff,
      reportDate: getIstDate(),
      createdAt: now,
      loadedBy: updatedBy,
      notes: notes ? `Correction for log ${logId} (${diff >= 0 ? '+' : ''}${diff} Kg): ${notes}` : `Correction for log ${logId}: ${diff >= 0 ? '+' : ''}${diff} Kg`,
    });

    // 4. Record audit log entry in auditLogs collection
    const auditRef = db.collection('auditLogs').doc();
    transaction.set(auditRef, {
      eventType: 'FEED_LOAD_UPDATED',
      action: 'UPDATE',
      userId: updatedBy,
      uid: updatedBy,
      farmId,
      resourceId: logId,
      timestamp: now,
      requestId: `fl_edit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      metadata: {
        logId,
        farmId,
        creatorUid,
        actorUid: updatedBy,
        actorRole: userRole || 'admin',
        previousValues: {
          quantityKg: oldQty,
          notes: logData.notes || '',
          loadedAt: logData.loadedAt || '',
          previousStockKg: logData.previousStockKg,
          newStockKg: logData.newStockKg,
          recordedBy: logData.recordedBy || creatorUid,
          createdByUid: logData.createdByUid || creatorUid,
        },
        updatedValues: {
          quantityKg: newQuantityKg,
          notes: notes || '',
          newStockKg: logData.newStockKg !== undefined ? Number((Number(logData.newStockKg) + diff).toFixed(2)) : undefined,
        },
        diff,
        currentStockBefore: currentStock,
        currentStockAfter: newStockKg,
      },
    });

    return { newStockKg, previousStockKg: currentStock, diff };
  });

  import('./notificationService').then(mod => {
    mod.evaluateFeedStockNotification(farmId, farmId, result.newStockKg);
  });

  return result;
}

export async function deleteFeedLoad(
  farmId: string,
  logId: string,
  deletedBy: string = 'Admin',
  userRole?: string,
  userFarmIds?: string[],
): Promise<{ newStockKg: number; deletedQuantityKg: number }> {
  if (!farmId) {
    throw new Error('FARM_ID_REQUIRED');
  }
  if (!logId) {
    throw new Error('LOG_ID_REQUIRED');
  }
  if (userRole && userRole !== 'admin') {
    if (userRole !== 'supervisor' || !userFarmIds || !userFarmIds.includes(farmId)) {
      throw new Error('PERMISSION_DENIED');
    }
  }

  const now = new Date().toISOString();
  const farmRef = db.collection('farms').doc(farmId);
  const feedLogRef = db.collection('logs').doc(farmId).collection('feedLogs').doc(logId);

  const result = await db.runTransaction(async (transaction: any) => {
    const [farmSnap, logSnap] = await Promise.all([
      transaction.get(farmRef),
      transaction.get(feedLogRef),
    ]);

    if (!farmSnap.exists) {
      throw new Error('FARM_NOT_FOUND');
    }
    if (!logSnap.exists) {
      throw new Error('FEED_LOG_NOT_FOUND');
    }

    const farmData = farmSnap.data();
    const logData = logSnap.data();

    // Verify record ownership:
    // Conflicting or missing metadata locks the record permanently.
    const cUid = typeof logData.createdByUid === 'string' && logData.createdByUid.trim() ? logData.createdByUid.trim() : null;
    const rBy = typeof (logData.recordedBy || logData.loadedBy || logData.userId) === 'string' &&
      String(logData.recordedBy || logData.loadedBy || logData.userId).trim().toLowerCase() !== 'admin'
        ? String(logData.recordedBy || logData.loadedBy || logData.userId).trim()
        : null;

    let creatorUid = '';
    if (cUid != null && rBy != null) {
      if (cUid !== rBy) {
        // Conflicting ownership metadata -> lock record
        throw new Error('UNVERIFIED_RECORD_OWNERSHIP');
      }
      creatorUid = cUid;
    } else if (cUid != null) {
      creatorUid = cUid;
    } else if (rBy != null) {
      creatorUid = rBy;
    }

    if (!creatorUid) {
      throw new Error('UNVERIFIED_RECORD_OWNERSHIP');
    }

    if (creatorUid !== deletedBy) {
      throw new Error('PERMISSION_DENIED_NOT_CREATOR');
    }

    const qty = Number(logData.quantityKg ?? logData.feedKg ?? 0);
    const currentStock = Number(farmData.currentFeedKg ?? farmData.initialFeedKg ?? 0);
    const totalLoaded = Number(farmData.totalFeedLoadedKg ?? farmData.initialFeedKg ?? 0);

    const newStockKg = Number((currentStock - qty).toFixed(2));
    const newTotalLoadedKg = Math.max(0, Number((totalLoaded - qty).toFixed(2)));

    if (!Number.isFinite(newStockKg) || newStockKg < 0) {
      throw new Error('INSUFFICIENT_STOCK_FOR_DELETION');
    }

    // 1. Update farm doc
    transaction.set(farmRef, {
      currentFeedKg: newStockKg,
      totalFeedLoadedKg: newTotalLoadedKg,
      inventoryUpdatedAt: now,
      updatedAt: now,
    }, { merge: true });

    // 2. Delete feed log doc
    transaction.delete(feedLogRef);

    // 3. Keep legacy feedTransaction for backward compatibility
    const txRef = db.collection('farms').doc(farmId).collection('feedTransactions').doc();
    transaction.set(txRef, {
      farmId,
      type: 'FEED_LOAD_DELETION',
      feedKg: qty,
      reportDate: getIstDate(),
      createdAt: now,
      loadedBy: deletedBy,
      notes: `Deleted feed load ${logId}: -${qty} Kg`,
    });

    // 4. Record audit log entry in auditLogs collection
    const auditRef = db.collection('auditLogs').doc();
    transaction.set(auditRef, {
      eventType: 'FEED_LOAD_DELETED',
      action: 'DELETE',
      userId: deletedBy,
      uid: deletedBy,
      farmId,
      resourceId: logId,
      timestamp: now,
      requestId: `fl_del_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      metadata: {
        logId,
        farmId,
        creatorUid,
        actorUid: deletedBy,
        actorRole: userRole || 'admin',
        deletedValues: {
          quantityKg: qty,
          notes: logData.notes || '',
          loadedAt: logData.loadedAt || '',
          previousStockKg: logData.previousStockKg,
          newStockKg: logData.newStockKg,
          recordedBy: logData.recordedBy || creatorUid,
          createdByUid: logData.createdByUid || creatorUid,
        },
        deletedQuantityKg: qty,
        currentStockBefore: currentStock,
        currentStockAfter: newStockKg,
      },
    });

    return { newStockKg, deletedQuantityKg: qty };
  });

  import('./notificationService').then(mod => {
    mod.evaluateFeedStockNotification(farmId, farmId, result.newStockKg);
  });

  return result;
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

