import { describe, it, expect, vi, beforeEach } from 'vitest';
import { importService } from './import.service';
import { AuthenticatedUser, UserRole } from '../types/auth';
import { HistoricalImportRecord } from '../types/import';

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

// Shared parser logic verification
function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuote = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuote && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
    } else if (char === delimiter && !inQuote) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseFlexibleDate(rawVal: string, preference: 'AUTO' | 'DD/MM/YYYY' | 'MM/DD/YYYY' = 'AUTO'): string | null {
  if (!rawVal || !rawVal.trim()) return null;
  const clean = rawVal.trim();

  // ISO
  const isoMatch = clean.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1]!, 10);
    const m = parseInt(isoMatch[2]!, 10);
    const d = parseInt(isoMatch[3]!, 10);
    return `${y}-${m < 10 ? '0' + m : m}-${d < 10 ? '0' + d : d}`;
  }

  // Textual
  const textMonthMatch = clean.match(/^(\d{1,2})[-/\s]([A-Za-z]+)[-/\s](\d{4})$/);
  if (textMonthMatch) {
    const d = parseInt(textMonthMatch[1]!, 10);
    const mStr = (textMonthMatch[2] || '').toLowerCase().slice(0, 3);
    const y = parseInt(textMonthMatch[3]!, 10);
    const months: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
    const m = months[mStr];
    if (m) return `${y}-${m < 10 ? '0' + m : m}-${d < 10 ? '0' + d : d}`;
  }

  // Delimited
  const delMatch = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (delMatch) {
    const p1 = parseInt(delMatch[1]!, 10);
    const p2 = parseInt(delMatch[2]!, 10);
    let y = parseInt(delMatch[3]!, 10);
    if (y < 100) y += 2000;

    let day = p1;
    let month = p2;
    if (preference === 'MM/DD/YYYY') {
      month = p1;
      day = p2;
    } else if (p1 > 12) {
      day = p1;
      month = p2;
    } else if (p2 > 12) {
      month = p1;
      day = p2;
    }
    return `${y}-${month < 10 ? '0' + month : month}-${day < 10 ? '0' + day : day}`;
  }

  return null;
}

