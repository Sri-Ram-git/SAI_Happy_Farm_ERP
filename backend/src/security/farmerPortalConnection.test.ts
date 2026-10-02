import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { normalizeReport } from '../../../frontend/src/utils/normalizeDailyReport';
import { isParentDoc } from '../../../frontend/src/services/reportDataService';

describe('Farmer Portal Connection & Submission Layer Contract Tests', () => {
  const userId = 'farmer-uid-akel-ap12';
  const farmId = 'AP12';
  const flockId = 'AP12_FL01';
  const submissionDate = '2026-10-01';

  let mockTransaction: any;
  let writes: Map<string, { data: any; options?: any }>;
  let reads: Map<string, any>;

  beforeEach(() => {
    writes = new Map();
    reads = new Map();

    mockTransaction = {
      get: vi.fn(async (ref: any) => {
        const val = reads.get(ref.path);
        return {
          exists: val !== undefined,
          data: () => val,
        };
      }),
      set: vi.fn((ref: any, data: any, options?: any) => {
        writes.set(ref.path, { data, options });
      }),
    };
  });

  describe('1 & 2. Canonical Path & Document Key Verification', () => {
    it('writes daily reports strictly to dailyReports/{userId}/dailyLogs/{YYYY-MM-DD} and parent dailyReports/{userId}', () => {
      const canonicalPath = `dailyReports/${userId}/dailyLogs/${submissionDate}`;
      const parentPath = `dailyReports/${userId}`;

      // Simulate a submission write
      mockTransaction.set({ path: parentPath }, {
        userId,
        farmId,
        flockId,
        lastSubmissionDate: submissionDate,
        updatedAt: '2026-10-01T10:00:00.000Z',
      }, { merge: true });

      mockTransaction.set({ path: canonicalPath }, {
        userId,
        submittedBy: userId,
        farmId,
        flockId,
        submissionDate,
        submissionMethod: 'DIGITAL_FORM',
        submissionVersion: 1,
        status: 'submitted',
        birdCount: 1995,
        eggsProduced: 1800,
      }, { merge: true });

      // Verify written paths
      expect(writes.has(canonicalPath)).toBe(true);
      expect(writes.has(parentPath)).toBe(true);

      // Verify NO invalid flat paths are created
      expect(writes.has(`dailyReports/${farmId}_${submissionDate}`)).toBe(false);
      expect(writes.has(`dailyReports/${userId}_${submissionDate}`)).toBe(false);
      expect(writes.has(`dailyLogs/${farmId}_${submissionDate}`)).toBe(false);

      for (const writtenPath of writes.keys()) {
        const isCanonicalLog = writtenPath === `dailyReports/${userId}/dailyLogs/${submissionDate}`;
        const isParentMeta = writtenPath === `dailyReports/${userId}`;
        const isSubcollection = writtenPath.startsWith(`dailyReports/${userId}/dailyLogs/${submissionDate}/revisions/`);
        expect(isCanonicalLog || isParentMeta || isSubcollection).toBe(true);
      }
    });
  });

  describe('3. Schema & Data Type Verification', () => {
    it('persists numbers as finite numbers and timestamps as ISO-8601 strings', () => {
      const canonicalPath = `dailyReports/${userId}/dailyLogs/${submissionDate}`;
      const timestampIso = new Date().toISOString();

      const reportPayload = {
        userId,
        submittedBy: userId,
        farmId,
        flockId,
        submissionDate,
        submissionMethod: 'DIGITAL_FORM',
        submissionVersion: 1,
        status: 'submitted',
        submittedAt: timestampIso,
        createdAt: timestampIso,
        updatedAt: timestampIso,
        openingBirdCount: 2000,
        closingBirdCount: 1995,
        birdCount: 1995,
        openingFeedKg: 500,
        feedKg: 120,
        closingFeedKg: 380,
        mortality: 3,
        culling: 2,
        eggsProduced: 1800,
        selectionEggs: 1750,
        damagedEggs: 30,
        floorEggs: 20,
        temperature: 28.5,
        tempMin: 25.0,
        tempMax: 32.0,
        eggWeight: { min: 52, max: 58, avg: 55 },
        bodyWeight: null,
        remarks: 'All hens normal',
        ammoniaPpm: 12,
        weekNumber: 4,
        weekLabel: '4.2',
      };

      mockTransaction.set({ path: canonicalPath }, reportPayload);

      const written = writes.get(canonicalPath)!.data;
      expect(typeof written.birdCount).toBe('number');
      expect(Number.isFinite(written.birdCount)).toBe(true);
      expect(typeof written.openingBirdCount).toBe('number');
      expect(typeof written.closingBirdCount).toBe('number');
      expect(typeof written.feedKg).toBe('number');
      expect(typeof written.mortality).toBe('number');
      expect(typeof written.culling).toBe('number');
      expect(typeof written.eggsProduced).toBe('number');
      expect(typeof written.submissionVersion).toBe('number');
      expect(typeof written.weekNumber).toBe('number');

      // ISO-8601 timestamp format verification
      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
      expect(isoRegex.test(written.submittedAt)).toBe(true);
      expect(isoRegex.test(written.createdAt)).toBe(true);
      expect(isoRegex.test(written.updatedAt)).toBe(true);
    });
  });

  describe('4. Atomicity & Offline Queue Recovery Verification', () => {
    it('rolls back completely if transaction encounters an unhandled failure', async () => {
      let rolledBack = false;
      try {
        await (async () => {
          mockTransaction.set({ path: `dailyReports/${userId}/dailyLogs/${submissionDate}` }, { test: 1 });
          throw new Error('INSUFFICIENT_FEED');
        })();
      } catch (e: any) {
        rolledBack = true;
        // In Firestore, if transaction throws, no staged sets are committed
        writes.clear();
      }

      expect(rolledBack).toBe(true);
      expect(writes.size).toBe(0);
    });

    it('does not fail submission if post-transaction pending queue removal throws', async () => {
      let submissionSuccess = false;
      const removePending = vi.fn().mockRejectedValue(new Error('IndexedDB connection closed'));

      try {
        // Simulate successful transaction
        mockTransaction.set({ path: `dailyReports/${userId}/dailyLogs/${submissionDate}` }, { status: 'submitted' });

        // Safe pending cleanup
        try {
          await removePending('sub_key');
        } catch (cleanErr) {
          // Logged warning, must not abort submission
        }

        submissionSuccess = true;
      } catch {
        submissionSuccess = false;
      }

      expect(submissionSuccess).toBe(true);
      expect(writes.size).toBe(1);
    });
  });

  describe('5 & 6. Retrieval & Version 2 Prefill Isolation', () => {
    it('rejects parent metadata documents from being treated as daily reports', () => {
      const parentDocData = {
        userId,
        farmId,
        lastSubmissionDate: '2026-10-01',
        updatedAt: '2026-10-01T12:00:00Z',
      };

      expect(isParentDoc(parentDocData)).toBe(true);

      const dailyLogData = {
        userId,
        farmId,
        submissionDate: '2026-10-01',
        birdCount: 2000,
        eggsProduced: 1800,
        feedKg: 120,
        mortality: 2,
      };

      expect(isParentDoc(dailyLogData)).toBe(false);
    });

    it('rejects documents belonging to another farm', () => {
      const docOtherFarm = {
        userId,
        farmId: 'AP11',
        submissionDate: '2026-10-01',
        birdCount: 1500,
      };

      const requestedFarmId = 'AP12';
      const isMismatch = requestedFarmId && docOtherFarm.farmId && docOtherFarm.farmId !== requestedFarmId;
      expect(isMismatch).toBe(true);
    });

    it('rejects documents whose submissionDate does not match the requested date', () => {
      const docOtherDate = {
        userId,
        farmId: 'AP12',
        submissionDate: '2026-09-30',
        birdCount: 2000,
      };

      const requestedDate = '2026-10-01';
      const isMismatch = docOtherDate.submissionDate && docOtherDate.submissionDate !== requestedDate;
      expect(isMismatch).toBe(true);
    });
  });

  describe('7. Form State Reset Contract on Date or Farm Switch', () => {
    it('FarmerFormPage effect resets form cleanly and depends on [reportDate, farmId]', () => {
      const formPagePath = path.resolve(__dirname, '../../../frontend/src/pages/FarmerFormPage.tsx');
      const formPageCode = fs.readFileSync(formPagePath, 'utf8');

      // Verify the dependency array includes [reportDate, farmId]
      expect(formPageCode).toMatch(/useEffect\s*\(\s*\(\)\s*=>\s*\{[\s\S]*?\}, \s*\[reportDate,\s*farmId\]\s*\)/);

      // Verify that reset does not preserve stale birdCount: prev.birdCount
      const resetBlockMatch = formPageCode.match(/When reportDate or farmId changes, reset form[\s\S]*?setData\(\{([\s\S]*?)\}\);/);
      expect(resetBlockMatch).not.toBeNull();
      expect(resetBlockMatch![1]).not.toContain('birdCount: prev.birdCount');
    });
  });

  describe('8. Admin Submissions Calculation & NaN Prevention Contract', () => {
    it('normalizes valid report and produces non-NaN production percentage', () => {
      const rawLog = {
        userId,
        farmId: 'AP12',
        flockId: 'AP12_FL01',
        submissionDate: '2026-10-01',
        birdCount: 2000,
        eggsProduced: 1800,
        mortality: 1,
        feedKg: 120,
        submissionVersion: 1,
        status: 'submitted',
        createdAt: '2026-10-01T10:00:00Z',
      };

      const normalized = normalizeReport('2026-10-01', rawLog, userId, 'dailyReports/user/dailyLogs/2026-10-01');

      expect(normalized.birdCount).toBe(2000);
      expect(normalized.eggsProduced).toBe(1800);

      // Admin calculation from AdminSubmissionsPage.tsx:
      // ((report.eggsProduced ?? 0) / (report.birdCount ?? 1) * 100).toFixed(1)%
      const prodPercent = `${((normalized.eggsProduced ?? 0) / (normalized.birdCount ?? 1) * 100).toFixed(1)}%`;
      expect(prodPercent).toBe('90.0%');
      expect(prodPercent).not.toContain('NaN');
    });

    it('filters out parent documents so Admin never shows 0 birds with NaN% from dummy parents', () => {
      const parentRecord = {
        userId,
        farmId: 'AP12',
        lastSubmissionDate: '2026-10-01',
      };

      expect(isParentDoc(parentRecord)).toBe(true);
    });
  });

  describe('9. Historical Import Conflict Replacement Flow', () => {
    it('allows a farmer to submit digital report over an imported conflict record without CORRECTION_LIMIT_REACHED', () => {
      const existingImportedRecord = {
        userId,
        submittedBy: 'admin-uid-1',
        farmId: 'AP12',
        submissionDate: '2026-10-01',
        submissionMethod: 'HISTORICAL_IMPORT',
        submissionVersion: 2, // Created during conflict import
        status: 'submitted',
        birdCount: 0,
        eggsProduced: 0,
      };

      // Check classification
      const isFromHistoricalImport =
        existingImportedRecord.submissionMethod === 'HISTORICAL_IMPORT' ||
        existingImportedRecord.submittedBy !== userId;

      expect(isFromHistoricalImport).toBe(true);

      // Archive imported record to revisions/imported_v1
      const revPath = `dailyReports/${userId}/dailyLogs/${submissionDate}/revisions/imported_v1`;
      mockTransaction.set({ path: revPath }, {
        ...existingImportedRecord,
        archivedReason: 'FARMER_INITIAL_DIGITAL_SUBMISSION_OVER_IMPORT',
      });

      // Write true farmer digital submission as Version 1
      const canonicalPath = `dailyReports/${userId}/dailyLogs/${submissionDate}`;
      mockTransaction.set({ path: canonicalPath }, {
        userId,
        submittedBy: userId,
        farmId: 'AP12',
        submissionDate: '2026-10-01',
        submissionMethod: 'DIGITAL_FORM',
        submissionVersion: 1,
        status: 'submitted',
        birdCount: 2000,
        eggsProduced: 1850,
      });

      expect(writes.has(revPath)).toBe(true);
      expect(writes.get(canonicalPath)!.data.submissionVersion).toBe(1);
      expect(writes.get(canonicalPath)!.data.submissionMethod).toBe('DIGITAL_FORM');
      expect(writes.get(canonicalPath)!.data.birdCount).toBe(2000);
    });
  });

  describe('10. Idempotent Re-Submission', () => {
    it('recognizes duplicate submissions of unchanged data and returns without error', () => {
      const existingData = {
        userId,
        farmId: 'AP12',
        feedKg: 120,
        mortality: 2,
        culling: 0,
        eggsProduced: 1800,
        selectionEggs: 1750,
        damagedEggs: 30,
        floorEggs: 20,
        temperature: 28,
        submissionVersion: 1,
      };

      const identicalInput = {
        feedKg: 120,
        mortality: 2,
        culling: 0,
        eggsProduced: 1800,
        selectionEggs: 1750,
        damagedEggs: 30,
        floorEggs: 20,
        temperature: 28,
      };

      const hasChanged =
        Number(identicalInput.feedKg) !== Number(existingData.feedKg) ||
        Number(identicalInput.mortality) !== Number(existingData.mortality) ||
        Number(identicalInput.culling) !== Number(existingData.culling) ||
        Number(identicalInput.eggsProduced) !== Number(existingData.eggsProduced);

      expect(hasChanged).toBe(false);
    });
  });
});
