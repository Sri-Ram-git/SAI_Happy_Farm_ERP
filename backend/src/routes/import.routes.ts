import { Router } from 'express';
import { validateBody } from '../middleware/validation.middleware';
import {
  CheckConflictsSchema,
  ExecuteImportSchema,
  RevertBatchSchema,
} from '../validators/import.validator';
import {
  checkConflicts,
  executeImport,
  getImportBatches,
  getImportBatchById,
  getRevertPreview,
  revertImportBatch,
} from '../controllers/import.controller';

const router = Router();

router.post(
  '/check-conflicts',
  validateBody(CheckConflictsSchema),
  checkConflicts,
);

router.post(
  '/execute',
  validateBody(ExecuteImportSchema),
  executeImport,
);

router.get(
  '/batches',
  getImportBatches,
);

router.get(
  '/batches/:batchId',
  getImportBatchById,
);

router.get(
  '/batches/:batchId/revert-preview',
  getRevertPreview,
);

router.post(
  '/batches/:batchId/revert',
  validateBody(RevertBatchSchema),
  revertImportBatch,
);

export default router;
