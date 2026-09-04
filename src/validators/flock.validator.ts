import { z } from 'zod';

export const createFlockSchema = z.object({
  body: z.object({
    farmId: z.string().min(1, 'Farm ID is required'),
    flockName: z.string().min(1, 'Flock name is required'),
    initialBirds: z.number().int().positive('Initial birds must be a positive integer'),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD'),
    breedType: z.string().min(1, 'Breed type is required'),
    productionCurve: z.enum(['CF_STD', 'FR_STD']),
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
