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

  if (input.eggWeight.min > input.eggWeight.max) {
    fields['eggWeights'] = 'Egg weight min cannot exceed max';
  }

  if (input.eggWeight.avg < input.eggWeight.min || input.eggWeight.avg > input.eggWeight.max) {
    fields['eggWeightAvg'] = 'Egg weight avg must be between min and max';
  }

  if (input.bodyWeight.min > input.bodyWeight.max) {
    fields['bodyWeights'] = 'Body weight min cannot exceed max';
  }

  if (input.bodyWeight.avg < input.bodyWeight.min || input.bodyWeight.avg > input.bodyWeight.max) {
    fields['bodyWeightAvg'] = 'Body weight avg must be between min and max';
  }

  if (input.eggsProduced > input.birdCount) {
    fields['eggsProduced'] = 'Egg production cannot exceed bird count';
  }

  if (input.selectionEggs > input.eggsProduced) {
    fields['selectionEggs'] = 'Selection eggs cannot exceed egg production';
  }

  if (input.temperature < -10 || input.temperature > 60) {
    fields['temperature'] = 'Temperature must be between -10 and 60 degrees';
  }

  if (input.ammoniaPpm < 0) {
    fields['ammoniaPpm'] = 'Ammonia result cannot be negative';
  }

  if (input.ammoniaPpm > 100) {
    fields['ammoniaPpm'] = 'Ammonia result cannot exceed 100 ppm';
  }

  if (Object.keys(fields).length > 0) {
    throw new ValidationError('Business rule validation failed', fields);
  }
}
