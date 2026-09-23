import { z } from 'zod';

export const createFlockSchema = z.object({
  body: z.object({
    farmId: z.string().min(1, 'Farm ID is required'),
    flockName: z.string().optional(),
    initialBirds: z.number().int().positive('Initial birds must be a positive integer').optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD'),
    breedType: z.string().optional(),
    productionCurve: z.enum(['CF_STD', 'FR_STD']).optional(),
    notes: z.string().optional(),
  }),
});

export const updateFlockStatusSchema = z.object({
  params: z.object({
    flockId: z.string(),
  }),
  body: z.object({
    status: z.enum(['active', 'completed']),
  }),
});
