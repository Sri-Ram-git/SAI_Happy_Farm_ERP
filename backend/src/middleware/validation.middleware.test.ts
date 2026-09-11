import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateBody } from '../middleware/validation.middleware';
import { DailyReportInputSchema } from '../types/reports';
import { Request, Response, NextFunction } from 'express';

describe('Validation Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = { body: {} };
    mockRes = {};
    mockNext = vi.fn();
  });

  it('should pass valid input through', () => {
    mockReq.body = {
      farmId: 'AP12',
      birdCount: 5000,
      feedKg: 1250,
      mortality: 10,
      culling: 2,
      eggsProduced: 4500,
      selectionEggs: 100,
      temperature: 25.5,
      eggWeight: { min: 58, max: 62, avg: 60 },
      bodyWeight: { min: 1.7, max: 1.9, avg: 1.8 },
      remarks: '',
      ammoniaPpm: 10,
    };

    const middleware = validateBody(DailyReportInputSchema);
    middleware(mockReq as Request, mockRes as Response, mockNext);
    expect(mockNext).toHaveBeenCalledWith();
  });

  it('should reject invalid input with error details', () => {
    mockReq.body = { farmId: '' };

    const middleware = validateBody(DailyReportInputSchema);
    middleware(mockReq as Request, mockRes as Response, mockNext);
    expect(mockNext).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        fields: expect.any(Object),
      }),
    );
  });

  it('should reject unexpected fields', () => {
    mockReq.body = {
      farmId: 'AP12',
      birdCount: 5000,
      feedKg: 1250,
      mortality: 10,
      culling: 2,
      eggsProduced: 4500,
      selectionEggs: 100,
      temperature: 25.5,
      eggWeight: { min: 58, max: 62, avg: 60 },
      bodyWeight: { min: 1.7, max: 1.9, avg: 1.8 },
      ammoniaPpm: 10,
      role: 'admin',
      submittedBy: 'user123',
    };

    const middleware = validateBody(DailyReportInputSchema);
    middleware(mockReq as Request, mockRes as Response, mockNext);
    expect(mockNext).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
      }),
    );
  });
});
