import { describe, it, expect } from 'vitest';
import { CreateAdminUserSchema } from './adminUser.validator';
import { CreateSupervisorSchema } from './supervisor.validator';

describe('SEC-05: Management Password Policy Security Tests', () => {
  describe('CreateAdminUserSchema', () => {
    const validBase = {
      name: 'Admin Test',
      email: 'admin.sec@example.com',
      phone_no: '+919876543210',
    };

    it('should reject passwords shorter than 8 characters', () => {
      const result = CreateAdminUserSchema.safeParse({
        ...validBase,
        password: 'pass1', // 5 chars
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors.some(e => e.message === 'Password must be at least 8 characters')).toBe(true);
      }
    });

    it('should reject 6-character and 7-character passwords (previous weak policy)', () => {
      const result6 = CreateAdminUserSchema.safeParse({
        ...validBase,
        password: 'pass12', // 6 chars
      });
      expect(result6.success).toBe(false);
      if (!result6.success) {
        expect(result6.error.errors.some(e => e.message === 'Password must be at least 8 characters')).toBe(true);
      }

      const result7 = CreateAdminUserSchema.safeParse({
        ...validBase,
        password: 'pass123', // 7 chars
      });
      expect(result7.success).toBe(false);
      if (!result7.success) {
        expect(result7.error.errors.some(e => e.message === 'Password must be at least 8 characters')).toBe(true);
      }
    });

    it('should accept passwords with 8 or more characters', () => {
      const result = CreateAdminUserSchema.safeParse({
        ...validBase,
        password: 'StrongPassword123!',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('CreateSupervisorSchema', () => {
    const validBase = {
      name: 'Supervisor Test',
      email: 'supervisor.sec@example.com',
      phone_no: '+919876543211',
      farmIds: ['farm-alpha'],
    };

    it('should reject passwords shorter than 8 characters', () => {
      const result = CreateSupervisorSchema.safeParse({
        ...validBase,
        password: 'pass1',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors.some(e => e.message === 'Password must be at least 8 characters')).toBe(true);
      }
    });

    it('should reject 6-character and 7-character passwords', () => {
      const result6 = CreateSupervisorSchema.safeParse({
        ...validBase,
        password: 'pass12',
      });
      expect(result6.success).toBe(false);
      if (!result6.success) {
        expect(result6.error.errors.some(e => e.message === 'Password must be at least 8 characters')).toBe(true);
      }

      const result7 = CreateSupervisorSchema.safeParse({
        ...validBase,
        password: 'pass123',
      });
      expect(result7.success).toBe(false);
      if (!result7.success) {
        expect(result7.error.errors.some(e => e.message === 'Password must be at least 8 characters')).toBe(true);
      }
    });

    it('should accept passwords with 8 or more characters', () => {
      const result = CreateSupervisorSchema.safeParse({
        ...validBase,
        password: 'SupervisorPass2026#',
      });
      expect(result.success).toBe(true);
    });
  });
});
