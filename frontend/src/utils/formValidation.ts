export interface FarmFormData {
  flockId: string;
  birdCount: string;
  feedQuantity: string;
  feedUnit: 'kg' | 'g';
  mortality: string;
  culling: string;
  eggsProduced: string;
  selectionEggs: string;
  damagedEggs: string;
  floorEggs: string;
  temperature: string;
  tempMin: string;
  tempMax: string;
  eggWeightMin: string;
  eggWeightMax: string;
  eggWeightAvg: string;
  bodyWeightMin: string;
  bodyWeightMax: string;
  bodyWeightAvg: string;
  remarks: string;
  ammoniaPpm: string;
  feedGramsPerBird?: string;
}

export const INITIAL_FARM_FORM_DATA: FarmFormData = {
  flockId: '',
  birdCount: '',
  feedQuantity: '',
  feedUnit: 'kg',
  mortality: '',
  culling: '',
  eggsProduced: '',
  selectionEggs: '',
  damagedEggs: '',
  floorEggs: '',
  temperature: '',
  tempMin: '',
  tempMax: '',
  eggWeightMin: '',
  eggWeightMax: '',
  eggWeightAvg: '',
  bodyWeightMin: '',
  bodyWeightMax: '',
  bodyWeightAvg: '',
  remarks: '',
  ammoniaPpm: '',
  feedGramsPerBird: '',
};

export const STEP_NAMES = [
  'Feed & Health',
  'Eggs & Temperature',
  'Weights & Remarks',
];

export interface FarmFormErrors {
  [key: string]: string;
}

export function calculateFeedGramsPerBird(feedKg: number | string, birdCount: number): number {
  const kg = Number(feedKg);
  if (!Number.isFinite(kg) || kg <= 0 || !Number.isFinite(birdCount) || birdCount <= 0) {
    return 0;
  }
  return Number(((kg * 1000) / birdCount).toFixed(1));
}

import { KPI_THRESHOLDS } from '../config/kpiThresholds';

export function isHighAmmonia(ammoniaPpm: number | string): boolean {
  const val = Number(ammoniaPpm);
  return Number.isFinite(val) && val > 10 && val <= 50;
}

export function isSeriousMortality(mortality: number | string, birdCount: number): {
  isTotalFlockLoss: boolean;
  isCriticalMortality: boolean;
  isHighMortality: boolean;
  mortalityPct: number;
  isCritical: boolean;
  isWarning: boolean;
  requiresConfirmation: boolean;
  ratePct: number;
  message?: string;
} {
  const moVal = Number(mortality);
  if (!Number.isFinite(moVal) || moVal <= 0 || !Number.isFinite(birdCount) || birdCount <= 0) {
    return {
      isTotalFlockLoss: false,
      isCriticalMortality: false,
      isHighMortality: false,
      mortalityPct: 0,
      isCritical: false,
      isWarning: false,
      requiresConfirmation: false,
      ratePct: 0,
    };
  }
  const pct = Number(((moVal / birdCount) * 100).toFixed(1));
  const isTotalFlockLoss = moVal === birdCount;
  const isCriticalMortality = isTotalFlockLoss || pct >= (KPI_THRESHOLDS.mortalityRateCritical ?? 10);
  const isHighMortality = !isCriticalMortality && pct >= (KPI_THRESHOLDS.mortalityRateWarning ?? 5);

  let message: string | undefined;
  if (isTotalFlockLoss) {
    message = `CRITICAL ALERT: TOTAL FLOCK MORTALITY (${moVal} of ${birdCount} birds died, 100% loss).`;
  } else if (isCriticalMortality) {
    message = `CRITICAL ALERT: Mortality rate is ${pct}%, exceeding critical threshold (${KPI_THRESHOLDS.mortalityRateCritical}%).`;
  } else if (isHighMortality) {
    message = `WARNING: Mortality rate is ${pct}%, exceeding warning threshold (${KPI_THRESHOLDS.mortalityRateWarning}%).`;
  }

  return {
    isTotalFlockLoss,
    isCriticalMortality,
    isHighMortality,
    mortalityPct: pct,
    isCritical: isCriticalMortality,
    isWarning: isHighMortality,
    requiresConfirmation: isTotalFlockLoss,
    ratePct: pct,
    message,
  };
}

