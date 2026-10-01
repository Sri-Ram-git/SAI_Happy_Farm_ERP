import { Request, Response, NextFunction } from 'express';
import { farmerService } from '../services/farmer.service';
import { userService } from '../services/userService';

export async function createFarmer(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user!;
    const requestId = req.requestId!;
    const input = req.body;

    const result = await farmerService.createFarmer(input, user.uid, requestId);

    res.status(201).json({
      success: true,
      data: {
        uid: result.uid,
        email: result.email,
        farmId: result.farmId,
        flockId: result.flockId,
        message: 'Farmer created successfully',
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function createSupervisor(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user!;
    const requestId = req.requestId!;
    const input = req.body;

    const result = await userService.createSupervisor(input, user.uid, requestId);

    res.status(201).json({
      success: true,
      data: {
        uid: result.uid,
        email: result.email,
        message: 'Supervisor created successfully',
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function createAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user!;
    const requestId = req.requestId!;
    const input = req.body;

    const result = await userService.createAdmin(input, user.uid, requestId);

    res.status(201).json({
      success: true,
      data: {
        uid: result.uid,
        email: result.email,
        message: 'Admin created successfully',
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateSupervisorAllocation(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user!;
    const requestId = req.requestId!;
    const targetUid = req.params['uid'] as string;
    const { farmIds } = req.body;

    const result = await userService.updateSupervisorAllocation(
      targetUid,
      farmIds || [],
      user.uid,
      requestId,
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateUserStatus(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const adminUser = req.user!;
    const requestId = req.requestId!;
    const targetUid = req.params['uid'] as string;
    const { active } = req.body;

    const result = await farmerService.updateUserStatus(
      targetUid,
      Boolean(active),
      adminUser.uid,
      requestId,
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function getUsers(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const requestId = req.requestId!;
    const users = await farmerService.getAllUsers(requestId);

    res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteUserAccount(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const adminUser = req.user!;
    const requestId = req.requestId!;
    const targetUid = req.params['uid'] as string;

    const result = await userService.deleteUserAccount(targetUid, adminUser.uid, requestId);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}



