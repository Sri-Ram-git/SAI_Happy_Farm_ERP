import { Request, Response, NextFunction } from 'express';
import { farmerService } from '../services/farmer.service';

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
        message: 'Farmer created successfully',
      },
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

