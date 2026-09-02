import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/authorization.middleware';
import { validateBody } from '../middleware/validation.middleware';
import { UserRole } from '../types/auth';
import { CreateFarmerSchema } from '../validators/farmer.validator';
import { UpdateUserStatusSchema } from '../validators/user.validator';
import { createFarmer, updateUserStatus, getUsers } from '../controllers/farmer.controller';

const router = Router();

router.use(authMiddleware);
router.use(requireRole(UserRole.ADMIN));

router.get('/users', getUsers);

router.patch(
  '/users/:uid/status',
  validateBody(UpdateUserStatusSchema),
  updateUserStatus,
);

router.put(
  '/users/:uid/status',
  validateBody(UpdateUserStatusSchema),
  updateUserStatus,
);

router.post(
  '/users/farmer',
  validateBody(CreateFarmerSchema),
  createFarmer,
);

export default router;

