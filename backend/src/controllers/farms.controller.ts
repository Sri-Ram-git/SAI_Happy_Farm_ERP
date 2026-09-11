import { Request, Response, NextFunction } from 'express';
import { farmsService } from '../services/farms.service';

export async function getFarmById(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const farmId = req.params['farmId'] as string;
    const requestId = req.requestId!;

    const farm = await farmsService.getFarmById(farmId, requestId);

    res.status(200).json({
      success: true,
      data: farm,
    });
  } catch (error) {
    next(error);
  }
}

export async function getFarms(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user!;
    const requestId = req.requestId!;

    const farms = await farmsService.getAuthorizedFarms(user, requestId);

    res.status(200).json({
      success: true,
      data: farms,
    });
  } catch (error) {
    next(error);
  }
}
