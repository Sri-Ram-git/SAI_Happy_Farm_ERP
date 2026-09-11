import { z } from 'zod';

export const UpdateUserStatusSchema = z
  .object({
    active: z.boolean({
      required_error: 'Active status is required',
      invalid_type_error: 'Active status must be a boolean',
    }),
  })
  .strict();

export type UpdateUserStatusInput = z.infer<typeof UpdateUserStatusSchema>;
