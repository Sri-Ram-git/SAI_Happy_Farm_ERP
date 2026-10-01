import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportProductionCurveReport } from './reports.controller';
import { Request, Response } from 'express';
import { UserRole } from '../types/auth';

vi.mock('../services/reports.service', () => ({
  reportsService: {
    generateProductionCurveExport: vi.fn().mockResolvedValue({
      buffer: Buffer.from('test-xlsx-content'),
      filename: 'Production_Report_2026-09-01_to_2026-10-01.xlsx',
    }),
  },
}));

import { reportsService } from '../services/reports.service';

describe('SEC-01: Production Curve Export Authorization & Cross-Farm Isolation', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let resStatus: any;
  let resJson: any;
  let resSend: any;
  let resSetHeader: any;
  let nextFn: any;

  beforeEach(() => {
    vi.clearAllMocks();
    resJson = vi.fn();
    resSend = vi.fn();
    resSetHeader = vi.fn();
    resStatus = vi.fn().mockReturnValue({ json: resJson, send: resSend });
    mockRes = {
      status: resStatus,
      json: resJson,
      send: resSend,
      setHeader: resSetHeader,
    };
    nextFn = vi.fn();
  });

  it('1. Admin: should permit export for any specific farmId', async () => {
    mockReq = {
      query: { farmId: 'AP99', startDate: '2026-09-01', endDate: '2026-10-01' },
      requestId: 'req-admin-export',
      user: {
        uid: 'admin-1',
        email: 'admin@sai.com',
        role: UserRole.ADMIN,
        farmIds: [],
      },
    };

    await exportProductionCurveReport(mockReq as Request, mockRes as Response, nextFn);

    expect(reportsService.generateProductionCurveExport).toHaveBeenCalledWith(
      '2026-09-01',
      '2026-10-01',
      'req-admin-export',
      ['AP99'],
    );
    expect(resStatus).toHaveBeenCalledWith(200);
    expect(resSend).toHaveBeenCalled();
  });

  it('2. Admin: should permit export across all farms when no farmId is specified', async () => {
    mockReq = {
      query: { startDate: '2026-09-01', endDate: '2026-10-01' },
      requestId: 'req-admin-all',
      user: {
        uid: 'admin-1',
        email: 'admin@sai.com',
        role: UserRole.ADMIN,
        farmIds: [],
      },
    };

    await exportProductionCurveReport(mockReq as Request, mockRes as Response, nextFn);

    expect(reportsService.generateProductionCurveExport).toHaveBeenCalledWith(
      '2026-09-01',
      '2026-10-01',
      'req-admin-all',
      undefined,
    );
    expect(resStatus).toHaveBeenCalledWith(200);
  });

  it('3. Supervisor: should permit export for an assigned farmId', async () => {
    mockReq = {
      query: { farmId: 'AP15', startDate: '2026-09-01', endDate: '2026-10-01' },
      requestId: 'req-sup-own',
      user: {
        uid: 'sup-1',
        email: 'supervisor@sai.com',
        role: UserRole.SUPERVISOR,
        farmIds: ['AP15', 'AP16'],
      },
    };

    await exportProductionCurveReport(mockReq as Request, mockRes as Response, nextFn);

    expect(reportsService.generateProductionCurveExport).toHaveBeenCalledWith(
      '2026-09-01',
      '2026-10-01',
      'req-sup-own',
      ['AP15'],
    );
    expect(resStatus).toHaveBeenCalledWith(200);
  });

  it('4. Supervisor: should automatically scope to assigned farmIds when no farmId param is passed', async () => {
    mockReq = {
      query: { startDate: '2026-09-01', endDate: '2026-10-01' },
      requestId: 'req-sup-scoped',
      user: {
        uid: 'sup-1',
        email: 'supervisor@sai.com',
        role: UserRole.SUPERVISOR,
        farmIds: ['AP15', 'AP16'],
      },
    };

    await exportProductionCurveReport(mockReq as Request, mockRes as Response, nextFn);

    expect(reportsService.generateProductionCurveExport).toHaveBeenCalledWith(
      '2026-09-01',
      '2026-10-01',
      'req-sup-scoped',
      ['AP15', 'AP16'],
    );
    expect(resStatus).toHaveBeenCalledWith(200);
  });

  it('5. Supervisor CROSS-FARM ATTACK: should reject request with 403 when requesting unassigned farmId', async () => {
    mockReq = {
      query: { farmId: 'AP99', startDate: '2026-09-01', endDate: '2026-10-01' },
      requestId: 'req-sup-attack',
      user: {
        uid: 'sup-1',
        email: 'supervisor@sai.com',
        role: UserRole.SUPERVISOR,
        farmIds: ['AP15', 'AP16'],
      },
    };

    await exportProductionCurveReport(mockReq as Request, mockRes as Response, nextFn);

    expect(reportsService.generateProductionCurveExport).not.toHaveBeenCalled();
    expect(resStatus).toHaveBeenCalledWith(403);
    expect(resJson).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'AUTHORIZATION_DENIED',
        message: 'Access to this farm is denied',
      },
    });
  });

  it('6. Farmer CROSS-FARM ATTACK: should reject request with 403 when requesting unassigned farmId', async () => {
    mockReq = {
      query: { farmId: 'AP16', startDate: '2026-09-01', endDate: '2026-10-01' },
      requestId: 'req-farmer-attack',
      user: {
        uid: 'farmer-1',
        email: 'farmer@sai.com',
        role: UserRole.FARMER,
        farmIds: ['AP15'],
      },
    };

    await exportProductionCurveReport(mockReq as Request, mockRes as Response, nextFn);

    expect(reportsService.generateProductionCurveExport).not.toHaveBeenCalled();
    expect(resStatus).toHaveBeenCalledWith(403);
    expect(resJson).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'AUTHORIZATION_DENIED',
        message: 'Access to this farm is denied',
      },
    });
  });

  it('7. User with no assigned farms: should reject export with 403 when no farmId is specified', async () => {
    mockReq = {
      query: { startDate: '2026-09-01', endDate: '2026-10-01' },
      requestId: 'req-empty-farms',
      user: {
        uid: 'farmer-no-farms',
        email: 'nofarms@sai.com',
        role: UserRole.FARMER,
        farmIds: [],
      },
    };

    await exportProductionCurveReport(mockReq as Request, mockRes as Response, nextFn);

    expect(reportsService.generateProductionCurveExport).not.toHaveBeenCalled();
    expect(resStatus).toHaveBeenCalledWith(403);
    expect(resJson).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'AUTHORIZATION_DENIED',
        message: 'No assigned farms found for export',
      },
    });
  });
});
