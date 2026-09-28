import { describe, it, expect, vi, beforeEach } from 'vitest';
import { importService } from './import.service';
import { AuthenticatedUser, UserRole } from '../types/auth';

// Mock dependencies
vi.mock('../config/firebase', () => ({
  getFirestore: vi.fn(),
  getAuth: vi.fn(),
  initializeFirebase: vi.fn(),
}));

vi.mock('../config/environment', () => ({
  getEnv: vi.fn().mockReturnValue({
    FIREBASE_PROJECT_ID: 'test-project',
    PORT: 3000,
    NODE_ENV: 'test',
    ALLOWED_ORIGINS: '*',
    RATE_LIMIT_WINDOW_MS: 900000,
    RATE_LIMIT_MAX_REQUESTS: 100,
    LOG_LEVEL: 'info',
  }),
}));

import { getFirestore } from '../config/firebase';

describe('ImportService', () => {
  let mockDb: any;
  let mockBatch: any;
  const adminUser: AuthenticatedUser = {
    uid: 'admin-1',
    email: 'admin@happyfarm.com',
    role: UserRole.ADMIN,
    farmIds: ['AP12', 'AP13'],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockBatch = {
      set: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined),
    };

    mockDb = {
      collection: vi.fn(),
      collectionGroup: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({ docs: [] }),
      }),
      batch: vi.fn().mockReturnValue(mockBatch),
    };

    (getFirestore as any).mockReturnValue(mockDb);
  });

  describe('checkConflicts', () => {
    it('should classify non-existent records as NEW', async () => {
      // Mock dailyReportLocks and dailyReports empty queries
      mockDb.collection.mockReturnValue({
        where: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ docs: [] }),
        }),
      });

      const res = await importService.checkConflicts(
        {
          records: [
            {
              recordType: 'DAILY_REPORT',
              farmId: 'AP12',
              submissionDate: '2026-01-10',
              birdCount: 1000,
              feedKg: 120,
              mortality: 2,
              culling: 1,
              eggsProduced: 950,
              selectionEggs: 10,
              sourceFile: 'history.csv',
              sourceRow: 2,
            },
          ],
        },
        adminUser,
        'req-1',
      );

      expect(res.results).toHaveLength(1);
      expect(res.results[0]!.status).toBe('NEW');
      expect(res.summary.newCount).toBe(1);
      expect(res.summary.exactDuplicateCount).toBe(0);
      expect(res.summary.conflictCount).toBe(0);
    });

    it('should classify matching records as EXACT_DUPLICATE', async () => {
      mockDb.collection.mockImplementation((name: string) => {
        if (name === 'dailyReportLocks') {
          return {
            where: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                docs: [
                  {
                    data: () => ({ farmId: 'AP12', submissionDate: '2026-01-10' }),
                  },
                ],
              }),
            }),
          };
        }
        if (name === 'dailyReports') {
          return {
            where: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                docs: [
                  {
                    data: () => ({
                      farmId: 'AP12',
                      submissionDate: '2026-01-10',
                      birdCount: 1000,
                      feedKg: 120,
                      mortality: 2,
                      culling: 1,
                      eggsProduced: 950,
                      selectionEggs: 10,
                    }),
                  },
                ],
              }),
            }),
          };
        }
        return {
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({ docs: [] }),
          }),
        };
      });

      const res = await importService.checkConflicts(
        {
          records: [
            {
              recordType: 'DAILY_REPORT',
              farmId: 'AP12',
              submissionDate: '2026-01-10',
              birdCount: 1000,
              feedKg: 120,
              mortality: 2,
              culling: 1,
              eggsProduced: 950,
              selectionEggs: 10,
              sourceFile: 'history.csv',
              sourceRow: 2,
            },
          ],
        },
        adminUser,
        'req-2',
      );

      expect(res.results).toHaveLength(1);
      expect(res.results[0]!.status).toBe('EXACT_DUPLICATE');
      expect(res.summary.exactDuplicateCount).toBe(1);
    });

    it('should classify differing records as CONFLICT with a diff', async () => {
      mockDb.collection.mockImplementation((name: string) => {
        if (name === 'dailyReportLocks') {
          return {
            where: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                docs: [
                  {
                    data: () => ({ farmId: 'AP12', submissionDate: '2026-01-10' }),
                  },
                ],
              }),
            }),
          };
        }
        if (name === 'dailyReports') {
          return {
            where: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                docs: [
                  {
                    data: () => ({
                      farmId: 'AP12',
                      submissionDate: '2026-01-10',
                      birdCount: 980,
                      feedKg: 120,
                      mortality: 5,
                      culling: 0,
                      eggsProduced: 920,
                    }),
                  },
                ],
              }),
            }),
          };
        }
        return {
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({ docs: [] }),
          }),
        };
      });

      const res = await importService.checkConflicts(
        {
          records: [
            {
              recordType: 'DAILY_REPORT',
              farmId: 'AP12',
              submissionDate: '2026-01-10',
              birdCount: 1000, // Differs from 980
              feedKg: 120,
              mortality: 2, // Differs from 5
              culling: 0,
              eggsProduced: 950, // Differs from 920
              sourceFile: 'history.csv',
              sourceRow: 2,
            },
          ],
        },
        adminUser,
        'req-3',
      );

      expect(res.results).toHaveLength(1);
      expect(res.results[0]!.status).toBe('CONFLICT');
      expect(res.results[0]!.diff).toHaveProperty('birdCount');
      expect(res.results[0]!.diff?.['birdCount']?.existing).toBe(980);
      expect(res.results[0]!.diff?.['birdCount']?.proposed).toBe(1000);
      expect(res.summary.conflictCount).toBe(1);
    });
  });

  describe('executeImport', () => {
    it('should flag errors when farm does not exist', async () => {
      mockDb.collection.mockImplementation((name: string) => {
        if (name === 'farms') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({ exists: false }),
            }),
          };
        }
        if (name === 'users') {
          return {
            where: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({ docs: [] }),
            }),
          };
        }
        return {
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({ docs: [] }),
          }),
          doc: vi.fn().mockReturnValue({
            set: vi.fn().mockResolvedValue(undefined),
          }),
          add: vi.fn().mockResolvedValue({ id: 'audit-1' }),
        };
      });

      const res = await importService.executeImport(
        {
          batchId: 'test-batch-1',
          records: [
            {
              recordType: 'DAILY_REPORT',
              farmId: 'UNKNOWN_FARM',
              submissionDate: '2026-01-10',
              birdCount: 1000,
              sourceFile: 'file.csv',
              sourceRow: 1,
            },
          ],
          conflictAction: 'skip',
          sourceFiles: ['file.csv'],
        },
        adminUser,
        'req-4',
      );

      expect(res.importedCount).toBe(0);
      expect(res.failedCount).toBe(1);
      expect(res.errors[0]?.reason).toContain("Farm 'UNKNOWN_FARM' does not exist");
      expect(res.status).toBe('FAILED');
    });

    it('should successfully write valid daily report records in batch without double-counting', async () => {
      mockDb.collection.mockImplementation((name: string) => {
        if (name === 'farms') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: true,
                data: () => ({ farmId: 'AP12', name: 'Farm AP 12', currentBirdCount: 990 }),
              }),
            }),
          };
        }
        if (name === 'users') {
          return {
            where: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                docs: [
                  {
                    id: 'farmer-12',
                    data: () => ({ role: 'farmer', farmIds: ['AP12'] }),
                  },
                ],
              }),
            }),
          };
        }
        if (name === 'dailyReportLocks' || name === 'dailyReports') {
          return {
            where: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({ docs: [] }),
            }),
            doc: vi.fn().mockReturnValue({
              collection: vi.fn().mockReturnValue({
                doc: vi.fn().mockReturnValue({}),
              }),
            }),
          };
        }
        if (name === 'importBatches') {
          return {
            doc: vi.fn().mockReturnValue({
              set: vi.fn().mockResolvedValue(undefined),
            }),
          };
        }
        if (name === 'auditLogs') {
          return {
            add: vi.fn().mockResolvedValue({ id: 'audit-log-1' }),
          };
        }
        return {
          doc: vi.fn().mockReturnValue({
            collection: vi.fn().mockReturnValue({
              doc: vi.fn().mockReturnValue({}),
            }),
            set: vi.fn().mockResolvedValue(undefined),
          }),
        };
      });

      const res = await importService.executeImport(
        {
          batchId: 'test-batch-2',
          records: [
            {
              recordType: 'DAILY_REPORT',
              farmId: 'AP12',
              submissionDate: '2025-10-01',
              birdCount: 1000,
              feedKg: 120,
              mortality: 3,
              culling: 0,
              eggsProduced: 960,
              selectionEggs: 12,
              sourceFile: 'historical_AP12.csv',
              sourceRow: 2,
            },
          ],
          conflictAction: 'skip',
          sourceFiles: ['historical_AP12.csv'],
        },
        adminUser,
        'req-5',
      );

      expect(res.importedCount).toBe(1);
      expect(res.failedCount).toBe(0);
      expect(res.status).toBe('COMPLETED');
      expect(mockBatch.commit).toHaveBeenCalled();

      // Ensure that farms/{farmId}.currentBirdCount was NOT mutated
      const farmDocCalls = mockBatch.set.mock.calls.filter((call: any) =>
        call[0]?.path?.startsWith?.('farms/AP12') && !call[0]?.path?.includes?.('Transactions'),
      );
      expect(farmDocCalls).toHaveLength(0);
    });

    it('should skip duplicate records and respect conflictAction=skip', async () => {
      mockDb.collection.mockImplementation((name: string) => {
        if (name === 'farms') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: true,
                data: () => ({ farmId: 'AP12' }),
              }),
            }),
          };
        }
        if (name === 'users') {
          return {
            where: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({ docs: [] }),
            }),
          };
        }
        if (name === 'dailyReportLocks') {
          return {
            where: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                docs: [
                  {
                    data: () => ({
                      farmId: 'AP12',
                      submissionDate: '2025-10-01',
                      birdCount: 1000,
                      feedKg: 120,
                      mortality: 3,
                      culling: 0,
                      eggsProduced: 960,
                    }),
                  },
                ],
              }),
            }),
          };
        }
        if (name === 'dailyReports') {
          return {
            where: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                docs: [
                  {
                    data: () => ({
                      farmId: 'AP12',
                      submissionDate: '2025-10-01',
                      birdCount: 1000,
                      feedKg: 120,
                      mortality: 3,
                      culling: 0,
                      eggsProduced: 960,
                    }),
                  },
                ],
              }),
            }),
          };
        }
        if (name === 'importBatches') {
          return {
            doc: vi.fn().mockReturnValue({
              set: vi.fn().mockResolvedValue(undefined),
            }),
          };
        }
        if (name === 'auditLogs') {
          return {
            add: vi.fn().mockResolvedValue({ id: 'audit-log-1' }),
          };
        }
        return {
          doc: vi.fn().mockReturnValue({
            collection: vi.fn().mockReturnValue({
              doc: vi.fn().mockReturnValue({}),
            }),
          }),
        };
      });

      const res = await importService.executeImport(
        {
          batchId: 'test-batch-3',
          records: [
            {
              recordType: 'DAILY_REPORT',
              farmId: 'AP12',
              submissionDate: '2025-10-01',
              birdCount: 1000,
              feedKg: 120,
              mortality: 3,
              culling: 0,
              eggsProduced: 960,
              sourceFile: 'dup.csv',
              sourceRow: 2,
            },
          ],
          conflictAction: 'skip',
          sourceFiles: ['dup.csv'],
        },
        adminUser,
        'req-6',
      );

      expect(res.importedCount).toBe(0);
      expect(res.duplicateCount).toBe(1);
      expect(res.skippedCount).toBe(1);
    });
  });

  describe('getRevertPreview', () => {
    it('should throw NotFoundError if batch does not exist', async () => {
      mockDb.collection.mockReturnValue({
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ exists: false }),
        }),
      });

      await expect(
        importService.getRevertPreview('non-existent-batch', adminUser, 'req-preview-1'),
      ).rejects.toThrow('Import batch \'non-existent-batch\' not found');
    });

    it('should return isReversible=false if batch is already REVERTED', async () => {
      mockDb.collection.mockReturnValue({
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({
              batchId: 'batch-reverted',
              revertStatus: 'REVERTED',
              importTimestamp: '2026-01-01T00:00:00.000Z',
              filenames: ['data.csv'],
              affectedFarms: ['AP12'],
              importedCount: 10,
            }),
          }),
        }),
      });

      const res = await importService.getRevertPreview('batch-reverted', adminUser, 'req-preview-2');
      expect(res.isReversible).toBe(false);
      expect(res.revertStatus).toBe('REVERTED');
      expect(res.notReversibleReason).toContain('already been reverted');
    });

    it('should calculate canSafelyRevert, willDelete, and willRestore from manifest', async () => {
      const mockManifest = [
        {
          recordType: 'DAILY_REPORT',
          action: 'CREATED',
          farmId: 'AP12',
          submissionDate: '2026-01-15',
          targetDocs: [{ collectionPath: 'dailyReportLocks', docId: 'AP12_2026-01-15' }],
          importedAt: '2026-01-15T10:00:00.000Z',
          submissionVersion: 1,
        },
        {
          recordType: 'DAILY_REPORT',
          action: 'UPDATED',
          farmId: 'AP12',
          submissionDate: '2026-01-16',
          targetDocs: [{ collectionPath: 'dailyReportLocks', docId: 'AP12_2026-01-16' }],
          beforeData: { farmId: 'AP12', submissionDate: '2026-01-16', birdCount: 950 },
          importedAt: '2026-01-15T10:00:00.000Z',
          submissionVersion: 2,
        },
      ];

      mockDb.collection.mockReturnValue({
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({
              batchId: 'batch-preview-3',
              revertStatus: 'NOT_REVERTED',
              importTimestamp: '2026-01-15T10:00:00.000Z',
              filenames: ['test.csv'],
              affectedFarms: ['AP12'],
              importedCount: 2,
              manifest: mockManifest,
            }),
          }),
        }),
      });

      mockDb.doc = vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            importBatchId: 'batch-preview-3',
            submissionVersion: 1,
          }),
        }),
      });

      const res = await importService.getRevertPreview('batch-preview-3', adminUser, 'req-preview-3');
      expect(res.isReversible).toBe(true);
      expect(res.totalImported).toBe(2);
      expect(res.canSafelyRevert).toBe(2);
      expect(res.willDelete).toBe(1);
      expect(res.willRestore).toBe(1);
      expect(res.requiresReview).toBe(0);
      expect(res.sampleRecords).toHaveLength(2);
    });
  });

  describe('revertImportBatch', () => {
    it('should reject revert if confirmationBatchId does not match batchId', async () => {
      await expect(
        importService.revertImportBatch(
          'batch-target',
          { confirmationBatchId: 'wrong-batch' },
          adminUser,
          'req-revert-1',
        ),
      ).rejects.toThrow('Confirmation batch ID mismatch');
    });

    it('should reject revert if batch is already REVERTED', async () => {
      mockDb.collection.mockReturnValue({
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({
              batchId: 'batch-already-rev',
              revertStatus: 'REVERTED',
            }),
          }),
        }),
      });

      await expect(
        importService.revertImportBatch(
          'batch-already-rev',
          { confirmationBatchId: 'batch-already-rev' },
          adminUser,
          'req-revert-2',
        ),
      ).rejects.toThrow('This batch has already been reverted');
    });

    it('should safely delete created records and restore updated records', async () => {
      const updateFn = vi.fn().mockResolvedValue(undefined);
      const batchDocRef = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            batchId: 'batch-revert-exec',
            revertStatus: 'NOT_REVERTED',
            importTimestamp: '2026-01-10T12:00:00.000Z',
            manifest: [
              {
                recordType: 'DAILY_REPORT',
                action: 'CREATED',
                farmId: 'AP12',
                submissionDate: '2026-01-10',
                targetDocs: [{ collectionPath: 'dailyReportLocks', docId: 'AP12_2026-01-10' }],
                importedAt: '2026-01-10T12:00:00.000Z',
                submissionVersion: 1,
              },
              {
                recordType: 'DAILY_REPORT',
                action: 'UPDATED',
                farmId: 'AP12',
                submissionDate: '2026-01-11',
                targetDocs: [{ collectionPath: 'dailyReportLocks', docId: 'AP12_2026-01-11' }],
                beforeData: { farmId: 'AP12', submissionDate: '2026-01-11', birdCount: 990 },
                importedAt: '2026-01-10T12:00:00.000Z',
                submissionVersion: 2,
              },
            ],
          }),
        }),
        update: updateFn,
      };

      mockDb.collection.mockImplementation((col: string) => {
        if (col === 'importBatches') {
          return { doc: vi.fn().mockReturnValue(batchDocRef) };
        }
        if (col === 'auditLogs') {
          return { add: vi.fn().mockResolvedValue({ id: 'audit-1' }) };
        }
        return { doc: vi.fn().mockReturnValue({}) };
      });

      mockDb.doc = vi.fn().mockImplementation((path: string) => ({
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            importBatchId: 'batch-revert-exec',
            submissionVersion: path.includes('2026-01-10') ? 1 : 2,
          }),
        }),
      }));

      const res = await importService.revertImportBatch(
        'batch-revert-exec',
        { confirmationBatchId: 'batch-revert-exec' },
        adminUser,
        'req-revert-exec-1',
      );

      expect(res.status).toBe('REVERTED');
      expect(res.deletedCount).toBe(1);
      expect(res.restoredCount).toBe(1);
      expect(res.conflictCount).toBe(0);
      expect(res.failedCount).toBe(0);
      expect(mockBatch.delete).toHaveBeenCalledTimes(1);
      expect(mockBatch.set).toHaveBeenCalledTimes(1);
      expect(mockBatch.commit).toHaveBeenCalled();
      expect(updateFn).toHaveBeenCalledWith(
        expect.objectContaining({
          revertStatus: 'REVERTED',
        }),
      );
    });
  });
});