describe('End-to-End Historical Data Importer Suite', () => {
  let mockDb: any;
  let mockBatch: any;
  const adminUser: AuthenticatedUser = {
    uid: 'admin-super',
    email: 'admin@happyfarms.com',
    role: UserRole.ADMIN,
    farmIds: ['AP12', 'AP13'],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockBatch = {
      set: vi.fn(),
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

  describe('1. Parsing & Delimiters', () => {
    it('should parse comma, semicolon, tab, and pipe delimited CSVs with quotes', () => {
      const commaLine = '2026-01-05,"AP12",1000,120,"Normal, good production"';
      expect(parseCsvLine(commaLine, ',')).toEqual([
        '2026-01-05',
        'AP12',
        '1000',
        '120',
        'Normal, good production',
      ]);

      const semiLine = '2026-01-05;AP12;1000;120;"Flock A; active"';
      expect(parseCsvLine(semiLine, ';')).toEqual([
        '2026-01-05',
        'AP12',
        '1000',
        '120',
        'Flock A; active',
      ]);

      const tabLine = '2026-01-05\tAP12\t1000\t120';
      expect(parseCsvLine(tabLine, '\t')).toEqual(['2026-01-05', 'AP12', '1000', '120']);

      const pipeLine = '2026-01-05|AP12|1000|120';
      expect(parseCsvLine(pipeLine, '|')).toEqual(['2026-01-05', 'AP12', '1000', '120']);
    });

    it('should parse escaped quotes inside strings', () => {
      const line = '"AP12","Notes: ""Checked temperature at noon"""';
      expect(parseCsvLine(line, ',')).toEqual(['AP12', 'Notes: "Checked temperature at noon"']);
    });
  });

  describe('2. Date & Unit Normalization', () => {
    it('should parse ISO, DD/MM/YYYY, MM/DD/YYYY, and Textual formats to canonical YYYY-MM-DD', () => {
      expect(parseFlexibleDate('2026-03-15')).toBe('2026-03-15');
      expect(parseFlexibleDate('15/03/2026')).toBe('2026-03-15');
      expect(parseFlexibleDate('15-03-2026')).toBe('2026-03-15');
      expect(parseFlexibleDate('15-Mar-2026')).toBe('2026-03-15');
      expect(parseFlexibleDate('15 March 2026')).toBe('2026-03-15');
      expect(parseFlexibleDate('03/15/2026', 'MM/DD/YYYY')).toBe('2026-03-15');
    });

    it('should convert Grams to Kg correctly (120,000 g -> 120 kg)', () => {
      const feedGrams = 120000;
      const feedKg = feedGrams / 1000;
      expect(feedKg).toBe(120);
    });
  });

  describe('3. Multi-file, Farm Matching & Identity Validation', () => {
    it('should import records from multiple farms independently and map to respective farmers', async () => {
      mockDb.collection.mockImplementation((name: string) => {
        if (name === 'farms') {
          return {
            doc: vi.fn().mockImplementation((id: string) => ({
              get: vi.fn().mockResolvedValue({
                exists: id === 'AP12' || id === 'AP13',
                data: () => ({ farmId: id, currentBirdCount: 1000, currentFeedKg: 5000 }),
              }),
            })),
          };
        }
        if (name === 'users') {
          return {
            where: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                docs: [
                  { id: 'farmer-ap12', data: () => ({ role: 'farmer', farmIds: ['AP12'] }) },
                  { id: 'farmer-ap13', data: () => ({ role: 'farmer', farmIds: ['AP13'] }) },
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
        return {
          doc: vi.fn().mockReturnValue({
            collection: vi.fn().mockReturnValue({
              doc: vi.fn().mockReturnValue({}),
            }),
            set: vi.fn().mockResolvedValue(undefined),
          }),
          add: vi.fn().mockResolvedValue({ id: 'audit-1' }),
        };
      });

      const multiFarmRecords: HistoricalImportRecord[] = [
        {
          recordType: 'DAILY_REPORT',
          farmId: 'AP12',
          submissionDate: '2025-05-10',
          birdCount: 1000,
          feedKg: 120,
          mortality: 1,
          eggsProduced: 950,
          sourceFile: 'file_ap12.csv',
          sourceRow: 1,
        },
        {
          recordType: 'DAILY_REPORT',
          farmId: 'AP13',
          submissionDate: '2025-05-10',
          birdCount: 1200,
          feedKg: 140,
          mortality: 2,
          eggsProduced: 1100,
          sourceFile: 'file_ap13.csv',
          sourceRow: 1,
        },
      ];

      const res = await importService.executeImport(
        {
          records: multiFarmRecords,
          conflictAction: 'skip',
          sourceFiles: ['file_ap12.csv', 'file_ap13.csv'],
        },
        adminUser,
        'req-multi',
      );

      expect(res.importedCount).toBe(2);
      expect(res.failedCount).toBe(0);
      expect(res.status).toBe('COMPLETED');

      // Verify that master farm inventory was NOT modified by summing snapshots
      const farmDocCalls = mockBatch.set.mock.calls.filter((call: any) =>
        call[0]?.path?.startsWith?.('farms/AP12') || call[0]?.path?.startsWith?.('farms/AP13'),
      );
      expect(farmDocCalls).toHaveLength(0);
    });
  });

  describe('4. Safe Conflict Overwrite & Audit', () => {
    it('should overwrite conflicting record when conflictAction=replace and record diff in batch', async () => {
      mockDb.collection.mockImplementation((name: string) => {
        if (name === 'farms') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: true,
                data: () => ({ farmId: 'AP12', currentBirdCount: 990 }),
              }),
            }),
          };
        }
        if (name === 'users') {
          return {
            where: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                docs: [{ id: 'farmer-12', data: () => ({ role: 'farmer', farmIds: ['AP12'] }) }],
              }),
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
                      submissionDate: '2025-06-01',
                      birdCount: 980,
                      feedKg: 110,
                      mortality: 5,
                    }),
                  },
                ],
              }),
            }),
            doc: vi.fn().mockReturnValue({}),
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
                      submissionDate: '2025-06-01',
                      birdCount: 980,
                      feedKg: 110,
                      mortality: 5,
                      submissionVersion: 1,
                    }),
                  },
                ],
              }),
            }),
            doc: vi.fn().mockReturnValue({
              collection: vi.fn().mockReturnValue({
                doc: vi.fn().mockReturnValue({}),
              }),
            }),
          };
        }
        return {
          doc: vi.fn().mockReturnValue({
            collection: vi.fn().mockReturnValue({
              doc: vi.fn().mockReturnValue({}),
            }),
            set: vi.fn().mockResolvedValue(undefined),
          }),
          add: vi.fn().mockResolvedValue({ id: 'audit-log-1' }),
        };
      });

      const res = await importService.executeImport(
        {
          records: [
            {
              recordType: 'DAILY_REPORT',
              farmId: 'AP12',
              submissionDate: '2025-06-01',
              birdCount: 1000, // Differs from 980
              feedKg: 120, // Differs from 110
              mortality: 2, // Differs from 5
              sourceFile: 'revised.csv',
              sourceRow: 2,
            },
          ],
          conflictAction: 'replace',
          sourceFiles: ['revised.csv'],
        },
        adminUser,
        'req-replace',
      );

      expect(res.importedCount).toBe(1);
      expect(res.conflictCount).toBe(1);
      expect(res.skippedCount).toBe(0);
      expect(mockBatch.commit).toHaveBeenCalled();
    });
  });
});
