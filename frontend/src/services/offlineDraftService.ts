import type { FarmFormData } from '../utils/formValidation';
import type { SubmitReportInput } from './reportService';

export interface FarmerFormDraft {
  draftKey: string;
  userId: string;
  farmId: string;
  reportDate: string;
  step: number;
  data: FarmFormData;
  updatedAt: number;
}

export interface PendingSubmission {
  submissionKey: string;
  userId: string;
  farmId: string;
  reportDate: string;
  payload: SubmitReportInput;
  createdAt: number;
  status: 'PENDING_SYNC' | 'SYNCING' | 'SUBMITTED' | 'FAILED';
  lastError?: string;
}

const DB_NAME = 'happy_farm_offline_db';
const DB_VERSION = 1;
const STORE_DRAFTS = 'drafts';
const STORE_PENDING = 'pendingSubmissions';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_DRAFTS)) {
        db.createObjectStore(STORE_DRAFTS, { keyPath: 'draftKey' });
      }
      if (!db.objectStoreNames.contains(STORE_PENDING)) {
        db.createObjectStore(STORE_PENDING, { keyPath: 'submissionKey' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ─── Draft Management ───

export async function saveFarmerDraft(draft: FarmerFormDraft): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_DRAFTS, 'readwrite');
    const store = tx.objectStore(STORE_DRAFTS);
    store.put(draft);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error('[offlineDraftService] saveFarmerDraft error:', err);
    try {
      localStorage.setItem(draft.draftKey, JSON.stringify(draft));
    } catch (e) {}
  }
}

export async function getFarmerDraft(
  userId: string,
  farmId: string,
  reportDate: string
): Promise<FarmerFormDraft | null> {
  const draftKey = `draft_${userId}_${farmId}_${reportDate}`;
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_DRAFTS, 'readonly');
    const store = tx.objectStore(STORE_DRAFTS);
    const request = store.get(draftKey);
    return new Promise((resolve) => {
      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result as FarmerFormDraft);
        } else {
          try {
            const cached = localStorage.getItem(draftKey);
            if (cached) resolve(JSON.parse(cached));
            else resolve(null);
          } catch (e) {
            resolve(null);
          }
        }
      };
      request.onerror = () => resolve(null);
    });
  } catch (err) {
    console.error('[offlineDraftService] getFarmerDraft error:', err);
    try {
      const cached = localStorage.getItem(draftKey);
      if (cached) return JSON.parse(cached);
    } catch (e) {}
    return null;
  }
}

export async function clearFarmerDraft(
  userId: string,
  farmId: string,
  reportDate: string
): Promise<void> {
  const draftKey = `draft_${userId}_${farmId}_${reportDate}`;
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_DRAFTS, 'readwrite');
    const store = tx.objectStore(STORE_DRAFTS);
    store.delete(draftKey);
    try {
      localStorage.removeItem(draftKey);
    } catch (e) {}
    return new Promise((resolve) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch (err) {
    console.error('[offlineDraftService] clearFarmerDraft error:', err);
    try {
      localStorage.removeItem(draftKey);
    } catch (e) {}
  }
}

// ─── Pending Submission Queue ───

export async function savePendingSubmission(pending: PendingSubmission): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_PENDING, 'readwrite');
    const store = tx.objectStore(STORE_PENDING);
    store.put(pending);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error('[offlineDraftService] savePendingSubmission error:', err);
    try {
      localStorage.setItem(`pending_${pending.submissionKey}`, JSON.stringify(pending));
    } catch (e) {}
  }
}

export async function getPendingSubmissions(userId?: string): Promise<PendingSubmission[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_PENDING, 'readonly');
    const store = tx.objectStore(STORE_PENDING);
    const request = store.getAll();
    return new Promise((resolve) => {
      request.onsuccess = () => {
        let results = (request.result || []) as PendingSubmission[];
        if (userId) {
          results = results.filter((p) => p.userId === userId);
        }
        resolve(results);
      };
      request.onerror = () => resolve([]);
    });
  } catch (err) {
    console.error('[offlineDraftService] getPendingSubmissions error:', err);
    return [];
  }
}

export async function removePendingSubmission(submissionKey: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_PENDING, 'readwrite');
    const store = tx.objectStore(STORE_PENDING);
    store.delete(submissionKey);
    try {
      localStorage.removeItem(`pending_${submissionKey}`);
    } catch (e) {}
    return new Promise((resolve) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch (err) {
    console.error('[offlineDraftService] removePendingSubmission error:', err);
    try {
      localStorage.removeItem(`pending_${submissionKey}`);
    } catch (e) {}
  }
}