export function validateStep(
  step: number,
  data: FarmFormData,
  birdCount: number,
  t?: (key: string, opts?: any) => string
): FarmFormErrors {
  const errors: FarmFormErrors = {};
  const tr = (key: string, fallback: string, opts?: any) => (t ? t(key, opts) : key);

  switch (step) {
    case 0: {
      const fq = Number(data.feedQuantity);
      if (data.feedQuantity === '') errors.feedQuantity = tr('validation.required', 'Required');
      else if (fq < 0 || isNaN(fq)) errors.feedQuantity = tr('validation.invalidNumber', 'Enter a valid non-negative number');

      const moVal = data.mortality === '' ? 0 : Number(data.mortality);
      if (isNaN(moVal) || moVal < 0 || !Number.isInteger(moVal)) {
        errors.mortality = tr('validation.invalidWholeNumber', 'Enter a valid non-negative whole number');
      } else if (birdCount <= 0 && moVal > 0) {
        errors.mortality = tr('validation.noEligibleBirds', 'Eligible bird count is 0. Mortality cannot exceed eligible bird count.');
      } else if (birdCount > 0 && moVal > birdCount) {
        errors.mortality = tr('validation.exceedsBirdCount', 'Cannot exceed eligible bird count');
      }

      const cuVal = data.culling === '' ? 0 : Number(data.culling);
      if (isNaN(cuVal) || cuVal < 0 || !Number.isInteger(cuVal)) {
        errors.culling = tr('validation.invalidWholeNumber', 'Enter a valid non-negative whole number');
      } else if (birdCount <= 0 && cuVal > 0) {
        errors.culling = tr('validation.noEligibleBirds', 'Eligible bird count is 0. Culling cannot exceed eligible bird count.');
      } else if (birdCount > 0 && cuVal > birdCount) {
        errors.culling = tr('validation.exceedsBirdCount', 'Cannot exceed eligible bird count');
      } else if (birdCount > 0 && moVal + cuVal > birdCount) {
        errors.culling = tr('validation.mortalityCullingExceeds', 'Mortality + Culling exceeds eligible bird count');
        if (!errors.mortality) {
          errors.mortality = tr('validation.mortalityCullingExceeds', 'Mortality + Culling exceeds eligible bird count');
        }
      }
      break;
    }
    case 1: {
      const ep = Number(data.eggsProduced);
      const maxAllowedEggs = Math.floor(birdCount * 0.95);
      if (data.eggsProduced === '') {
        errors.eggsProduced = tr('validation.required', 'Required');
      } else if (!Number.isInteger(ep) || ep < 0) {
        errors.eggsProduced = tr('validation.invalidWholeNumber', 'Enter a valid non-negative whole number');
      } else if (birdCount > 0 && ep > maxAllowedEggs) {
        errors.eggsProduced = tr(
          'validation.exceedsProductionRate',
          `Egg production cannot exceed 95% of bird count (max ${maxAllowedEggs})`,
          { max: maxAllowedEggs }
        );
      }

      const se = Number(data.selectionEggs);
      if (data.selectionEggs === '') {
        errors.selectionEggs = tr('validation.required', 'Required');
      } else if (!Number.isInteger(se) || se < 0) {
        errors.selectionEggs = tr('validation.invalidWholeNumber', 'Enter a valid non-negative whole number');
      }

      let de = 0;
      if (data.damagedEggs !== '') {
        const parsedDe = Number(data.damagedEggs);
        if (isNaN(parsedDe) || !Number.isInteger(parsedDe) || parsedDe < 0) {
          errors.damagedEggs = tr('validation.invalidWholeNumber', 'Enter a valid non-negative whole number');
        } else {
          de = parsedDe;
        }
      }

      let fe = 0;
      if (data.floorEggs !== '') {
        const parsedFe = Number(data.floorEggs);
        if (isNaN(parsedFe) || !Number.isInteger(parsedFe) || parsedFe < 0) {
          errors.floorEggs = tr('validation.invalidWholeNumber', 'Enter a valid non-negative whole number');
        } else {
          fe = parsedFe;
        }
      }

      // Production, Selection, Damaged, and Floor Eggs Constraint:
      // Egg Production must equal Selection Eggs + Damaged Eggs + Floor Eggs
      if (!errors.eggsProduced && !errors.selectionEggs && !errors.damagedEggs && !errors.floorEggs) {
        if (se + de + fe !== ep) {
          errors.eggsProduced = tr(
            'validation.eggProductionMismatch',
            'Egg Production must equal Selection Eggs + Damaged Eggs + Floor Eggs.'
          );
        }
      }

      const tMin = Number(data.tempMin);
      if (data.tempMin === '') errors.tempMin = tr('validation.required', 'Required');
      else if (isNaN(tMin) || tMin < 10 || tMin > 50) errors.tempMin = tr('validation.tempRange', 'Must be between 10 and 50');

      const tMax = Number(data.tempMax);
      if (data.tempMax === '') errors.tempMax = tr('validation.required', 'Required');
      else if (isNaN(tMax) || tMax < 10 || tMax > 50) errors.tempMax = tr('validation.tempRange', 'Must be between 10 and 50');

      if (!errors.tempMin && !errors.tempMax && !isNaN(tMin) && !isNaN(tMax) && tMin > tMax) {
        errors.tempMin = tr('validation.minExceedsMax', 'Min temp cannot exceed max temp');
      }
      break;
    }
    case 2: {
      validateEggWeight(errors, data, tr);
      validateBodyWeight(errors, data, tr);

      if (data.ammoniaPpm !== '') {
        const a = Number(data.ammoniaPpm);
        if (isNaN(a) || a < 0) errors.ammoniaPpm = tr('validation.invalidNumber', 'Enter a valid non-negative number');
        else if (a > 50) errors.ammoniaPpm = tr('validation.maxPpm50', 'Cannot exceed 50 PPM');
      }

      if (data.remarks.length > 1000) errors.remarks = tr('validation.maxChars', 'Max 1000 characters', { max: 1000 });
      break;
    }
  }

  return errors;
}

