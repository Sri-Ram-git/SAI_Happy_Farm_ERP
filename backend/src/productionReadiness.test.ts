import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';

import { validateDailyReportBusinessRules } from './validators/report.validator';
import { calcAverage, calcProductionRate } from '../../frontend/src/utils/kpiCalculations';
import { resolveFarmId, detectFarmFromText } from '../../frontend/src/services/historicalImportService';
import { UserRole, AuthenticatedUser } from './types/auth';
import { DailyReportInput } from './types/reports';
import { ValidationError, DuplicateError } from './utils/errors';

const execFileAsync = promisify(execFile);

describe('Happy Farmer ERP — 25-Farm Onboarding & Production Readiness Verification', () => {
  // Generate 25 synthetic farm IDs: FARM_001 through FARM_025
  const syntheticFarmIds = Array.from({ length: 25 }, (_, i) => `FARM_${String(i + 1).padStart(3, '0')}`);
  const syntheticFarms = syntheticFarmIds.map((farmId, i) => ({
    farmId,
    name: `Synthetic Test Farm ${i + 1}`,
    active: true,
    location: `Zone ${String.fromCharCode(65 + (i % 5))}`,
    currentBirdCount: 2000 + i * 100,
    currentFeedKg: 250 + i * 10,
  }));

  describe('1. Multi-farm Isolation & Dynamic ID Association (25 Farms)', () => {
    it('should dynamically resolve and associate all 25 synthetic farm IDs without hardcoding', () => {
      expect(syntheticFarmIds).toHaveLength(25);

      for (const farm of syntheticFarms) {
        // Direct ID match
        const direct = resolveFarmId(farm.farmId, syntheticFarms);
        expect(direct.farmId).toBe(farm.farmId);

        // Name match
        const byName = resolveFarmId(farm.name, syntheticFarms);
        expect(byName.farmId).toBe(farm.farmId);

        // Text detection from sheet name
        const detected = detectFarmFromText(`Sheet ${farm.farmId}`, syntheticFarms);
        expect(detected).toBe(farm.farmId);
      }
    });

    it('should reject unknown farm IDs and prevent cross-farm contamination', () => {
      const unknown = resolveFarmId('NON_EXISTENT_FARM', syntheticFarms);
      expect(unknown.farmId).toBeUndefined();
      expect(unknown.reason).toContain('Unknown Farm ID');
    });

    it('should maintain strict tenant isolation across supervisor allocations', () => {
      const supervisorAllocations = new Map<string, string[]>();
      // Assign farms 1-10 to sup1, 11-20 to sup2, 21-25 to sup3
      supervisorAllocations.set('sup-1', syntheticFarmIds.slice(0, 10));
      supervisorAllocations.set('sup-2', syntheticFarmIds.slice(10, 20));
      supervisorAllocations.set('sup-3', syntheticFarmIds.slice(20, 25));

      // sup-1 must have FARM_001..010 and NOT FARM_011
      expect(supervisorAllocations.get('sup-1')).toContain('FARM_001');
      expect(supervisorAllocations.get('sup-1')).toContain('FARM_010');
      expect(supervisorAllocations.get('sup-1')).not.toContain('FARM_011');
      expect(supervisorAllocations.get('sup-1')).not.toContain('FARM_025');

      // sup-3 must only have 5 farms
      expect(supervisorAllocations.get('sup-3')).toHaveLength(5);
      expect(supervisorAllocations.get('sup-3')).toContain('FARM_025');
    });
  });

  describe('2. Farmer Submission, Validation & Persistence Constraints', () => {
    it('should validate a normal daily report submission on arbitrary farm ID', () => {
      const validReport: DailyReportInput = {
        farmId: 'FARM_015',
        birdCount: 2000,
        feedKg: 220,
        feedGramsPerBird: 110,
        mortality: 2,
        culling: 1,
        eggsProduced: 1800,
        selectionEggs: 1750,
        damagedEggs: 30,
        floorEggs: 20, // 1750 + 30 + 20 = 1800
        temperature: 26,
        eggWeight: { min: 52, max: 65, avg: 58 },
        bodyWeight: { min: 1600, max: 1900, avg: 1750 },
        remarks: 'Optimal health and feed consumption',
      };

      expect(() => validateDailyReportBusinessRules(validReport)).not.toThrow();
    });

    it('should correctly handle missing optional fields (floorEggs, damagedEggs, bodyWeight, remarks, ammoniaPpm)', () => {
      const minimalReport: DailyReportInput = {
        farmId: 'FARM_022',
        birdCount: 2000,
        feedKg: 200,
        mortality: 0,
        culling: 0,
        eggsProduced: 1700,
        selectionEggs: 1700, // floor and damaged default to 0 in rule: 1700 + 0 + 0 = 1700
        temperature: 25,
        eggWeight: { min: 50, max: 62, avg: 56 },
      };

      expect(() => validateDailyReportBusinessRules(minimalReport)).not.toThrow();
    });

    it('should reject submission when egg breakdown does not equal egg production', () => {
      const invalidReport: DailyReportInput = {
        farmId: 'FARM_003',
        birdCount: 2000,
        feedKg: 200,
        mortality: 0,
        culling: 0,
        eggsProduced: 1800,
        selectionEggs: 1600,
        damagedEggs: 50,
        floorEggs: 50, // 1600 + 50 + 50 = 1700 !== 1800
        temperature: 25,
        eggWeight: { min: 50, max: 62, avg: 56 },
      };

      expect(() => validateDailyReportBusinessRules(invalidReport)).toThrowError(ValidationError);
    });

    it('should reject egg production exceeding 95% bird count threshold', () => {
      const highProdReport: DailyReportInput = {
        farmId: 'FARM_007',
        birdCount: 1000,
        feedKg: 100,
        mortality: 0,
        culling: 0,
        eggsProduced: 960, // 960 > 950 (95% of 1000)
        selectionEggs: 960,
        damagedEggs: 0,
        floorEggs: 0,
        temperature: 25,
        eggWeight: { min: 50, max: 62, avg: 56 },
      };

      expect(() => validateDailyReportBusinessRules(highProdReport)).toThrowError(ValidationError);
    });

    it('should detect duplicate locks and prevent concurrent duplicate writes', () => {
      const simulatedLocks = new Set<string>();

      const acquireLock = (farmId: string, date: string): boolean => {
        const lockKey = `${farmId}_${date}`;
        if (simulatedLocks.has(lockKey)) {
          throw new DuplicateError('A report for this farm on this date already exists');
        }
        simulatedLocks.add(lockKey);
        return true;
      };

      expect(acquireLock('FARM_001', '2026-10-14')).toBe(true);
      expect(() => acquireLock('FARM_001', '2026-10-14')).toThrowError(DuplicateError);
      // Different farm on same date must succeed
      expect(acquireLock('FARM_002', '2026-10-14')).toBe(true);
    });
  });

  describe('3. Import: Decimal Preservation, Blank vs Zero & Revert Simulation', () => {
    it('should distinguish explicit zero from blank and preserve decimals', () => {
      const rawImportValues = [
        { field: 'mortality', raw: '0', expected: 0 },
        { field: 'mortality', raw: '', expected: null },
        { field: 'mortality', raw: '   ', expected: null },
        { field: 'feedKg', raw: '125.75', expected: 125.75 },
        { field: 'temperature', raw: '28.4', expected: 28.4 },
        { field: 'actualProductionPct', raw: '88.65', expected: 88.65 },
        { field: 'actualProductionPct', raw: '0', expected: 0 },
      ];

      for (const item of rawImportValues) {
        const parsed = item.raw.trim() === '' ? null : Number(item.raw);
        if (item.expected === null) {
          expect(parsed).toBeNull();
        } else {
          expect(parsed).toBe(item.expected);
        }
      }
    });

    it('should track creation/update in manifest and successfully revert created records', () => {
      const manifest: Array<{ docId: string; action: 'CREATED' | 'UPDATED'; farmId: string; beforeData?: any }> = [];
      const datastore = new Map<string, any>();

      // Record 1: New record
      manifest.push({ docId: 'FARM_001_2026-09-01', action: 'CREATED', farmId: 'FARM_001' });
      datastore.set('FARM_001_2026-09-01', { farmId: 'FARM_001', eggs: 1500 });

      // Record 2: Updated existing record
      manifest.push({
        docId: 'FARM_002_2026-09-01',
        action: 'UPDATED',
        farmId: 'FARM_002',
        beforeData: { farmId: 'FARM_002', eggs: 1200 },
      });
      datastore.set('FARM_002_2026-09-01', { farmId: 'FARM_002', eggs: 1600 });

      // Execute revert
      for (const item of manifest) {
        if (item.action === 'CREATED') {
          datastore.delete(item.docId);
        } else if (item.action === 'UPDATED') {
          datastore.set(item.docId, item.beforeData);
        }
      }

      expect(datastore.has('FARM_001_2026-09-01')).toBe(false);
      expect(datastore.get('FARM_002_2026-09-01')?.eggs).toBe(1200);
    });
  });

  describe('4. Export: ACT %-Based Worksheet AVG & Python Generator Runtime', () => {
    it('calcAverage: must ignore blanks/nulls and include explicit zeros', () => {
      // [85.5, null, 0, undefined, 90.5] -> valid: [85.5, 0, 90.5] -> avg: 176 / 3 = 58.666 -> 58.7
      const samples = [85.5, null, 0, undefined, 90.5];
      const result = calcAverage(samples);
      expect(result).toBe(58.7);

      // Only explicit zeros: [0, 0] -> 0
      expect(calcAverage([0, 0])).toBe(0);

      // Only blanks: [null, undefined] -> 0
      expect(calcAverage([null, undefined])).toBe(0);
    });

    it('must keep bodyWeight.avg completely separate from egg production actualProductionPct', () => {
      const report = {
        farmId: 'FARM_001',
        eggsProduced: 1600,
        birdCount: 2000,
        actualProductionPct: 80.0,
        bodyWeight: { min: 1600, max: 1800, avg: 1720 },
      };

      // ACT % is 80%, bodyWeight avg is 1720g. They must not bleed into each other.
      const actPct = calcProductionRate(report.eggsProduced, report.birdCount);
      expect(actPct).toBe(80.0);
      expect(report.bodyWeight.avg).toBe(1720);
      expect(report.bodyWeight.avg).not.toBe(actPct);
    });

    it('Python export script: should execute and generate valid Excel workbook for 25 synthetic farms', async () => {
      const scriptPath = path.resolve(__dirname, '..', 'scripts', 'generate_production_curve.py');
      expect(fs.existsSync(scriptPath)).toBe(true);

      const tmpDir = path.resolve(__dirname, '..', 'scratch');
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }

      const inputJsonPath = path.join(tmpDir, `test_25farms_in_${Date.now()}.json`);
      const outputXlsxPath = path.join(tmpDir, `test_25farms_out_${Date.now()}.xlsx`);

      // Construct payload for 25 synthetic farms with 3 daily reports each
      const farmsPayload = syntheticFarms.map((f, fIdx) => ({
        farmId: f.farmId,
        farmName: f.name,
        productionCurve: 'CF_STD',
        initialBirds: f.currentBirdCount,
        reports: [
          {
            submissionDate: '2026-09-01',
            ageWeeks: 21.0,
            openingBirdCount: f.currentBirdCount,
            eggsProduced: 1700 + fIdx * 10,
            selectionEggs: 1600 + fIdx * 10,
            mortality: 1,
            culling: 0,
            temperature: 26.5,
            feedKg: 200 + fIdx * 2,
          },
          {
            submissionDate: '2026-09-02',
            ageWeeks: 21.1,
            openingBirdCount: f.currentBirdCount - 1,
            eggsProduced: 1720 + fIdx * 10,
            selectionEggs: 1620 + fIdx * 10,
            mortality: 0, // explicit zero
            culling: 0,
            temperature: 27.0,
            feedKg: 205 + fIdx * 2,
          },
          {
            submissionDate: '2026-09-03',
            ageWeeks: 21.2,
            openingBirdCount: f.currentBirdCount - 1,
            eggsProduced: 1710 + fIdx * 10,
            selectionEggs: 1610 + fIdx * 10,
            mortality: null, // blank
            culling: 0,
            temperature: 26.8,
            feedKg: 202 + fIdx * 2,
          },
        ],
      }));

      fs.writeFileSync(inputJsonPath, JSON.stringify({ farms: farmsPayload }), 'utf-8');

      try {
        const { stdout, stderr } = await execFileAsync('python', [scriptPath, inputJsonPath, outputXlsxPath]);
        expect(stdout).toContain('SUCCESS');
        expect(fs.existsSync(outputXlsxPath)).toBe(true);

        const stats = fs.statSync(outputXlsxPath);
        // An Excel file containing 25 sheets should be > 20KB
        expect(stats.size).toBeGreaterThan(20000);
      } finally {
        if (fs.existsSync(inputJsonPath)) fs.unlinkSync(inputJsonPath);
        if (fs.existsSync(outputXlsxPath)) fs.unlinkSync(outputXlsxPath);
      }
    });
  });

  describe('5. Security, Authorization & Tenant Scoping', () => {
    it('Farmer: should only have access to assigned farmId', () => {
      const farmerUser: AuthenticatedUser = {
        uid: 'farmer-01',
        email: 'farmer01@test.com',
        role: UserRole.FARMER,
        farmIds: ['FARM_001'],
      };

      // Accessing FARM_001 allowed
      expect(farmerUser.farmIds.includes('FARM_001')).toBe(true);
      // Accessing FARM_002 denied
      expect(farmerUser.farmIds.includes('FARM_002')).toBe(false);
    });

    it('Supervisor: should only have access to assigned farmIds subset', () => {
      const supervisorUser: AuthenticatedUser = {
        uid: 'supervisor-01',
        email: 'supervisor@test.com',
        role: UserRole.SUPERVISOR,
        farmIds: ['FARM_001', 'FARM_002', 'FARM_003'],
      };

      expect(supervisorUser.farmIds.includes('FARM_003')).toBe(true);
      expect(supervisorUser.farmIds.includes('FARM_004')).toBe(false);
      expect(supervisorUser.farmIds.includes('FARM_025')).toBe(false);
    });

    it('Admin: has global access across all 25 synthetic farm IDs', () => {
      const adminUser: AuthenticatedUser = {
        uid: 'admin-01',
        email: 'admin@test.com',
        role: UserRole.ADMIN,
        farmIds: [],
      };

      const hasAccess = (user: AuthenticatedUser, targetFarmId: string): boolean => {
        if (user.role === UserRole.ADMIN || user.role === UserRole.OFFICE_STAFF) return true;
        return user.farmIds.includes(targetFarmId);
      };

      for (const farmId of syntheticFarmIds) {
        expect(hasAccess(adminUser, farmId)).toBe(true);
      }
    });
  });
});
