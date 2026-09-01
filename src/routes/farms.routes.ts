import { Router } from 'express';
import { getFarmById, getFarms } from '../controllers/farms.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireFarmAccess } from '../middleware/authorization.middleware';

const router = Router();

router.get(
  '/',
  authMiddleware,
  getFarms,
);

router.get(
  '/:farmId',
  authMiddleware,
  requireFarmAccess,
  getFarmById,
);

export default router;
