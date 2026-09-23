import { describe, it, expect, vi, beforeEach } from 'vitest';
import { userService } from './userService';
import { farmerService } from './farmer.service';
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

describe('User Deletion and Deactivation Security', () => {
  let mockDb: any;
  let mockAuth: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      collection: vi.fn(),
      batch: vi.fn().mockReturnValue({
        delete: vi.fn(),
        commit: vi.fn().mockResolvedValue(undefined),
      }),
    };

    mockAuth = {
      deleteUser: vi.fn().mockResolvedValue(undefined),
      revokeRefreshTokens: vi.fn().mockResolvedValue(undefined),
    };

    (getFirestore as any).mockReturnValue(mockDb);
    (getAuth as any).mockReturnValue(mockAuth);
  });

  describe('userService.deleteUserAccount', () => {
    it('should reject self-deletion if targetUid matches adminUid', async () => {
      await expect(
        userService.deleteUserAccount('admin-123', 'admin-123', 'req-1'),
      ).rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError if target user document does not exist', async () => {
      mockDb.collection.mockReturnValue({
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ exists: false }),
        }),
      });

      await expect(
        userService.deleteUserAccount('target-missing', 'admin-123', 'req-1'),
      ).rejects.toThrow(NotFoundError);
    });

    it('should reject deletion of the last remaining admin', async () => {
      const targetUserDoc = {
        exists: true,
        data: () => ({
          role: 'admin',
          email: 'lastadmin@test.com',
          active: true,
        }),
      };

      const usersCollectionMock = {
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue(targetUserDoc),
        }),
        where: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            docs: [
              { id: 'target-admin', data: () => ({ role: 'admin', active: true }) },
            ],
          }),
        }),
      };

      mockDb.collection.mockImplementation((coll: string) => {
        if (coll === 'users') return usersCollectionMock;
        return { doc: vi.fn() };
      });

      await expect(
        userService.deleteUserAccount('target-admin', 'other-admin', 'req-1'),
      ).rejects.toThrow(ValidationError);
    });

    it('should delete a supervisor without deleting any farms', async () => {
      const targetUserDoc = {
        exists: true,
        data: () => ({
          role: 'supervisor',
          email: 'supervisor@test.com',
          farmIds: ['AP12', 'AP13'],
          active: true,
        }),
      };

      const userDocRef = {
        get: vi.fn().mockResolvedValue(targetUserDoc),
        delete: vi.fn().mockResolvedValue(undefined),
      };

      const usersCollectionMock = {
        doc: vi.fn().mockReturnValue(userDocRef),
      };

      const auditCollectionMock = {
        add: vi.fn().mockResolvedValue(undefined),
      };

      mockDb.collection.mockImplementation((coll: string) => {
        if (coll === 'users') return usersCollectionMock;
        if (coll === 'auditLogs') return auditCollectionMock;
        throw new Error(`Unexpected collection access: ${coll}`);
      });

      const result = await userService.deleteUserAccount('sup-1', 'admin-123', 'req-1');

      expect(result.uid).toBe('sup-1');
      expect(result.deletedFarms).toEqual([]);
      expect(userDocRef.delete).toHaveBeenCalled();
      expect(mockAuth.deleteUser).toHaveBeenCalledWith('sup-1');
    });

    it('should delete a farmer and cascade delete their owned farm', async () => {
      const farmerDoc = {
        exists: true,
        data: () => ({
          role: 'farmer',
          email: 'farmer@test.com',
          farmIds: ['AP12'],
          active: true,
        }),
      };

      const userDocRef = {
        get: vi.fn().mockResolvedValue(farmerDoc),
        delete: vi.fn().mockResolvedValue(undefined),
      };

      const farmDocRef = {
        get: vi.fn().mockResolvedValue({ exists: true, data: () => ({ farmId: 'AP12' }) }),
        delete: vi.fn().mockResolvedValue(undefined),
        collection: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
        }),
      };

      mockDb.collection.mockImplementation((coll: string) => {
        if (coll === 'users') {
          return {
            doc: vi.fn().mockReturnValue(userDocRef),
            where: vi.fn().mockImplementation((field: string, op: string, val: string) => {
              if (val === 'farmer') {
                return {
                  get: vi.fn().mockResolvedValue({
                    docs: [{ id: 'farmer-1', data: () => ({ farmIds: ['AP12'] }) }],
                  }),
                };
              }
              if (val === 'supervisor') {
                return {
                  get: vi.fn().mockResolvedValue({ docs: [] }),
                };
              }
              return { get: vi.fn().mockResolvedValue({ docs: [] }) };
            }),
          };
        }
        if (coll === 'farms') {
          return {
            doc: vi.fn().mockReturnValue(farmDocRef),
          };
        }
        if (coll === 'flocks' || coll === 'dailyReportLocks' || coll === 'dailyReports') {
          return {
            where: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
            }),
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({ exists: false }),
              collection: vi.fn().mockReturnValue({
                get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
              }),
            }),
          };
        }
        if (coll === 'auditLogs') {
          return { add: vi.fn().mockResolvedValue(undefined) };
        }
        return { doc: vi.fn(), where: vi.fn() };
      });

      const result = await userService.deleteUserAccount('farmer-1', 'admin-123', 'req-1');

      expect(result.uid).toBe('farmer-1');
      expect(result.deletedFarms).toEqual(['AP12']);
      expect(farmDocRef.delete).toHaveBeenCalled();
      expect(userDocRef.delete).toHaveBeenCalled();
      expect(mockAuth.deleteUser).toHaveBeenCalledWith('farmer-1');
    });
  });

  describe('farmerService.updateUserStatus', () => {
    it('should reject self-deactivation by admin', async () => {
      await expect(
        farmerService.updateUserStatus('admin-1', false, 'admin-1', 'req-1'),
      ).rejects.toThrow(ValidationError);
    });

    it('should reject deactivating the last active admin', async () => {
      const adminDoc = {
        exists: true,
        data: () => ({ role: 'admin', active: true }),
      };

      mockDb.collection.mockImplementation((coll: string) => {
        if (coll === 'users') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue(adminDoc),
              update: vi.fn().mockResolvedValue(undefined),
            }),
            where: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                docs: [{ id: 'admin-target', data: () => ({ role: 'admin', active: true }) }],
              }),
            }),
          };
        }
        return { doc: vi.fn() };
      });

      await expect(
        farmerService.updateUserStatus('admin-target', false, 'other-admin', 'req-1'),
      ).rejects.toThrow(ValidationError);
    });

    it('should successfully deactivate a regular user and revoke refresh tokens', async () => {
      const userDocRef = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({ role: 'farmer', email: 'farmer@test.com', active: true }),
        }),
        update: vi.fn().mockResolvedValue(undefined),
      };

      mockDb.collection.mockImplementation((coll: string) => {
        if (coll === 'users') {
          return { doc: vi.fn().mockReturnValue(userDocRef) };
        }
        if (coll === 'auditLogs') {
          return { add: vi.fn().mockResolvedValue(undefined) };
        }
        return { doc: vi.fn() };
      });

      const result = await farmerService.updateUserStatus('farmer-1', false, 'admin-1', 'req-1');

      expect(result.active).toBe(false);
      expect(userDocRef.update).toHaveBeenCalledWith(
        expect.objectContaining({ active: false }),
      );
      expect(mockAuth.revokeRefreshTokens).toHaveBeenCalledWith('farmer-1');
    });
  });
});
