import { describe, it, expect } from 'vitest';
import { DailyReportInputSchema } from '../types/reports';

describe('DailyReportInputSchema', () => {
  const validInput = {
    farmId: 'AP12',
    birdCount: 5000,
    feedKg: 1250,
    mortality: 10,
    culling: 2,
    eggsProduced: 4500,
    selectionEggs: 100,
    temperature: 25.5,
    eggWeight: { min: 58, max: 62, avg: 60 },
    bodyWeight: { min: 1.7, max: 1.9, avg: 1.8 },
    remarks: '',
    ammoniaPpm: 10,
  };

  it('should accept valid input', () => {
    const result = DailyReportInputSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('should reject missing farmId', () => {
    const { farmId: _, ...input } = validInput;
    const result = DailyReportInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject negative birdCount', () => {
    const result = DailyReportInputSchema.safeParse({ ...validInput, birdCount: -1 });
    expect(result.success).toBe(false);
  });

  it('should reject negative mortality', () => {
    const result = DailyReportInputSchema.safeParse({ ...validInput, mortality: -5 });
    expect(result.success).toBe(false);
  });

  it('should reject non-integer birdCount', () => {
    const result = DailyReportInputSchema.safeParse({ ...validInput, birdCount: 5000.5 });
    expect(result.success).toBe(false);
  });

  it('should reject non-integer mortality', () => {
    const result = DailyReportInputSchema.safeParse({ ...validInput, mortality: 10.5 });
    expect(result.success).toBe(false);
  });

  it('should reject string birdCount', () => {
    const result = DailyReportInputSchema.safeParse({ ...validInput, birdCount: 'five thousand' });
    expect(result.success).toBe(false);
  });

  it('should reject unexpected fields with strict mode', () => {
    const result = DailyReportInputSchema.safeParse({
      ...validInput,
      role: 'admin',
    });
    expect(result.success).toBe(false);
  });

  it('should reject submittedBy field from client', () => {
    const result = DailyReportInputSchema.safeParse({
      ...validInput,
      submittedBy: 'some-user',
    });
    expect(result.success).toBe(false);
  });

  it('should reject date field from client', () => {
    const result = DailyReportInputSchema.safeParse({
      ...validInput,
      date: '2019-01-01',
    });
    expect(result.success).toBe(false);
  });

  it('should reject submissionDate field from client', () => {
    const result = DailyReportInputSchema.safeParse({
      ...validInput,
      submissionDate: '2019-01-01',
    });
    expect(result.success).toBe(false);
  });

  it('should reject createdAt field from client', () => {
    const result = DailyReportInputSchema.safeParse({
      ...validInput,
      createdAt: '2019-01-01',
    });
    expect(result.success).toBe(false);
  });

  it('should accept remarks as optional', () => {
    const { remarks: _, ...inputWithoutRemarks } = validInput;
    const result = DailyReportInputSchema.safeParse(inputWithoutRemarks);
    expect(result.success).toBe(true);
  });

  it('should reject remarks longer than 1000 characters', () => {
    const result = DailyReportInputSchema.safeParse({
      ...validInput,
      remarks: 'a'.repeat(1001),
    });
    expect(result.success).toBe(false);
  });

  it('should accept empty farmId', () => {
    const result = DailyReportInputSchema.safeParse({ ...validInput, farmId: '' });
    expect(result.success).toBe(false);
  });
});
