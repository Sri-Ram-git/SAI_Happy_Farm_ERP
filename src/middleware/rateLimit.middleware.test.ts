import { describe, it, expect, vi, beforeEach } from 'vitest';
import { rateLimitMiddleware, createRateLimiter } from '../middleware/rateLimit.middleware';
import { Request, Response, NextFunction } from 'express';

describe('Rate Limit Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    };
    mockRes = {};
    mockNext = vi.fn();
  });

  it('should allow requests within limit', () => {
    const limiter = createRateLimiter(60000, 5);

    for (let i = 0; i < 5; i++) {
      limiter(mockReq as Request, mockRes as Response, mockNext);
    }

    expect(mockNext).toHaveBeenCalledTimes(5);
    expect(mockNext).not.toHaveBeenCalledWith(expect.objectContaining({ statusCode: 429 }));
  });

  it('should reject requests exceeding limit', () => {
    const limiter = createRateLimiter(60000, 3);

    for (let i = 0; i < 4; i++) {
      limiter(mockReq as Request, mockRes as Response, mockNext);
    }

    expect(mockNext).toHaveBeenCalledTimes(4);
    const lastCall = mockNext.mock.calls[3]?.[0];
    expect(lastCall).toBeDefined();
    expect(lastCall?.statusCode).toBe(429);
  });
});
