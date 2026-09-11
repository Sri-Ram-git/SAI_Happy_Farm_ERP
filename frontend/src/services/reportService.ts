const f = (window as any).firebase;

export function getIstDate(): string {
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

function normalizeDateToString(val: any): string | null {
  if (!val) return null;

  if (typeof val === 'string') {
    return val;
  }

  if (typeof val === 'object') {
    if (typeof val.toDate === 'function') {
      try {
        return val.toDate().toISOString();
      } catch {
        // fallback
      }
    }
    if (typeof val.seconds === 'number') {
      return new Date(val.seconds * 1000).toISOString();
    }
    if (val instanceof Date) {
      return val.toISOString();
    }
  }

  if (typeof val === 'number') {
    const ms = val < 10000000000 ? val * 1000 : val;
    return new Date(ms).toISOString();
  }

  try {
    return String(val);
  } catch {
    return null;
  }
}

export function formatDisplayDate(isoDate: any): string {
  if (!isoDate) return '';
  const dateStr = normalizeDateToString(isoDate);
  if (!dateStr || typeof dateStr !== 'string') return '';
  try {
    const cleanIso = dateStr.split('T')[0];
    const parts = cleanIso.split('-');
    if (parts.length < 3) return cleanIso;
    const [y, m, d] = parts;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthIdx = parseInt(m, 10) - 1;
    if (isNaN(monthIdx) || monthIdx < 0 || monthIdx > 11) return cleanIso;
    return `${d} ${months[monthIdx]} ${y}`;
  } catch {
    return String(isoDate);
  }
}

export function calculateWeekNumber(startDateInput: any, reportDateInput: any): number {
  if (!startDateInput || !reportDateInput) return 1;

  const startDateStr = normalizeDateToString(startDateInput);
  const reportDateStr = normalizeDateToString(reportDateInput);

  if (!startDateStr || typeof startDateStr !== 'string' || !reportDateStr || typeof reportDateStr !== 'string') {
    return 1;
  }

  try {
    const startIso = startDateStr.split('T')[0];
    const reportIso = reportDateStr.split('T')[0];

    const startParts = startIso.split('-').map(Number);
    const reportParts = reportIso.split('-').map(Number);

    if (startParts.length < 3 || reportParts.length < 3) return 1;
    if (isNaN(startParts[0]) || isNaN(reportParts[0])) return 1;

    const startDate = new Date(Date.UTC(startParts[0], startParts[1] - 1, startParts[2]));
    const reportDate = new Date(Date.UTC(reportParts[0], reportParts[1] - 1, reportParts[2]));

    const diffMs = reportDate.getTime() - startDate.getTime();
    if (isNaN(diffMs)) return 1;

    const daysElapsed = Math.max(0, Math.floor(diffMs / (24 * 3600 * 1000)));
    return Math.floor(daysElapsed / 7) + 1;
  } catch (err) {
    console.warn('[calculateWeekNumber] Failed to parse dates:', err);
    return 1;
  }
}

export interface SubmitReportInput {
  farmId: string;
  flockId: string;
  birdCount: number;
  feedKg: number;
  feedGrams?: number;
  feedG?: number;
  mortality: number;
  culling: number;
  eggsProduced: number;
  selectionEggs: number;
  temperature: number;
  tempMin?: number;
  tempMax?: number;
  eggWeight: { min: number; max: number; avg: number };
  bodyWeight: { min: number; max: number; avg: number };
  remarks: string;
  ammoniaPpm: number;
  submittedBy: string;
  weekNumber?: number;
  submissionDate?: string;
  reportDate?: string;
  submissionKey?: string;
}

function hasDataChanged(input: SubmitReportInput, existing: any): boolean {
  if (Number(input.feedKg) !== Number(existing.feedKg ?? 0)) return true;
  if (Number(input.mortality) !== Number(existing.mortality ?? 0)) return true;
  if (Number(input.culling) !== Number(existing.culling ?? 0)) return true;
  if (Number(input.eggsProduced) !== Number(existing.eggsProduced ?? 0)) return true;
  if (Number(input.selectionEggs) !== Number(existing.selectionEggs ?? 0)) return true;
  if (Number(input.tempMin ?? input.temperature) !== Number(existing.tempMin ?? existing.temperature ?? 0)) return true;
  if (Number(input.tempMax ?? input.temperature) !== Number(existing.tempMax ?? existing.temperature ?? 0)) return true;
  if (Number(input.eggWeight?.min) !== Number(existing.eggWeight?.min ?? 0)) return true;
  if (Number(input.eggWeight?.max) !== Number(existing.eggWeight?.max ?? 0)) return true;
  if (Number(input.eggWeight?.avg) !== Number(existing.eggWeight?.avg ?? 0)) return true;
  if (Number(input.bodyWeight?.min) !== Number(existing.bodyWeight?.min ?? 0)) return true;
  if (Number(input.bodyWeight?.max) !== Number(existing.bodyWeight?.max ?? 0)) return true;
  if (Number(input.bodyWeight?.avg) !== Number(existing.bodyWeight?.avg ?? 0)) return true;
  if (Number(input.ammoniaPpm) !== Number(existing.ammoniaPpm ?? 0)) return true;
  if ((input.remarks || '').trim() !== (existing.remarks || '').trim()) return true;
  return false;
}

export function subscribeToTodayReport(
  userId: string,
  flockId: string,
  submissionDate: string,
  callback: (report: any | null) => void,
): () => void {
  const db = f.firestore();
  const dailyLogRef = db.collection('dailyReports').doc(userId).collection('dailyLogs').doc(submissionDate);
  return dailyLogRef.onSnapshot(
    (doc: any) => {
      if (doc && doc.exists) {
        callback(doc.data());
      } else {
        callback(null);
      }
    },
    (err: any) => {
      console.warn('[reportService] subscribeToTodayReport error:', err);
      callback(null);
    },
  );
}

export async function submitReport(input: SubmitReportInput): Promise<{ reportId: string; version: number; isOffline?: boolean }> {
  const db = f.firestore();
  const userId = input.submittedBy;
  const submissionDate = input.submissionDate || input.reportDate || getIstDate();
  const now = new Date().toISOString();

  const submissionKey = input.submissionKey || `sub_${userId}_${input.farmId}_${submissionDate}`;

  // If browser is explicitly offline, save to pending queue immediately
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    await savePendingSubmission({
      submissionKey,
      userId,
      farmId: input.farmId,
      reportDate: submissionDate,
      payload: { ...input, submissionDate, reportDate: submissionDate, submissionKey },
      createdAt: Date.now(),
      status: 'PENDING_SYNC',
    });
    return { reportId: `${userId}_${submissionDate}_${input.flockId}`, version: 1, isOffline: true };
  }

  const parentRef = db.collection('dailyReports').doc(userId);
  const dailyLogRef = db.collection('dailyReports').doc(userId).collection('dailyLogs').doc(submissionDate);
  const flockRef = db.collection('flocks').doc(input.flockId);
  const farmRef = db.collection('farms').doc(input.farmId);
  const userRef = db.collection('users').doc(userId);

  let finalVersion = 1;

  try {
    await db.runTransaction(async (transaction: any) => {
      // 1. Verify User Authorization
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) {
        throw new Error('USER_NOT_FOUND');
      }
      const userData = userDoc.data();
      if (userData.role !== 'farmer' || userData.active !== true) {
        throw new Error('USER_NOT_AUTHORIZED');
      }
      if (!userData.farmIds || !userData.farmIds.includes(input.farmId)) {
        throw new Error('FARM_NOT_ASSIGNED');
      }

      const existingLog = await transaction.get(dailyLogRef);
      const flockDoc = await transaction.get(flockRef);
      const flockData = flockDoc.exists ? flockDoc.data() : null;

      const farmDoc = await transaction.get(farmRef);
      if (!farmDoc.exists) {
        throw new Error('FARM_NOT_FOUND');
      }
      const farmData = farmDoc.data();
      
      // Master Inventory Guards
      if (farmData.inventoryInitialized !== true) {
        throw new Error('INVENTORY_NOT_INITIALIZED');
      }

      const currentFeedStock = Number(farmData.currentFeedKg ?? 0);
      const currentBirdCount = Number(farmData.currentBirdCount ?? 0);

      if (!existingLog.exists) {
        // INITIAL SUBMISSION (VERSION 1)
        finalVersion = 1;
        
        if (input.feedKg > 0 && currentFeedStock < input.feedKg) {
          throw new Error('INSUFFICIENT_FEED');
        }
        
        const totalBirdDeduction = input.mortality + input.culling;
        if (totalBirdDeduction > 0 && currentBirdCount < totalBirdDeduction) {
          throw new Error('INSUFFICIENT_BIRDS');
        }

        const openingBirdCount = currentBirdCount; // Derived natively from master inventory
        const closingBirdCount = openingBirdCount - totalBirdDeduction;

        // Update Legacy Flock as requested (only if it exists)
        if (flockData) {
          transaction.set(flockRef, {
            currentBirds: closingBirdCount,
            totalMortality: (flockData.totalMortality || 0) + input.mortality,
            totalCulling: (flockData.totalCulling || 0) + input.culling,
            totalEggs: (flockData.totalEggs || 0) + input.eggsProduced,
            updatedAt: now,
          }, { merge: true });
        }

        transaction.set(parentRef, {
          userId,
          farmId: input.farmId,
          flockId: input.flockId,
          lastSubmissionDate: submissionDate,
          updatedAt: now,
        }, { merge: true });

        transaction.set(dailyLogRef, {
          userId,
          submittedBy: userId,
          farmId: input.farmId,
          flockId: input.flockId,
          submissionDate,
          submissionMethod: 'DIGITAL_FORM',
          submissionVersion: 1,
          status: 'submitted',
          submittedAt: now,
          createdAt: now,
          updatedAt: now,
          openingBirdCount,
          closingBirdCount,
          birdCount: closingBirdCount,
          openingFeedKg: currentFeedStock,
          feedKg: input.feedKg,
          closingFeedKg: currentFeedStock - input.feedKg,
          feedGrams: input.feedGrams ?? input.feedKg * 1000,
          feedG: input.feedG ?? input.feedKg * 1000,
          mortality: input.mortality,
          culling: input.culling,
          eggsProduced: input.eggsProduced,
          selectionEggs: input.selectionEggs,
          temperature: input.temperature,
          tempMin: input.tempMin ?? input.temperature,
          tempMax: input.tempMax ?? input.temperature,
          eggWeight: input.eggWeight,
          bodyWeight: input.bodyWeight,
          remarks: input.remarks,
          ammoniaPpm: input.ammoniaPpm,
          ...(input.weekNumber != null ? { weekNumber: input.weekNumber } : {}),
        }, { merge: true });

        if (input.mortality > 0) {
          const birdTxRef = db.collection('farms').doc(input.farmId).collection('birdTransactions').doc();
          transaction.set(birdTxRef, {
            farmId: input.farmId,
            flockId: input.flockId,
            type: 'MORTALITY',
            count: input.mortality,
            reportDate: submissionDate,
            createdAt: now,
            userId,
          });
        }

        if (input.culling > 0) {
          const birdTxRef = db.collection('farms').doc(input.farmId).collection('birdTransactions').doc();
          transaction.set(birdTxRef, {
            farmId: input.farmId,
            flockId: input.flockId,
            type: 'CULLING',
            count: input.culling,
            reportDate: submissionDate,
            createdAt: now,
            userId,
          });
        }

        // Update master farm inventory (Atomic)
        transaction.set(farmRef, {
          currentBirdCount: closingBirdCount,
          currentFeedKg: currentFeedStock - input.feedKg,
          totalFeedConsumedKg: (farmData.totalFeedConsumedKg || 0) + input.feedKg,
          inventoryUpdatedAt: now,
          updatedAt: now,
        }, { merge: true });

        if (input.feedKg > 0) {
          const feedTxRef = db.collection('farms').doc(input.farmId).collection('feedTransactions').doc();
          transaction.set(feedTxRef, {
            farmId: input.farmId,
            flockId: input.flockId,
            type: 'FEED_USAGE',
            feedKg: input.feedKg,
            reportDate: submissionDate,
            createdAt: now,
            userId,
          });
        }

      } else {
        // EXISTING REPORT: CORRECTION / REVISION (VERSION 2)
        const existingData = existingLog.data();
        const currentVersion = Number(existingData.submissionVersion || 1);

        if (currentVersion >= 2 || existingData.status === 'corrected' || existingData.status === 'finalized') {
          throw new Error('CORRECTION_LIMIT_REACHED');
        }

        if (!hasDataChanged(input, existingData)) {
          throw new Error('NO_CHANGES_DETECTED');
        }

        finalVersion = 2;

        // 1. Archive Version 1 into subcollection
        const revRef = dailyLogRef.collection('revisions').doc('v1');
        transaction.set(revRef, {
          ...existingData,
          archivedAt: now,
          archivedReason: 'FARMER_CORRECTION_V2',
        });

        // 2. Calculate diffs
        const feedDiff = input.feedKg - Number(existingData.feedKg || 0);
        const mortalityDiff = input.mortality - Number(existingData.mortality || 0);
        const cullingDiff = input.culling - Number(existingData.culling || 0);
        const eggsDiff = input.eggsProduced - Number(existingData.eggsProduced || 0);

        if (feedDiff > 0 && currentFeedStock < feedDiff) {
          throw new Error('INSUFFICIENT_FEED');
        }

        const totalBirdDeductionDiff = mortalityDiff + cullingDiff;
        if (totalBirdDeductionDiff > 0 && currentBirdCount < totalBirdDeductionDiff) {
          throw new Error('INSUFFICIENT_BIRDS');
        }

        // 3. Update Legacy flock totals (if exists)
        if (flockData) {
          transaction.set(flockRef, {
            currentBirds: (flockData.currentBirds || 0) - totalBirdDeductionDiff,
            totalMortality: (flockData.totalMortality || 0) + mortalityDiff,
            totalCulling: (flockData.totalCulling || 0) + cullingDiff,
            totalEggs: (flockData.totalEggs || 0) + eggsDiff,
            updatedAt: now,
          }, { merge: true });
        }

        // 4. Update master farm inventory (Atomic Delta)
        const newFarmBirdCount = currentBirdCount - totalBirdDeductionDiff;
        transaction.set(farmRef, {
          currentBirdCount: newFarmBirdCount,
          currentFeedKg: currentFeedStock - feedDiff,
          totalFeedConsumedKg: (farmData.totalFeedConsumedKg || 0) + feedDiff,
          inventoryUpdatedAt: now,
          updatedAt: now,
        }, { merge: true });

        const openingBirdCount = existingData.openingBirdCount ?? currentBirdCount;
        const closingBirdCount = openingBirdCount - input.mortality - input.culling;

        if (feedDiff !== 0) {
          const feedTxRef = db.collection('farms').doc(input.farmId).collection('feedTransactions').doc();
          transaction.set(feedTxRef, {
            farmId: input.farmId,
            flockId: input.flockId,
            type: 'FEED_USAGE_CORRECTION',
            feedKg: feedDiff,
            reportDate: submissionDate,
            createdAt: now,
            userId,
          });
        }

        // 5. Update canonical daily report with Version 2 values
        transaction.set(dailyLogRef, {
          submissionVersion: 2,
          status: 'corrected',
          updatedAt: now,
          correctedAt: now,
          openingBirdCount,
          closingBirdCount,
          birdCount: closingBirdCount,
          openingFeedKg: existingData.openingFeedKg ?? currentFeedStock,
          feedKg: input.feedKg,
          closingFeedKg: (existingData.openingFeedKg ?? currentFeedStock) - input.feedKg,
          feedGrams: input.feedGrams ?? input.feedKg * 1000,
          feedG: input.feedG ?? input.feedKg * 1000,
          mortality: input.mortality,
          culling: input.culling,
          eggsProduced: input.eggsProduced,
          selectionEggs: input.selectionEggs,
          temperature: input.temperature,
          tempMin: input.tempMin ?? input.temperature,
          tempMax: input.tempMax ?? input.temperature,
          eggWeight: input.eggWeight,
          bodyWeight: input.bodyWeight,
          remarks: input.remarks,
          ammoniaPpm: input.ammoniaPpm,
          previousVersionData: {
            feedKg: existingData.feedKg,
            mortality: existingData.mortality,
            culling: existingData.culling,
            eggsProduced: existingData.eggsProduced,
            submittedAt: existingData.submittedAt || existingData.createdAt,
          },
        }, { merge: true });
      }
    });

    // Clean up any pending queue item if online submission succeeded
    await removePendingSubmission(submissionKey);

    return { reportId: `${userId}_${submissionDate}_${input.flockId}`, version: finalVersion };
  } catch (err: any) {
    const errMsg = String(err?.message || err || '').toLowerCase();
    const isNetworkError =
      err?.code === 'unavailable' ||
      err?.code === 'failed-precondition' ||
      errMsg.includes('offline') ||
      errMsg.includes('network') ||
      errMsg.includes('fetch');

    if (isNetworkError) {
      console.warn('[reportService] Transaction failed due to network/offline state. Saving to pending queue.');
      await savePendingSubmission({
        submissionKey,
        userId,
        farmId: input.farmId,
        reportDate: submissionDate,
        payload: input,
        createdAt: Date.now(),
        status: 'PENDING_SYNC',
      });
      return { reportId: `${userId}_${submissionDate}_${input.flockId}`, version: 1, isOffline: true };
    }

    throw err;
  }
}

