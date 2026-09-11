import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/authorization.middleware';
import { UserRole } from '../types/auth';
import { FlockController } from '../controllers/flock.controller';
import { validateBody } from '../middleware/validation.middleware';
import { createFlockSchema, updateFlockStatusSchema } from '../validators/flock.validator';

const router = Router();

// Only admins can create and manage flocks via API
router.post(
  '/',
  authMiddleware,
  requireRole(UserRole.ADMIN),
  validateBody(createFlockSchema),
  FlockController.createFlock
);

router.patch(
  '/:flockId/status',
  authMiddleware,
  requireRole(UserRole.ADMIN),
  validateBody(updateFlockStatusSchema),
  FlockController.updateFlockStatus
);

export default router;
