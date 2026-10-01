import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  normalizeFeedLogDoc,
  getFeedLogsByFarm,
  subscribeToFeedLogsByFarm,
  addFeedLoad,
  type FeedLogDoc,
} from './inventoryService';
import { db } from '../config/firebase';

vi.mock('../config/firebase', () => {
  const mockDb = {
    collection: vi.fn(),
    runTransaction: vi.fn(),
  };
  return {
    db: mockDb,
    auth: {},
  };
});

describe('Feed Load History & Inventory Service Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. normalizeFeedLogDoc — Document Structure & Field Resiliency', () => {
    it('1.1 should correctly normalize the verified live AP12 document', () => {
      const liveDocData = {
        logId: 'xZGpPg5VwZL59QEJ2MpD',
        farmId: 'AP12',
        quantityKg: 250,
        previousStockKg: 3955,
        newStockKg: 4205,
        loadedAt: '2026-09-25T05:22:57.620Z',
        recordedBy: 'ltiCEvWLoeYSkyvvG0E9fcKg7lE3',
        notes: 'Standard feed batch load - verified',
        type: 'FEED_LOAD',
      };

      const normalized = normalizeFeedLogDoc('xZGpPg5VwZL59QEJ2MpD', liveDocData);

      expect(normalized.logId).toBe('xZGpPg5VwZL59QEJ2MpD');
      expect(normalized.farmId).toBe('AP12');
      expect(normalized.quantityKg).toBe(250);
      expect(normalized.previousStockKg).toBe(3955);
      expect(normalized.newStockKg).toBe(4205);
      expect(normalized.loadedAt).toBe('2026-09-25T05:22:57.620Z');
      expect(normalized.recordedBy).toBe('ltiCEvWLoeYSkyvvG0E9fcKg7lE3');
      expect(normalized.notes).toBe('Standard feed batch load - verified');
      expect(normalized.type).toBe('FEED_LOAD');
    });

    it('1.2 should normalize Firestore Timestamp objects with .toDate()', () => {
      const timestampDoc = {
        farmId: 'AP12',
        quantityKg: 500,
        loadedAt: {
          toDate: () => new Date('2026-09-28T10:00:00.000Z'),
        },
        recordedBy: 'admin-1',
      };

      const normalized = normalizeFeedLogDoc('ts-log-1', timestampDoc);
      expect(normalized.loadedAt).toBe('2026-09-28T10:00:00.000Z');
      expect(normalized.quantityKg).toBe(500);
    });

    it('1.3 should normalize Firestore Timestamp representations with _seconds or seconds', () => {
      const secondsDoc = {
        farmId: 'AP12',
        quantityKg: 300,
        loadedAt: { _seconds: 1788417923, _nanoseconds: 0 },
        recordedBy: 'admin-1',
      };

      const normalized = normalizeFeedLogDoc('sec-log-1', secondsDoc);
      expect(normalized.loadedAt).toBe(new Date(1788417923 * 1000).toISOString());
    });

    it('1.4 should fallback to createdAt or reportDate if loadedAt is absent', () => {
      const fallbackDoc = {
        farmId: 'AP12',
        quantityKg: 400,
        createdAt: '2026-09-27T08:30:00.000Z',
        recordedBy: 'admin-1',
      };

      const normalized = normalizeFeedLogDoc('fb-log-1', fallbackDoc);
      expect(normalized.loadedAt).toBe('2026-09-27T08:30:00.000Z');
    });

    it('1.5 should safely handle missing optional fields and fallback numbers', () => {
      const minimalDoc = {
        feedKg: '150',
      };

      const normalized = normalizeFeedLogDoc('min-log-1', minimalDoc);
      expect(normalized.quantityKg).toBe(150);
      expect(normalized.previousStockKg).toBeUndefined();
      expect(normalized.newStockKg).toBeUndefined();
      expect(normalized.notes).toBe('');
      expect(normalized.recordedBy).toBe('Admin');
    });
  });

  describe('2. getFeedLogsByFarm — Firestore Query & Ordering', () => {
    it('2.1 should query logs/{farmId}/feedLogs and sort chronologically descending', async () => {
      const mockDocs = [
        {
          id: 'log-older',
          data: () => ({
            farmId: 'AP12',
            quantityKg: 200,
            loadedAt: '2026-09-20T08:00:00.000Z',
          }),
        },
        {
          id: 'xZGpPg5VwZL59QEJ2MpD',
          data: () => ({
            farmId: 'AP12',
            quantityKg: 250,
            loadedAt: '2026-09-25T05:22:57.620Z',
          }),
        },
      ];

      const getMock = vi.fn().mockResolvedValue({ docs: mockDocs });
      const collectionLogsMock = {
        doc: vi.fn().mockReturnValue({
          collection: vi.fn().mockReturnValue({
            get: getMock,
          }),
        }),
      };

      (db.collection as any).mockImplementation((collName: string) => {
        if (collName === 'logs') return collectionLogsMock;
        return {};
      });

      const logs = await getFeedLogsByFarm('AP12');

      expect(collectionLogsMock.doc).toHaveBeenCalledWith('AP12');
      expect(logs).toHaveLength(2);
      // Descending order: newer date first
      expect(logs[0].logId).toBe('xZGpPg5VwZL59QEJ2MpD');
      expect(logs[0].loadedAt).toBe('2026-09-25T05:22:57.620Z');
      expect(logs[1].logId).toBe('log-older');
      expect(logs[1].loadedAt).toBe('2026-09-20T08:00:00.000Z');
    });

    it('2.2 should return empty array for empty farmId', async () => {
      const logs = await getFeedLogsByFarm('');
      expect(logs).toEqual([]);
      expect(db.collection).not.toHaveBeenCalled();
    });
  });

  describe('3. subscribeToFeedLogsByFarm — Real-Time Listener & Error Propagation', () => {
    it('3.1 should query logs/{farmId}/feedLogs and emit normalized logs', () => {
      let snapshotCallback: any;
      const onSnapshotMock = vi.fn().mockImplementation((onNext: any) => {
        snapshotCallback = onNext;
        return vi.fn(); // unsubscribe
      });

      const collectionLogsMock = {
        doc: vi.fn().mockReturnValue({
          collection: vi.fn().mockReturnValue({
            onSnapshot: onSnapshotMock,
          }),
        }),
      };

      (db.collection as any).mockImplementation((collName: string) => {
        if (collName === 'logs') return collectionLogsMock;
        return {};
      });

      const callback = vi.fn();
      const unsubscribe = subscribeToFeedLogsByFarm('AP12', callback);

      expect(collectionLogsMock.doc).toHaveBeenCalledWith('AP12');
      expect(onSnapshotMock).toHaveBeenCalled();

      // Simulate snapshot emission
      snapshotCallback({
        docs: [
          {
            id: 'xZGpPg5VwZL59QEJ2MpD',
            data: () => ({
              farmId: 'AP12',
              quantityKg: 250,
              loadedAt: '2026-09-25T05:22:57.620Z',
              recordedBy: 'admin-1',
            }),
          },
        ],
      });

      expect(callback).toHaveBeenCalledTimes(1);
      const emittedLogs: FeedLogDoc[] = callback.mock.calls[0][0];
      expect(emittedLogs).toHaveLength(1);
      expect(emittedLogs[0].logId).toBe('xZGpPg5VwZL59QEJ2MpD');
      expect(emittedLogs[0].quantityKg).toBe(250);

      unsubscribe();
    });

    it('3.2 should forward errors to onError callback and NOT trigger false empty state', () => {
      let errorCallback: any;
      const onSnapshotMock = vi.fn().mockImplementation((_onNext: any, onError: any) => {
        errorCallback = onError;
        return vi.fn();
      });

      const collectionLogsMock = {
        doc: vi.fn().mockReturnValue({
          collection: vi.fn().mockReturnValue({
            onSnapshot: onSnapshotMock,
          }),
        }),
      };

      (db.collection as any).mockImplementation((collName: string) => {
        if (collName === 'logs') return collectionLogsMock;
        return {};
      });

      const callback = vi.fn();
      const onError = vi.fn();

      subscribeToFeedLogsByFarm('AP12', callback, onError);

      // Simulate permission denied error
      const permError = new Error('Missing or insufficient permissions');
      errorCallback(permError);

      expect(onError).toHaveBeenCalledWith(permError);
      // Callback with empty array should NOT be called when onError is provided
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('4. addFeedLoad — Transactional Safety & Non-Doubling', () => {
    it('4.1 should validate input arguments', async () => {
      await expect(addFeedLoad('', 100, 'admin-1')).rejects.toThrow('FARM_ID_REQUIRED');
      await expect(addFeedLoad('AP12', 0, 'admin-1')).rejects.toThrow('INVALID_FEED_QUANTITY');
      await expect(addFeedLoad('AP12', -50, 'admin-1')).rejects.toThrow('INVALID_FEED_QUANTITY');
      await expect(addFeedLoad('AP12', NaN, 'admin-1')).rejects.toThrow('INVALID_FEED_QUANTITY');
    });

    it('4.2 should execute atomic transaction updating farm and writing feedLogs and feedTransactions', async () => {
      const mockFarmSnap = {
        exists: true,
        data: () => ({
          farmId: 'AP12',
          currentFeedKg: 3905,
          totalFeedLoadedKg: 3450,
        }),
      };

      const farmRef = { id: 'AP12' };
      const feedLogRef = { id: 'new-feed-log-99' };
      const feedTxRef = { id: 'new-tx-99' };

      (db.collection as any).mockImplementation((collName: string) => {
        if (collName === 'farms') {
          return {
            doc: vi.fn().mockImplementation((docId: string) => {
              if (docId === 'AP12') {
                return {
                  ...farmRef,
                  collection: vi.fn().mockImplementation((sub: string) => {
                    if (sub === 'feedTransactions') {
                      return { doc: vi.fn().mockReturnValue(feedTxRef) };
                    }
                    return {};
                  }),
                };
              }
              return { id: docId };
            }),
          };
        }
        if (collName === 'logs') {
          return {
            doc: vi.fn().mockReturnValue({
              collection: vi.fn().mockImplementation((sub: string) => {
                if (sub === 'feedLogs') {
                  return { doc: vi.fn().mockReturnValue(feedLogRef) };
                }
                return {};
              }),
            }),
          };
        }
        return {};
      });

      const setCalls: { ref: any; data: any; options?: any }[] = [];
      const mockTransaction = {
        get: vi.fn().mockResolvedValue(mockFarmSnap),
        set: vi.fn().mockImplementation((ref: any, data: any, options?: any) => {
          setCalls.push({ ref, data, options });
        }),
      };

      (db.runTransaction as any).mockImplementation(async (cb: any) => {
        return cb(mockTransaction);
      });

      await addFeedLoad('AP12', 300, 'admin-user-1', 'Morning delivery');

      expect(mockTransaction.get).toHaveBeenCalled();
      expect(setCalls).toHaveLength(3);

      // 1. Farm doc update: currentFeedKg = 3905 + 300 = 4205, totalFeedLoadedKg = 3450 + 300 = 3750
      const farmCall = setCalls.find((c) => c.ref.id === 'AP12');
      expect(farmCall).toBeDefined();
      expect(farmCall?.data.currentFeedKg).toBe(4205);
      expect(farmCall?.data.totalFeedLoadedKg).toBe(3750);
      expect(farmCall?.options).toEqual({ merge: true });

      // 2. Feed log written to logs/AP12/feedLogs
      const feedLogCall = setCalls.find((c) => c.ref.id === 'new-feed-log-99');
      expect(feedLogCall).toBeDefined();
      expect(feedLogCall?.data.farmId).toBe('AP12');
      expect(feedLogCall?.data.quantityKg).toBe(300);
      expect(feedLogCall?.data.previousStockKg).toBe(3905);
      expect(feedLogCall?.data.newStockKg).toBe(4205);
      expect(feedLogCall?.data.notes).toBe('Morning delivery');
      expect(feedLogCall?.data.type).toBe('FEED_LOAD');

      // 3. Legacy feedTransaction written
      const txCall = setCalls.find((c) => c.ref.id === 'new-tx-99');
      expect(txCall).toBeDefined();
      expect(txCall?.data.farmId).toBe('AP12');
      expect(txCall?.data.feedKg).toBe(300);
      expect(txCall?.data.type).toBe('FEED_LOAD');
    });
  });

  describe('5. Farm Switching & Isolation', () => {
    it('5.1 should subscribe to the correct farm subcollection when switching farms', () => {
      const docMock = vi.fn().mockImplementation((farmId: string) => ({
        collection: vi.fn().mockReturnValue({
          onSnapshot: vi.fn().mockReturnValue(vi.fn()),
        }),
      }));

      (db.collection as any).mockImplementation((collName: string) => {
        if (collName === 'logs') return { doc: docMock };
        return {};
      });

      // Switch to AP12
      const unsub1 = subscribeToFeedLogsByFarm('AP12', vi.fn());
      expect(docMock).toHaveBeenLastCalledWith('AP12');
      unsub1();

      // Switch to AP14
      const unsub2 = subscribeToFeedLogsByFarm('AP14', vi.fn());
      expect(docMock).toHaveBeenLastCalledWith('AP14');
      unsub2();

      // Switch back to AP12
      const unsub3 = subscribeToFeedLogsByFarm('AP12', vi.fn());
      expect(docMock).toHaveBeenLastCalledWith('AP12');
      unsub3();
    });
  });
});