function validateEggWeight(
  errors: FarmFormErrors,
  data: FarmFormData,
  tr: (key: string, fallback: string, opts?: any) => string
) {
  const min = Number(data.eggWeightMin);
  const max = Number(data.eggWeightMax);

  if (data.eggWeightMin === '' || isNaN(min)) {
    errors.eggWeightMin = tr('validation.required', 'Required');
  } else if (min < 30 || min > 80) {
    errors.eggWeightMin = tr('validation.eggWeightRange', 'Must be between 30g and 80g');
  }

  if (data.eggWeightMax === '' || isNaN(max)) {
    errors.eggWeightMax = tr('validation.required', 'Required');
  } else if (max < 30 || max > 80) {
    errors.eggWeightMax = tr('validation.eggWeightRange', 'Must be between 30g and 80g');
  }

  if (!errors.eggWeightMin && !errors.eggWeightMax && min > max) {
    errors.eggWeightMin = tr('validation.minExceedsMax', 'Min cannot exceed max');
  }
}

function validateBodyWeight(
  errors: FarmFormErrors,
  data: FarmFormData,
  tr: (key: string, fallback: string, opts?: any) => string
) {
  // Body weight is collected weekly and is optional on daily submissions
  const hasMin = data.bodyWeightMin !== '';
  const hasMax = data.bodyWeightMax !== '';

  if (!hasMin && !hasMax) {
    return;
  }

  const min = Number(data.bodyWeightMin);
  const max = Number(data.bodyWeightMax);

  if (!hasMin || isNaN(min)) {
    errors.bodyWeightMin = tr('validation.required', 'Required');
  } else if (min < 500 || min > 3000) {
    errors.bodyWeightMin = tr('validation.bodyWeightRange', 'Must be between 500g and 3000g');
  }

  if (!hasMax || isNaN(max)) {
    errors.bodyWeightMax = tr('validation.required', 'Required');
  } else if (max < 500 || max > 3000) {
    errors.bodyWeightMax = tr('validation.bodyWeightRange', 'Must be between 500g and 3000g');
  }

  if (!errors.bodyWeightMin && !errors.bodyWeightMax && min > max) {
    errors.bodyWeightMin = tr('validation.minExceedsMax', 'Min cannot exceed max');
  }
}
