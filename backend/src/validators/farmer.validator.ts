import { z } from 'zod';

export const CreateFarmerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Name is required')
      .max(100, 'Name must be 100 characters or fewer'),
    email: z
      .string()
      .trim()
      .email('Invalid email address')
      .max(254, 'Email must be 254 characters or fewer'),
    phone_no: z
      .string()
      .trim()
      .min(1, 'Phone number is required')
      .max(20, 'Phone number must be 20 characters or fewer')
      .regex(/^\+?[0-9\s\-()]{7,20}$/, 'Invalid phone number format')
      .refine(
        (val) => {
          const digits = (val.match(/\d/g) || []).length;
          return digits >= 7 && digits <= 15;
        },
        { message: 'Phone number must contain between 7 and 15 digits' },
      ),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password must be 128 characters or fewer'),
    farmName: z
      .string()
      .trim()
      .min(1, 'Farm Name is required')
      .max(100, 'Farm Name must be 100 characters or fewer'),
    farmId: z
      .string()
      .trim()
      .min(1, 'Farm ID is required')
      .max(50, 'Farm ID must be 50 characters or fewer')
      .regex(/^[a-zA-Z0-9_\-]+$/, 'Farm ID must contain only letters, numbers, hyphens, and underscores'),
    initialBirdCount: z
      .number()
      .int('Initial bird count must be a whole number')
      .nonnegative('Must be 0 or positive')
      .max(10000000, 'Initial bird count cannot exceed 10,000,000')
      .optional(),
    initialFeedKg: z
      .number()
      .nonnegative('Must be 0 or positive')
      .max(9999999.99, 'Initial feed cannot exceed 9,999,999.99 Kg')
      .optional(),
  })
  .strict();

export type CreateFarmerInput = z.infer<typeof CreateFarmerSchema>;
