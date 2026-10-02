import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import {
  parseXlsxWorkbook,
  excelSerialToIsoDate,
  detectFarmFromText,
  resolveFarmId,
  applyMappingToMatchingFiles,
  parseFlexibleDate,
  validateParsedFile,
  executeHistoricalImport,
  sanitizeFirestoreData,
  saveImportBatchRecord,
  getBatchWorksheets,
  detectColumnMappings,
  STANDARD_FIELDS,
  type ParsedFile,
  type ValidatedRow,
  type WorksheetImportContribution,
} from './historicalImportService';
import type { FarmDoc } from './farmDataService';
import { normalizeReport } from '../utils/normalizeDailyReport';
import { calcProductionRate, calcSelectionRate, calcFeedPerBird } from '../utils/kpiCalculations';

describe('XLSX Historical Import Suite', () => {
  const mockFarms: FarmDoc[] = [
    {
      farmId: 'AP12',
      name: 'Happy Farm 12',
      active: true,
      location: 'Andhra Pradesh',
      currentBirdCount: 9500,
      currentFeedKg: 1200,
    },
    {
      farmId: 'AP13',
      name: 'Happy Farm 13',
      active: true,
      location: 'Andhra Pradesh',
      currentBirdCount: 7800,
      currentFeedKg: 950,
    },
  ];

  beforeEach(() => {
    (globalThis as any).window = {
      firebase: {
        apps: [{ name: '[DEFAULT]' }],
        auth: () => ({ currentUser: { uid: 'admin-test', email: 'admin@test.com' } }),
        firestore: () => ({
          batch: () => ({
            set: vi.fn(),
            commit: vi.fn().mockResolvedValue(true),
          }),
          collection: (col: string) => {
            if (col === 'users') {
              return {
                where: () => ({
                  get: vi.fn().mockResolvedValue({
                    docs: [
                      { id: 'farmer-ap12', data: () => ({ role: 'farmer', farmIds: ['AP12'] }) },
                      { id: 'farmer-ap13', data: () => ({ role: 'farmer', farmIds: ['AP13'] }) },
                      { id: 'farmer-ap14', data: () => ({ role: 'farmer', farmIds: ['AP14'] }) },
                      { id: 'farmer-ap15', data: () => ({ role: 'farmer', farmIds: ['AP15'] }) },
                    ],
                  }),
                }),
              };
            }
            return {
              doc: () => ({
                id: 'mock_doc_id',
                set: vi.fn().mockResolvedValue(true),
                collection: () => ({
                  doc: () => ({ id: 'sub_doc_id', set: vi.fn().mockResolvedValue(true) }),
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

  describe('1. Date Serial & Formula Conversions', () => {
    it('should accurately convert Excel date serials to ISO YYYY-MM-DD', () => {
      // 45300 is 2024-01-09 in Excel 1900 date system
      const iso1 = excelSerialToIsoDate(45300);
      expect(iso1).toBe('2024-01-09');

      // 46000 is 2025-12-09
      const iso2 = excelSerialToIsoDate(46000);
      expect(iso2).toBe('2025-12-09');

      // Invalid serial numbers
      expect(excelSerialToIsoDate(0)).toBeNull();
      expect(excelSerialToIsoDate(-100)).toBeNull();
      expect(excelSerialToIsoDate(NaN)).toBeNull();
    });

    it('should parse flexible dates including serial numbers via parseFlexibleDate', () => {
      const res = parseFlexibleDate('45300');
      expect(res.isoDate).toBe('2024-01-09');

      const resIso = parseFlexibleDate('2026-02-14');
      expect(resIso.isoDate).toBe('2026-02-14');

      const resIndian = parseFlexibleDate('15/01/2026', 'DD/MM/YYYY');
      expect(resIndian.isoDate).toBe('2026-01-15');
    });
  });

  describe('2. Farm Identifier Detection', () => {
    it('should detect farm ID from sheet name matching known farms', () => {
      const known = ['AP12', 'AP13'];
      expect(detectFarmFromText('AP12 - Layer Flock', known)).toBe('AP12');
      expect(detectFarmFromText('Farm AP13 Production', known)).toBe('AP13');
      expect(detectFarmFromText('AP-12 Daily Log', known)).toBe('AP12');
      expect(detectFarmFromText('Summary Report', known)).toBeUndefined();
    });

    it('should detect generic farm patterns when not explicitly in known list', () => {
      expect(detectFarmFromText('Shed AP14 Log')).toBe('AP14');
      expect(detectFarmFromText('Farm TN01 - Broiler')).toBe('TN01');
    });
  });

  describe('3. Single-Sheet XLSX Parsing', () => {
    it('should parse a single-sheet workbook and map headers correctly', () => {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([
        ['Report Date', 'Farm ID', 'Bird Count', 'Feed (Kg)', 'Mortality', 'Eggs Produced'],
        ['2026-01-10', 'AP12', 5000, 600, 5, 4800],
        ['2026-01-11', 'AP12', 4995, 605, 3, 4810],
      ]);
      XLSX.utils.book_append_sheet(wb, ws, 'DailyData');
      const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

      const sheets = parseXlsxWorkbook(buf, 'single.xlsx', ['AP12']);
      expect(sheets).toHaveLength(1);

      const s = sheets[0]!;
      expect(s.sheetName).toBe('DailyData');
      expect(s.isEmpty).toBe(false);
      expect(s.rows).toHaveLength(2);
      expect(s.headers).toContain('Report Date');
      expect(s.headers).toContain('Bird Count');

      // Check detected mapping
      const dateMap = s.mappings.find((m) => m.fileHeader === 'Report Date');
      expect(dateMap?.mappedField).toBe('submissionDate');

      const birdMap = s.mappings.find((m) => m.fileHeader === 'Bird Count');
      expect(birdMap?.mappedField).toBe('birdCount');
    });
  });

  describe('4. Multi-Sheet Workbook with Different Farms', () => {
    it('should extract multiple sheets, detect respective farms from sheet names, and ignore empty rows', () => {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Farm AP12
      const ws1 = XLSX.utils.aoa_to_sheet([
        ['Date', 'Live Birds', 'Daily Feed (Kg)', 'Dead Birds', 'Eggs'],
        ['2026-01-10', 5000, 600, 5, 4800],
        ['', '', '', '', ''], // empty row to be ignored
        ['2026-01-11', 4995, 605, 3, 4810],
      ]);
      XLSX.utils.book_append_sheet(wb, ws1, 'Farm AP12');

      // Sheet 2: Farm AP13 with different header names
      const ws2 = XLSX.utils.aoa_to_sheet([
        ['Log Date', 'Total Birds', 'Feed Consumed', 'Mortality', 'Eggs Produced'],
        ['2026-01-10', 4000, 480, 2, 3850],
        ['2026-01-11', 3998, 482, 4, 3840],
      ]);
      XLSX.utils.book_append_sheet(wb, ws2, 'AP13 - Layer');

      const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
      const sheets = parseXlsxWorkbook(buf, 'multi_farms.xlsx', ['AP12', 'AP13']);

      expect(sheets).toHaveLength(2);

      const sheet1 = sheets[0]!;
      expect(sheet1.sheetName).toBe('Farm AP12');
      expect(sheet1.detectedFarmId).toBe('AP12');
      expect(sheet1.rows).toHaveLength(2); // blank row was skipped

      const sheet2 = sheets[1]!;
      expect(sheet2.sheetName).toBe('AP13 - Layer');
      expect(sheet2.detectedFarmId).toBe('AP13');
      expect(sheet2.rows).toHaveLength(2);
      expect(sheet2.headers).toContain('Log Date');
    });
  });

  describe('5. Formulas and Cached Values', () => {
    it('should read cached formula values and flag error formula cells', () => {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([
        ['Date', 'Opening Birds', 'Mortality', 'Closing Birds'],
        ['2026-01-10', 5000, 5, 4995],
      ]);

      // Add a formula cell with a cached value
      ws['D2'] = { t: 'n', f: 'B2-C2', v: 4995, w: '4995' };

      XLSX.utils.book_append_sheet(wb, ws, 'FormulasSheet');
      const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

      const sheets = parseXlsxWorkbook(buf, 'formulas.xlsx');
      expect(sheets).toHaveLength(1);
      const s = sheets[0]!;
      expect(s.hasFormulas).toBe(true);
      expect(s.rows[0]!.data['Closing Birds']).toBe('4995');
    });
  });

  describe('6. Hidden Sheets & Empty Worksheets', () => {
    it('should flag hidden sheets and mark empty sheets', () => {
      const wb = XLSX.utils.book_new();

      const ws1 = XLSX.utils.aoa_to_sheet([
        ['Date', 'Birds'],
        ['2026-01-10', 1000],
      ]);
      XLSX.utils.book_append_sheet(wb, ws1, 'VisibleSheet');

      const ws2 = XLSX.utils.aoa_to_sheet([]);
      XLSX.utils.book_append_sheet(wb, ws2, 'EmptySheet');

      const ws3 = XLSX.utils.aoa_to_sheet([
        ['Date', 'Birds'],
        ['2026-01-10', 2000],
      ]);
      XLSX.utils.book_append_sheet(wb, ws3, 'HiddenSheet');

      wb.Workbook = {
        Sheets: [
          { name: 'VisibleSheet' },
          { name: 'EmptySheet' },
          { name: 'HiddenSheet', Hidden: 1 },
        ],
      };

      const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
      const sheets = parseXlsxWorkbook(buf, 'sheets_visibility.xlsx');

      expect(sheets).toHaveLength(3);
      expect(sheets[0]!.isHidden).toBe(false);
      expect(sheets[0]!.isEmpty).toBe(false);

      expect(sheets[1]!.isEmpty).toBe(true);

      expect(sheets[2]!.isHidden).toBe(true);
      expect(sheets[2]!.rows).toHaveLength(1);
    });
  });

  describe('7. Reuse Mappings Across Worksheets with Matching Headers', () => {
    it('should copy confirmed mappings to target sheets with matching headers', () => {
      const mockFile1: ParsedFile = {
        id: 'file1',
        file: new File([], 'wb1.xlsx'),
        name: 'wb1.xlsx [Sheet1]',
        size: 1000,
        format: 'XLSX',
        headers: ['Dt', 'Closing Brd', 'Fd Kg', 'Dead Brd'],
        mappings: [
          { fileHeader: 'Dt', mappedField: 'submissionDate', confidence: 'HIGH', sampleValues: [] },
          { fileHeader: 'Closing Brd', mappedField: 'birdCount', confidence: 'HIGH', sampleValues: [] },
          { fileHeader: 'Fd Kg', mappedField: 'feedKg', confidence: 'HIGH', sampleValues: [] },
          { fileHeader: 'Dead Brd', mappedField: 'mortality', confidence: 'HIGH', sampleValues: [] },
        ],
        rawRows: [],
        detectedRecordType: 'DAILY_REPORT',
        status: 'PARSED',
      };

      const mockFile2: ParsedFile = {
        id: 'file2',
        file: new File([], 'wb1.xlsx'),
        name: 'wb1.xlsx [Sheet2]',
        size: 1000,
        format: 'XLSX',
        headers: ['Dt', 'Closing Brd', 'Fd Kg', 'Dead Brd'],
        mappings: [
          { fileHeader: 'Dt', mappedField: 'ignore', confidence: 'UNMAPPED', sampleValues: [] },
          { fileHeader: 'Closing Brd', mappedField: 'ignore', confidence: 'UNMAPPED', sampleValues: [] },
          { fileHeader: 'Fd Kg', mappedField: 'ignore', confidence: 'UNMAPPED', sampleValues: [] },
          { fileHeader: 'Dead Brd', mappedField: 'ignore', confidence: 'UNMAPPED', sampleValues: [] },
        ],
        rawRows: [],
        detectedRecordType: 'DAILY_REPORT',
        status: 'PARSED',
      };

      const { updatedCount, updatedFileIds } = applyMappingToMatchingFiles(
        mockFile1.mappings,
        mockFile1.headers,
        [mockFile2],
      );

      expect(updatedCount).toBe(1);
      expect(updatedFileIds).toContain('file2');

      const dtMapping = mockFile2.mappings.find((m) => m.fileHeader === 'Dt');
      expect(dtMapping?.mappedField).toBe('submissionDate');

      const birdMapping = mockFile2.mappings.find((m) => m.fileHeader === 'Closing Brd');
      expect(birdMapping?.mappedField).toBe('birdCount');
    });
  });

  describe('8. Validation of XLSX Rows', () => {
    it('should validate parsed XLSX rows, identify errors with exact row numbers, and check farm existence', () => {
      const parsedXlsxFile: ParsedFile = {
        id: 'pf_1',
        file: new File([], 'farm_data.xlsx'),
        name: 'farm_data.xlsx [AP12]',
        parentFileName: 'farm_data.xlsx',
        sheetName: 'AP12',
        size: 5000,
        format: 'XLSX',
        assignedFarmId: 'AP12',
        headers: ['Date', 'Birds', 'Feed', 'Mortality'],
        mappings: [
          { fileHeader: 'Date', mappedField: 'submissionDate', confidence: 'HIGH', sampleValues: [] },
          { fileHeader: 'Birds', mappedField: 'birdCount', confidence: 'HIGH', sampleValues: [] },
          { fileHeader: 'Feed', mappedField: 'feedKg', confidence: 'HIGH', sampleValues: [] },
          { fileHeader: 'Mortality', mappedField: 'mortality', confidence: 'HIGH', sampleValues: [] },
        ],
        rawRows: [
          {
            rowNumber: 2,
            data: { Date: '2026-01-10', Birds: '5000', Feed: '600', Mortality: '2' },
          },
          {
            rowNumber: 3,
            data: { Date: 'invalid-date', Birds: 'abc', Feed: '-50', Mortality: '0' },
          },
        ],
        detectedRecordType: 'DAILY_REPORT',
        status: 'PARSED',
      };

      const validated = validateParsedFile(parsedXlsxFile, mockFarms);
      expect(validated).toHaveLength(2);

      // Row 1 should be valid
      expect(validated[0]!.isValid).toBe(true);
      expect(validated[0]!.farmId).toBe('AP12');
      expect(validated[0]!.openingBirdCount).toBe(5000);
      expect(validated[0]!.closingBirdCount).toBe(4998);
      expect(validated[0]!.birdCount).toBe(4998);
      expect(validated[0]!.submissionDate).toBe('2026-01-10');
      expect(validated[0]!.fileName).toBe('farm_data.xlsx [AP12]');

      // Row 2 should be invalid with specific field errors
      expect(validated[1]!.isValid).toBe(false);
      expect(validated[1]!.errors.length).toBeGreaterThan(0);
      const fieldsWithErrors = validated[1]!.errors.map((e) => e.field);
      expect(fieldsWithErrors).toContain('submissionDate');
      expect(fieldsWithErrors).toContain('birdCount');
      expect(fieldsWithErrors).toContain('feedKg');
    });
  });

  describe('9. Transposed Horizontal Matrix Auto-Detection & Transposition (AP12)', () => {
    it('should auto-detect horizontal matrix layout, transpose columns into rows, and preserve AP12 poultry metrics', () => {
      const wb = XLSX.utils.book_new();
      // Matrix simulating customer AP12 Production Curve layout
      const matrixData = [
        ['Farm : AP12', '', '', '', ''],
        ['', '2026-01-25', '2026-01-26', '2026-01-27'], // Row 1: Col A is blank, Col B/C/D have dates
        ['WEEKS', '17.1', '17.2', '17.3'],
        ['NO.OF BIRDS', 1200, 1200, 1198],
        ['PRODUCTION', 1050, 1080, 1100],
        ['SELECTION', 10, 12, 15],
        ['DAMAGE/REJECTED', 5, 4, 6],
        ['Mortality', 0, 2, 1],
        ['Temp', 28, 29, 27],
        ['Feed Kgs', 130, 130, 132],
        ['Feed Gms/Bird', 108, 108, 110],
        ['ACT %', '87.5%', '90.0%', '91.8%'],
      ];

      const ws = XLSX.utils.aoa_to_sheet(matrixData);
      XLSX.utils.book_append_sheet(wb, ws, 'AP12');

      const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
      const sheets = parseXlsxWorkbook(buf, 'Production_Curve.xlsx', mockFarms);

      expect(sheets).toHaveLength(1);
      const ap12Sheet = sheets[0]!;
      expect(ap12Sheet.sheetName).toBe('AP12');
      expect(ap12Sheet.isTransposed).toBe(true);
      expect(ap12Sheet.detectedFarmId).toBe('AP12');
      expect(ap12Sheet.rows).toHaveLength(3); // exactly 3 daily records

      // Validate transposed rows
      const parsedFile: ParsedFile = {
        id: 'pf_ap12',
        file: new File([], 'Production_Curve.xlsx'),
        name: 'Production_Curve.xlsx [AP12]',
        sheetName: 'AP12',
        size: buf.byteLength,
        format: 'XLSX',
        assignedFarmId: 'AP12',
        headers: ap12Sheet.headers,
        mappings: ap12Sheet.mappings,
        rawRows: ap12Sheet.rows,
        detectedRecordType: 'DAILY_REPORT',
        status: 'PARSED',
      };

      const validated = validateParsedFile(parsedFile, mockFarms);
      expect(validated).toHaveLength(3);

      // Check record 1
      const day1 = validated[0]!;
      expect(day1.isValid).toBe(true);
      expect(day1.farmId).toBe('AP12');
      expect(day1.submissionDate).toBe('2026-01-25');
      expect(day1.birdCount).toBe(1200);
      expect(day1.eggsProduced).toBe(1050);
      expect(day1.selectionEggs).toBe(10);
      expect(day1.damagedEggs).toBe(5);
      expect(day1.mortality).toBe(0);
      expect(day1.temperature).toBe(28);
      expect(day1.feedKg).toBe(130);
      expect(day1.weekNumber).toBe(17.1);
      expect(day1.feedGramsPerBird).toBe(108);

      // Check record 2
      const day2 = validated[1]!;
      expect(day2.isValid).toBe(true);
      expect(day2.submissionDate).toBe('2026-01-26');
      expect(day2.mortality).toBe(2);
      expect(day2.weekNumber).toBe(17.2);
    });

    it('should parse real customer Production Curve.xlsx with AP12 without data loss if file exists', () => {
      const realPath = 'C:\\Users\\SRIRAM\\Downloads\\Production Curve.xlsx';
      if (!fs.existsSync(realPath)) {
        return; // skip if running in CI without local downloads
      }

      const fileBuffer = fs.readFileSync(realPath);
      const sheets = parseXlsxWorkbook(fileBuffer, 'Production Curve.xlsx', mockFarms);

      const ap12Sheet = sheets.find((s) => s.sheetName === 'AP12');
      expect(ap12Sheet).toBeDefined();
      expect(ap12Sheet!.isTransposed).toBe(true);
      expect(ap12Sheet!.detectedFarmId).toBe('AP12');
      // Exactly 197 consecutive daily records from 2026-01-25 to 2026-08-09
      expect(ap12Sheet!.rows.length).toBe(197);

      // Check that CF STD and FR STD are flagged as standard reference curves
      const cfStd = sheets.find((s) => s.sheetName === 'CF STD');
      expect(cfStd?.isReferenceSheet).toBe(true);
      const frStd = sheets.find((s) => s.sheetName === 'FR STD');
      expect(frStd?.isReferenceSheet).toBe(true);
    });
  });

  describe('10. Farm Identifier & Alias Resolution Guarantee (Zero Silent Fallback)', () => {
    it('should resolve exact farm IDs and human-readable aliases correctly', () => {
      expect(resolveFarmId('AP12', mockFarms).farmId).toBe('AP12');
      expect(resolveFarmId('ap12', mockFarms).farmId).toBe('AP12');
      expect(resolveFarmId('AP-12', mockFarms).farmId).toBe('AP12');
      expect(resolveFarmId('Happy Farm 12', mockFarms).farmId).toBe('AP12');
      expect(resolveFarmId('Farm Alpha 12', mockFarms).farmId).toBe('AP12');
      expect(resolveFarmId('Alpha 12', mockFarms).farmId).toBe('AP12');

      expect(resolveFarmId('AP13', mockFarms).farmId).toBe('AP13');
      expect(resolveFarmId('Farm Alpha 13', mockFarms).farmId).toBe('AP13');
    });

    it('should NEVER silently fallback unknown or ambiguous farm IDs to AP12 or AP13', () => {
      const unknownResult = resolveFarmId('Unknown Farm 99', mockFarms);
      expect(unknownResult.farmId).toBeUndefined();
      expect(unknownResult.reason).toContain('Unknown Farm ID "Unknown Farm 99"');

      const genericFarmResult = resolveFarmId('Shed Z', mockFarms);
      expect(genericFarmResult.farmId).toBeUndefined();
      expect(genericFarmResult.reason).toBeDefined();
    });

    it('should flag validation error for unknown farm in row data without assigning to another farm', () => {
      const mockFile: ParsedFile = {
        id: 'pf_unknown',
        file: new File([], 'mystery.xlsx'),
        name: 'mystery.xlsx',
        size: 1000,
        format: 'XLSX',
        headers: ['Date', 'Farm', 'Birds'],
        mappings: [
          { fileHeader: 'Date', mappedField: 'submissionDate', confidence: 'HIGH', sampleValues: [] },
          { fileHeader: 'Farm', mappedField: 'farmId', confidence: 'HIGH', sampleValues: [] },
          { fileHeader: 'Birds', mappedField: 'birdCount', confidence: 'HIGH', sampleValues: [] },
        ],
        rawRows: [
          { rowNumber: 2, data: { Date: '2026-01-10', Farm: 'UNKNOWN_FARM', Birds: '1000' } },
        ],
        detectedRecordType: 'DAILY_REPORT',
        status: 'PARSED',
      };

      const validated = validateParsedFile(mockFile, mockFarms);
      expect(validated).toHaveLength(1);
      expect(validated[0]!.isValid).toBe(false);
      expect(validated[0]!.farmId).toBe('');
      expect(validated[0]!.errors.some((e) => e.field === 'farmId')).toBe(true);
    });
  });

  describe('11. Customer Poultry Business Rules & Domain Validation', () => {
    const baseValidRow = {
      rowNumber: 2,
      data: {
        Date: '2026-01-15',
        Birds: '1000',
        Eggs: '900',
        Feed: '120',
        Mortality: '2',
        Culling: '1',
        Selection: '10',
        Temp: '28',
        Ammonia: '8',
        EggWeight: '55',
        BodyWeight: '1800',
      },
    };

    const makeFile = (rowData: Record<string, string>): ParsedFile => ({
      id: 'pf_rules',
      file: new File([], 'rules.xlsx'),
      name: 'rules.xlsx',
      size: 1000,
      format: 'XLSX',
      assignedFarmId: 'AP12',
      headers: Object.keys(rowData),
      mappings: [
        { fileHeader: 'Date', mappedField: 'submissionDate', confidence: 'HIGH', sampleValues: [] },
        { fileHeader: 'Birds', mappedField: 'birdCount', confidence: 'HIGH', sampleValues: [] },
        { fileHeader: 'Eggs', mappedField: 'eggsProduced', confidence: 'HIGH', sampleValues: [] },
        { fileHeader: 'Feed', mappedField: 'feedKg', confidence: 'HIGH', sampleValues: [] },
        { fileHeader: 'Mortality', mappedField: 'mortality', confidence: 'HIGH', sampleValues: [] },
        { fileHeader: 'Culling', mappedField: 'culling', confidence: 'HIGH', sampleValues: [] },
        { fileHeader: 'Selection', mappedField: 'selectionEggs', confidence: 'HIGH', sampleValues: [] },
        { fileHeader: 'Temp', mappedField: 'temperature', confidence: 'HIGH', sampleValues: [] },
        { fileHeader: 'Ammonia', mappedField: 'ammoniaPpm', confidence: 'HIGH', sampleValues: [] },
        { fileHeader: 'EggWeight', mappedField: 'eggWeightAvg', confidence: 'HIGH', sampleValues: [] },
        { fileHeader: 'BodyWeight', mappedField: 'bodyWeightAvg', confidence: 'HIGH', sampleValues: [] },
      ],
      rawRows: [{ rowNumber: 2, data: rowData }],
      detectedRecordType: 'DAILY_REPORT',
      status: 'PARSED',
    });

    it('should enforce 95% egg production rate threshold', () => {
      // 960 eggs from 1000 birds is 96.0% -> exceeds 95% threshold
      const invalidProd = makeFile({ ...baseValidRow.data, Eggs: '960' });
      const resInvalid = validateParsedFile(invalidProd, mockFarms);
      expect(resInvalid[0]!.isValid).toBe(false);
      expect(resInvalid[0]!.errors.some((e) => e.field === 'eggsProduced' && e.reason.includes('95%'))).toBe(true);

      // 940 eggs from 1000 birds is 94.0% -> valid
      const validProd = makeFile({ ...baseValidRow.data, Eggs: '940' });
      const resValid = validateParsedFile(validProd, mockFarms);
      expect(resValid[0]!.isValid).toBe(true);
    });

    it('should enforce shed temperature range (10°C to 50°C)', () => {
      // 8°C is below 10°C
      const tooCold = makeFile({ ...baseValidRow.data, Temp: '8' });
      const resCold = validateParsedFile(tooCold, mockFarms);
      expect(resCold[0]!.isValid).toBe(false);
      expect(resCold[0]!.errors.some((e) => e.field === 'temperature')).toBe(true);

      // 55°C is above 50°C
      const tooHot = makeFile({ ...baseValidRow.data, Temp: '55' });
      const resHot = validateParsedFile(tooHot, mockFarms);
      expect(resHot[0]!.isValid).toBe(false);
      expect(resHot[0]!.errors.some((e) => e.field === 'temperature')).toBe(true);

      // 32°C is within range
      const comfortable = makeFile({ ...baseValidRow.data, Temp: '32' });
      expect(validateParsedFile(comfortable, mockFarms)[0]!.isValid).toBe(true);
    });

    it('should validate ammonia level (0 - 50 PPM) and trigger warning above 10 PPM', () => {
      // 60 PPM exceeds 50 PPM limit -> invalid
      const toxic = makeFile({ ...baseValidRow.data, Ammonia: '60' });
      const resToxic = validateParsedFile(toxic, mockFarms);
      expect(resToxic[0]!.isValid).toBe(false);
      expect(resToxic[0]!.errors.some((e) => e.field === 'ammoniaPpm')).toBe(true);

      // 15 PPM is valid but generates safety warning (>10 PPM)
      const elevated = makeFile({ ...baseValidRow.data, Ammonia: '15' });
      const resElevated = validateParsedFile(elevated, mockFarms);
      expect(resElevated[0]!.isValid).toBe(true);
      expect(resElevated[0]!.warnings?.some((w) => w.field === 'ammoniaPpm' && w.message.includes('10 PPM'))).toBe(true);
    });

    it('should validate average egg weight (30g - 80g)', () => {
      const tooLight = makeFile({ ...baseValidRow.data, EggWeight: '25' });
      expect(validateParsedFile(tooLight, mockFarms)[0]!.isValid).toBe(false);

      const tooHeavy = makeFile({ ...baseValidRow.data, EggWeight: '90' });
      expect(validateParsedFile(tooHeavy, mockFarms)[0]!.isValid).toBe(false);

      const normal = makeFile({ ...baseValidRow.data, EggWeight: '62' });
      expect(validateParsedFile(normal, mockFarms)[0]!.isValid).toBe(true);
    });

    it('should validate body weight (500g - 3,000g) when provided', () => {
      const underWeight = makeFile({ ...baseValidRow.data, BodyWeight: '450' });
      expect(validateParsedFile(underWeight, mockFarms)[0]!.isValid).toBe(false);

      const overWeight = makeFile({ ...baseValidRow.data, BodyWeight: '3200' });
      expect(validateParsedFile(overWeight, mockFarms)[0]!.isValid).toBe(false);

      const normalWeight = makeFile({ ...baseValidRow.data, BodyWeight: '1750' });
      expect(validateParsedFile(normalWeight, mockFarms)[0]!.isValid).toBe(true);
    });
  });

  describe('12. Tolerance of Formula Errors (#DIV/0!, #VALUE!, #REF!)', () => {
    it('should gracefully handle formula error strings without crashing', () => {
      const mockFile: ParsedFile = {
        id: 'pf_div0',
        file: new File([], 'formula_errors.xlsx'),
        name: 'formula_errors.xlsx',
        size: 1000,
        format: 'XLSX',
        assignedFarmId: 'AP12',
        headers: ['Date', 'Birds', 'Eggs', 'ActualRate'],
        mappings: [
          { fileHeader: 'Date', mappedField: 'submissionDate', confidence: 'HIGH', sampleValues: [] },
          { fileHeader: 'Birds', mappedField: 'birdCount', confidence: 'HIGH', sampleValues: [] },
          { fileHeader: 'Eggs', mappedField: 'eggsProduced', confidence: 'HIGH', sampleValues: [] },
          { fileHeader: 'ActualRate', mappedField: 'actualProductionPct', confidence: 'HIGH', sampleValues: [] },
        ],
        rawRows: [
          {
            rowNumber: 2,
            data: {
              Date: '2026-01-10',
              Birds: '1000',
              Eggs: '900',
              ActualRate: '#DIV/0!', // formula error from Excel
            },
          },
        ],
        detectedRecordType: 'DAILY_REPORT',
        status: 'PARSED',
      };

      const validated = validateParsedFile(mockFile, mockFarms);
      expect(validated).toHaveLength(1);
      // Formula error should be tolerated and not invalidate the row
      expect(validated[0]!.isValid).toBe(true);
      expect(validated[0]!.actualProductionPct).toBeUndefined();
    });
  });

  describe('13. Multi-Farm Vertical Report (Daily_Reports_...) Handling', () => {
    it('should accurately parse multi-farm rows and assign each to the correct farm', () => {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([
        ['Date', 'Farm ID', 'Bird Count', 'Feed (Kg)', 'Mortality'],
        ['2026-09-01', 'AP12', 1200, 130, 0],
        ['2026-09-01', 'AP13', 1500, 160, 1],
        ['2026-09-02', 'AP12', 1200, 130, 0],
        ['2026-09-02', 'AP13', 1499, 160, 2],
      ]);
      XLSX.utils.book_append_sheet(wb, ws, 'DailyReports');

      const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
      const sheets = parseXlsxWorkbook(buf, 'Daily_Reports.xlsx', mockFarms);
      expect(sheets).toHaveLength(1);

      const parsedFile: ParsedFile = {
        id: 'pf_vertical_multi',
        file: new File([], 'Daily_Reports.xlsx'),
        name: 'Daily_Reports.xlsx',
        size: buf.byteLength,
        format: 'XLSX',
        headers: sheets[0]!.headers,
        mappings: sheets[0]!.mappings,
        rawRows: sheets[0]!.rows,
        detectedRecordType: 'DAILY_REPORT',
        status: 'PARSED',
      };

      const validated = validateParsedFile(parsedFile, mockFarms);
      expect(validated).toHaveLength(4);

      const ap12Rows = validated.filter((r) => r.farmId === 'AP12');
      const ap13Rows = validated.filter((r) => r.farmId === 'AP13');

      expect(ap12Rows).toHaveLength(2);
      expect(ap13Rows).toHaveLength(2);
      expect(ap12Rows.every((r) => r.isValid)).toBe(true);
      expect(ap13Rows.every((r) => r.isValid)).toBe(true);
    });
  });

  describe('14. Dry-Run Import Simulation Support', () => {
    it('should support dry-run simulation mode without committing writes', async () => {
      const testRows: ValidatedRow[] = [
        {
          fileId: 'f1',
          rowNumber: 2,
          fileName: 'test.xlsx',
          recordType: 'DAILY_REPORT',
          farmId: 'AP12',
          submissionDate: '2026-01-10',
          rawDate: '2026-01-10',
          birdCount: 1200,
          feedKg: 130,
          mortality: 0,
          culling: 0,
          eggsProduced: 1050,
          isValid: true,
          errors: [],
          conflictStatus: 'NEW',
        },
        {
          fileId: 'f1',
          rowNumber: 3,
          fileName: 'test.xlsx',
          recordType: 'DAILY_REPORT',
          farmId: 'AP12',
          submissionDate: '2026-01-11',
          rawDate: '2026-01-11',
          birdCount: 1200,
          feedKg: 130,
          mortality: 1,
          culling: 0,
          eggsProduced: 1060,
          isValid: true,
          errors: [],
          conflictStatus: 'EXACT_DUPLICATE',
        },
      ];

      const simResult = await executeHistoricalImport(
        testRows,
        'skip',
        undefined,
        { dryRun: true },
      );

      expect(simResult.isDryRun).toBe(true);
      expect(simResult.status).toBe('SIMULATED');
      expect(simResult.totalProcessed).toBe(2);
      expect(simResult.importedCount).toBe(1);
      expect(simResult.duplicateCount).toBe(1);
      expect(simResult.skippedCount).toBe(1);
    });
  });

  describe('15. Customer Sample Production Curve (july - sep) .xlsx Parsing & Validation', () => {
    const customerFarms: FarmDoc[] = [
      { farmId: 'AP12', name: 'AP12', active: true, location: 'Unit 12' },
      { farmId: 'AP14', name: 'ap10', active: true, location: 'Unit 14' },
      { farmId: 'AP15', name: 'ap11', active: true, location: 'Unit 15' },
    ];

    it('should parse synthetic matrix with date serials, selection percentages, and formula errors with 100% validity', () => {
      const wb = XLSX.utils.book_new();
      // Excel serial 46175 = 2026-06-02, 46176 = 2026-06-03
      const ws: any = {
        '!ref': 'A1:C12',
        A1: { t: 's', v: 'Farm : AP14' },
        A2: { t: 's', v: '' },
        B2: { t: 'n', v: 46175, w: '6/2/26', z: 'm/d/yy' },
        C2: { t: 'n', v: 46176, w: '6/3/26', z: 'm/d/yy' },
        A3: { t: 's', v: 'WEEKS' },
        B3: { t: 'n', v: 24.1 },
        C3: { t: 'n', v: 24.2 },
        A4: { t: 's', v: 'NO.OF BIRDS' },
        B4: { t: 'n', v: 2197 },
        C4: { t: 'n', v: 2197 },
        A5: { t: 's', v: 'PRODUCTION' },
        B5: { t: 'n', v: 1956 },
        C5: { t: 'n', v: 1960 },
        A6: { t: 's', v: 'SELECTION' },
        B6: { t: 'n', v: 1922 },
        C6: { t: 'n', v: 1930 },
        A7: { t: 's', v: 'SELECTION %' },
        B7: { t: 'n', v: 98.26, f: 'B6/B5*100' },
        C7: { t: 'n', v: 98.47, f: 'C6/C5*100' },
        A8: { t: 's', v: 'DAMAGE/REJECTED' },
        B8: { t: 'n', v: 34 },
        C8: { t: 'n', v: 30 },
        A9: { t: 's', v: 'Feed Kgs' },
        B9: { t: 'n', v: 245 },
        C9: { t: 'n', v: 245 },
        A10: { t: 's', v: 'AVG' }, // Summary row that should NOT map to bird body weight
        B10: { t: 'n', v: 67.1 },
        C10: { t: 'n', v: 67.5 },
        A11: { t: 's', v: 'ACT %' },
        B11: { t: 'e', v: 7, w: '#DIV/0!', f: 'B5/B4' }, // Formula error
        C11: { t: 'n', v: 89.2, f: 'C5/C4*100' },
        A12: { t: 's', v: '88' }, // Non-data label with no data across dates
        B12: { t: 's', v: '' },
        C12: { t: 's', v: '' },
      };
      XLSX.utils.book_append_sheet(wb, ws, 'AP14');
      const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

      const sheets = parseXlsxWorkbook(buf, 'Sample.xlsx', customerFarms);
      expect(sheets).toHaveLength(1);
      const s = sheets[0]!;

      expect(s.sheetName).toBe('AP14');
      expect(s.detectedFarmId).toBe('AP14');
      expect(s.isTransposed).toBe(true);
      expect(s.rows).toHaveLength(2); // 2 date columns
      expect(s.totalFormulaCount).toBeGreaterThan(0);
      expect(s.formulaErrorCount).toBe(1);

      // Verify ignored non-data footer row
      expect(s.ignoredNonDataRows?.some((r) => r.label === '88')).toBe(true);

      // Verify column mappings
      const selCountMap = s.mappings.find((m) => m.fileHeader === 'SELECTION');
      expect(selCountMap?.mappedField).toBe('selectionEggs');

      const selPctMap = s.mappings.find((m) => m.fileHeader === 'SELECTION %');
      expect(selPctMap?.mappedField).not.toBe('selectionEggs'); // Not overwritten!

      const avgMap = s.mappings.find((m) => m.fileHeader === 'AVG');
      expect(avgMap?.mappedField).not.toBe('bodyWeightAvg'); // Not mapped to body weight!

      // Validate parsed file
      const parsedFile: ParsedFile = {
        id: 'pf_synth_ap14',
        file: new File([], 'Sample.xlsx'),
        name: 'Sample.xlsx [AP14]',
        sheetName: 'AP14',
        size: buf.byteLength,
        format: 'XLSX',
        assignedFarmId: 'AP14',
        headers: s.headers,
        mappings: s.mappings,
        rawRows: s.rows,
        detectedRecordType: 'DAILY_REPORT',
        status: 'PARSED',
      };

      const validated = validateParsedFile(parsedFile, customerFarms);
      expect(validated).toHaveLength(2);
      expect(validated[0]!.isValid).toBe(true);
      expect(validated[1]!.isValid).toBe(true);

      // Check date is June 2, NOT Feb 6
      expect(validated[0]!.submissionDate).toBe('2026-06-02');
      expect(validated[0]!.birdCount).toBe(2197);
      expect(validated[0]!.eggsProduced).toBe(1956);
      expect(validated[0]!.selectionEggs).toBe(1922);
      expect(validated[0]!.damagedEggs).toBe(34);
      expect(validated[0]!.feedKg).toBe(245);
      expect(validated[0]!.bodyWeight).toBeUndefined(); // AVG was not treated as body weight

      expect(validated[1]!.submissionDate).toBe('2026-06-03');
    });

    it('should parse real customer Sample Production Curve (july - sep) .xlsx with 100% validity when present', () => {
      const candidates = [
        'C:\\Users\\SRIRAM\\Downloads\\Sample Production Curve (july - sep) .xlsx',
        'C:\\Users\\SRIRAM\\Downloads\\Sample Production Curve (july - sep).xlsx',
      ];
      const realPath = candidates.find((p) => fs.existsSync(p));
      if (!realPath) return; // skip if file not found locally

      const fileBuffer = fs.readFileSync(realPath);
      const sheets = parseXlsxWorkbook(fileBuffer, path.basename(realPath), customerFarms);

      // Standard reference curve sheets should be detected
      const cfStd = sheets.find((s) => s.sheetName.toLowerCase().includes('cage free'));
      expect(cfStd?.isReferenceSheet).toBe(true);

      const frStd = sheets.find((s) => s.sheetName.toLowerCase().includes('free range'));
      expect(frStd?.isReferenceSheet).toBe(true);

      // Check AP14 sheet
      const ap14Sheet = sheets.find((s) => s.sheetName === 'AP14');
      if (!ap14Sheet) return; // skip if AP14 sheet not present in this workbook version
      expect(ap14Sheet).toBeDefined();
      expect(ap14Sheet!.detectedFarmId).toBe('AP14');
      expect(ap14Sheet!.isTransposed).toBe(true);
      expect(ap14Sheet!.rows.length).toBe(120);

      const ap14ParsedFile: ParsedFile = {
        id: 'pf_ap14_real',
        file: new File([], path.basename(realPath)),
        name: `${path.basename(realPath)} [AP14]`,
        sheetName: 'AP14',
        size: fileBuffer.byteLength,
        format: 'XLSX',
        assignedFarmId: 'AP14',
        headers: ap14Sheet!.headers,
        mappings: ap14Sheet!.mappings,
        rawRows: ap14Sheet!.rows,
        detectedRecordType: 'DAILY_REPORT',
        status: 'PARSED',
      };

      const ap14Validated = validateParsedFile(ap14ParsedFile, customerFarms);
      expect(ap14Validated).toHaveLength(120);

      // CRITICAL: 0 invalid rows!
      const invalidRows = ap14Validated.filter((r) => !r.isValid);
      expect(invalidRows).toHaveLength(0);

      // Date order: June 2 to Sept 29
      expect(ap14Validated[0]!.submissionDate).toBe('2026-06-02');
      expect(ap14Validated[ap14Validated.length - 1]!.submissionDate).toBe('2026-09-29');

      // Metric integrity
      expect(ap14Validated[0]!.openingBirdCount).toBe(2453);
      expect(ap14Validated[0]!.closingBirdCount).toBe(2452);
      expect(ap14Validated[0]!.birdCount).toBe(2452);
      expect(ap14Validated[0]!.eggsProduced).toBe(1956);
      expect(ap14Validated[0]!.selectionEggs).toBe(1922);
      expect(ap14Validated[0]!.damagedEggs).toBe(34);
      expect(ap14Validated[0]!.feedKg).toBe(250);

      // Check AP15 sheet
      const ap15Sheet = sheets.find((s) => s.sheetName === 'AP15');
      expect(ap15Sheet).toBeDefined();
      expect(ap15Sheet!.detectedFarmId).toBe('AP15');
      expect(ap15Sheet!.rows.length).toBe(116);

      const ap15ParsedFile: ParsedFile = {
        id: 'pf_ap15_real',
        file: new File([], path.basename(realPath)),
        name: `${path.basename(realPath)} [AP15]`,
        sheetName: 'AP15',
        size: fileBuffer.byteLength,
        format: 'XLSX',
        assignedFarmId: 'AP15',
        headers: ap15Sheet!.headers,
        mappings: ap15Sheet!.mappings,
        rawRows: ap15Sheet!.rows,
        detectedRecordType: 'DAILY_REPORT',
        status: 'PARSED',
      };
      const ap15Validated = validateParsedFile(ap15ParsedFile, customerFarms);
      expect(ap15Validated).toHaveLength(116);
      expect(ap15Validated.filter((r) => !r.isValid)).toHaveLength(0);

      // Check AP12 sheet
      const ap12Sheet = sheets.find((s) => s.sheetName === 'AP12');
      expect(ap12Sheet).toBeDefined();
      expect(ap12Sheet!.detectedFarmId).toBe('AP12');
      expect(ap12Sheet!.rows.length).toBe(126);

      const ap12ParsedFile: ParsedFile = {
        id: 'pf_ap12_real',
        file: new File([], path.basename(realPath)),
        name: `${path.basename(realPath)} [AP12]`,
        sheetName: 'AP12',
        size: fileBuffer.byteLength,
        format: 'XLSX',
        assignedFarmId: 'AP12',
        headers: ap12Sheet!.headers,
        mappings: ap12Sheet!.mappings,
        rawRows: ap12Sheet!.rows,
        detectedRecordType: 'DAILY_REPORT',
        status: 'PARSED',
      };
      const ap12Validated = validateParsedFile(ap12ParsedFile, customerFarms);
      expect(ap12Validated).toHaveLength(126);
      expect(ap12Validated.filter((r) => !r.isValid)).toHaveLength(0);
    });
  });

  describe('16. Individual Worksheet Revert & Full Batch Revert Lifecycle', () => {
    it('16.1 should extract worksheet contributions using getBatchWorksheets for structured batches', () => {
      const mockBatch = {
        batchId: 'BATCH-2026-09-29-001',
        status: 'COMPLETED',
        revertStatus: 'NONE',
        worksheets: [
          {
            worksheetKey: 'Sample.xlsx [AP12]',
            fileName: 'Sample.xlsx [AP12]',
            sheetName: 'AP12',
            farmId: 'AP12',
            importedCount: 85,
            status: 'IMPORTED',
          },
          {
            worksheetKey: 'Sample.xlsx [AP14]',
            fileName: 'Sample.xlsx [AP14]',
            sheetName: 'AP14',
            farmId: 'AP14',
            importedCount: 85,
            status: 'IMPORTED',
          },
          {
            worksheetKey: 'Sample.xlsx [AP15]',
            fileName: 'Sample.xlsx [AP15]',
            sheetName: 'AP15',
            farmId: 'AP15',
            importedCount: 85,
            status: 'IMPORTED_WITH_ERRORS',
          },
        ],
      };

      const sheets = getBatchWorksheets(mockBatch);
      expect(sheets).toHaveLength(3);
      expect(sheets[0]!.sheetName).toBe('AP12');
      expect(sheets[1]!.sheetName).toBe('AP14');
      expect(sheets[2]!.sheetName).toBe('AP15');
      expect(sheets[2]!.status).toBe('IMPORTED_WITH_ERRORS');
    });

    it('16.2 should fallback gracefully and extract worksheets from filenames for legacy batches', () => {
      const legacyBatch = {
        batchId: 'BATCH-LEGACY-001',
        status: 'COMPLETED',
        revertStatus: 'PARTIALLY_REVERTED',
        importedCount: 170,
        filenames: ['Sample Production Curve (july - sep).xlsx [AP12]', 'Sample Production Curve (july - sep).xlsx [AP14]'],
        affectedFarms: ['AP12', 'AP14'],
      };

      const sheets = getBatchWorksheets(legacyBatch);
      expect(sheets).toHaveLength(2);
      expect(sheets[0]!.sheetName).toBe('AP12');
      expect(sheets[0]!.farmId).toBe('AP12');
      expect(sheets[1]!.sheetName).toBe('AP14');
      expect(sheets[1]!.farmId).toBe('AP14');
      expect(sheets[0]!.status).toBe('PARTIALLY_REVERTED');
    });

    it('16.3 should build worksheet contribution metadata when executing multi-worksheet imports', async () => {
      const multiSheetRows: ValidatedRow[] = [
        {
          fileId: 'f_ap12',
          rowNumber: 2,
          fileName: 'Production Curve.xlsx [AP12]',
          recordType: 'DAILY_REPORT',
          farmId: 'AP12',
          submissionDate: '2026-07-01',
          rawDate: '2026-07-01',
          birdCount: 2200,
          feedKg: 240,
          mortality: 1,
          eggsProduced: 1950,
          isValid: true,
          errors: [],
          conflictStatus: 'NEW',
        },
        {
          fileId: 'f_ap14',
          rowNumber: 2,
          fileName: 'Production Curve.xlsx [AP14]',
          recordType: 'DAILY_REPORT',
          farmId: 'AP14',
          submissionDate: '2026-07-01',
          rawDate: '2026-07-01',
          birdCount: 2197,
          feedKg: 245,
          mortality: 2,
          eggsProduced: 1956,
          isValid: true,
          errors: [],
          conflictStatus: 'NEW',
        },
        {
          fileId: 'f_ap15',
          rowNumber: 2,
          fileName: 'Production Curve.xlsx [AP15]',
          recordType: 'DAILY_REPORT',
          farmId: 'AP15',
          submissionDate: '2026-07-01',
          rawDate: '2026-07-01',
          birdCount: 2180,
          feedKg: 250,
          mortality: 5,
          eggsProduced: 1900,
          isValid: true,
          errors: [],
          conflictStatus: 'NEW',
        },
      ];

      const simResult = await executeHistoricalImport(
        multiSheetRows,
        'skip',
        undefined,
        { dryRun: true },
      );

      expect(simResult.isDryRun).toBe(true);
      expect(simResult.worksheets).toHaveLength(3);
      const ap12Meta = simResult.worksheets!.find((w: any) => w.sheetName === 'AP12');
      const ap14Meta = simResult.worksheets!.find((w: any) => w.sheetName === 'AP14');
      const ap15Meta = simResult.worksheets!.find((w: any) => w.sheetName === 'AP15');

      expect(ap12Meta).toBeDefined();
      expect(ap12Meta!.importedCount).toBe(1);
      expect(ap12Meta!.farmId).toBe('AP12');

      expect(ap14Meta).toBeDefined();
      expect(ap14Meta!.importedCount).toBe(1);
      expect(ap14Meta!.farmId).toBe('AP14');

      expect(ap15Meta).toBeDefined();
      expect(ap15Meta!.importedCount).toBe(1);
      expect(ap15Meta!.farmId).toBe('AP15');
    });

    it('16.4 should correctly isolate and calculate status transitions for individual worksheet revert vs full revert', () => {
      // Simulation of worksheet state reducer
      const initialWorksheets: WorksheetImportContribution[] = [
        {
          worksheetKey: 'Sample.xlsx [AP12]',
          fileName: 'Sample.xlsx [AP12]',
          sheetName: 'AP12',
          farmId: 'AP12',
          importedCount: 85,
          createdCount: 85,
          updatedCount: 0,
          skippedCount: 0,
          failedCount: 0,
          status: 'IMPORTED',
          importTimestamp: '2026-09-29T10:00:00Z',
          canSafelyRevert: true,
        },
        {
          worksheetKey: 'Sample.xlsx [AP14]',
          fileName: 'Sample.xlsx [AP14]',
          sheetName: 'AP14',
          farmId: 'AP14',
          importedCount: 85,
          createdCount: 85,
          updatedCount: 0,
          skippedCount: 0,
          failedCount: 0,
          status: 'IMPORTED',
          importTimestamp: '2026-09-29T10:00:00Z',
          canSafelyRevert: true,
        },
        {
          worksheetKey: 'Sample.xlsx [AP15]',
          fileName: 'Sample.xlsx [AP15]',
          sheetName: 'AP15',
          farmId: 'AP15',
          importedCount: 85,
          createdCount: 85,
          updatedCount: 0,
          skippedCount: 0,
          failedCount: 1,
          status: 'IMPORTED_WITH_ERRORS',
          importTimestamp: '2026-09-29T10:00:00Z',
          canSafelyRevert: true,
        },
      ];

      // Step A: Revert AP15 alone
      const targetKey = 'Sample.xlsx [AP15]';
      const afterAp15Revert = initialWorksheets.map((w) =>
        w.worksheetKey === targetKey
          ? { ...w, status: 'REVERTED' as const, revertTimestamp: '2026-09-29T10:15:00Z' }
          : w,
      );

      const allRevertedA = afterAp15Revert.every((w) => w.status === 'REVERTED');
      const anyRevertedA = afterAp15Revert.some((w) => w.status === 'REVERTED');
      const derivedBatchStatusA = allRevertedA ? 'REVERTED' : anyRevertedA ? 'PARTIALLY_REVERTED' : 'COMPLETED';

      expect(derivedBatchStatusA).toBe('PARTIALLY_REVERTED');
      expect(afterAp15Revert.find((w) => w.sheetName === 'AP15')!.status).toBe('REVERTED');
      expect(afterAp15Revert.find((w) => w.sheetName === 'AP12')!.status).toBe('IMPORTED');
      expect(afterAp15Revert.find((w) => w.sheetName === 'AP14')!.status).toBe('IMPORTED');

      // Step B: Revert the rest of the batch (AP12 & AP14)
      const afterFullRevert = afterAp15Revert.map((w) => ({
        ...w,
        status: 'REVERTED' as const,
        revertTimestamp: '2026-09-29T10:20:00Z',
      }));

      const allRevertedB = afterFullRevert.every((w) => w.status === 'REVERTED');
      const derivedBatchStatusB = allRevertedB ? 'REVERTED' : 'PARTIALLY_REVERTED';

      expect(derivedBatchStatusB).toBe('REVERTED');
      expect(afterFullRevert.every((w) => w.status === 'REVERTED')).toBe(true);
    });

    it('16.5 should detect post-import edits and protect modified documents from deletion', () => {
      const originalBatchId = 'BATCH-2026-09-29-ORIG';
      const manifestItem = {
        docId: 'AP14_2026-07-05',
        action: 'CREATED',
        submissionVersion: 1,
        sourceFile: 'Sample.xlsx [AP14]',
      };

      // Case 1: Document was untouched since import
      const untouchedDoc = {
        importBatchId: 'BATCH-2026-09-29-ORIG',
        submissionVersion: 1,
      };
      const isUntouchedSafe =
        untouchedDoc.importBatchId === originalBatchId &&
        untouchedDoc.submissionVersion <= manifestItem.submissionVersion;
      expect(isUntouchedSafe).toBe(true);

      // Case 2: Document was subsequently edited by admin or farmer (version bumped)
      const modifiedDoc = {
        importBatchId: 'BATCH-2026-09-29-ORIG',
        submissionVersion: 2, // Modified later!
      };
      const isModifiedSafe =
        modifiedDoc.importBatchId === originalBatchId &&
        modifiedDoc.submissionVersion <= manifestItem.submissionVersion;
      expect(isModifiedSafe).toBe(false);

      // Case 3: Document was overwritten by another subsequent batch import
      const overwrittenDoc = {
        importBatchId: 'BATCH-2026-09-30-NEW',
        submissionVersion: 1,
      };
      const isOverwrittenSafe = overwrittenDoc.importBatchId === originalBatchId;
      expect(isOverwrittenSafe).toBe(false);
    });
  });

  describe('17. Farmer Daily Report Mapping, Direct Storage & Compatibility (Tests A - F)', () => {
    describe('Test A: Mapping validation', () => {
      it('should accurately detect all customer workbook headers with valid ERP destinations', () => {
        const customerHeaders = [
          'Date',
          'WEEKS',
          'NO.OF BIRDS',
          'PRODUCTION',
          'SELECTION',
          'SELECTION %',
          'DAMAGE/REJECTED',
          'Mortality',
          'Temp',
          'Feed Kgs',
          'Feed Gms/Bird',
          'STD %',
          'ACT %',
          'AVG',
        ];

        const sampleRows = [
          {
            rowNumber: 2,
            data: {
              Date: '6/2/26',
              WEEKS: '44',
              'NO.OF BIRDS': '2453',
              PRODUCTION: '1956',
              SELECTION: '1922',
              'SELECTION %': '98.26',
              'DAMAGE/REJECTED': '34',
              Mortality: '1',
              Temp: '36',
              'Feed Kgs': '250',
              'Feed Gms/Bird': '102',
              'STD %': '87.26',
              'ACT %': '79.74',
              AVG: '67.10',
            },
          },
        ];

        const { mappings, detectedType } = detectColumnMappings(customerHeaders, sampleRows);
        expect(detectedType).toBe('DAILY_REPORT');

        const mappingMap = new Map(mappings.map((m) => [m.fileHeader, m]));

        // Supported fields must have HIGH confidence and valid destination
        expect(mappingMap.get('Date')?.mappedField).toBe('submissionDate');
        expect(mappingMap.get('Date')?.confidence).toBe('HIGH');

        expect(mappingMap.get('WEEKS')?.mappedField).toBe('weekNumber');
        expect(mappingMap.get('WEEKS')?.confidence).toBe('HIGH');

        expect(mappingMap.get('NO.OF BIRDS')?.mappedField).toBe('birdCount');
        expect(mappingMap.get('NO.OF BIRDS')?.confidence).toBe('HIGH');

        expect(mappingMap.get('PRODUCTION')?.mappedField).toBe('eggsProduced');
        expect(mappingMap.get('PRODUCTION')?.confidence).toBe('HIGH');

        expect(mappingMap.get('SELECTION')?.mappedField).toBe('selectionEggs');
        expect(mappingMap.get('SELECTION')?.confidence).toBe('HIGH');

        expect(mappingMap.get('DAMAGE/REJECTED')?.mappedField).toBe('damagedEggs');
        expect(mappingMap.get('DAMAGE/REJECTED')?.confidence).toBe('HIGH');

        expect(mappingMap.get('Mortality')?.mappedField).toBe('mortality');
        expect(mappingMap.get('Mortality')?.confidence).toBe('HIGH');

        expect(mappingMap.get('Temp')?.mappedField).toBe('temperature');
        expect(mappingMap.get('Temp')?.confidence).toBe('HIGH');

        expect(mappingMap.get('Feed Kgs')?.mappedField).toBe('feedKg');
        expect(mappingMap.get('Feed Kgs')?.confidence).toBe('HIGH');

        expect(mappingMap.get('Feed Gms/Bird')?.mappedField).toBe('feedGramsPerBird');
        expect(mappingMap.get('Feed Gms/Bird')?.confidence).toBe('HIGH');

        expect(mappingMap.get('STD %')?.mappedField).toBe('standardProductionPct');
        expect(mappingMap.get('STD %')?.confidence).toBe('HIGH');

        expect(mappingMap.get('ACT %')?.mappedField).toBe('actualProductionPct');
        expect(mappingMap.get('ACT %')?.confidence).toBe('HIGH');

        // Ambiguous generic statistic (AVG) must require manual user selection
        expect(mappingMap.get('AVG')?.mappedField).toBe('ignore');
        expect(mappingMap.get('AVG')?.confidence).toBe('AMBIGUOUS');

        // Calculated formula percentages must default to ignore
        expect(mappingMap.get('SELECTION %')?.mappedField).toBe('ignore');
      });
    });

    describe('Test B: Daily report import verification', () => {
      it('should validate and correctly derive opening, closing, and bird counts', () => {
        const sampleFile: ParsedFile = {
          id: 'pf_customer_ap14',
          file: new File([], 'Sample Production Curve.xlsx'),
          name: 'Sample Production Curve.xlsx',
          size: 2048,
          format: 'XLSX',
          assignedFarmId: 'AP12',
          headers: [
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
          ],
          mappings: [
            { fileHeader: 'Date', mappedField: 'submissionDate', confidence: 'HIGH', sampleValues: ['6/2/26'] },
            { fileHeader: 'WEEKS', mappedField: 'weekNumber', confidence: 'HIGH', sampleValues: ['44.1'] },
            { fileHeader: 'NO.OF BIRDS', mappedField: 'birdCount', confidence: 'HIGH', sampleValues: ['2453'] },
            { fileHeader: 'PRODUCTION', mappedField: 'eggsProduced', confidence: 'HIGH', sampleValues: ['1956'] },
            { fileHeader: 'SELECTION', mappedField: 'selectionEggs', confidence: 'HIGH', sampleValues: ['1922'] },
            { fileHeader: 'DAMAGE/REJECTED', mappedField: 'damagedEggs', confidence: 'HIGH', sampleValues: ['34'] },
            { fileHeader: 'Mortality', mappedField: 'mortality', confidence: 'HIGH', sampleValues: ['1'] },
            { fileHeader: 'Temp', mappedField: 'temperature', confidence: 'HIGH', sampleValues: ['36'] },
            { fileHeader: 'Feed Kgs', mappedField: 'feedKg', confidence: 'HIGH', sampleValues: ['250'] },
            { fileHeader: 'Feed Gms/Bird', mappedField: 'feedGramsPerBird', confidence: 'HIGH', sampleValues: ['102'] },
            { fileHeader: 'STD %', mappedField: 'standardProductionPct', confidence: 'HIGH', sampleValues: ['87.26'] },
            { fileHeader: 'ACT %', mappedField: 'actualProductionPct', confidence: 'HIGH', sampleValues: ['79.74'] },
          ],
          rawRows: [
            {
              rowNumber: 2,
              data: {
                Date: '2026-06-02',
                WEEKS: '44.1',
                'NO.OF BIRDS': '2453',
                PRODUCTION: '1956',
                SELECTION: '1922',
                'DAMAGE/REJECTED': '34',
                Mortality: '1',
                Temp: '36',
                'Feed Kgs': '250',
                'Feed Gms/Bird': '102',
                'STD %': '87.26',
                'ACT %': '79.74',
              },
            },
          ],
          detectedRecordType: 'DAILY_REPORT',
          status: 'PARSED',
        };

        const validated = validateParsedFile(sampleFile, mockFarms);
        expect(validated).toHaveLength(1);
        const row = validated[0]!;

        expect(row.isValid).toBe(true);
        expect(row.farmId).toBe('AP12');
        expect(row.submissionDate).toBe('2026-06-02');
        expect(row.openingBirdCount).toBe(2453);
        expect(row.mortality).toBe(1);
        expect(row.culling).toBe(0);
        // Closing bird count derived: 2453 - 1 = 2452
        expect(row.closingBirdCount).toBe(2452);
        expect(row.birdCount).toBe(2452);
        expect(row.feedKg).toBe(250);
        expect(row.feedGrams).toBe(250000);
        expect(row.feedGramsPerBird).toBe(102);
        expect(row.eggsProduced).toBe(1956);
        expect(row.selectionEggs).toBe(1922);
        expect(row.damagedEggs).toBe(34);
        expect(row.weekNumber).toBe(44.1);
        expect(row.weekLabel).toBe('44.1');
        expect(row.temperature).toBe(36);
        expect(row.actualProductionPct).toBe(79.74);
        expect(row.standardProductionPct).toBe(87.26);
      });
    });

    describe('Test C: Weekly fields verification', () => {
      it('should preserve null for missing bodyWeight and store positive bodyWeight on weekly weigh-in days', () => {
        const fileWithWeight: ParsedFile = {
          id: 'pf_weight_test',
          file: new File([], 'weekly_weight.xlsx'),
          name: 'weekly_weight.xlsx',
          size: 2048,
          format: 'XLSX',
          assignedFarmId: 'AP12',
          headers: ['Date', 'Birds', 'Eggs', 'AvgBodyWeight'],
          mappings: [
            { fileHeader: 'Date', mappedField: 'submissionDate', confidence: 'HIGH', sampleValues: [] },
            { fileHeader: 'Birds', mappedField: 'birdCount', confidence: 'HIGH', sampleValues: [] },
            { fileHeader: 'Eggs', mappedField: 'eggsProduced', confidence: 'HIGH', sampleValues: [] },
            { fileHeader: 'AvgBodyWeight', mappedField: 'bodyWeightAvg', confidence: 'HIGH', sampleValues: [] },
          ],
          rawRows: [
            // Day 1: Regular day without body weight
            {
              rowNumber: 2,
              data: { Date: '2026-06-01', Birds: '2000', Eggs: '1600', AvgBodyWeight: '' },
            },
            // Day 2: Weekly weigh-in day
            {
              rowNumber: 3,
              data: { Date: '2026-06-02', Birds: '2000', Eggs: '1610', AvgBodyWeight: '1550' },
            },
          ],
          detectedRecordType: 'DAILY_REPORT',
          status: 'PARSED',
        };

        const validated = validateParsedFile(fileWithWeight, mockFarms);
        expect(validated).toHaveLength(2);

        // Day 1: bodyWeight must be undefined (stored as null in Firestore, NOT { min: 0, max: 0, avg: 0 })
        expect(validated[0]!.bodyWeight).toBeUndefined();

        // Day 2: bodyWeight is accurately populated
        expect(validated[1]!.bodyWeight).toEqual({ min: 1550, max: 1550, avg: 1550 });
      });
    });

    describe('Test D: Existing application compatibility', () => {
      it('should produce records compatible with normalizeReport and KPI calculation functions', () => {
        const rawImportedLog: Record<string, any> = {
          userId: 'farmer_usr_123',
          submittedBy: 'admin_uid',
          farmId: 'AP12',
          flockId: 'flock_main',
          submissionDate: '2026-06-02',
          submissionMethod: 'HISTORICAL_IMPORT',
          submissionVersion: 1,
          status: 'submitted',
          openingBirdCount: 2453,
          closingBirdCount: 2452,
          birdCount: 2452,
          feedKg: 250,
          feedGrams: 250000,
          feedGramsPerBird: 102,
          weekNumber: 44,
          weekLabel: '44.1',
          mortality: 1,
          culling: 0,
          eggsProduced: 1956,
          selectionEggs: 1922,
          damagedEggs: 34,
          actualProductionPct: 79.74,
          standardProductionPct: 87.26,
          temperature: 36,
          bodyWeight: null,
          eggWeight: null,
          remarks: 'Imported historical record',
          isHistorical: true,
        };

        const normalized = normalizeReport('AP12_2026-06-02', rawImportedLog);

        expect(normalized.farmId).toBe('AP12');
        expect(normalized.submissionDate).toBe('2026-06-02');
        expect(normalized.birdCount).toBe(2452);
        expect(normalized.openingBirdCount).toBe(2453);
        expect(normalized.closingBirdCount).toBe(2452);
        expect(normalized.eggsProduced).toBe(1956);
        expect(normalized.selectionEggs).toBe(1922);
        expect(normalized.damagedEggs).toBe(34);
        expect(normalized.feedKg).toBe(250);
        expect(normalized.weekNumber).toBe(44);
        expect(normalized.weekLabel).toBe('44.1');
        expect(normalized.feedGramsPerBird).toBe(102);

        // Verify compatibility with existing KPI Calculations
        const prodRate = calcProductionRate(normalized.eggsProduced, normalized.birdCount);
        expect(prodRate).toBe(79.8); // 1956 / 2452 * 100 = 79.77% ≈ 79.8%

        const selRate = calcSelectionRate(normalized.selectionEggs, normalized.eggsProduced);
        expect(selRate).toBe(98.3); // 1922 / 1956 * 100 = 98.26% ≈ 98.3%

        const feedPerBird = calcFeedPerBird(normalized.feedKg, normalized.birdCount);
        expect(feedPerBird).toBe(102); // 250 * 1000 / 2452 ≈ 101.96 ≈ 102g
      });
    });

    describe('Test E: Invalid mapping & data prevention', () => {
      it('should reject records with missing required fields or impossible values', () => {
        const invalidFile: ParsedFile = {
          id: 'pf_invalid_test',
          file: new File([], 'invalid.xlsx'),
          name: 'invalid.xlsx',
          size: 1024,
          format: 'XLSX',
          // No assigned farm!
          headers: ['Date', 'Birds', 'Mortality'],
          mappings: [
            { fileHeader: 'Date', mappedField: 'submissionDate', confidence: 'HIGH', sampleValues: [] },
            { fileHeader: 'Birds', mappedField: 'birdCount', confidence: 'HIGH', sampleValues: [] },
            { fileHeader: 'Mortality', mappedField: 'mortality', confidence: 'HIGH', sampleValues: [] },
          ],
          rawRows: [
            // Row 1: Missing date and missing farm
            {
              rowNumber: 2,
              data: { Date: '', Birds: '2000', Mortality: '0' },
            },
            // Row 2: Impossible mortality exceeding total birds
            {
              rowNumber: 3,
              data: { Date: '2026-06-03', Birds: '100', Mortality: '250' },
            },
          ],
          detectedRecordType: 'DAILY_REPORT',
          status: 'PARSED',
        };

        const validated = validateParsedFile(invalidFile, mockFarms);
        expect(validated).toHaveLength(2);

        // Row 1 must fail due to missing date and farm
        expect(validated[0]!.isValid).toBe(false);
        expect(validated[0]!.errors.some((e) => e.field === 'submissionDate')).toBe(true);
        expect(validated[0]!.errors.some((e) => e.field === 'farmId')).toBe(true);

        // Row 2 must fail due to mortality exceeding bird count
        expect(validated[1]!.isValid).toBe(false);
        expect(validated[1]!.errors.some((e) => e.field === 'mortality')).toBe(true);
      });
    });

    describe('Test F: Revert compatibility', () => {
      it('should support individual worksheet revert without corrupting sibling worksheets', () => {
        const batchContributions: WorksheetImportContribution[] = [
          {
            worksheetKey: 'Sample.xlsx [AP12]',
            fileName: 'Sample.xlsx',
            sheetName: 'AP12',
            farmId: 'AP12',
            status: 'IMPORTED',
            importedCount: 92,
            createdCount: 92,
            updatedCount: 0,
            skippedCount: 0,
            failedCount: 0,
            importTimestamp: '2026-09-29T10:00:00Z',
            revertStatus: 'NOT_REVERTED',
            canSafelyRevert: true,
          },
          {
            worksheetKey: 'Sample.xlsx [AP14]',
            fileName: 'Sample.xlsx',
            sheetName: 'AP14',
            farmId: 'AP14',
            status: 'IMPORTED',
            importedCount: 92,
            createdCount: 92,
            updatedCount: 0,
            skippedCount: 0,
            failedCount: 0,
            importTimestamp: '2026-09-29T10:00:00Z',
            revertStatus: 'NOT_REVERTED',
            canSafelyRevert: true,
          },
        ];

        // Simulate reverting only AP14
        const updated = batchContributions.map((w) => {
          if (w.worksheetKey === 'Sample.xlsx [AP14]') {
            return {
              ...w,
              status: 'REVERTED' as const,
              revertStatus: 'REVERTED' as const,
              revertTimestamp: '2026-09-29T10:15:00Z',
            };
          }
          return w;
        });

        // AP14 is reverted
        const ap14 = updated.find((w) => w.sheetName === 'AP14');
        expect(ap14?.status).toBe('REVERTED');
        expect(ap14?.revertStatus).toBe('REVERTED');

        // AP12 is completely untouched and remains active
        const ap12 = updated.find((w) => w.sheetName === 'AP12');
        expect(ap12?.status).toBe('IMPORTED');
        expect(ap12?.revertStatus).toBe('NOT_REVERTED');

        // Derived batch status is PARTIALLY_REVERTED
        const anyReverted = updated.some((w) => w.revertStatus === 'REVERTED');
        const allReverted = updated.every((w) => w.revertStatus === 'REVERTED');
        const batchStatus = allReverted ? 'REVERTED' : anyReverted ? 'PARTIALLY_REVERTED' : 'COMPLETED';
        expect(batchStatus).toBe('PARTIALLY_REVERTED');
      });
    });
  });

  describe('17. Firestore Sanitization, Batch Persistence & Failure Recovery', () => {
    it('17.1 should recursively convert undefined values to null to ensure compatibility with Firestore set/update', () => {
      const sampleDate = new Date();
      const input = {
        batchId: 'BATCH-001',
        missingField: undefined,
        nested: {
          subMissing: undefined,
          validValue: 'hello',
          count: 0,
        },
        items: [
          { name: 'Item 1', diff: undefined },
          { name: 'Item 2', diff: { before: undefined, after: 10 } },
        ],
        timestamp: sampleDate,
        nullValue: null,
      };

      const sanitized = sanitizeFirestoreData(input);

      expect(sanitized.batchId).toBe('BATCH-001');
      expect(sanitized.missingField).toBeNull();
      expect(sanitized.nested.subMissing).toBeNull();
      expect(sanitized.nested.validValue).toBe('hello');
      expect(sanitized.nested.count).toBe(0);
      expect(sanitized.items[0]!.diff).toBeNull();
      expect((sanitized.items[1]!.diff as any).before).toBeNull();
      expect((sanitized.items[1]!.diff as any).after).toBe(10);
      expect(sanitized.timestamp).toBe(sampleDate);
      expect(sanitized.nullValue).toBeNull();

      // Ensure no undefined values exist anywhere in JSON representation
      const jsonStr = JSON.stringify(sanitized);
      expect(jsonStr).not.toContain('undefined');
    });

    it('17.2 should include worksheets metadata and sanitize manifest when executing live imports', async () => {
      const originalWindowFirebase = (globalThis as any).window?.firebase;
      const mockSet = vi.fn().mockResolvedValue(true);

      (globalThis as any).window = {
        firebase: {
          apps: [{ name: '[DEFAULT]' }],
          auth: () => ({ currentUser: null }),
          firestore: () => ({
            batch: () => ({
              set: vi.fn(),
              commit: vi.fn().mockResolvedValue(true),
            }),
            collection: (col: string) => {
              if (col === 'users') {
                return {
                  where: () => ({
                    get: vi.fn().mockResolvedValue({
                      docs: [
                        { id: 'farmer-ap12', data: () => ({ role: 'farmer', farmIds: ['AP12'] }) },
                      ],
                    }),
                  }),
                };
              }
              return {
                doc: () => ({
                  id: 'mock_doc_id',
                  set: mockSet,
                  collection: () => ({
                    doc: () => ({ id: 'sub_doc_id', set: mockSet }),
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

      const rows: ValidatedRow[] = [
        {
          fileId: 'f1',
          rowNumber: 2,
          fileName: 'Sample.xlsx [AP12]',
          recordType: 'DAILY_REPORT',
          farmId: 'AP12',
          submissionDate: '2026-07-01',
          rawDate: '2026-07-01',
          birdCount: 2000,
          feedKg: 200,
          mortality: 0,
          eggsProduced: 1800,
          isValid: true,
          errors: [],
          conflictStatus: 'NEW',
          diff: undefined, // diff is undefined for new row
        },
      ];

      const result = await executeHistoricalImport(rows, 'skip');

      // Worksheets must be returned in live execution
      expect(result.worksheets).toBeDefined();
      expect(result.worksheets).toHaveLength(1);
      expect(result.worksheets![0]!.sheetName).toBe('AP12');
      expect(result.worksheets![0]!.farmId).toBe('AP12');
      expect(result.worksheets![0]!.importedCount).toBe(1);

      // Verify canonical targetDocs without top-level dailyReports
      const targetDocs = result.rawBatchRecord.manifest[0].targetDocs;
      expect(targetDocs).toContainEqual({
        collectionPath: 'dailyReports/farmer-ap12/dailyLogs',
        docId: '2026-07-01',
      });
      expect(targetDocs).toContainEqual({
        collectionPath: 'dailyReportLocks',
        docId: 'AP12_2026-07-01',
      });
      expect(targetDocs.some((d: any) => d.collectionPath === 'dailyReports')).toBe(false);

      // Verify historyWriteFailed is tracked
      expect(result.historyWriteFailed).toBe(false);
      expect(result.rawBatchRecord).toBeDefined();
      expect(result.rawBatchRecord.manifest[0].beforeData).toBeNull();

      if (originalWindowFirebase) {
        (globalThis as any).window.firebase = originalWindowFirebase;
      }
    });

    it('17.3 should safely flag historyWriteFailed and preserve rawBatchRecord if importBatches write fails', async () => {
      // Mock db.collection('importBatches').doc().set to fail
      const originalWindowFirebase = (globalThis as any).window?.firebase;
      const mockSet = vi.fn().mockRejectedValue(new Error('Permission denied writing importBatches'));

      (globalThis as any).window = {
        firebase: {
          apps: [{ name: '[DEFAULT]' }],
          auth: () => ({ currentUser: null }),
          firestore: () => ({
            batch: () => ({
              set: vi.fn(),
              commit: vi.fn().mockResolvedValue(true),
            }),
            collection: (col: string) => {
              if (col === 'importBatches') {
                return {
                  doc: () => ({
                    set: mockSet,
                  }),
                };
              }
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
                doc: () => ({
                  set: vi.fn().mockResolvedValue(true),
                  collection: () => ({
                    doc: () => ({ id: 'mock_doc', set: vi.fn().mockResolvedValue(true) }),
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

      const rows: ValidatedRow[] = [
        {
          fileId: 'f1',
          rowNumber: 2,
          fileName: 'Sample.xlsx [AP14]',
          recordType: 'DAILY_REPORT',
          farmId: 'AP14',
          submissionDate: '2026-07-02',
          rawDate: '2026-07-02',
          birdCount: 2100,
          feedKg: 210,
          mortality: 1,
          eggsProduced: 1850,
          isValid: true,
          errors: [],
          conflictStatus: 'NEW',
        },
      ];

      const result = await executeHistoricalImport(rows, 'skip');

      // Operation succeeds for data, but records failure for history
      expect(result.importedCount).toBe(1);
      expect(result.historyWriteFailed).toBe(true);
      expect(result.historyWriteError).toContain('Permission denied');
      expect(result.rawBatchRecord).toBeDefined();
      expect(result.rawBatchRecord.batchId).toBe(result.batchId);

      // Cleanup mock
      if (originalWindowFirebase) {
        (globalThis as any).window.firebase = originalWindowFirebase;
      }
    });

    it('17.4 should validate and save batch record on retry using saveImportBatchRecord', async () => {
      const mockSet = vi.fn().mockResolvedValue(true);
      (globalThis as any).window = {
        firebase: {
          apps: [{ name: '[DEFAULT]' }],
          auth: () => ({ currentUser: null }),
          firestore: () => ({
            collection: () => ({
              doc: () => ({
                set: mockSet,
              }),
            }),
          }),
        },
      };

      const batchToSave = {
        batchId: 'BATCH-RETRY-001',
        totalRows: 10,
        unsupported: undefined,
      };

      await saveImportBatchRecord(batchToSave);

      expect(mockSet).toHaveBeenCalledTimes(1);
      const savedPayload = mockSet.mock.calls[0]![0];
      expect(savedPayload.batchId).toBe('BATCH-RETRY-001');
      expect(savedPayload.unsupported).toBeNull();
    });

    it('17.5 should reject unmapped farm without fallback to admin in client execution', async () => {
      const mockBatchSet = vi.fn();
      const mockImportBatchSet = vi.fn().mockResolvedValue(true);
      (globalThis as any).window = {
        firebase: {
          apps: [{ name: '[DEFAULT]' }],
          auth: () => ({ currentUser: { uid: 'admin-fallback-test' } }),
          firestore: () => ({
            batch: () => ({
              set: mockBatchSet,
              commit: vi.fn().mockResolvedValue(true),
            }),
            collection: (col: string) => {
              if (col === 'importBatches') {
                return {
                  doc: () => ({
                    set: mockImportBatchSet,
                  }),
                };
              }
              if (col === 'users') {
                return {
                  where: () => ({
                    get: vi.fn().mockResolvedValue({ docs: [] }), // No farmers for AP99
                  }),
                };
              }
              return {
                doc: () => ({
                  set: vi.fn().mockResolvedValue(true),
                  collection: () => ({
                    doc: () => ({ id: 'mock_doc', set: vi.fn().mockResolvedValue(true) }),
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

      const rows: ValidatedRow[] = [
        {
          fileId: 'f_orphan',
          rowNumber: 2,
          fileName: 'Orphan.xlsx [AP99]',
          recordType: 'DAILY_REPORT',
          farmId: 'AP99',
          submissionDate: '2026-07-02',
          rawDate: '2026-07-02',
          birdCount: 1500,
          feedKg: 150,
          mortality: 0,
          eggsProduced: 1400,
          isValid: true,
          errors: [],
          conflictStatus: 'NEW',
        },
      ];

      const result = await executeHistoricalImport(rows, 'skip');
      expect(result.importedCount).toBe(0);
      expect(result.failedCount).toBe(1);
      expect(result.errors[0]?.reason).toContain("No registered farmer assigned to farm 'AP99'");
      expect(mockBatchSet).not.toHaveBeenCalled();
      expect(mockImportBatchSet).toHaveBeenCalled();
    });

    it('17.6 should reject ambiguous multiple farmer mappings in client execution', async () => {
      const mockBatchSet = vi.fn();
      const mockImportBatchSet = vi.fn().mockResolvedValue(true);
      (globalThis as any).window = {
        firebase: {
          apps: [{ name: '[DEFAULT]' }],
          auth: () => ({ currentUser: { uid: 'admin-fallback-test' } }),
          firestore: () => ({
            batch: () => ({
              set: mockBatchSet,
              commit: vi.fn().mockResolvedValue(true),
            }),
            collection: (col: string) => {
              if (col === 'importBatches') {
                return {
                  doc: () => ({
                    set: mockImportBatchSet,
                  }),
                };
              }
              if (col === 'users') {
                return {
                  where: () => ({
                    get: vi.fn().mockResolvedValue({
                      docs: [
                        { id: 'farmer-1', data: () => ({ role: 'farmer', farmIds: ['AP12'] }) },
                        { id: 'farmer-2', data: () => ({ role: 'farmer', farmIds: ['AP12'] }) },
                      ],
                    }),
                  }),
                };
              }
              return {
                doc: () => ({
                  set: vi.fn().mockResolvedValue(true),
                  collection: () => ({
                    doc: () => ({ id: 'mock_doc', set: vi.fn().mockResolvedValue(true) }),
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

      const rows: ValidatedRow[] = [
        {
          fileId: 'f_ambig',
          rowNumber: 2,
          fileName: 'Contested.xlsx [AP12]',
          recordType: 'DAILY_REPORT',
          farmId: 'AP12',
          submissionDate: '2026-07-02',
          rawDate: '2026-07-02',
          birdCount: 1500,
          feedKg: 150,
          mortality: 0,
          eggsProduced: 1400,
          isValid: true,
          errors: [],
          conflictStatus: 'NEW',
        },
      ];

      const result = await executeHistoricalImport(rows, 'skip');
      expect(result.importedCount).toBe(0);
      expect(result.failedCount).toBe(1);
      expect(result.errors[0]?.reason).toContain("Ambiguous farmer mapping for farm 'AP12'");
      expect(mockBatchSet).not.toHaveBeenCalled();
      expect(mockImportBatchSet).toHaveBeenCalled();
    });
  });
});

