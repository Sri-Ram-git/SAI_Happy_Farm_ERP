import { z } from 'zod';

export const CreateSupervisorSchema = z
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
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password must be 128 characters or fewer'),
    farmIds: z
      .array(z.string())
      .min(1, 'At least one farm must be assigned to supervisor'),
  })
  .strict();

export type CreateSupervisorInput = z.infer<typeof CreateSupervisorSchema>;

export const UpdateSupervisorFarmsSchema = z
  .object({
    farmIds: z
      .array(z.string())
      .min(0, 'farmIds must be an array'),
  })
  .strict();

export type UpdateSupervisorFarmsInput = z.infer<typeof UpdateSupervisorFarmsSchema>;
