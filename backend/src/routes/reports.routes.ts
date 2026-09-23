import { Router } from 'express';
import { createDailyReport, getReportById, exportProductionCurveReport } from '../controllers/reports.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireFarmAccess } from '../middleware/authorization.middleware';
import { validateBody } from '../middleware/validation.middleware';
import { createRateLimiter } from '../middleware/rateLimit.middleware';
import { DailyReportInputSchema } from '../types/reports';

const router = Router();
const reportRateLimiter = createRateLimiter(60000, 10);

router.get(
  '/export-production-curve',
  authMiddleware,
  exportProductionCurveReport,
);

router.post(
  '/daily',
  authMiddleware,
  reportRateLimiter,
  validateBody(DailyReportInputSchema),
  requireFarmAccess,
  createDailyReport,
);

router.get(
  '/daily/:id',
  authMiddleware,
  getReportById,
);

export default router;

