import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserRole } from '../types/auth';
import { AuthorizationError } from '../utils/errors';
import { requireRole, requireFarmAccess } from '../middleware/authorization.middleware';
import { Request, Response, NextFunction } from 'express';

describe('Authorization Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      user: undefined,
      requestId: 'test-request-id',
      params: {},
      body: {},
      originalUrl: '/api/test',
      method: 'GET',
    };
    mockRes = {};
    mockNext = vi.fn();
  });

  describe('requireRole', () => {
    it('should deny access when user is not authenticated', () => {
      const middleware = requireRole(UserRole.ADMIN);
      middleware(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthorizationError));
    });

    it('should deny access when user has wrong role', () => {
      mockReq.user = {
        uid: 'user1',
        email: 'test@test.com',
        role: UserRole.FARMER,
        farmIds: ['AP12'],
      };
      const middleware = requireRole(UserRole.ADMIN);
      middleware(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthorizationError));
    });

    it('should allow access when user has correct role', () => {
      mockReq.user = {
        uid: 'user1',
        email: 'test@test.com',
        role: UserRole.ADMIN,
        farmIds: [],
      };
      const middleware = requireRole(UserRole.ADMIN);
      middleware(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should allow access when user has one of multiple roles', () => {
      mockReq.user = {
        uid: 'user1',
        email: 'test@test.com',
        role: UserRole.SUPERVISOR,
        farmIds: ['AP12'],
      };
      const middleware = requireRole(UserRole.ADMIN, UserRole.SUPERVISOR);
      middleware(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('requireFarmAccess', () => {
    it('should deny access when user is not authenticated', () => {
      requireFarmAccess(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthorizationError));
    });

    it('should allow admin access to any farm', () => {
      mockReq.user = {
        uid: 'user1',
        email: 'test@test.com',
        role: UserRole.ADMIN,
        farmIds: ['AP12'],
      };
      mockReq.params = { farmId: 'AP13' };
      requireFarmAccess(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should allow office_staff access to any farm', () => {
      mockReq.user = {
        uid: 'user1',
        email: 'test@test.com',
        role: UserRole.OFFICE_STAFF,
        farmIds: ['AP12'],
      };
      mockReq.params = { farmId: 'AP13' };
      requireFarmAccess(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should deny farmer access to unassigned farm via params', () => {
      mockReq.user = {
        uid: 'user1',
        email: 'test@test.com',
        role: UserRole.FARMER,
        farmIds: ['AP12'],
      };
      mockReq.params = { farmId: 'AP13' };
      requireFarmAccess(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthorizationError));
    });

    it('should deny farmer access to unassigned farm via body', () => {
      mockReq.user = {
        uid: 'user1',
        email: 'test@test.com',
        role: UserRole.FARMER,
        farmIds: ['AP12'],
      };
      mockReq.params = {};
      mockReq.body = { farmId: 'AP13' };
      requireFarmAccess(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthorizationError));
    });

    it('should allow farmer access to assigned farm', () => {
      mockReq.user = {
        uid: 'user1',
        email: 'test@test.com',
        role: UserRole.FARMER,
        farmIds: ['AP12'],
      };
      mockReq.params = { farmId: 'AP12' };
      requireFarmAccess(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should allow supervisor access to assigned farm', () => {
      mockReq.user = {
        uid: 'user1',
        email: 'test@test.com',
        role: UserRole.SUPERVISOR,
        farmIds: ['AP12', 'AP13'],
      };
      mockReq.params = { farmId: 'AP13' };
      requireFarmAccess(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should deny access when no farmId is provided for non-admin', () => {
      mockReq.user = {
        uid: 'user1',
        email: 'test@test.com',
        role: UserRole.FARMER,
        farmIds: ['AP12'],
      };
      mockReq.params = {};
      mockReq.body = {};
      requireFarmAccess(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthorizationError));
    });

    it('should allow admin access even without farmId in params', () => {
      mockReq.user = {
        uid: 'user1',
        email: 'test@test.com',
        role: UserRole.ADMIN,
        farmIds: [],
      };
      mockReq.params = {};
      mockReq.body = {};
      requireFarmAccess(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledWith();
    });
  });
});
