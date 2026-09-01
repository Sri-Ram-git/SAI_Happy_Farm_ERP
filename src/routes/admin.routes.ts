import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/authorization.middleware';
import { UserRole } from '../types/auth';

const router = Router();

router.use(authMiddleware);
router.use(requireRole(UserRole.ADMIN));

router.get('/users', (_req, res) => {
  res.status(200).json({
    success: true,
    data: { message: 'Admin users endpoint - implement later' },
  });
});

export default router;
