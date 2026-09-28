import { describe, it, expect } from 'vitest';
import { validateDailyReportBusinessRules } from '../validators/report.validator';
import { DailyReportInput } from '../types/reports';

describe('Business Rule Validation', () => {
  const validInput: DailyReportInput = {
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

  it('should pass for valid input', () => {
    expect(() => validateDailyReportBusinessRules(validInput)).not.toThrow();
  });

  it('should pass without bodyWeight or ammoniaPpm (optional weekly fields)', () => {
    expect(() =>
      validateDailyReportBusinessRules({
        ...validInput,
        bodyWeight: undefined,
        ammoniaPpm: undefined,
      }),
    ).not.toThrow();
  });

  it('should reject mortality > birdCount', () => {
    expect(() =>
      validateDailyReportBusinessRules({ ...validInput, mortality: 5001 }),
    ).toThrow();
  });

  it('should reject culling > birdCount', () => {
    expect(() =>
      validateDailyReportBusinessRules({ ...validInput, culling: 5001 }),
    ).toThrow();
  });

  it('should reject mortality + culling > birdCount', () => {
    expect(() =>
      validateDailyReportBusinessRules({
        ...validInput,
        mortality: 3000,
        culling: 3000,
      }),
    ).toThrow();
  });

  it('should reject eggWeight min < 30', () => {
    expect(() =>
      validateDailyReportBusinessRules({
        ...validInput,
        eggWeight: { min: 25, max: 60, avg: 45 },
      }),
    ).toThrow();
  });

  it('should reject eggWeight max > 80', () => {
    expect(() =>
      validateDailyReportBusinessRules({
        ...validInput,
        eggWeight: { min: 60, max: 85, avg: 70 },
      }),
    ).toThrow();
  });

  it('should reject eggWeight min > max', () => {
    expect(() =>
      validateDailyReportBusinessRules({
        ...validInput,
        eggWeight: { min: 70, max: 60, avg: 65 },
      }),
    ).toThrow();
  });

  it('should reject eggWeight avg outside range', () => {
    expect(() =>
      validateDailyReportBusinessRules({
        ...validInput,
        eggWeight: { min: 58, max: 62, avg: 70 },
      }),
    ).toThrow();
  });

  it('should reject bodyWeight min < 500', () => {
    expect(() =>
      validateDailyReportBusinessRules({
        ...validInput,
        bodyWeight: { min: 450, max: 1500, avg: 1000 },
      }),
    ).toThrow();
  });

  it('should reject bodyWeight max > 3000', () => {
    expect(() =>
      validateDailyReportBusinessRules({
        ...validInput,
        bodyWeight: { min: 1500, max: 3200, avg: 2000 },
      }),
    ).toThrow();
  });

  it('should reject bodyWeight min > max', () => {
    expect(() =>
      validateDailyReportBusinessRules({
        ...validInput,
        bodyWeight: { min: 2500, max: 1500, avg: 2000 },
      }),
    ).toThrow();
  });

  it('should reject bodyWeight avg outside range', () => {
    expect(() =>
      validateDailyReportBusinessRules({
        ...validInput,
        bodyWeight: { min: 1700, max: 1900, avg: 2500 },
      }),
    ).toThrow();
  });

  it('should reject eggsProduced > 95% of birdCount', () => {
    // 5000 birds -> max 4750 eggs
    expect(() =>
      validateDailyReportBusinessRules({
        ...validInput,
        eggsProduced: 4751,
      }),
    ).toThrow();
  });

  it('should allow eggsProduced exactly at 95% of birdCount', () => {
    expect(() =>
      validateDailyReportBusinessRules({
        ...validInput,
        eggsProduced: 4750,
      }),
    ).not.toThrow();
  });

  it('should reject selectionEggs > eggsProduced', () => {
    expect(() =>
      validateDailyReportBusinessRules({
        ...validInput,
        selectionEggs: 5000,
      }),
    ).toThrow();
  });

  it('should reject temperature < 10', () => {
    expect(() =>
      validateDailyReportBusinessRules({
        ...validInput,
        temperature: 9,
      }),
    ).toThrow();
  });

  it('should reject temperature > 50', () => {
    expect(() =>
      validateDailyReportBusinessRules({
        ...validInput,
        temperature: 51,
      }),
    ).toThrow();
  });

  it('should reject negative ammoniaPpm', () => {
    expect(() =>
      validateDailyReportBusinessRules({
        ...validInput,
        ammoniaPpm: -5,
      }),
    ).toThrow();
  });

  it('should reject ammoniaPpm > 50', () => {
    expect(() =>
      validateDailyReportBusinessRules({
        ...validInput,
        ammoniaPpm: 55,
      }),
    ).toThrow();
  });

  it('should accept ammoniaPpm <= 50', () => {
    expect(() =>
      validateDailyReportBusinessRules({
        ...validInput,
        ammoniaPpm: 50,
      }),
    ).not.toThrow();
  });

  it('should accept valid non-negative integer damagedEggs and floorEggs', () => {
    expect(() =>
      validateDailyReportBusinessRules({
        ...validInput,
        damagedEggs: 12,
        floorEggs: 6,
      }),
    ).not.toThrow();
  });

  it('should reject negative damagedEggs or floorEggs', () => {
    expect(() =>
      validateDailyReportBusinessRules({
        ...validInput,
        damagedEggs: -1,
      }),
    ).toThrow();

    expect(() =>
      validateDailyReportBusinessRules({
        ...validInput,
        floorEggs: -3,
      }),
    ).toThrow();
  });

  it('should reject non-integer decimal damagedEggs or floorEggs', () => {
    expect(() =>
      validateDailyReportBusinessRules({
        ...validInput,
        damagedEggs: 4.5,
      }),
    ).toThrow();

    expect(() =>
      validateDailyReportBusinessRules({
        ...validInput,
        floorEggs: 1.2,
      }),
    ).toThrow();
  });
});
