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
  type ParsedFile,
  type ValidatedRow,
} from './historicalImportService';
import type { FarmDoc } from './farmDataService';

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
      expect(validated[0]!.birdCount).toBe(5000);
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
      expect(simResult.batchId).toContain('dry_run_');
    });
  });
});
