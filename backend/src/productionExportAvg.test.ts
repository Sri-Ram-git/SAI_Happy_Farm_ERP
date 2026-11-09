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

  it('should prioritize stored actualProductionPct over derived calculation and include stored zeroes in AVG', async () => {
    const scriptPath = path.resolve(__dirname, '..', 'scripts', 'generate_production_curve.py');
    expect(fs.existsSync(scriptPath)).toBe(true);

    const tmpDir = path.resolve(__dirname, '..', 'scratch');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    const inputJsonPath = path.join(tmpDir, `test_stored_act_in_${Date.now()}.json`);
    const outputXlsxPath = path.join(tmpDir, `test_stored_act_out_${Date.now()}.xlsx`);

    const testPayload = {
      farms: [
        {
          farmId: 'FARM_STORED_ACT',
          farmName: 'Farm Stored ACT Precedence',
          productionCurve: 'CF_STD',
          initialBirds: 2000,
          reports: [
            // Day 1: Derived would be (1500/2000)=75%, but stored is 78.60% -> MUST BE 78.60%
            {
              submissionDate: '2026-09-01',
              ageWeeks: 21.0,
              openingBirdCount: 2000,
              eggsProduced: 1500,
              selectionEggs: 1400,
              actualProductionPct: 78.60,
            },
            // Day 2: Stored numeric 0.0 -> MUST BE 0.00% (Not replaced by derived or treated as missing)
            {
              submissionDate: '2026-09-02',
              ageWeeks: 21.1,
              openingBirdCount: 2000,
              eggsProduced: 0,
              selectionEggs: 0,
              actualProductionPct: 0.0,
            },
            // Day 3: Missing stored (null) -> Falls back to derived (1600/2000)=80.00%
            {
              submissionDate: '2026-09-03',
              ageWeeks: 21.2,
              openingBirdCount: 2000,
              eggsProduced: 1600,
              selectionEggs: 1500,
              actualProductionPct: null,
            },
            // Day 4: Invalid stored (-10%) -> Falls back to derived (1600/2000)=80.00%
            {
              submissionDate: '2026-09-04',
              ageWeeks: 21.3,
              openingBirdCount: 2000,
              eggsProduced: 1600,
              selectionEggs: 1500,
              actualProductionPct: -10.0,
            },
            // Day 5: Blank both -> Excluded from AVG
            {
              submissionDate: '2026-09-05',
              ageWeeks: 21.4,
              openingBirdCount: 2000,
              eggsProduced: null,
              selectionEggs: null,
              actualProductionPct: null,
            },
          ],
        },
        {
          farmId: 'FARM_INDEPENDENT',
          farmName: 'Farm Independent Isolation',
          productionCurve: 'CF_STD',
          initialBirds: 1000,
          reports: [
            {
              submissionDate: '2026-09-01',
              ageWeeks: 21.0,
              openingBirdCount: 1000,
              eggsProduced: 900,
              actualProductionPct: 90.0,
            },
          ],
        },
      ],
    };

    fs.writeFileSync(inputJsonPath, JSON.stringify(testPayload), 'utf-8');

    try {
      const { stdout } = await execFileAsync('python', [scriptPath, inputJsonPath, outputXlsxPath]);
      expect(stdout).toContain('SUCCESS');

      const inspectCmd = `
import openpyxl, json
wb = openpyxl.load_workbook(r'${outputXlsxPath}')
result = {}
for sheet_name in wb.sheetnames:
    ws = wb[sheet_name]
    result[sheet_name] = {
        'row13_values': [ws.cell(13, col).value if ws.cell(13, col).value is not None else '' for col in range(2, ws.max_column + 1)],
        'row14_values': [ws.cell(14, col).value if ws.cell(14, col).value is not None else '' for col in range(2, ws.max_column + 1)],
    }
print(json.dumps(result))
`;
      const { stdout: inspectStdout } = await execFileAsync('python', ['-c', inspectCmd]);
      const inspectedData = JSON.parse(inspectStdout.trim());

      const farmASheet = inspectedData['Farm Stored ACT Precedence'];
      expect(farmASheet).toBeDefined();

      // Day 1: 78.6 (stored wins over derived 75.0)
      expect(farmASheet.row13_values[0]).toBe(78.6);
      // Day 2: 0.0 (stored 0.0 preserved)
      expect(farmASheet.row13_values[1]).toBe(0.0);
      // Day 3: 80.0 (fallback to derived 1600/2000)
      expect(farmASheet.row13_values[2]).toBe(80.0);
      // Day 4: 80.0 (invalid -10% falls back to derived 1600/2000)
      expect(farmASheet.row13_values[3]).toBe(80.0);
      // Day 5: '' (blank safely skipped)
      expect(farmASheet.row13_values[4]).toBe('');

      // AVG = (78.60 + 0.0 + 80.0 + 80.0) / 4 = 238.6 / 4 = 59.65
      const expectedAvg = 59.65;
      for (let col = 0; col < 5; col++) {
        expect(farmASheet.row14_values[col]).toBe(expectedAvg);
      }

      // Farm B isolation check: AVG is 90.0, completely independent of Farm A
      const farmBSheet = inspectedData['Farm Independent Isolation'];
      expect(farmBSheet).toBeDefined();
      expect(farmBSheet.row13_values[0]).toBe(90.0);
      expect(farmBSheet.row14_values[0]).toBe(90.0);
    } finally {
      if (fs.existsSync(inputJsonPath)) fs.unlinkSync(inputJsonPath);
      if (fs.existsSync(outputXlsxPath)) fs.unlinkSync(outputXlsxPath);
    }
  }, 15000);

  it('should preserve original imported AVG row values in export, support per-date AVG, safely fall back when absent, and maintain complete farm isolation', async () => {
    const scriptPath = path.resolve(__dirname, '..', 'scripts', 'generate_production_curve.py');
    expect(fs.existsSync(scriptPath)).toBe(true);

    const tmpDir = path.resolve(__dirname, '..', 'scratch');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    const inputJsonPath = path.join(tmpDir, `test_preserved_avg_in_${Date.now()}.json`);
    const outputXlsxPath = path.join(tmpDir, `test_preserved_avg_out_${Date.now()}.xlsx`);

    const testPayload = {
      farms: [
        // Farm 1: Has original preservedAvg = 67.10 from customer workbook
        // Even though daily ACT % is 80%, Row 14 must preserve original 67.10
        {
          farmId: 'FARM_PRESERVED',
          farmName: 'Farm Preserved AVG',
          productionCurve: 'CF_STD',
          initialBirds: 2000,
          preservedAvg: 67.10,
          reports: [
            {
              submissionDate: '2026-09-01',
              ageWeeks: 21.0,
              openingBirdCount: 2000,
              eggsProduced: 1600,
              actualProductionPct: 80.0,
            },
            {
              submissionDate: '2026-09-02',
              ageWeeks: 21.1,
              openingBirdCount: 2000,
              eggsProduced: 1600,
              actualProductionPct: 80.0,
            },
          ],
        },
        // Farm 2: Has date-specific preservedAvgByDate
        {
          farmId: 'FARM_PRESERVED_BY_DATE',
          farmName: 'Farm Date Specific AVG',
          productionCurve: 'CF_STD',
          initialBirds: 1500,
          preservedAvg: 70.0,
          preservedAvgByDate: {
            '2026-09-01': 70.50,
            '2026-09-02': 71.20,
          },
          reports: [
            {
              submissionDate: '2026-09-01',
              ageWeeks: 21.0,
              openingBirdCount: 1500,
              eggsProduced: 1200,
              actualProductionPct: 80.0,
            },
            {
              submissionDate: '2026-09-02',
              ageWeeks: 21.1,
              openingBirdCount: 1500,
              eggsProduced: 1200,
              actualProductionPct: 80.0,
            },
          ],
        },
        // Farm 3: Absent AVG row (preservedAvg is null/undefined)
        // Must safely fall back to calculated average: (80.0 + 90.0) / 2 = 85.00
        // Must never leak Farm 1's 67.10 or Farm 2's values
        {
          farmId: 'FARM_ABSENT_AVG',
          farmName: 'Farm Fallback Calculated AVG',
          productionCurve: 'CF_STD',
          initialBirds: 1000,
          reports: [
            {
              submissionDate: '2026-09-01',
              ageWeeks: 21.0,
              openingBirdCount: 1000,
              eggsProduced: 800,
              actualProductionPct: 80.0,
            },
            {
              submissionDate: '2026-09-02',
              ageWeeks: 21.1,
              openingBirdCount: 1000,
              eggsProduced: 900,
              actualProductionPct: 90.0,
            },
          ],
        },
        // Farm 4: Preserved numeric 0.0 must be preserved as 0.00
        {
          farmId: 'FARM_ZERO_AVG',
          farmName: 'Farm Zero Preserved AVG',
          productionCurve: 'CF_STD',
          initialBirds: 1000,
          preservedAvg: 0.0,
          reports: [
            {
              submissionDate: '2026-09-01',
              ageWeeks: 21.0,
              openingBirdCount: 1000,
              eggsProduced: 800,
              actualProductionPct: 80.0,
            },
          ],
        },
      ],
    };

    fs.writeFileSync(inputJsonPath, JSON.stringify(testPayload), 'utf-8');

    try {
      const { stdout } = await execFileAsync('python', [scriptPath, inputJsonPath, outputXlsxPath]);
      expect(stdout).toContain('SUCCESS');

      const inspectCmd = `
import openpyxl, json
wb = openpyxl.load_workbook(r'${outputXlsxPath}')
result = {}
for sheet_name in wb.sheetnames:
    ws = wb[sheet_name]
    result[sheet_name] = {
        'row13_values': [ws.cell(13, col).value if ws.cell(13, col).value is not None else '' for col in range(2, ws.max_column + 1)],
        'row14_values': [ws.cell(14, col).value if ws.cell(14, col).value is not None else '' for col in range(2, ws.max_column + 1)],
    }
print(json.dumps(result))
`;
      const { stdout: inspectStdout } = await execFileAsync('python', ['-c', inspectCmd]);
      const inspectedData = JSON.parse(inspectStdout.trim());

      // Farm 1: Preserved 67.10 retained across all columns, NOT overwritten with 80.00
      const farm1Sheet = inspectedData['Farm Preserved AVG'];
      expect(farm1Sheet).toBeDefined();
      expect(farm1Sheet.row13_values[0]).toBe(80.0);
      expect(farm1Sheet.row13_values[1]).toBe(80.0);
      expect(farm1Sheet.row14_values[0]).toBe(67.10);
      expect(farm1Sheet.row14_values[1]).toBe(67.10);

      // Farm 2: Date-specific preserved values
      const farm2Sheet = inspectedData['Farm Date Specific AVG'];
      expect(farm2Sheet).toBeDefined();
      expect(farm2Sheet.row14_values[0]).toBe(70.50);
      expect(farm2Sheet.row14_values[1]).toBe(71.20);

      // Farm 3: Fallback calculation (80 + 90)/2 = 85.00, isolated from Farm 1 and 2
      const farm3Sheet = inspectedData['Farm Fallback Calculated AVG'];
      expect(farm3Sheet).toBeDefined();
      expect(farm3Sheet.row14_values[0]).toBe(85.0);
      expect(farm3Sheet.row14_values[1]).toBe(85.0);

      // Farm 4: Zero preserved avg
      const farm4Sheet = inspectedData['Farm Zero Preserved AVG'];
      expect(farm4Sheet).toBeDefined();
      expect(farm4Sheet.row14_values[0]).toBe(0.0);
    } finally {
      if (fs.existsSync(inputJsonPath)) fs.unlinkSync(inputJsonPath);
      if (fs.existsSync(outputXlsxPath)) fs.unlinkSync(outputXlsxPath);
    }
  }, 15000);
});
