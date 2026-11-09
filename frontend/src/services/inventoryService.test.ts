import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  normalizeFeedLogDoc,
  getFeedLogsByFarm,
  subscribeToFeedLogsByFarm,
  addFeedLoad,
  updateFeedLoad,
  deleteFeedLoad,
  isValidFeedQuantityInput,
  validateFeedQuantity,
  MAX_FEED_QUANTITY_KG,
  MAX_FEED_STOCK_KG,
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
        if (collName === 'auditLogs') {
          return { doc: vi.fn().mockReturnValue({ id: 'audit-add-1' }) };
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
      expect(setCalls).toHaveLength(4);

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

  describe('6. Numeric Input & Immediate Typing/Pasting Restriction', () => {
    it('6.1 isValidFeedQuantityInput allows valid formats within 7 digits and 2 decimals', () => {
      expect(isValidFeedQuantityInput('')).toBe(true);
      expect(isValidFeedQuantityInput('0')).toBe(true);
      expect(isValidFeedQuantityInput('500')).toBe(true);
      expect(isValidFeedQuantityInput('9999999.99')).toBe(true);
      expect(isValidFeedQuantityInput('1234567')).toBe(true);
      expect(isValidFeedQuantityInput('1234.5')).toBe(true);
      expect(isValidFeedQuantityInput('1234.56')).toBe(true);
      expect(isValidFeedQuantityInput('.5')).toBe(true);
    });

    it('6.2 isValidFeedQuantityInput rejects excessive digits, negative, and invalid patterns immediately', () => {
      // More than 7 digits before decimal
      expect(isValidFeedQuantityInput('12345678')).toBe(false);
      // More than 2 decimal digits
      expect(isValidFeedQuantityInput('500.123')).toBe(false);
      // Exceeds max feed quantity
      expect(isValidFeedQuantityInput('10000000')).toBe(false);
      // Negative
      expect(isValidFeedQuantityInput('-5')).toBe(false);
      expect(isValidFeedQuantityInput('-0.5')).toBe(false);
      // Scientific notation and characters
      expect(isValidFeedQuantityInput('1e5')).toBe(false);
      expect(isValidFeedQuantityInput('abc')).toBe(false);
      expect(isValidFeedQuantityInput('500 kg')).toBe(false);
      expect(isValidFeedQuantityInput('..')).toBe(false);
    });

    it('6.3 validateFeedQuantity validates submission values and limits', () => {
      // Valid
      const valid = validateFeedQuantity('500.5', 1000);
      expect(valid.valid).toBe(true);
      expect(valid.quantity).toBe(500.5);
      expect(valid.resultingStock).toBe(1500.5);

      // Empty or 0
      expect(validateFeedQuantity('').valid).toBe(false);
      expect(validateFeedQuantity('0').valid).toBe(false);
      expect(validateFeedQuantity('-10').valid).toBe(false);

      // Resulting stock total overflow protection
      const overflow = validateFeedQuantity('200', 9999900);
      expect(overflow.valid).toBe(false);
      expect(overflow.error).toContain('would exceed the maximum allowable limit');

      // Oversized existing stock does not crash and rejects further additions
      const alreadyOversized = validateFeedQuantity('10', 10000000);
      expect(alreadyOversized.valid).toBe(false);
      expect(alreadyOversized.error).toContain('would exceed the maximum allowable limit');
    });
  });

  describe('7. Edit Feed Load & Stock Reconciliation', () => {
    it('7.1 should update feed log and adjust farm stock by difference', async () => {
      const mockFarmSnap = {
        exists: true,
        data: () => ({
          farmId: 'AP12',
          currentFeedKg: 1000,
          totalFeedLoadedKg: 2000,
        }),
      };

      const mockLogSnap = {
        exists: true,
        data: () => ({
          logId: 'log-1',
          farmId: 'AP12',
          quantityKg: 200,
          newStockKg: 1000,
          notes: 'Old note',
          createdByUid: 'admin-1',
          recordedBy: 'admin-1',
        }),
      };

      const farmRef = {
        id: 'AP12',
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({ id: 'tx-edit-1' }),
        }),
      };
      const feedLogRef = { id: 'log-1' };
      const auditRef = { id: 'audit-edit-1' };

      (db.collection as any).mockImplementation((collName: string) => {
        if (collName === 'farms') {
          return { doc: vi.fn().mockReturnValue(farmRef) };
        }
        if (collName === 'logs') {
          return {
            doc: vi.fn().mockReturnValue({
              collection: vi.fn().mockReturnValue({
                doc: vi.fn().mockReturnValue(feedLogRef),
              }),
            }),
          };
        }
        if (collName === 'auditLogs') {
          return { doc: vi.fn().mockReturnValue(auditRef) };
        }
        return {};
      });

      const setCalls: { ref: any; data: any; options?: any }[] = [];
      const mockTransaction = {
        get: vi.fn().mockImplementation((ref: any) => {
          if (ref.id === 'AP12') return Promise.resolve(mockFarmSnap);
          if (ref.id === 'log-1') return Promise.resolve(mockLogSnap);
          return Promise.resolve({ exists: false });
        }),
        set: vi.fn().mockImplementation((ref: any, data: any, options?: any) => {
          setCalls.push({ ref, data, options });
        }),
      };

      (db.runTransaction as any).mockImplementation(async (cb: any) => {
        return cb(mockTransaction);
      });

      // Increase quantity from 200 to 300 (+100 diff)
      const res = await updateFeedLoad('AP12', 'log-1', 300, 'Corrected note', 'admin-1', 'admin');

      expect(res.newStockKg).toBe(1100);
      expect(res.diff).toBe(100);

      // Verify farm updated: 1000 + 100 = 1100, total: 2000 + 100 = 2100
      const farmCall = setCalls.find((c) => c.ref.id === 'AP12');
      expect(farmCall?.data.currentFeedKg).toBe(1100);
      expect(farmCall?.data.totalFeedLoadedKg).toBe(2100);

      // Verify log updated
      const logCall = setCalls.find((c) => c.ref.id === 'log-1');
      expect(logCall?.data.quantityKg).toBe(300);
      expect(logCall?.data.notes).toBe('Corrected note');
      expect(logCall?.data.newStockKg).toBe(1100);
    });

    it('7.2 should reject edit when reduction would cause negative stock', async () => {
      const mockFarmSnap = {
        exists: true,
        data: () => ({
          farmId: 'AP12',
          currentFeedKg: 50, // only 50 left in stock
          totalFeedLoadedKg: 500,
        }),
      };

      const mockLogSnap = {
        exists: true,
        data: () => ({
          logId: 'log-1',
          farmId: 'AP12',
          quantityKg: 200, // reducing to 100 would subtract 100 from 50 -> negative!
          createdByUid: 'admin-1',
          recordedBy: 'admin-1',
        }),
      };

      const mockTransaction = {
        get: vi.fn().mockImplementation((ref: any) => {
          if (ref.id === 'AP12') return Promise.resolve(mockFarmSnap);
          if (ref.id === 'log-1') return Promise.resolve(mockLogSnap);
          return Promise.resolve({ exists: false });
        }),
        set: vi.fn(),
      };

      (db.runTransaction as any).mockImplementation(async (cb: any) => cb(mockTransaction));

      await expect(
        updateFeedLoad('AP12', 'log-1', 100, '', 'admin-1', 'admin')
      ).rejects.toThrow('INSUFFICIENT_STOCK_FOR_UPDATE');
    });

    it('7.3 should reject edit for unauthorized supervisor or non-admin', async () => {
      // Supervisor not assigned to AP12
      await expect(
        updateFeedLoad('AP12', 'log-1', 250, '', 'sup-1', 'supervisor', ['AP14'])
      ).rejects.toThrow('PERMISSION_DENIED');

      // Farmer role
      await expect(
        updateFeedLoad('AP12', 'log-1', 250, '', 'farmer-1', 'farmer', ['AP12'])
      ).rejects.toThrow('PERMISSION_DENIED');
    });
  });

  describe('8. Delete Feed Load & Stock Reconcile Without Double Deduction', () => {
    it('8.1 should delete feed log and deduct quantity exactly once from current and total stock', async () => {
      const mockFarmSnap = {
        exists: true,
        data: () => ({
          farmId: 'AP12',
          currentFeedKg: 1000,
          totalFeedLoadedKg: 2000,
        }),
      };

      const mockLogSnap = {
        exists: true,
        data: () => ({
          logId: 'log-1',
          farmId: 'AP12',
          quantityKg: 300,
          createdByUid: 'admin-1',
          recordedBy: 'admin-1',
        }),
      };

      const farmRef = {
        id: 'AP12',
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({ id: 'tx-del-1' }),
        }),
      };
      const feedLogRef = { id: 'log-1' };
      const auditRef = { id: 'audit-del-1' };

      (db.collection as any).mockImplementation((collName: string) => {
        if (collName === 'farms') return { doc: vi.fn().mockReturnValue(farmRef) };
        if (collName === 'logs') {
          return {
            doc: vi.fn().mockReturnValue({
              collection: vi.fn().mockReturnValue({
                doc: vi.fn().mockReturnValue(feedLogRef),
              }),
            }),
          };
        }
        if (collName === 'auditLogs') {
          return { doc: vi.fn().mockReturnValue(auditRef) };
        }
        return {};
      });

      const setCalls: { ref: any; data: any; options?: any }[] = [];
      const deleteCalls: any[] = [];
      const mockTransaction = {
        get: vi.fn().mockImplementation((ref: any) => {
          if (ref.id === 'AP12') return Promise.resolve(mockFarmSnap);
          if (ref.id === 'log-1') return Promise.resolve(mockLogSnap);
          return Promise.resolve({ exists: false });
        }),
        set: vi.fn().mockImplementation((ref: any, data: any, options?: any) => {
          setCalls.push({ ref, data, options });
        }),
        delete: vi.fn().mockImplementation((ref: any) => {
          deleteCalls.push(ref);
        }),
      };

      (db.runTransaction as any).mockImplementation(async (cb: any) => cb(mockTransaction));

      const res = await deleteFeedLoad('AP12', 'log-1', 'admin-1', 'admin');

      expect(res.newStockKg).toBe(700); // 1000 - 300 = 700 exactly
      expect(res.deletedQuantityKg).toBe(300);

      // 3 set calls (farm, feedTransactions, auditLogs) and 1 log delete call
      expect(setCalls).toHaveLength(3);
      expect(setCalls[0].data.currentFeedKg).toBe(700);
      expect(setCalls[0].data.totalFeedLoadedKg).toBe(1700);

      expect(deleteCalls).toHaveLength(1);
      expect(deleteCalls[0].id).toBe('log-1');
    });

    it('8.2 should reject delete when current stock is less than deleted quantity', async () => {
      const mockFarmSnap = {
        exists: true,
        data: () => ({
          farmId: 'AP12',
          currentFeedKg: 100, // only 100 left
          totalFeedLoadedKg: 1000,
        }),
      };

      const mockLogSnap = {
        exists: true,
        data: () => ({
          logId: 'log-1',
          farmId: 'AP12',
          quantityKg: 250, // deleting 250 would make stock negative (-150)
          createdByUid: 'admin-1',
          recordedBy: 'admin-1',
        }),
      };

      const farmRef84 = {
        id: 'AP12',
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({ id: 'tx-84' }),
        }),
      };
      const feedLogRef84 = { id: 'log-1' };
      const auditRef84 = { id: 'audit-84' };

      (db.collection as any).mockImplementation((collName: string) => {
        if (collName === 'farms') return { doc: vi.fn().mockReturnValue(farmRef84) };
        if (collName === 'logs') {
          return {
            doc: vi.fn().mockReturnValue({
              collection: vi.fn().mockReturnValue({
                doc: vi.fn().mockReturnValue(feedLogRef84),
              }),
            }),
          };
        }
        if (collName === 'auditLogs') {
          return { doc: vi.fn().mockReturnValue(auditRef84) };
        }
        return {};
      });

      const mockTransaction = {
        get: vi.fn().mockImplementation((ref: any) => {
          if (ref.id === 'AP12') return Promise.resolve(mockFarmSnap);
          if (ref.id === 'log-1') return Promise.resolve(mockLogSnap);
          return Promise.resolve({ exists: false });
        }),
        set: vi.fn(),
        delete: vi.fn(),
      };

      (db.runTransaction as any).mockImplementation(async (cb: any) => cb(mockTransaction));

      await expect(
        deleteFeedLoad('AP12', 'log-1', 'admin-1', 'admin')
      ).rejects.toThrow('INSUFFICIENT_STOCK_FOR_DELETION');
    });

    it('8.3 should reject delete for unauthorized users', async () => {
      // Supervisor unassigned
      await expect(
        deleteFeedLoad('AP12', 'log-1', 'sup-1', 'supervisor', ['AP15'])
      ).rejects.toThrow('PERMISSION_DENIED');

      // Farmer
      await expect(
        deleteFeedLoad('AP12', 'log-1', 'farmer-1', 'farmer', ['AP12'])
      ).rejects.toThrow('PERMISSION_DENIED');
    });

    it('8.4 should allow supervisor assigned to farm to edit and delete', async () => {
      const mockFarmSnap = {
        exists: true,
        data: () => ({
          farmId: 'AP12',
          currentFeedKg: 1000,
          totalFeedLoadedKg: 2000,
        }),
      };

      const mockLogSnap = {
        exists: true,
        data: () => ({
          logId: 'log-1',
          farmId: 'AP12',
          quantityKg: 200,
          createdByUid: 'sup-1',
          recordedBy: 'sup-1',
        }),
      };

      const mockTransaction = {
        get: vi.fn().mockImplementation((ref: any) => {
          if (ref.id === 'AP12') return Promise.resolve(mockFarmSnap);
          if (ref.id === 'log-1') return Promise.resolve(mockLogSnap);
          return Promise.resolve({ exists: false });
        }),
        set: vi.fn(),
        delete: vi.fn(),
      };

      (db.runTransaction as any).mockImplementation(async (cb: any) => cb(mockTransaction));

      // Supervisor assigned to AP12
      const editRes = await updateFeedLoad('AP12', 'log-1', 250, 'sup notes', 'sup-1', 'supervisor', ['AP12', 'AP13']);
      expect(editRes.newStockKg).toBe(1050);

      const delRes = await deleteFeedLoad('AP12', 'log-1', 'sup-1', 'supervisor', ['AP12', 'AP13']);
      expect(delRes.newStockKg).toBe(800);
    });
  });
  describe('9. Audit Trail & Metadata Retention', () => {
    it('9.1 updateFeedLoad should atomically record FEED_LOAD_UPDATED in auditLogs', async () => {
      const mockFarmSnap = {
        exists: true,
        data: () => ({
          farmId: 'AP12',
          currentFeedKg: 1500,
          totalFeedLoadedKg: 2500,
        }),
      };

      const mockLogSnap = {
        exists: true,
        data: () => ({
          logId: 'feed-log-xyz',
          farmId: 'AP12',
          quantityKg: 500,
          loadedAt: '2026-10-10T12:00:00.000Z',
          previousStockKg: 1000,
          newStockKg: 1500,
          notes: 'Original supplier note',
          createdByUid: 'admin-uid-1',
          recordedBy: 'admin-uid-1',
        }),
      };

      const auditRef = { id: 'audit-log-new' };
      const farmRef = {
        id: 'AP12',
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({ id: 'tx-audit-test' }),
        }),
      };
      const feedLogRef = { id: 'feed-log-xyz' };

      (db.collection as any).mockImplementation((collName: string) => {
        if (collName === 'farms') return { doc: vi.fn().mockReturnValue(farmRef) };
        if (collName === 'logs') {
          return {
            doc: vi.fn().mockReturnValue({
              collection: vi.fn().mockReturnValue({
                doc: vi.fn().mockReturnValue(feedLogRef),
              }),
            }),
          };
        }
        if (collName === 'auditLogs') {
          return { doc: vi.fn().mockReturnValue(auditRef) };
        }
        return {};
      });

      const setCalls: { ref: any; data: any; options?: any }[] = [];
      const mockTransaction = {
        get: vi.fn().mockImplementation((ref: any) => {
          if (ref.id === 'AP12') return Promise.resolve(mockFarmSnap);
          if (ref.id === 'feed-log-xyz') return Promise.resolve(mockLogSnap);
          return Promise.resolve({ exists: false });
        }),
        set: vi.fn().mockImplementation((ref: any, data: any, options?: any) => {
          setCalls.push({ ref, data, options });
        }),
      };

      (db.runTransaction as any).mockImplementation(async (cb: any) => cb(mockTransaction));

      await updateFeedLoad('AP12', 'feed-log-xyz', 600, 'Supplier corrected invoice to 600 kg', 'admin-uid-1', 'admin');

      const auditCall = setCalls.find((c) => c.ref.id === 'audit-log-new');
      expect(auditCall).toBeDefined();
      expect(auditCall?.data.eventType).toBe('FEED_LOAD_UPDATED');
      expect(auditCall?.data.action).toBe('UPDATE');
      expect(auditCall?.data.userId).toBe('admin-uid-1');
      expect(auditCall?.data.uid).toBe('admin-uid-1');
      expect(auditCall?.data.farmId).toBe('AP12');
      expect(auditCall?.data.resourceId).toBe('feed-log-xyz');
      expect(auditCall?.data.metadata.diff).toBe(100);
      expect(auditCall?.data.metadata.previousValues.quantityKg).toBe(500);
      expect(auditCall?.data.metadata.updatedValues.quantityKg).toBe(600);
      expect(auditCall?.data.metadata.currentStockBefore).toBe(1500);
      expect(auditCall?.data.metadata.currentStockAfter).toBe(1600);
    });

    it('9.2 deleteFeedLoad should atomically record FEED_LOAD_DELETED in auditLogs', async () => {
      const mockFarmSnap = {
        exists: true,
        data: () => ({
          farmId: 'AP12',
          currentFeedKg: 1000,
          totalFeedLoadedKg: 2000,
        }),
      };

      const mockLogSnap = {
        exists: true,
        data: () => ({
          logId: 'feed-log-del',
          farmId: 'AP12',
          quantityKg: 400,
          loadedAt: '2026-10-12T09:00:00.000Z',
          recordedBy: 'admin-uid-1',
          createdByUid: 'admin-uid-1',
          notes: 'Erroneous batch entry',
        }),
      };

      const auditRef = { id: 'audit-log-del-test' };
      const farmRef = {
        id: 'AP12',
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({ id: 'tx-del-test' }),
        }),
      };
      const feedLogRef = { id: 'feed-log-del' };

      (db.collection as any).mockImplementation((collName: string) => {
        if (collName === 'farms') return { doc: vi.fn().mockReturnValue(farmRef) };
        if (collName === 'logs') {
          return {
            doc: vi.fn().mockReturnValue({
              collection: vi.fn().mockReturnValue({
                doc: vi.fn().mockReturnValue(feedLogRef),
              }),
            }),
          };
        }
        if (collName === 'auditLogs') {
          return { doc: vi.fn().mockReturnValue(auditRef) };
        }
        return {};
      });

      const setCalls: { ref: any; data: any; options?: any }[] = [];
      const deleteCalls: any[] = [];
      const mockTransaction = {
        get: vi.fn().mockImplementation((ref: any) => {
          if (ref.id === 'AP12') return Promise.resolve(mockFarmSnap);
          if (ref.id === 'feed-log-del') return Promise.resolve(mockLogSnap);
          return Promise.resolve({ exists: false });
        }),
        set: vi.fn().mockImplementation((ref: any, data: any, options?: any) => {
          setCalls.push({ ref, data, options });
        }),
        delete: vi.fn().mockImplementation((ref: any) => {
          deleteCalls.push(ref);
        }),
      };

      (db.runTransaction as any).mockImplementation(async (cb: any) => cb(mockTransaction));

      await deleteFeedLoad('AP12', 'feed-log-del', 'admin-uid-1', 'admin');

      const auditCall = setCalls.find((c) => c.ref.id === 'audit-log-del-test');
      expect(auditCall).toBeDefined();
      expect(auditCall?.data.eventType).toBe('FEED_LOAD_DELETED');
      expect(auditCall?.data.action).toBe('DELETE');
      expect(auditCall?.data.userId).toBe('admin-uid-1');
      expect(auditCall?.data.resourceId).toBe('feed-log-del');
      expect(auditCall?.data.metadata.deletedQuantityKg).toBe(400);
      expect(auditCall?.data.metadata.currentStockBefore).toBe(1000);
      expect(auditCall?.data.metadata.currentStockAfter).toBe(600);
    });
  });

  describe('10. Parent Document & Category Isolation', () => {
    it('10.1 deleteFeedLoad deletes only the targeted feedLog document and never touches parent logs or other subcollections', async () => {
      const mockFarmSnap = {
        exists: true,
        data: () => ({ farmId: 'AP12', currentFeedKg: 800, totalFeedLoadedKg: 1000 }),
      };
      const mockLogSnap = {
        exists: true,
        data: () => ({ logId: 'target-log', farmId: 'AP12', quantityKg: 100, createdByUid: 'admin-1', recordedBy: 'admin-1' }),
      };

      const farmRef = {
        id: 'AP12',
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({ id: 'tx-iso' }),
        }),
      };
      const feedLogRef = { id: 'target-log', path: 'logs/AP12/feedLogs/target-log' };
      const auditRef = { id: 'audit-iso' };

      (db.collection as any).mockImplementation((collName: string) => {
        if (collName === 'farms') return { doc: vi.fn().mockReturnValue(farmRef) };
        if (collName === 'logs') {
          return {
            doc: vi.fn().mockReturnValue({
              collection: vi.fn().mockReturnValue({
                doc: vi.fn().mockReturnValue(feedLogRef),
              }),
            }),
          };
        }
        if (collName === 'auditLogs') {
          return { doc: vi.fn().mockReturnValue(auditRef) };
        }
        return {};
      });

      const deleteCalls: any[] = [];

      const mockTransaction = {
        get: vi.fn().mockImplementation((ref: any) => {
          if (ref.id === 'AP12') return Promise.resolve(mockFarmSnap);
          if (ref.id === 'target-log') return Promise.resolve(mockLogSnap);
          return Promise.resolve({ exists: false });
        }),
        set: vi.fn(),
        delete: vi.fn().mockImplementation((ref: any) => {
          deleteCalls.push(ref);
        }),
      };

      (db.runTransaction as any).mockImplementation(async (cb: any) => cb(mockTransaction));

      await deleteFeedLoad('AP12', 'target-log', 'admin-1', 'admin');

      // Exactly 1 delete operation occurred
      expect(deleteCalls).toHaveLength(1);
      // The deleted reference is strictly the target feedLog document
      expect(deleteCalls[0].id).toBe('target-log');
      expect(deleteCalls[0].path).toBe('logs/AP12/feedLogs/target-log');
    });
  });

  describe('11. Record-Level Ownership & Permission Matrix (Issue #04 Record Creator Rules)', () => {
    const setupOwnershipMocks = (logData: any, farmCurrentStock = 1000) => {
      const mockFarmSnap = {
        exists: true,
        data: () => ({
          farmId: 'AP12',
          currentFeedKg: farmCurrentStock,
          totalFeedLoadedKg: 2000,
        }),
      };

      const mockLogSnap = {
        exists: true,
        data: () => logData,
      };

      const farmRef = {
        id: 'AP12',
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({ id: 'tx-1' }),
        }),
      };
      const feedLogRef = { id: logData.logId || 'log-1' };
      const auditRef = { id: 'audit-1' };

      (db.collection as any).mockImplementation((collName: string) => {
        if (collName === 'farms') return { doc: vi.fn().mockReturnValue(farmRef) };
        if (collName === 'logs') {
          return {
            doc: vi.fn().mockReturnValue({
              collection: vi.fn().mockReturnValue({
                doc: vi.fn().mockReturnValue(feedLogRef),
              }),
            }),
          };
        }
        if (collName === 'auditLogs') return { doc: vi.fn().mockReturnValue(auditRef) };
        return {};
      });

      const setCalls: { ref: any; data: any; options?: any }[] = [];
      const deleteCalls: any[] = [];
      const mockTransaction = {
        get: vi.fn().mockImplementation((ref: any) => {
          if (ref.id === 'AP12') return Promise.resolve(mockFarmSnap);
          return Promise.resolve(mockLogSnap);
        }),
        set: vi.fn().mockImplementation((ref: any, data: any, options?: any) => {
          setCalls.push({ ref, data, options });
        }),
        delete: vi.fn().mockImplementation((ref: any) => {
          deleteCalls.push(ref);
        }),
      };

      (db.runTransaction as any).mockImplementation(async (cb: any) => {
        return cb(mockTransaction);
      });

      return { setCalls, deleteCalls };
    };

    it('11.1 Admin A CAN edit and delete Admin A\'s record', async () => {
      const { setCalls, deleteCalls } = setupOwnershipMocks({
        logId: 'admin-log-1',
        farmId: 'AP12',
        quantityKg: 200,
        newStockKg: 1000,
        createdByUid: 'admin-a-uid',
        recordedBy: 'admin-a-uid',
      });

      // Admin A edits Admin A's record -> SUCCESS
      const editRes = await updateFeedLoad('AP12', 'admin-log-1', 250, 'Updated', 'admin-a-uid', 'admin');
      expect(editRes.newStockKg).toBe(1050);

      // Admin A deletes Admin A's record -> SUCCESS
      const delRes = await deleteFeedLoad('AP12', 'admin-log-1', 'admin-a-uid', 'admin');
      expect(delRes.deletedQuantityKg).toBe(200);
      expect(deleteCalls.length).toBe(1);
    });

    it('11.2 Admin A CANNOT edit or delete Supervisor A\'s record', async () => {
      setupOwnershipMocks({
        logId: 'sup-log-1',
        farmId: 'AP12',
        quantityKg: 300,
        newStockKg: 1000,
        createdByUid: 'supervisor-a-uid',
        recordedBy: 'supervisor-a-uid',
      });

      // Admin A attempts to edit Supervisor A's record -> REJECTED
      await expect(
        updateFeedLoad('AP12', 'sup-log-1', 350, 'Admin override', 'admin-a-uid', 'admin')
      ).rejects.toThrow('PERMISSION_DENIED_NOT_CREATOR');

      // Admin A attempts to delete Supervisor A's record -> REJECTED
      await expect(
        deleteFeedLoad('AP12', 'sup-log-1', 'admin-a-uid', 'admin')
      ).rejects.toThrow('PERMISSION_DENIED_NOT_CREATOR');
    });

    it('11.3 Supervisor A CAN edit and delete Supervisor A\'s record on assigned farm', async () => {
      const { setCalls, deleteCalls } = setupOwnershipMocks({
        logId: 'sup-log-1',
        farmId: 'AP12',
        quantityKg: 150,
        newStockKg: 800,
        createdByUid: 'supervisor-a-uid',
        recordedBy: 'supervisor-a-uid',
      });

      // Supervisor A edits own record -> SUCCESS
      const editRes = await updateFeedLoad(
        'AP12',
        'sup-log-1',
        200,
        'Supervisor correction',
        'supervisor-a-uid',
        'supervisor',
        ['AP12']
      );
      expect(editRes.newStockKg).toBe(1050);

      // Supervisor A deletes own record -> SUCCESS
      const delRes = await deleteFeedLoad(
        'AP12',
        'sup-log-1',
        'supervisor-a-uid',
        'supervisor',
        ['AP12']
      );
      expect(delRes.deletedQuantityKg).toBe(150);
      expect(deleteCalls.length).toBe(1);
    });

    it('11.4 Supervisor A CANNOT edit or delete Admin A\'s record', async () => {
      setupOwnershipMocks({
        logId: 'admin-log-1',
        farmId: 'AP12',
        quantityKg: 200,
        createdByUid: 'admin-a-uid',
        recordedBy: 'admin-a-uid',
      });

      // Supervisor A attempts to edit Admin A's record -> REJECTED
      await expect(
        updateFeedLoad('AP12', 'admin-log-1', 250, 'Sup edit', 'supervisor-a-uid', 'supervisor', ['AP12'])
      ).rejects.toThrow('PERMISSION_DENIED_NOT_CREATOR');

      // Supervisor A attempts to delete Admin A's record -> REJECTED
      await expect(
        deleteFeedLoad('AP12', 'admin-log-1', 'supervisor-a-uid', 'supervisor', ['AP12'])
      ).rejects.toThrow('PERMISSION_DENIED_NOT_CREATOR');
    });

    it('11.5 Supervisor B CANNOT edit or delete Supervisor A\'s record', async () => {
      setupOwnershipMocks({
        logId: 'sup-a-log',
        farmId: 'AP12',
        quantityKg: 200,
        createdByUid: 'supervisor-a-uid',
        recordedBy: 'supervisor-a-uid',
      });

      // Supervisor B attempts to edit Supervisor A's record -> REJECTED
      await expect(
        updateFeedLoad('AP12', 'sup-a-log', 250, 'B edit', 'supervisor-b-uid', 'supervisor', ['AP12'])
      ).rejects.toThrow('PERMISSION_DENIED_NOT_CREATOR');

      // Supervisor B attempts to delete Supervisor A's record -> REJECTED
      await expect(
        deleteFeedLoad('AP12', 'sup-a-log', 'supervisor-b-uid', 'supervisor', ['AP12'])
      ).rejects.toThrow('PERMISSION_DENIED_NOT_CREATOR');
    });

    it('11.6 Farmer role CANNOT edit or delete any feed-load record', async () => {
      setupOwnershipMocks({
        logId: 'any-log',
        farmId: 'AP12',
        quantityKg: 200,
        createdByUid: 'farmer-uid',
        recordedBy: 'farmer-uid',
      });

      // Farmer attempts to edit -> REJECTED with PERMISSION_DENIED
      await expect(
        updateFeedLoad('AP12', 'any-log', 250, 'Farmer edit', 'farmer-uid', 'farmer', ['AP12'])
      ).rejects.toThrow('PERMISSION_DENIED');

      // Farmer attempts to delete -> REJECTED with PERMISSION_DENIED
      await expect(
        deleteFeedLoad('AP12', 'any-log', 'farmer-uid', 'farmer', ['AP12'])
      ).rejects.toThrow('PERMISSION_DENIED');
    });

    it('11.7 Feed load records with unverified ownership CANNOT be edited or deleted', async () => {
      // Record without createdByUid and without recordedBy (or with generic placeholder 'Admin')
      setupOwnershipMocks({
        logId: 'unverified-log',
        farmId: 'AP12',
        quantityKg: 200,
        notes: 'Legacy unverified record',
      });

      // Even Admin cannot edit an unverified record
      await expect(
        updateFeedLoad('AP12', 'unverified-log', 250, 'Admin try', 'admin-a-uid', 'admin')
      ).rejects.toThrow('UNVERIFIED_RECORD_OWNERSHIP');

      // Even Admin cannot delete an unverified record
      await expect(
        deleteFeedLoad('AP12', 'unverified-log', 'admin-a-uid', 'admin')
      ).rejects.toThrow('UNVERIFIED_RECORD_OWNERSHIP');
    });

    it('11.8 Editing a feed load record strictly preserves immutable createdByUid and recordedBy', async () => {
      const { setCalls } = setupOwnershipMocks({
        logId: 'admin-log-1',
        farmId: 'AP12',
        quantityKg: 200,
        newStockKg: 1000,
        createdByUid: 'admin-a-uid',
        recordedBy: 'admin-a-uid',
      });

      await updateFeedLoad('AP12', 'admin-log-1', 250, 'Updated notes', 'admin-a-uid', 'admin');

      const logSetCall = setCalls.find((c) => c.ref.id === 'admin-log-1');
      expect(logSetCall).toBeDefined();
      expect(logSetCall.data.createdByUid).toBe('admin-a-uid');
      expect(logSetCall.data.recordedBy).toBe('admin-a-uid');
      expect(logSetCall.data.quantityKg).toBe(250);
      expect(logSetCall.data.updatedBy).toBe('admin-a-uid');
    });

    it('11.9 Records with conflicting creator metadata (createdByUid != recordedBy) are locked permanently', async () => {
      setupOwnershipMocks({
        logId: 'conflict-log',
        farmId: 'AP12',
        quantityKg: 200,
        createdByUid: 'admin-a-uid',
        recordedBy: 'sup-a-uid', // conflicting metadata
      });

      // Update is blocked
      await expect(
        updateFeedLoad('AP12', 'conflict-log', 250, 'Attempt update', 'admin-a-uid', 'admin')
      ).rejects.toThrow('UNVERIFIED_RECORD_OWNERSHIP');

      // Delete is blocked
      await expect(
        deleteFeedLoad('AP12', 'conflict-log', 'admin-a-uid', 'admin')
      ).rejects.toThrow('UNVERIFIED_RECORD_OWNERSHIP');
    });
  });
});
