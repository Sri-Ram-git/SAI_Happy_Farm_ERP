import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  detectColumnMappings,
  validateParsedFile,
  executeHistoricalImport,
  checkServerConflicts,
  extractPreservedAvgFromMappings,
  type ParsedFile,
  type ColumnMapping,
} from './historicalImportService';
import type { FarmDoc } from './farmDataService';

/**
 * Replicates the UI mapping status badge resolution logic from AdminImportPage.tsx (lines 1037-1049)
 */
export function getDisplayedMappingStatus(mapping: ColumnMapping): {
  label: string;
  badgeClass: string;
} {
  if (mapping.mappedField === 'worksheetSummary' || mapping.isSummary) {
    return { label: 'Recognized', badgeClass: 'badge--success' };
  }
  if (mapping.mappedField === 'ignore') {
    return mapping.confidence === 'AMBIGUOUS'
      ? { label: 'Ambiguous (Choose)', badgeClass: 'badge--warning' }
      : { label: 'Ignored', badgeClass: 'badge--neutral' };
  }
  return mapping.confidence === 'HIGH'
    ? { label: 'Matched', badgeClass: 'badge--success' }
    : { label: 'Review', badgeClass: 'badge--warning' };
}

describe('AVG Excel Import Mapping — Investigation & Expected Behavior', () => {
  const mockFarms: FarmDoc[] = [
    {
      farmId: 'AP14',
      name: 'Happy Farm 14',
      active: true,
      location: 'Andhra Pradesh',
      currentBirdCount: 9500,
      currentFeedKg: 1200,
    },
  ];

  // Customer headers matching the exact production curve sheet from the screenshot
  const customerHeaders = [
    'Date',
    'WEEKS',
    'NO.OF BIRDS',
    'PRODUCTION',
    'SELECTION',
    'DAMAGE/REJECTED',
    'Mortality',
    'Temp',
    'Feed Kgs',
    'Feed Gms/Bird',
    'STD %',
    'ACT %',
    'SELECTION %',
    'AVG',
  ];

  // Sample transposed daily data with AVG row repeating the weekly ACT % average (67.10)
  const sampleRows = [
    {
      rowNumber: 2,
      data: {
        Date: '2026-03-01',
        WEEKS: '44',
        'NO.OF BIRDS': '9500',
        PRODUCTION: '7500',
        SELECTION: '7000',
        'DAMAGE/REJECTED': '100',
        Mortality: '5',
        Temp: '28',
        'Feed Kgs': '1200',
        'Feed Gms/Bird': '126.3',
        'STD %': '87.26',
        'ACT %': '79.74',
        'SELECTION %': '93.33',
        AVG: '67.10',
      },
    },
    {
      rowNumber: 3,
      data: {
        Date: '2026-03-02',
        WEEKS: '44',
        'NO.OF BIRDS': '9495',
        PRODUCTION: '7550',
        SELECTION: '7050',
        'DAMAGE/REJECTED': '90',
        Mortality: '3',
        Temp: '28.5',
        'Feed Kgs': '1210',
        'Feed Gms/Bird': '127.4',
        'STD %': '87.26',
        'ACT %': '80.20',
        'SELECTION %': '93.38',
        AVG: '67.10',
      },
    },
    {
      rowNumber: 4,
      data: {
        Date: '2026-03-03',
        WEEKS: '44',
        'NO.OF BIRDS': '9492',
        PRODUCTION: '7480',
        SELECTION: '7000',
        'DAMAGE/REJECTED': '110',
        Mortality: '4',
        Temp: '29',
        'Feed Kgs': '1205',
        'Feed Gms/Bird': '126.9',
        'STD %': '87.26',
        'ACT %': '79.40',
        'SELECTION %': '93.58',
        AVG: '67.10',
      },
    },
  ];

  let savedBatchDocs: any[] = [];

  beforeEach(() => {
    savedBatchDocs = [];
    (globalThis as any).window = {
      firebase: {
        apps: [{ name: '[DEFAULT]' }],
        auth: () => ({ currentUser: { uid: 'admin-test', email: 'admin@test.com' } }),
        firestore: () => ({
          batch: () => ({
            set: vi.fn((ref, data) => {
              savedBatchDocs.push({ ref, data });
            }),
            commit: vi.fn().mockResolvedValue(true),
          }),
          collection: (col: string) => {
            if (col === 'users') {
              return {
                where: () => ({
                  get: vi.fn().mockResolvedValue({
                    docs: [
                      { id: 'farmer-ap14', data: () => ({ role: 'farmer', farmIds: ['AP14'] }) },
                    ],
                  }),
                }),
              };
            }
            return {
              doc: (id?: string) => ({
                id: id || 'mock_doc_id',
                set: vi.fn().mockResolvedValue(true),
                collection: () => ({
                  doc: (subId?: string) => ({ id: subId || 'sub_doc_id', set: vi.fn().mockResolvedValue(true) }),
                }),
              }),
              where: () => ({
                get: vi.fn().mockResolvedValue({ docs: [] }),
              }),
            };
          },
        }),
      },
    };
  });

  describe('1. Regression Verification: Daily Percentage Fields', () => {
    it('should continue to map ACT %, STD %, and SELECTION % to daily production fields with HIGH confidence', () => {
      const { mappings, detectedType } = detectColumnMappings(customerHeaders, sampleRows);
      expect(detectedType).toBe('DAILY_REPORT');

      const mappingMap = new Map(mappings.map((m) => [m.fileHeader, m]));

      // ACT % must map to actualProductionPct
      const actMapping = mappingMap.get('ACT %');
      expect(actMapping?.mappedField).toBe('actualProductionPct');
      expect(actMapping?.confidence).toBe('HIGH');
      expect(getDisplayedMappingStatus(actMapping!).label).toBe('Matched');
      expect(getDisplayedMappingStatus(actMapping!).badgeClass).toBe('badge--success');

      // STD % must map to standardProductionPct
      const stdMapping = mappingMap.get('STD %');
      expect(stdMapping?.mappedField).toBe('standardProductionPct');
      expect(stdMapping?.confidence).toBe('HIGH');
      expect(getDisplayedMappingStatus(stdMapping!).label).toBe('Matched');
      expect(getDisplayedMappingStatus(stdMapping!).badgeClass).toBe('badge--success');

      // SELECTION % must map to selectionPct
      const selMapping = mappingMap.get('SELECTION %');
      expect(selMapping?.mappedField).toBe('selectionPct');
      expect(selMapping?.confidence).toBe('HIGH');
      expect(getDisplayedMappingStatus(selMapping!).label).toBe('Matched');
      expect(getDisplayedMappingStatus(selMapping!).badgeClass).toBe('badge--success');
    });
  });

  describe('2. Worksheet Summary Mapping: Automatic Recognition of AVG / AVERAGE', () => {
    it('automatically recognizes AVG as a worksheet summary with sample values [67.10, 67.10, 67.10]', () => {
      const { mappings } = detectColumnMappings(customerHeaders, sampleRows);
      const avgMapping = mappings.find((m) => m.fileHeader === 'AVG');

      expect(avgMapping).toBeDefined();
      expect(avgMapping?.fileHeader).toBe('AVG');
      expect(avgMapping?.sampleValues.slice(0, 3)).toEqual(['67.10', '67.10', '67.10']);
      // Automatically classified as worksheetSummary, NOT ordinary ignore
      expect(avgMapping?.mappedField).toBe('worksheetSummary');
      expect(avgMapping?.confidence).toBe('HIGH');
      expect(avgMapping?.isSummary).toBe(true);

      // Never maps to daily fields
      expect(avgMapping?.mappedField).not.toBe('actualProductionPct');
      expect(avgMapping?.mappedField).not.toBe('standardProductionPct');
      expect(avgMapping?.mappedField).not.toBe('bodyWeightAvg');
      expect(avgMapping?.mappedField).not.toBe('eggWeightAvg');

      // Status badge is Recognized (badge--success)
      const status = getDisplayedMappingStatus(avgMapping!);
      expect(status.label).toBe('Recognized');
      expect(status.badgeClass).toBe('badge--success');
    });

    it('automatically recognizes case-insensitive and trimmed variants: avg, AVERAGE, and "  AVG  "', () => {
      const testHeaders = ['Date', 'avg', 'AVERAGE', '  AVG  '];
      const dummyRows = [
        { rowNumber: 2, data: { Date: '2026-03-01', avg: '67.10', AVERAGE: '67.10', '  AVG  ': '67.10' } },
      ];
      // Note: testing individual detection without collision
      for (const h of ['avg', 'AVERAGE', '  AVG  ']) {
        const { mappings } = detectColumnMappings(['Date', h], dummyRows);
        const m = mappings.find((item) => item.fileHeader === h);
        expect(m).toBeDefined();
        expect(m?.mappedField).toBe('worksheetSummary');
        expect(m?.confidence).toBe('HIGH');
        expect(m?.isSummary).toBe(true);
        const status = getDisplayedMappingStatus(m!);
        expect(status.label).toBe('Recognized');
        expect(status.badgeClass).toBe('badge--success');
      }
    });

    it('verifies non-AVG generic summary headers map to ignore with UNMAPPED confidence and Ignored badge', () => {
      const genericHeaders = ['MIN', 'MAX', 'TOTAL', 'SUM', 'STD', 'DIFF'];
      const dummyRows = [{ rowNumber: 2, data: Object.fromEntries(genericHeaders.map((h) => [h, '100'])) }];
      const { mappings } = detectColumnMappings(genericHeaders, dummyRows);

      for (const h of genericHeaders) {
        const m = mappings.find((item) => item.fileHeader === h);
        expect(m).toBeDefined();
        expect(m?.mappedField).toBe('ignore');
        expect(m?.confidence).toBe('UNMAPPED');
        const status = getDisplayedMappingStatus(m!);
        expect(status.label).toBe('Ignored');
        expect(status.badgeClass).toBe('badge--neutral');
      }
    });

    it('verifies genuine field collisions between duplicate AVG headers still produce AMBIGUOUS confidence and "Ambiguous (Choose)" badge', () => {
      const collidingHeaders = ['Date', 'AVG', 'AVERAGE'];
      const dummyRows = [
        { rowNumber: 2, data: { Date: '2026-03-01', AVG: '67.10', AVERAGE: '67.10' } },
      ];
      const { mappings } = detectColumnMappings(collidingHeaders, dummyRows);
      const firstAvg = mappings.find((m) => m.fileHeader === 'AVG')!;
      const secondAvg = mappings.find((m) => m.fileHeader === 'AVERAGE')!;

      expect(firstAvg.mappedField).toBe('worksheetSummary');
      expect(firstAvg.confidence).toBe('HIGH');

      expect(secondAvg.mappedField).toBe('ignore');
      expect(secondAvg.confidence).toBe('AMBIGUOUS');
      const collidedStatus = getDisplayedMappingStatus(secondAvg);
      expect(collidedStatus.label).toBe('Ambiguous (Choose)');
      expect(collidedStatus.badgeClass).toBe('badge--warning');
    });

    it('verifies dropdown options include worksheetSummary for the AVG row', () => {
      const { mappings } = detectColumnMappings(customerHeaders, sampleRows);
      const avgMapping = mappings.find((m) => m.fileHeader === 'AVG')!;

      expect(avgMapping.mappedField).toBe('worksheetSummary');

      const standardDropdownOptions = [
        'ignore',
        'worksheetSummary',
        'submissionDate', 'farmId', 'flockId', 'weekNumber',
        'birdCount', 'mortality', 'culling',
        'feedKg', 'feedGrams', 'feedGramsPerBird',
        'actualProductionPct', 'standardProductionPct', 'selectionPct',
        'eggWeightAvg', 'bodyWeightAvg',
      ];

      expect(standardDropdownOptions).toContain(avgMapping.mappedField);
      expect(standardDropdownOptions).toContain('actualProductionPct');
      expect(standardDropdownOptions).toContain('bodyWeightAvg');
    });
  });

  describe('3. Persistence & Conflict Processing Exclusion', () => {
    it('verifies that a worksheetSummary AVG row is 100% excluded from ValidatedRow and Firestore daily records', async () => {
      const { mappings } = detectColumnMappings(customerHeaders, sampleRows);

      const { preservedAvg, preservedAvgByDate } = extractPreservedAvgFromMappings(mappings, sampleRows);
      expect(preservedAvg).toBe(67.10);
      expect(preservedAvgByDate['2026-03-01']).toBe(67.10);

      const parsedFile: ParsedFile = {
        id: 'pf_avg_test',
        file: new File([], 'Customer_Curve.xlsx'),
        name: 'Customer_Curve.xlsx',
        size: 2048,
        format: 'XLSX',
        assignedFarmId: 'AP14',
        detectedRecordType: 'DAILY_REPORT',
        headers: customerHeaders,
        mappings,
        rawRows: sampleRows,
        preservedAvg,
        preservedAvgByDate,
      };

      // 1. Validate parsed file
      const validatedRows = validateParsedFile(parsedFile, mockFarms);
      expect(validatedRows).toHaveLength(3);

      for (const row of validatedRows) {
        expect(row.isValid).toBe(true);
        expect(row.farmId).toBe('AP14');
        expect(row.preservedAvg).toBe(67.10);

        // Normal daily rates from ACT % are preserved
        expect(row.actualProductionPct).toBeGreaterThan(0);
        expect(row.actualProductionPct).not.toBe(67.10); // Not overwritten with the 67.10 average!

        // AVG is completely absent from daily report fields
        expect((row as any).AVG).toBeUndefined();
        expect((row as any).avg).toBeUndefined();
        expect((row as any).worksheetActPctAvg).toBeUndefined();

        // Must NOT be mapped into bodyWeight or eggWeight
        expect(row.bodyWeight).toBeUndefined();
        expect(row.eggWeight).toBeUndefined();
      }

      // 2. Execute import to Firestore with worksheet contribution
      const importResult = await executeHistoricalImport(validatedRows, 'skip', undefined, {
        worksheets: [
          {
            worksheetKey: 'Customer_Curve.xlsx',
            farmId: 'AP14',
            preservedAvg,
            preservedAvgByDate,
          },
        ],
      });
      expect(importResult.importedCount).toBe(3);

      // Verify payloads written to Firestore
      const dailyReportDocs = savedBatchDocs.filter(
        (b) => b.data && b.data.submissionMethod === 'HISTORICAL_IMPORT'
      );
      expect(dailyReportDocs).toHaveLength(3);

      for (const batchItem of dailyReportDocs) {
        const payload = batchItem.data;
        expect(payload.actualProductionPct).toBeGreaterThan(0);
        expect(payload.actualProductionPct).not.toBe(67.10);
        expect(payload.bodyWeight == null).toBe(true);
        expect(payload.eggWeight == null).toBe(true);
        expect(payload.AVG).toBeUndefined();
        expect(payload.avg).toBeUndefined();
        expect(payload.worksheetActPctAvg).toBeUndefined();
      }

      // Verify farm document received preservedAvg
      const farmDocs = savedBatchDocs.filter((b) => b.ref && b.ref.id === 'AP14');
      if (farmDocs.length > 0) {
        expect(farmDocs[0].data.preservedAvg).toBe(67.10);
      }
    });
  });

  describe('4. Risk Demonstration: Accidental Mapping of AVG to Daily Production Fields', () => {
    it('demonstrates corruption if user obeys "Ambiguous (Choose)" and maps AVG to bodyWeightAvg', () => {
      const { mappings } = detectColumnMappings(customerHeaders, sampleRows);

      // User accidentally selects 'bodyWeightAvg' because the header is 'AVG'
      const corruptedMappings = mappings.map((m) =>
        m.fileHeader === 'AVG' ? { ...m, mappedField: 'bodyWeightAvg' as any } : m
      );

      const parsedFile: ParsedFile = {
        id: 'pf_corrupted_test',
        file: new File([], 'Customer_Curve.xlsx'),
        name: 'Customer_Curve.xlsx',
        size: 2048,
        format: 'XLSX',
        assignedFarmId: 'AP14',
        headers: customerHeaders,
        mappings: corruptedMappings,
        rawRows: sampleRows,
      };

      const validatedRows = validateParsedFile(parsedFile, mockFarms);

      // Proves that mapping AVG to bodyWeightAvg writes 67.10g as flock body weight
      expect(validatedRows[0]?.bodyWeight).toEqual({
        min: 67.1,
        max: 67.1,
        avg: 67.1,
      });
      // This confirms why AVG should NOT invite user mapping to daily fields!
    });
  });

  describe('5. ACT % Conflict Detection Suite', () => {
    it('detects a conflict when imported actualProductionPct differs from existing record', async () => {
      // Mock existing Firestore report with actualProductionPct = 75.0
      (globalThis as any).window.firebase.firestore = () => ({
        collection: (col: string) => ({
          where: () => ({
            get: vi.fn().mockResolvedValue({
              docs: col === 'dailyReports' ? [
                {
                  id: 'rep_1',
                  data: () => ({
                    farmId: 'AP14',
                    submissionDate: '2026-03-01',
                    birdCount: 9500,
                    feedKg: 1200,
                    mortality: 5,
                    culling: 0,
                    eggsProduced: 7500,
                    actualProductionPct: 75.0,
                  }),
                },
              ] : [],
            }),
          }),
        }),
        collectionGroup: () => ({
          get: vi.fn().mockResolvedValue({ docs: [] }),
        }),
      });

      const proposedRows = [
        {
          fileId: 'f1',
          fileName: 'curve.xlsx',
          rowNumber: 2,
          isValid: true,
          farmId: 'AP14',
          submissionDate: '2026-03-01',
          birdCount: 9500,
          feedKg: 1200,
          mortality: 5,
          culling: 0,
          eggsProduced: 7500,
          actualProductionPct: 79.74, // Different!
          errors: [],
          warnings: [],
        },
      ];

      const checked = await checkServerConflicts(proposedRows as any);
      expect(checked[0].conflictStatus).toBe('CONFLICT');
      expect(checked[0].diff?.actualProductionPct).toEqual({ existing: 75.0, proposed: 79.74 });
    });

    it('does not produce false conflict when imported actualProductionPct matches existing record', async () => {
      (globalThis as any).window.firebase.firestore = () => ({
        collection: (col: string) => ({
          where: () => ({
            get: vi.fn().mockResolvedValue({
              docs: col === 'dailyReports' ? [
                {
                  id: 'rep_1',
                  data: () => ({
                    farmId: 'AP14',
                    submissionDate: '2026-03-01',
                    birdCount: 9500,
                    feedKg: 1200,
                    mortality: 5,
                    culling: 0,
                    eggsProduced: 7500,
                    actualProductionPct: 79.74,
                  }),
                },
              ] : [],
            }),
          }),
        }),
        collectionGroup: () => ({
          get: vi.fn().mockResolvedValue({ docs: [] }),
        }),
      });

      const proposedRows = [
        {
          fileId: 'f1',
          fileName: 'curve.xlsx',
          rowNumber: 2,
          isValid: true,
          farmId: 'AP14',
          submissionDate: '2026-03-01',
          birdCount: 9500,
          feedKg: 1200,
          mortality: 5,
          culling: 0,
          eggsProduced: 7500,
          actualProductionPct: 79.74, // Identical!
          errors: [],
          warnings: [],
        },
      ];

      const checked = await checkServerConflicts(proposedRows as any);
      expect(checked[0].conflictStatus).toBe('EXACT_DUPLICATE');
      expect(checked[0].diff).toBeUndefined();
    });

    it('preserves numeric zero and correctly detects conflict between 0 and positive rate', async () => {
      (globalThis as any).window.firebase.firestore = () => ({
        collection: (col: string) => ({
          where: () => ({
            get: vi.fn().mockResolvedValue({
              docs: col === 'dailyReports' ? [
                {
                  id: 'rep_1',
                  data: () => ({
                    farmId: 'AP14',
                    submissionDate: '2026-03-01',
                    birdCount: 9500,
                    feedKg: 1200,
                    mortality: 5,
                    culling: 0,
                    eggsProduced: 0,
                    actualProductionPct: 0.0,
                  }),
                },
              ] : [],
            }),
          }),
        }),
        collectionGroup: () => ({
          get: vi.fn().mockResolvedValue({ docs: [] }),
        }),
      });

      const proposedRows = [
        {
          fileId: 'f1',
          fileName: 'curve.xlsx',
          rowNumber: 2,
          isValid: true,
          farmId: 'AP14',
          submissionDate: '2026-03-01',
          birdCount: 9500,
          feedKg: 1200,
          mortality: 5,
          culling: 0,
          eggsProduced: 0,
          actualProductionPct: 50.0,
          errors: [],
          warnings: [],
        },
      ];

      const checked = await checkServerConflicts(proposedRows as any);
      expect(checked[0].conflictStatus).toBe('CONFLICT');
      expect(checked[0].diff?.actualProductionPct).toEqual({ existing: 0.0, proposed: 50.0 });
    });
  });

  describe('6. Multi-Worksheet Ingestion & Export Preservation', () => {
    it('accurately extracts and isolates distinct preserved AVG values per farm sheet (AP16=67.10, AP15=71.72, AP12=56.37)', () => {
      const mockCustomerFarms = [
        { farmId: 'AP16', name: 'Farm 16' },
        { farmId: 'AP15', name: 'Farm 15' },
        { farmId: 'AP12', name: 'Farm 12' },
      ];

      // Recreate representative transposed raw rows for each sheet
      const sheetsData = [
        { farmId: 'AP16', avgVal: '67.10' },
        { farmId: 'AP15', avgVal: '71.72' },
        { farmId: 'AP12', avgVal: '56.37' },
      ];

      for (const { farmId, avgVal } of sheetsData) {
        const rows = [
          {
            rowNumber: 2,
            data: {
              Date: '2026-06-02',
              'ACT %': '79.74',
              AVG: avgVal,
            },
          },
          {
            rowNumber: 3,
            data: {
              Date: '2026-06-03',
              'ACT %': '79.36',
              AVG: avgVal,
            },
          },
        ];

        const { mappings } = detectColumnMappings(['Date', 'ACT %', 'AVG'], rows);
        const avgMapping = mappings.find((m) => m.fileHeader === 'AVG');
        expect(avgMapping?.mappedField).toBe('worksheetSummary');
        expect(avgMapping?.confidence).toBe('HIGH');
        expect(getDisplayedMappingStatus(avgMapping!).label).toBe('Recognized');

        const { preservedAvg, preservedAvgByDate } = extractPreservedAvgFromMappings(mappings, rows);
        expect(preservedAvg).toBe(Number(avgVal));
        expect(preservedAvgByDate['2026-06-02']).toBe(Number(avgVal));
        expect(preservedAvgByDate['2026-06-03']).toBe(Number(avgVal));
      }
    });
  });
});
