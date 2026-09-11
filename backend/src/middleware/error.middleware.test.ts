import { describe, it, expect, vi, beforeEach } from 'vitest';
import { errorMiddleware } from '../middleware/error.middleware';
import { Request, Response, NextFunction } from 'express';
import { ValidationError, AuthenticationError, AuthorizationError, InternalError } from '../utils/errors';

describe('Error Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      requestId: 'test-request-id',
      user: undefined,
      method: 'POST',
      originalUrl: '/api/test',
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    mockNext = vi.fn();
  });

  it('should handle ValidationError', () => {
    const error = new ValidationError('Invalid data', { field1: 'error1' });
    errorMiddleware(error, mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid data',
        fields: { field1: 'error1' },
      },
    });
  });

  it('should handle AuthenticationError', () => {
    const error = new AuthenticationError();
    errorMiddleware(error, mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required',
      },
    });
  });

  it('should handle AuthorizationError', () => {
    const error = new AuthorizationError();
    errorMiddleware(error, mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(403);
  });

  it('should handle unknown errors as InternalError', () => {
    const error = new Error('Something went wrong');
    errorMiddleware(error, mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      },
    });
  });

  it('should not expose internal error details', () => {
    const error = new Error('Database connection failed at db.internal.com:5432');
    errorMiddleware(error, mockReq as Request, mockRes as Response, mockNext);

    const callArgs = (mockRes.json as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(callArgs).toBeDefined();
    const errorObj = callArgs['error'] as Record<string, string>;
    expect(errorObj).toBeDefined();
    expect(errorObj['message']).not.toContain('db.internal.com');
    expect(errorObj['message']).not.toContain('5432');
  });
});
