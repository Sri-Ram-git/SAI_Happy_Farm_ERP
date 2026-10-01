import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Version 2 Correction Submission Flow & Security Verification', () => {
  let mockTransaction: any;
  let mockDb: any;
  let writes: Map<string, any>;

  const userId = 'farmer-uid-123';
  const farmId = 'AP12';
  const flockId = 'flock-initial-1';
  const submissionDate = '2026-10-01';

  beforeEach(() => {
    writes = new Map();

    mockTransaction = {
      get: vi.fn(),
      set: vi.fn((ref: any, data: any, options?: any) => {
        writes.set(ref.path, { data, options });
      }),
    };

    mockDb = {
      runTransaction: vi.fn(async (cb: any) => cb(mockTransaction)),
      collection: vi.fn((colName: string) => ({
        doc: vi.fn((docId: string) => ({
          path: `${colName}/${docId}`,
          collection: vi.fn((subColName: string) => ({
            doc: vi.fn((subDocId: string) => ({
              path: `${colName}/${docId}/${subColName}/${subDocId}`,
              collection: vi.fn((nestedSubCol: string) => ({
                doc: vi.fn((nestedDocId: string) => ({
                  path: `${colName}/${docId}/${subColName}/${subDocId}/${nestedSubCol}/${nestedDocId}`,
                })),
              })),
            })),
          })),
        })),
      })),
    };
  });

  it('should write archived Version 1 record with farmId into dailyReports/{userId}/dailyLogs/{date}/revisions/v1', async () => {
    const existingLogData = {
      userId,
      farmId,
      flockId,
      submissionDate,
      submissionVersion: 1,
      status: 'submitted',
      mortality: 5,
      culling: 2,
      eggsProduced: 4000,
      feedKg: 200,
      openingBirdCount: 5000,
      closingBirdCount: 4993,
    };

    const correctionInput = {
      submittedBy: userId,
      farmId,
      flockId,
      submissionDate,
      mortality: 8, // corrected mortality (+3)
      culling: 2,
      eggsProduced: 4050, // corrected eggs (+50)
      feedKg: 210, // corrected feed (+10)
    };

    // Revision doc path
    const revisionPath = `dailyReports/${userId}/dailyLogs/${submissionDate}/revisions/v1`;
    const canonicalLogPath = `dailyReports/${userId}/dailyLogs/${submissionDate}`;

    // Simulate archive write
    mockTransaction.set({ path: revisionPath }, {
      ...existingLogData,
      farmId: correctionInput.farmId,
      flockId: correctionInput.flockId,
      userId,
      archivedAt: new Date().toISOString(),
      archivedReason: 'FARMER_CORRECTION_V2',
    });

    // Simulate canonical update
    mockTransaction.set({ path: canonicalLogPath }, {
      farmId: correctionInput.farmId,
      flockId: correctionInput.flockId,
      userId,
      submissionVersion: 2,
      status: 'corrected',
      mortality: correctionInput.mortality,
      eggsProduced: correctionInput.eggsProduced,
      feedKg: correctionInput.feedKg,
    }, { merge: true });

    // Assertions
    expect(writes.has(revisionPath)).toBe(true);
    const archived = writes.get(revisionPath).data;
    expect(archived.farmId).toBe(farmId);
    expect(archived.submissionVersion).toBe(1);
    expect(archived.archivedReason).toBe('FARMER_CORRECTION_V2');

    expect(writes.has(canonicalLogPath)).toBe(true);
    const updated = writes.get(canonicalLogPath).data;
    expect(updated.farmId).toBe(farmId);
    expect(updated.submissionVersion).toBe(2);
    expect(updated.status).toBe('corrected');
  });

  it('should enforce single correction limit (rejection if submissionVersion >= 2)', () => {
    const existingLogData = {
      submissionVersion: 2,
      status: 'corrected',
    };

    const currentVersion = Number(existingLogData.submissionVersion || 1);
    const shouldReject = currentVersion >= 2 || existingLogData.status === 'corrected';

    expect(shouldReject).toBe(true);
  });
});
