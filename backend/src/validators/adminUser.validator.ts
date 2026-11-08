import { z } from 'zod';

export const CreateAdminUserSchema = z
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
  })
  .strict();

export type CreateAdminUserInput = z.infer<typeof CreateAdminUserSchema>;
