import { Request, Response, NextFunction } from 'express';
import { DailyReportInput } from '../types/reports';
import { UserRole } from '../types/auth';
import { reportsService } from '../services/reports.service';
import { logger } from '../utils/logger';

export async function createDailyReport(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = req.body as DailyReportInput;
    const user = req.user!;
    const requestId = req.requestId!;

    const result = await reportsService.createDailyReport(input, user, requestId);

    logger.info('Daily report created', {
      requestId,
      userId: user.uid,
      farmId: result.farmId,
      reportId: result.reportId,
    });

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function getReportById(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const reportId = req.params['id'] as string;
    const user = req.user!;

    const report = await reportsService.getReportById(reportId, user);

    if (user.role === UserRole.ADMIN || user.role === UserRole.OFFICE_STAFF) {
      // Admin and office staff can access all reports
    } else if (user.farmIds.length === 0 || !user.farmIds.includes(report.farmId)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'AUTHORIZATION_DENIED',
          message: 'Access to this report is denied',
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
}

export async function exportProductionCurveReport(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const startDate = (req.query['startDate'] as string) || new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().split('T')[0]!;
    const endDate = (req.query['endDate'] as string) || new Date().toISOString().split('T')[0]!;
    const requestId = req.requestId!;
    const user = req.user;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Start date and end date must be in YYYY-MM-DD format',
        },
      });
      return;
    }

    if (startDate > endDate) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'End date must be on or after the start date',
        },
      });
      return;
    }

    const farmIdParam = req.query['farmId'] as string | undefined;
    let targetFarmIds: string[] | undefined = undefined;

    if (user && user.role !== UserRole.ADMIN && user.role !== UserRole.OFFICE_STAFF) {
      if (farmIdParam) {
        if (!user.farmIds.includes(farmIdParam)) {
          logger.warn('Export denied: unauthorized farmId parameter', {
            requestId,
            userId: user.uid,
            requestedFarmId: farmIdParam,
            allowedFarmIds: user.farmIds,
          });
          res.status(403).json({
            success: false,
            error: {
              code: 'AUTHORIZATION_DENIED',
              message: 'Access to this farm is denied',
            },
          });
          return;
        }
        targetFarmIds = [farmIdParam];
      } else {
        if (!user.farmIds || user.farmIds.length === 0) {
          logger.warn('Export denied: user has no assigned farms', {
            requestId,
            userId: user.uid,
          });
          res.status(403).json({
            success: false,
            error: {
              code: 'AUTHORIZATION_DENIED',
              message: 'No assigned farms found for export',
            },
          });
          return;
        }
        targetFarmIds = user.farmIds;
      }
    } else {
      if (farmIdParam) {
        targetFarmIds = [farmIdParam];
      }
    }

    const { buffer, filename } = await reportsService.generateProductionCurveExport(
      startDate,
      endDate,
      requestId,
      targetFarmIds,
    );

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(buffer);
  } catch (error) {
    next(error);
  }
}

