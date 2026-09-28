import { z } from 'zod';

const HistoricalImportRecordSchema = z.object({
  recordType: z.enum(['DAILY_REPORT', 'FEED_LOAD', 'FLOCK_RECORD']),
  farmId: z.string().min(1, 'Farm ID is required'),
  submissionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  birdCount: z.number().int().nonnegative().optional(),
  feedKg: z.number().nonnegative().optional(),
  feedGrams: z.number().nonnegative().optional(),
  feedG: z.number().nonnegative().optional(),
  mortality: z.number().int().nonnegative().optional(),
  culling: z.number().int().nonnegative().optional(),
  eggsProduced: z.number().int().nonnegative().optional(),
  selectionEggs: z.number().int().nonnegative().optional(),
  temperature: z.number().nullable().optional(),
  tempMin: z.number().nullable().optional(),
  tempMax: z.number().nullable().optional(),
  ammoniaPpm: z.number().nullable().optional(),
  eggWeight: z
    .object({
      min: z.number().nonnegative(),
      max: z.number().nonnegative(),
      avg: z.number().nonnegative(),
    })
    .optional(),
  bodyWeight: z
    .object({
      min: z.number().nonnegative(),
      max: z.number().nonnegative(),
      avg: z.number().nonnegative(),
    })
    .optional(),
  remarks: z.string().optional(),
  flockId: z.string().optional(),
  sourceFile: z.string().min(1, 'Source file name is required'),
  sourceRow: z.number().int().min(1, 'Source row must be at least 1'),
  weekNumber: z.number().optional(),
  damagedEggs: z.number().int().nonnegative().optional(),
  floorEggs: z.number().int().nonnegative().optional(),
  feedGramsPerBird: z.number().nonnegative().optional(),
  actualProductionPct: z.number().nonnegative().optional(),
  standardProductionPct: z.number().nonnegative().optional(),
  feedLoadQuantityKg: z.number().positive().optional(),
  feedLoadNotes: z.string().optional(),
  flockName: z.string().optional(),
  initialBirds: z.number().int().positive().optional(),
  startDate: z.string().optional(),
  breedType: z.string().optional(),
});

export const CheckConflictsSchema = z.object({
  records: z.array(HistoricalImportRecordSchema).min(1, 'At least one record is required to check conflicts'),
});

export const ExecuteImportSchema = z.object({
  batchId: z.string().optional(),
  records: z.array(HistoricalImportRecordSchema).min(1, 'At least one record is required to import'),
  conflictAction: z.enum(['skip', 'replace']),
  sourceFiles: z.array(z.string()).min(1, 'Source files list is required'),
  dryRun: z.boolean().optional(),
});

export const RevertBatchSchema = z.object({
  confirmationBatchId: z.string().min(1, 'Confirmation batch ID is required to authorize revert'),
});
