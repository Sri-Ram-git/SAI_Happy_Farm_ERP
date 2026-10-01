import { describe, it, expect } from 'vitest';
import { CreateFarmerSchema } from './farmer.validator';

describe('CreateFarmerSchema Validation Suite', () => {
  const validPayload = {
    name: 'Ramesh Patel',
    email: 'ramesh@saihappyfarms.com',
    phone_no: '9876543210',
    password: 'password123',
    farmName: 'Sai Sunrise Poultry',
    initialBirdCount: 1000,
    initialFeedKg: 250,
  };

  it('should accept valid farmer creation data with nonzero birds and feed', () => {
    const result = CreateFarmerSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it('should accept valid farmer creation with 0 birds and 0 feed', () => {
    const result = CreateFarmerSchema.safeParse({
      ...validPayload,
      initialBirdCount: 0,
      initialFeedKg: 0,
    });
    expect(result.success).toBe(true);
  });

  it('should accept valid farmer creation with optional birds and feed omitted', () => {
    const { initialBirdCount, initialFeedKg, ...minimalPayload } = validPayload;
    const result = CreateFarmerSchema.safeParse(minimalPayload);
    expect(result.success).toBe(true);
  });

  it('should reject negative initialBirdCount', () => {
    const result = CreateFarmerSchema.safeParse({
      ...validPayload,
      initialBirdCount: -5,
    });
    expect(result.success).toBe(false);
  });

  it('should reject fractional/decimal initialBirdCount', () => {
    const result = CreateFarmerSchema.safeParse({
      ...validPayload,
      initialBirdCount: 100.5,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('whole number');
    }
  });

  it('should reject negative initialFeedKg', () => {
    const result = CreateFarmerSchema.safeParse({
      ...validPayload,
      initialFeedKg: -10,
    });
    expect(result.success).toBe(false);
  });

  it('should accept decimal initialFeedKg (e.g. 250.5 kg)', () => {
    const result = CreateFarmerSchema.safeParse({
      ...validPayload,
      initialFeedKg: 250.5,
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid email format', () => {
    const result = CreateFarmerSchema.safeParse({
      ...validPayload,
      email: 'not-an-email',
    });
    expect(result.success).toBe(false);
  });

  it('should reject password less than 6 characters', () => {
    const result = CreateFarmerSchema.safeParse({
      ...validPayload,
      password: '12345',
    });
    expect(result.success).toBe(false);
  });

  it('should reject unknown extra properties due to strict mode', () => {
    const result = CreateFarmerSchema.safeParse({
      ...validPayload,
      extraProperty: 'disallowed',
    });
    expect(result.success).toBe(false);
  });
});
