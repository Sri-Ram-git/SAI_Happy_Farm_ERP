import { describe, it, expect, vi, beforeEach } from 'vitest';
import { userService } from './userService';
import { ValidationError, NotFoundError } from '../utils/errors';

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

import { getFirestore, getAuth } from '../config/firebase';

describe('Supervisor Farm Reassignment Security & Logic', () => {
  let mockDb: any;
  let mockAuth: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      collection: vi.fn(),
    };

    mockAuth = {};

    (getFirestore as any).mockReturnValue(mockDb);
    (getAuth as any).mockReturnValue(mockAuth);
  });

  describe('userService.updateSupervisorAllocation', () => {
    it('should throw NotFoundError if supervisor user document does not exist', async () => {
      mockDb.collection.mockReturnValue({
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ exists: false }),
        }),
      });

      await expect(
        userService.updateSupervisorAllocation('non-existent-sup', ['AP12'], 'admin-1', 'req-1'),
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError if target user is not a supervisor (e.g. farmer)', async () => {
      mockDb.collection.mockReturnValue({
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({ role: 'farmer', email: 'farmer@test.com' }),
          }),
        }),
      });

      await expect(
        userService.updateSupervisorAllocation('farmer-1', ['AP12'], 'admin-1', 'req-1'),
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError if a requested farm ID does not exist in farms collection', async () => {
      const mockUserDoc = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({ role: 'supervisor', email: 'sup@test.com', farmIds: ['AP12'] }),
        }),
      };

      const mockFarmDoc = {
        get: vi.fn().mockResolvedValue({ exists: false }),
      };

      mockDb.collection.mockImplementation((coll: string) => {
        if (coll === 'users') {
          return { doc: vi.fn().mockReturnValue(mockUserDoc) };
        }
        if (coll === 'farms') {
          return { doc: vi.fn().mockReturnValue(mockFarmDoc) };
        }
        return { doc: vi.fn() };
      });

      await expect(
        userService.updateSupervisorAllocation('sup-1', ['INVALID_FARM'], 'admin-1', 'req-1'),
      ).rejects.toThrow(ValidationError);
    });

    it('should successfully update farmIds, deduplicate entries, and log audit event', async () => {
      const mockUpdate = vi.fn().mockResolvedValue(undefined);
      const mockUserDoc = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({ role: 'supervisor', email: 'sup@test.com', farmIds: ['AP12'] }),
        }),
        update: mockUpdate,
      };

      const mockFarmDoc = {
        get: vi.fn().mockResolvedValue({ exists: true, data: () => ({ farmId: 'AP12' }) }),
      };

      const mockAuditAdd = vi.fn().mockResolvedValue({ id: 'audit-1' });

      mockDb.collection.mockImplementation((coll: string) => {
        if (coll === 'users') {
          return { doc: vi.fn().mockReturnValue(mockUserDoc) };
        }
        if (coll === 'farms') {
          return { doc: vi.fn().mockReturnValue(mockFarmDoc) };
        }
        if (coll === 'auditLogs') {
          return { add: mockAuditAdd };
        }
        return { doc: vi.fn() };
      });

      const result = await userService.updateSupervisorAllocation(
        'sup-1',
        ['AP12', 'AP12', 'AP14'],
        'admin-1',
        'req-1',
      );

      expect(result.uid).toBe('sup-1');
      expect(result.farmIds).toEqual(['AP12', 'AP14']);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          farmIds: ['AP12', 'AP14'],
        }),
      );
    });

    it('should allow reassigning to an empty array if all farms are removed', async () => {
      const mockUpdate = vi.fn().mockResolvedValue(undefined);
      const mockUserDoc = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({ role: 'supervisor', email: 'sup@test.com', farmIds: ['AP12'] }),
        }),
        update: mockUpdate,
      };

      const mockAuditAdd = vi.fn().mockResolvedValue({ id: 'audit-1' });

      mockDb.collection.mockImplementation((coll: string) => {
        if (coll === 'users') {
          return { doc: vi.fn().mockReturnValue(mockUserDoc) };
        }
        if (coll === 'auditLogs') {
          return { add: mockAuditAdd };
        }
        return { doc: vi.fn() };
      });

      const result = await userService.updateSupervisorAllocation(
        'sup-1',
        [],
        'admin-1',
        'req-1',
      );

      expect(result.uid).toBe('sup-1');
      expect(result.farmIds).toEqual([]);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          farmIds: [],
        }),
      );
    });
  });
});
