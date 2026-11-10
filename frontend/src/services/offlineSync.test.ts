import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '../config/firebase';
import { syncPendingSubmissions, isPermanentSyncError, getIstDate, type SubmitReportInput } from './reportService';
import type { PendingSubmission } from './offlineDraftService';

// In-memory offline queue + drafts (stands in for IndexedDB).
const store = vi.hoisted(() => ({ pending: new Map<string, any>(), clearedDrafts: [] as string[] }));
vi.mock('./offlineDraftService', () => ({
  savePendingSubmission: vi.fn(async (p: any) => { store.pending.set(p.submissionKey, { ...p }); }),
  getPendingSubmissions: vi.fn(async (uid?: string) => [...store.pending.values()].filter((p) => !uid || p.userId === uid)),
  removePendingSubmission: vi.fn(async (k: string) => { store.pending.delete(k); }),
  clearFarmerDraft: vi.fn(async (u: string, f: string, d: string) => { store.clearedDrafts.push(`${u}_${f}_${d}`); }),
}));

vi.mock('../config/firebase', () => {
  const ref: any = {};
  ref.collection = () => ref;
  ref.doc = () => ref;
  return { db: { collection: () => ref, runTransaction: vi.fn() }, auth: {} };
});

const fsError = (code: string) => Object.assign(new Error(`Firestore ${code}`), { code });

function queueItem(key: string, overrides: Partial<PendingSubmission> = {}): PendingSubmission {
  const date = getIstDate();
  const payload: SubmitReportInput = {
    farmId: 'F1', flockId: '', birdCount: 100, feedKg: 10, mortality: 0, culling: 0, eggsProduced: 80,
    selectionEggs: 0, temperature: 30, eggWeight: { min: 50, max: 60, avg: 55 }, remarks: '', submittedBy: 'farmerA',
    submissionDate: date, reportDate: date, submissionKey: key,
  };
  return { submissionKey: key, userId: 'farmerA', farmId: 'F1', reportDate: date, payload, createdAt: 1, status: 'PENDING_SYNC', ...overrides };
}

describe('offline queue: error classification', () => {
  it('treats permission-denied as permanent', () => expect(isPermanentSyncError(fsError('permission-denied'))).toBe(true));
  it('treats a farm mismatch as permanent', () => expect(isPermanentSyncError(new Error('REPORT_FARM_MISMATCH'))).toBe(true));
  it('treats an expired report date as permanent', () =>
    expect(isPermanentSyncError(new Error('Invalid report date. Only Today and Yesterday are allowed for daily reporting.'))).toBe(true));
  it('treats network and contention errors as retryable', () => {
    for (const code of ['unavailable', 'aborted', 'deadline-exceeded', 'resource-exhausted', 'internal']) {
      expect(isPermanentSyncError(fsError(code))).toBe(false);
    }
  });
});

describe('offline queue: syncPendingSubmissions', () => {
  beforeEach(() => {
    store.pending.clear();
    store.clearedDrafts.length = 0;
    vi.mocked(db.runTransaction).mockReset();
  });

  it('permission-denied: kept as FAILED with payload, draft kept, not retried on next reconnect', async () => {
    const item = queueItem('sub_denied');
    store.pending.set(item.submissionKey, item);
    vi.mocked(db.runTransaction).mockRejectedValue(fsError('permission-denied'));

    expect(await syncPendingSubmissions('farmerA')).toBe(0);
    const saved = store.pending.get('sub_denied');
    expect(saved.status).toBe('FAILED');
    expect(saved.lastError).toBe('permission-denied');
    expect(saved.payload).toEqual(item.payload);
    expect(store.clearedDrafts).toEqual([]);

    vi.mocked(db.runTransaction).mockClear();
    await syncPendingSubmissions('farmerA'); // reconnect again
    expect(db.runTransaction).not.toHaveBeenCalled();
    expect(store.pending.get('sub_denied').status).toBe('FAILED');
  });

  it('business rejection (previously deleted silently) is now kept as FAILED', async () => {
    store.pending.set('sub_limit', queueItem('sub_limit'));
    vi.mocked(db.runTransaction).mockRejectedValue(new Error('FARM_NOT_ASSIGNED'));
    await syncPendingSubmissions('farmerA');
    expect(store.pending.get('sub_limit')).toMatchObject({ status: 'FAILED', lastError: 'FARM_NOT_ASSIGNED' });
    expect(store.clearedDrafts).toEqual([]);
  });

  it('transient contention error: stays PENDING_SYNC and is retried on the next reconnect', async () => {
    store.pending.set('sub_busy', queueItem('sub_busy'));
    vi.mocked(db.runTransaction).mockRejectedValue(fsError('aborted'));
    await syncPendingSubmissions('farmerA');
    expect(store.pending.get('sub_busy').status).toBe('PENDING_SYNC');

    vi.mocked(db.runTransaction).mockClear();
    await syncPendingSubmissions('farmerA');
    expect(db.runTransaction).toHaveBeenCalledTimes(1);
  });

  it('network failure during sync: stays queued as PENDING_SYNC', async () => {
    store.pending.set('sub_net', queueItem('sub_net'));
    vi.mocked(db.runTransaction).mockRejectedValue(fsError('unavailable'));
    expect(await syncPendingSubmissions('farmerA')).toBe(0);
    expect(store.pending.get('sub_net').status).toBe('PENDING_SYNC');
  });

  it('successful reconnect: legitimate submission is synced, removed and its draft cleared', async () => {
    store.pending.set('sub_ok', queueItem('sub_ok'));
    vi.mocked(db.runTransaction).mockResolvedValue(undefined);
    expect(await syncPendingSubmissions('farmerA')).toBe(1);
    expect(store.pending.has('sub_ok')).toBe(false);
    expect(store.clearedDrafts).toHaveLength(1);
  });

  it('one permanent failure does not block other queued submissions', async () => {
    store.pending.set('sub_bad', queueItem('sub_bad'));
    store.pending.set('sub_good', queueItem('sub_good'));
    vi.mocked(db.runTransaction)
      .mockRejectedValueOnce(fsError('permission-denied'))
      .mockResolvedValueOnce(undefined);
    expect(await syncPendingSubmissions('farmerA')).toBe(1);
    expect(store.pending.get('sub_bad').status).toBe('FAILED');
    expect(store.pending.has('sub_good')).toBe(false);
  });

  it('only syncs the signed-in user\'s queue', async () => {
    store.pending.set('sub_other', queueItem('sub_other', { userId: 'farmerB' }));
    vi.mocked(db.runTransaction).mockResolvedValue(undefined);
    expect(await syncPendingSubmissions('farmerA')).toBe(0);
    expect(store.pending.has('sub_other')).toBe(true);
  });
});
