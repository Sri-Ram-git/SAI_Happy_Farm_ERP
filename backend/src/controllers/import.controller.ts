import { Request, Response, NextFunction } from 'express';
import { importService } from '../services/import.service';
import { NotFoundError } from '../utils/errors';

export async function checkConflicts(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user!;
    const requestId = req.requestId!;
    const input = req.body;

    const result = await importService.checkConflicts(input, user, requestId);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function executeImport(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user!;
    const requestId = req.requestId!;
    const input = req.body;

    const result = await importService.executeImport(input, user, requestId);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function getImportBatches(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const batches = await importService.getImportBatches();

    res.status(200).json({
      success: true,
      data: batches,
    });
  } catch (error) {
    next(error);
  }
}

export async function getImportBatchById(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const batchId = req.params['batchId'];
    if (!batchId) {
      throw new NotFoundError('Import batch');
    }

    const batch = await importService.getImportBatchById(batchId);
    if (!batch) {
      throw new NotFoundError('Import batch');
    }

    res.status(200).json({
      success: true,
      data: batch,
    });
  } catch (error) {
    next(error);
  }
}

export async function getRevertPreview(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user!;
    const requestId = req.requestId!;
    const batchId = req.params['batchId'];
    if (!batchId) {
      throw new NotFoundError('Import batch');
    }

    const worksheetKey = typeof req.query['worksheetKey'] === 'string' ? req.query['worksheetKey'] : undefined;
    const preview = await importService.getRevertPreview(batchId, user, requestId, worksheetKey);

    res.status(200).json({
      success: true,
      data: preview,
    });
  } catch (error) {
    next(error);
  }
}

export async function revertImportBatch(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user!;
    const requestId = req.requestId!;
    const batchId = req.params['batchId'];
    if (!batchId) {
      throw new NotFoundError('Import batch');
    }
    const input = req.body;

    const result = await importService.revertImportBatch(batchId, input, user, requestId);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
