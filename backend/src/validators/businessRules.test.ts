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
    bodyWeight: { min: 1.7, max: 1.9, avg: 1.8 },
    remarks: '',
    ammoniaPpm: 10,
  };

  it('should pass for valid input', () => {
    expect(() => validateDailyReportBusinessRules(validInput)).not.toThrow();
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

  it('should reject bodyWeight min > max', () => {
    expect(() =>
      validateDailyReportBusinessRules({
        ...validInput,
        bodyWeight: { min: 2.5, max: 1.5, avg: 2.0 },
      }),
    ).toThrow();
  });

  it('should reject bodyWeight avg outside range', () => {
    expect(() =>
      validateDailyReportBusinessRules({
        ...validInput,
        bodyWeight: { min: 1.7, max: 1.9, avg: 2.5 },
      }),
    ).toThrow();
  });

  it('should reject eggsProduced > birdCount', () => {
    expect(() =>
      validateDailyReportBusinessRules({
        ...validInput,
        eggsProduced: 6000,
      }),
    ).toThrow();
  });

  it('should reject selectionEggs > eggsProduced', () => {
    expect(() =>
      validateDailyReportBusinessRules({
        ...validInput,
        selectionEggs: 5000,
      }),
    ).toThrow();
  });

  it('should reject temperature < -10', () => {
    expect(() =>
      validateDailyReportBusinessRules({
        ...validInput,
        temperature: -15,
      }),
    ).toThrow();
  });

  it('should reject temperature > 60', () => {
    expect(() =>
      validateDailyReportBusinessRules({
        ...validInput,
        temperature: 65,
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

  it('should reject ammoniaPpm > 100', () => {
    expect(() =>
      validateDailyReportBusinessRules({
        ...validInput,
        ammoniaPpm: 150,
      }),
    ).toThrow();
  });
});
