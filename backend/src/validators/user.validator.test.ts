import { describe, it, expect } from 'vitest';
import { UpdateUserStatusSchema } from './user.validator';

describe('UpdateUserStatusSchema', () => {
  it('should accept valid active=true', () => {
    const result = UpdateUserStatusSchema.safeParse({ active: true });
    expect(result.success).toBe(true);
  });

  it('should accept valid active=false', () => {
    const result = UpdateUserStatusSchema.safeParse({ active: false });
    expect(result.success).toBe(true);
  });

  it('should reject missing active field', () => {
    const result = UpdateUserStatusSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('should reject non-boolean active field', () => {
    const result = UpdateUserStatusSchema.safeParse({ active: 'true' });
    expect(result.success).toBe(false);
  });

  it('should reject extra fields due to strict mode', () => {
    const result = UpdateUserStatusSchema.safeParse({ active: true, extra: 'not-allowed' });
    expect(result.success).toBe(false);
  });
});
