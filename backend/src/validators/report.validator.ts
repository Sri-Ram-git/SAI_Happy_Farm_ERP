import { DailyReportInput } from '../types/reports';
import { ValidationError } from '../utils/errors';

export function validateDailyReportBusinessRules(input: DailyReportInput): void {
  const fields: Record<string, string> = {};

  if (input.mortality > input.birdCount) {
    fields['mortality'] = 'Mortality cannot exceed bird count';
  }

  if (input.culling > input.birdCount) {
    fields['culling'] = 'Culling cannot exceed bird count';
  }

  if (input.mortality + input.culling > input.birdCount) {
    fields['mortality+culling'] =
      'Combined mortality and culling cannot exceed bird count';
  }

  if (input.eggWeight.min < 30 || input.eggWeight.min > 80) {
    fields['eggWeightMin'] = 'Egg weight min must be between 30g and 80g';
  }

  if (input.eggWeight.max < 30 || input.eggWeight.max > 80) {
    fields['eggWeightMax'] = 'Egg weight max must be between 30g and 80g';
  }

  if (input.eggWeight.min > input.eggWeight.max) {
    fields['eggWeights'] = 'Egg weight min cannot exceed max';
  }

  if (input.eggWeight.avg < input.eggWeight.min || input.eggWeight.avg > input.eggWeight.max) {
    fields['eggWeightAvg'] = 'Egg weight avg must be between min and max';
  }

  if (input.bodyWeight) {
    if (input.bodyWeight.min < 500 || input.bodyWeight.min > 3000) {
      fields['bodyWeightMin'] = 'Body weight min must be between 500g and 3000g';
    }

    if (input.bodyWeight.max < 500 || input.bodyWeight.max > 3000) {
      fields['bodyWeightMax'] = 'Body weight max must be between 500g and 3000g';
    }

    if (input.bodyWeight.min > input.bodyWeight.max) {
      fields['bodyWeights'] = 'Body weight min cannot exceed max';
    }

    if (input.bodyWeight.avg < input.bodyWeight.min || input.bodyWeight.avg > input.bodyWeight.max) {
      fields['bodyWeightAvg'] = 'Body weight avg must be between min and max';
    }
  }

  const maxEggs = Math.floor(input.birdCount * 0.95);
  if (input.eggsProduced > maxEggs) {
    fields['eggsProduced'] = `Egg production cannot exceed 95% of bird count (maximum allowed: ${maxEggs})`;
  }

  const se = input.selectionEggs || 0;
  const de = input.damagedEggs || 0;
  const fe = input.floorEggs || 0;
  if (se + de + fe !== input.eggsProduced) {
    fields['eggsProduced'] = 'Egg Production must equal Selection Eggs + Damaged Eggs + Floor Eggs.';
  }

  if (input.damagedEggs !== undefined && input.damagedEggs !== null) {
    if (input.damagedEggs < 0 || !Number.isInteger(input.damagedEggs)) {
      fields['damagedEggs'] = 'Damaged eggs must be a non-negative whole number';
    }
  }

  if (input.floorEggs !== undefined && input.floorEggs !== null) {
    if (input.floorEggs < 0 || !Number.isInteger(input.floorEggs)) {
      fields['floorEggs'] = 'Floor eggs must be a non-negative whole number';
    }
  }

  if (input.temperature < 10 || input.temperature > 50) {
    fields['temperature'] = 'Temperature must be between 10 and 50 degrees';
  }

  if (input.ammoniaPpm !== undefined && input.ammoniaPpm !== null) {
    if (input.ammoniaPpm < 0) {
      fields['ammoniaPpm'] = 'Ammonia result cannot be negative';
    }

    if (input.ammoniaPpm > 50) {
      fields['ammoniaPpm'] = 'Ammonia result cannot exceed 50 ppm';
    }
  }

  if (Object.keys(fields).length > 0) {
    throw new ValidationError('Business rule validation failed', fields);
  }
}
