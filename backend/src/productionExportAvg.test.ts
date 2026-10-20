import { describe, it, expect } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

describe('Production Curve Export: Worksheet AVG Row Regression Suite', () => {
  it('should accurately generate Row 14 AVG label and value, including zeroes and excluding blanks', async () => {
    const scriptPath = path.resolve(__dirname, '..', 'scripts', 'generate_production_curve.py');
    expect(fs.existsSync(scriptPath)).toBe(true);

    const tmpDir = path.resolve(__dirname, '..', 'scratch');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    const inputJsonPath = path.join(tmpDir, `test_avg_in_${Date.now()}.json`);
    const outputXlsxPath = path.join(tmpDir, `test_avg_out_${Date.now()}.xlsx`);

    const testPayload = {
      farms: [
        {
          farmId: 'FARM_MIXED',
          farmName: 'Farm Mixed ACT Test',
          productionCurve: 'CF_STD',
          initialBirds: 2000,
          reports: [
            // Day 1: Normal production (1600 / 2000 = 80.00%)
            {
              submissionDate: '2026-09-01',
              ageWeeks: 21.0,
              openingBirdCount: 2000,
              eggsProduced: 1600,
              selectionEggs: 1550,
              mortality: 0,
              culling: 0,
              temperature: 26.0,
              feedKg: 200,
            },
            // Day 2: Zero production (0 / 2000 = 0.00%) -> MUST BE INCLUDED IN AVG
            {
              submissionDate: '2026-09-02',
              ageWeeks: 21.1,
              openingBirdCount: 2000,
              eggsProduced: 0,
              selectionEggs: 0,
              mortality: 0,
              culling: 0,
              temperature: 26.0,
              feedKg: 200,
            },
            // Day 3: Missing / blank production -> MUST BE EXCLUDED FROM AVG
            {
              submissionDate: '2026-09-03',
              ageWeeks: 21.2,
              openingBirdCount: 2000,
              eggsProduced: null,
              selectionEggs: null,
              mortality: 0,
              culling: 0,
              temperature: 26.0,
              feedKg: 200,
            },
          ],
        },
        {
          farmId: 'FARM_EMPTY_SET',
          farmName: 'Farm Empty Valid Set',
          productionCurve: 'CF_STD',
          initialBirds: 2000,
          reports: [
            // Only blank production records
            {
              submissionDate: '2026-09-01',
              ageWeeks: 21.0,
              openingBirdCount: 2000,
              eggsProduced: null,
              selectionEggs: null,
            },
            {
              submissionDate: '2026-09-02',
              ageWeeks: 21.1,
              openingBirdCount: 2000,
              eggsProduced: null,
              selectionEggs: null,
            },
          ],
        },
      ],
    };

    fs.writeFileSync(inputJsonPath, JSON.stringify(testPayload), 'utf-8');

    try {
      const { stdout } = await execFileAsync('python', [scriptPath, inputJsonPath, outputXlsxPath]);
      expect(stdout).toContain('SUCCESS');
      expect(fs.existsSync(outputXlsxPath)).toBe(true);

      // Open generated XLSX via python openpyxl and inspect cell contents
      const inspectCmd = `
import openpyxl, json
wb = openpyxl.load_workbook(r'${outputXlsxPath}')
result = {}
for sheet_name in wb.sheetnames:
    ws = wb[sheet_name]
    result[sheet_name] = {
        'row13_label': ws.cell(13, 1).value,
        'row14_label': ws.cell(14, 1).value,
        'row13_values': [ws.cell(13, col).value if ws.cell(13, col).value is not None else '' for col in range(2, ws.max_column + 1)],
        'row14_values': [ws.cell(14, col).value if ws.cell(14, col).value is not None else '' for col in range(2, ws.max_column + 1)],
        'row14_formats': [ws.cell(14, col).number_format for col in range(2, ws.max_column + 1)],
    }
print(json.dumps(result))
`;
      const { stdout: inspectStdout } = await execFileAsync('python', ['-c', inspectCmd]);
      const inspectedData = JSON.parse(inspectStdout.trim());

      // 1. Verify FARM_MIXED
      const mixedSheet = inspectedData['Farm Mixed ACT Test'];
      expect(mixedSheet).toBeDefined();
      // Row 13 is ACT %, Row 14 is AVG
      expect(mixedSheet.row13_label).toBe('ACT %');
      expect(mixedSheet.row14_label).toBe('AVG');

      // Day 1 = 80%, Day 2 = 0%, Day 3 = '' (blank)
      expect(mixedSheet.row13_values[0]).toBe(80.0);
      expect(mixedSheet.row13_values[1]).toBe(0.0);
      expect(mixedSheet.row13_values[2]).toBe('');

      // AVG = (80.0 + 0.0) / 2 = 40.00 (Zero included, blank Day 3 excluded)
      expect(mixedSheet.row14_values[0]).toBe(40.0);
      expect(mixedSheet.row14_values[1]).toBe(40.0);
      expect(mixedSheet.row14_values[2]).toBe(40.0);
      expect(mixedSheet.row14_formats[0]).toBe('0.00');

      // 2. Verify FARM_EMPTY_SET
      const emptySheet = inspectedData['Farm Empty Valid Set'];
      expect(emptySheet).toBeDefined();
      expect(emptySheet.row13_label).toBe('ACT %');
      expect(emptySheet.row14_label).toBe('AVG');
      // When all production is blank, ACT % is blank and AVG is blank
      expect(emptySheet.row13_values[0]).toBe('');
      expect(emptySheet.row13_values[1]).toBe('');
      expect(emptySheet.row14_values[0]).toBe('');
      expect(emptySheet.row14_values[1]).toBe('');
    } finally {
      if (fs.existsSync(inputJsonPath)) fs.unlinkSync(inputJsonPath);
      if (fs.existsSync(outputXlsxPath)) fs.unlinkSync(outputXlsxPath);
    }
  }, 15000);
});
