import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/authorization.middleware';
import { validateBody } from '../middleware/validation.middleware';
import { UserRole } from '../types/auth';
import { CreateFarmerSchema } from '../validators/farmer.validator';
import { UpdateUserStatusSchema } from '../validators/user.validator';
import { CreateSupervisorSchema, UpdateSupervisorFarmsSchema } from '../validators/supervisor.validator';
import { CreateAdminUserSchema } from '../validators/adminUser.validator';
import {
  createFarmer,
  createSupervisor,
  createAdmin,
  updateSupervisorAllocation,
  updateUserStatus,
  getUsers,
  deleteUserAccount,
} from '../controllers/farmer.controller';
import importRouter from './import.routes';

const router = Router();

router.use(authMiddleware);
router.use(requireRole(UserRole.ADMIN));

router.get('/users', getUsers);
router.delete('/users/:uid', deleteUserAccount);

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

router.post(
  '/users/supervisor',
  validateBody(CreateSupervisorSchema),
  createSupervisor,
);

router.post(
  '/users/admin',
  validateBody(CreateAdminUserSchema),
  createAdmin,
);

router.patch(
  '/users/supervisor/:uid/farms',
  validateBody(UpdateSupervisorFarmsSchema),
  updateSupervisorAllocation,
);

router.use('/import', importRouter);

export default router;


