import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../types/auth';
import { AuthorizationError } from '../utils/errors';
import { logger } from '../utils/logger';

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AuthorizationError('Not authenticated'));
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn('Authorization denied: insufficient role', {
        requestId: req.requestId,
        userId: req.user.uid,
        requiredRoles: allowedRoles,
        actualRole: req.user.role,
        endpoint: req.originalUrl,
        method: req.method,
      });
      next(new AuthorizationError('Insufficient permissions'));
      return;
    }

    next();
  };
}

export function requireFarmAccess(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(new AuthorizationError('Not authenticated'));
    return;
  }

  if (req.user.role === UserRole.ADMIN || req.user.role === UserRole.OFFICE_STAFF) {
    next();
    return;
  }

  const farmId =
    (req.params['farmId'] as string) ?? (req.body as Record<string, unknown>)?.['farmId'];

  if (!farmId) {
    next(new AuthorizationError('Farm ID is required'));
    return;
  }

  if (!req.user.farmIds.includes(farmId)) {
    logger.warn('Authorization denied: farm access denied', {
      requestId: req.requestId,
      userId: req.user.uid,
      requestedFarmId: farmId,
      allowedFarmIds: req.user.farmIds,
      endpoint: req.originalUrl,
      method: req.method,
    });
    next(new AuthorizationError('Access to this farm is denied'));
    return;
  }

  next();
}
