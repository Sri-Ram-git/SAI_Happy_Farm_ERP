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
    bodyWeight: { min: 1700, max: 1900, avg: 1800 },
    remarks: '',
    ammoniaPpm: 10,
  };

  it('should accept valid input', () => {
    const result = DailyReportInputSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('should accept input without bodyWeight and ammoniaPpm (weekly/optional)', () => {
    const { bodyWeight: _, ammoniaPpm: __, ...input } = validInput;
    const result = DailyReportInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should reject bodyWeight min < 500', () => {
    const result = DailyReportInputSchema.safeParse({
      ...validInput,
      bodyWeight: { min: 400, max: 1500, avg: 1000 },
    });
    expect(result.success).toBe(false);
  });

  it('should reject bodyWeight max > 3000', () => {
    const result = DailyReportInputSchema.safeParse({
      ...validInput,
      bodyWeight: { min: 1500, max: 3500, avg: 2000 },
    });
    expect(result.success).toBe(false);
  });

  it('should reject eggWeight min < 30', () => {
    const result = DailyReportInputSchema.safeParse({
      ...validInput,
      eggWeight: { min: 25, max: 60, avg: 45 },
    });
    expect(result.success).toBe(false);
  });

  it('should reject eggWeight max > 80', () => {
    const result = DailyReportInputSchema.safeParse({
      ...validInput,
      eggWeight: { min: 60, max: 85, avg: 70 },
    });
    expect(result.success).toBe(false);
  });

  it('should reject ammoniaPpm > 50', () => {
    const result = DailyReportInputSchema.safeParse({
      ...validInput,
      ammoniaPpm: 55,
    });
    expect(result.success).toBe(false);
  });

  it('should reject temperature < 10', () => {
    const result = DailyReportInputSchema.safeParse({
      ...validInput,
      temperature: 9,
    });
    expect(result.success).toBe(false);
  });

  it('should reject temperature > 50', () => {
    const result = DailyReportInputSchema.safeParse({
      ...validInput,
      temperature: 51,
    });
    expect(result.success).toBe(false);
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

  it('should accept valid non-negative integer damagedEggs and floorEggs', () => {
    const result = DailyReportInputSchema.safeParse({
      ...validInput,
      damagedEggs: 15,
      floorEggs: 8,
    });
    expect(result.success).toBe(true);
  });

  it('should accept damagedEggs and floorEggs as 0 or omitted', () => {
    const resultZero = DailyReportInputSchema.safeParse({
      ...validInput,
      damagedEggs: 0,
      floorEggs: 0,
    });
    expect(resultZero.success).toBe(true);

    const resultOmitted = DailyReportInputSchema.safeParse(validInput);
    expect(resultOmitted.success).toBe(true);
  });

  it('should reject negative damagedEggs or floorEggs', () => {
    const resultDamaged = DailyReportInputSchema.safeParse({
      ...validInput,
      damagedEggs: -1,
    });
    expect(resultDamaged.success).toBe(false);

    const resultFloor = DailyReportInputSchema.safeParse({
      ...validInput,
      floorEggs: -5,
    });
    expect(resultFloor.success).toBe(false);
  });

  it('should reject non-integer decimal damagedEggs or floorEggs', () => {
    const resultDamaged = DailyReportInputSchema.safeParse({
      ...validInput,
      damagedEggs: 4.5,
    });
    expect(resultDamaged.success).toBe(false);

    const resultFloor = DailyReportInputSchema.safeParse({
      ...validInput,
      floorEggs: 2.3,
    });
    expect(resultFloor.success).toBe(false);
  });
});
