import { describe, it, expect } from 'vitest';
import { CreateAdminUserSchema } from './adminUser.validator';
import { CreateSupervisorSchema, UpdateSupervisorFarmsSchema } from './supervisor.validator';
import { createFlockSchema, updateFlockStatusSchema } from './flock.validator';

describe('Management & Admin Input Constraints Suite', () => {
  describe('CreateAdminUserSchema', () => {
    const validAdmin = {
      name: 'System Administrator',
      email: 'admin@saihappyfarms.com',
      phone_no: '+919876543210',
      password: 'StrongAdminPassword123!',
    };

    it('should accept valid admin user input', () => {
      const res = CreateAdminUserSchema.safeParse(validAdmin);
      expect(res.success).toBe(true);
    });

    it('should reject invalid phone format or letters', () => {
      const res = CreateAdminUserSchema.safeParse({
        ...validAdmin,
        phone_no: 'invalid-phone-num',
      });
      expect(res.success).toBe(false);
    });

    it('should reject passwords shorter than 8 characters', () => {
      const res = CreateAdminUserSchema.safeParse({
        ...validAdmin,
        password: 'short',
      });
      expect(res.success).toBe(false);
    });

    it('should reject names longer than 100 characters', () => {
      const res = CreateAdminUserSchema.safeParse({
        ...validAdmin,
        name: 'A'.repeat(101),
      });
      expect(res.success).toBe(false);
    });
  });

  describe('CreateSupervisorSchema', () => {
    const validSupervisor = {
      name: 'Field Supervisor Rao',
      email: 'supervisor@saihappyfarms.com',
      phone_no: '9848012345',
      password: 'SupervisorPass2026!',
      farmIds: ['AP15', 'AP16'],
    };

    it('should accept valid supervisor input', () => {
      const res = CreateSupervisorSchema.safeParse(validSupervisor);
      expect(res.success).toBe(true);
    });

    it('should reject supervisor with 0 assigned farms', () => {
      const res = CreateSupervisorSchema.safeParse({
        ...validSupervisor,
        farmIds: [],
      });
      expect(res.success).toBe(false);
    });

    it('should reject invalid phone format', () => {
      const res = CreateSupervisorSchema.safeParse({
        ...validSupervisor,
        phone_no: '12345',
      });
      expect(res.success).toBe(false);
    });

    it('should accept update supervisor farms with empty array', () => {
      const res = UpdateSupervisorFarmsSchema.safeParse({ farmIds: [] });
      expect(res.success).toBe(true);
    });
  });

  describe('createFlockSchema', () => {
    const validFlock = {
      body: {
        farmId: 'AP15',
        flockName: 'Batch 2026-A',
        initialBirds: 2000,
        startDate: '2026-09-01',
        breedType: 'BV-380',
        productionCurve: 'CF_STD' as const,
        notes: 'Initial arrival test batch',
      },
    };

    it('should accept valid flock creation input', () => {
      const res = createFlockSchema.safeParse(validFlock);
      expect(res.success).toBe(true);
    });

    it('should reject non-positive or decimal initialBirds', () => {
      const negRes = createFlockSchema.safeParse({
        body: { ...validFlock.body, initialBirds: -100 },
      });
      expect(negRes.success).toBe(false);

      const zeroRes = createFlockSchema.safeParse({
        body: { ...validFlock.body, initialBirds: 0 },
      });
      expect(zeroRes.success).toBe(false);

      const decRes = createFlockSchema.safeParse({
        body: { ...validFlock.body, initialBirds: 250.5 },
      });
      expect(decRes.success).toBe(false);
    });

    it('should reject initialBirds exceeding 10,000,000 birds', () => {
      const res = createFlockSchema.safeParse({
        body: { ...validFlock.body, initialBirds: 10000001 },
      });
      expect(res.success).toBe(false);
    });

    it('should reject invalid startDate format', () => {
      const res = createFlockSchema.safeParse({
        body: { ...validFlock.body, startDate: '01/09/2026' },
      });
      expect(res.success).toBe(false);
    });

    it('should reject notes exceeding 1000 characters', () => {
      const res = createFlockSchema.safeParse({
        body: { ...validFlock.body, notes: 'A'.repeat(1001) },
      });
      expect(res.success).toBe(false);
    });

    it('should validate updateFlockStatusSchema', () => {
      expect(updateFlockStatusSchema.safeParse({ params: { flockId: 'FLOCK1' }, body: { status: 'active' } }).success).toBe(true);
      expect(updateFlockStatusSchema.safeParse({ params: { flockId: 'FLOCK1' }, body: { status: 'completed' } }).success).toBe(true);
      expect(updateFlockStatusSchema.safeParse({ params: { flockId: 'FLOCK1' }, body: { status: 'invalid' } }).success).toBe(false);
    });
  });
});