import {
  savePendingSubmission,
  getPendingSubmissions,
  removePendingSubmission,
  clearFarmerDraft,
} from './offlineDraftService';

let isSyncingPending = false;

export async function syncPendingSubmissions(userId: string): Promise<number> {
  if (isSyncingPending) return 0;
  isSyncingPending = true;

  try {
    const pendingList = await getPendingSubmissions(userId);
    if (!pendingList || pendingList.length === 0) return 0;

    let syncedCount = 0;
    for (const item of pendingList) {
      const targetDate: string = item.reportDate || item.payload.submissionDate || item.payload.reportDate || getIstDate();
      const targetKey = item.submissionKey || `sub_${item.userId}_${item.farmId}_${targetDate}`;

      const payloadWithMeta: SubmitReportInput = {
        ...item.payload,
        submissionDate: targetDate,
        reportDate: targetDate,
        submissionKey: targetKey,
      };

      try {
        const res = await submitReport(payloadWithMeta);
        if (!res.isOffline) {
          await removePendingSubmission(targetKey);
          await clearFarmerDraft(item.userId, item.farmId, targetDate);
          syncedCount++;
        }
      } catch (err: any) {
        console.warn('[reportService] syncPendingSubmissions item error:', err);
        const nonRetryableErrors = [
          'NO_CHANGES_DETECTED',
          'CORRECTION_LIMIT_REACHED',
          'USER_NOT_AUTHORIZED',
          'USER_NOT_FOUND',
          'FARM_NOT_ASSIGNED',
          'INVENTORY_NOT_INITIALIZED',
          'FARM_NOT_FOUND',
        ];
        if (nonRetryableErrors.includes(err.message)) {
          await removePendingSubmission(targetKey);
          await clearFarmerDraft(item.userId, item.farmId, targetDate);
        }
      }
    }
    return syncedCount;
  } finally {
    isSyncingPending = false;
  }
}
