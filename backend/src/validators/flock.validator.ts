import { z } from 'zod';

export const createFlockSchema = z.object({
  body: z.object({
    farmId: z.string().trim().min(1, 'Farm ID is required').max(50, 'Farm ID cannot exceed 50 characters'),
    flockName: z.string().trim().max(100, 'Flock name cannot exceed 100 characters').optional(),
    initialBirds: z
      .number()
      .int('Initial birds must be a whole number')
      .positive('Initial birds must be a positive integer')
      .max(10000000, 'Initial birds cannot exceed 10,000,000')
      .optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD'),
    breedType: z.string().trim().max(50, 'Breed type cannot exceed 50 characters').optional(),
    productionCurve: z.enum(['CF_STD', 'FR_STD']).optional(),
    notes: z.string().trim().max(1000, 'Notes cannot exceed 1000 characters').optional(),
  }),
});

export const updateFlockStatusSchema = z.object({
  params: z.object({
    flockId: z.string().trim().min(1, 'Flock ID is required'),
  }),
  body: z.object({
    status: z.enum(['active', 'completed']),
  }),
});
