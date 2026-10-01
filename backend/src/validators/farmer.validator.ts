import { z } from 'zod';

export const CreateFarmerSchema = z
  .object({
    name: z
      .string()
      .min(1, 'Name is required')
      .max(100, 'Name must be 100 characters or fewer'),
    email: z
      .string()
      .email('Invalid email address')
      .max(254, 'Email must be 254 characters or fewer'),
    phone_no: z
      .string()
      .min(1, 'Phone number is required')
      .max(20, 'Phone number must be 20 characters or fewer'),
    password: z
      .string()
      .min(6, 'Password must be at least 6 characters')
      .max(128, 'Password must be 128 characters or fewer'),
    farmName: z
      .string()
      .min(1, 'Farm Name is required')
      .max(100, 'Farm Name must be 100 characters or fewer'),
    farmId: z
      .string()
      .trim()
      .min(1, 'Farm ID is required')
      .max(50, 'Farm ID must be 50 characters or fewer'),
    initialBirdCount: z.number().int('Initial bird count must be a whole number').nonnegative('Must be 0 or positive').optional(),
    initialFeedKg: z.number().nonnegative('Must be 0 or positive').optional(),
  })
  .strict();

export type CreateFarmerInput = z.infer<typeof CreateFarmerSchema>;
