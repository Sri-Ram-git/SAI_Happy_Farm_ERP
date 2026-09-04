export interface FarmFormData {
  flockId: string;
  birdCount: string;
  feedQuantity: string;
  feedUnit: 'kg' | 'g';
  mortality: string;
  culling: string;
  eggsProduced: string;
  selectionEggs: string;
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
};

export const STEP_NAMES = [
  'Feed & Health',
  'Eggs & Temperature',
  'Weights & Remarks',
];

export interface FarmFormErrors {
  [key: string]: string;
}

export function validateStep(step: number, data: FarmFormData, birdCount: number): FarmFormErrors {
  const errors: FarmFormErrors = {};

  switch (step) {
    case 0: {
      const fq = Number(data.feedQuantity);
      if (data.feedQuantity === '') errors.feedQuantity = 'Required';
      else if (fq < 0 || isNaN(fq)) errors.feedQuantity = 'Enter a valid non-negative number';

      const moVal = data.mortality === '' ? 0 : Number(data.mortality);
      if (isNaN(moVal) || moVal < 0) errors.mortality = 'Enter a valid non-negative whole number';
      else if (birdCount > 0 && moVal > birdCount) errors.mortality = 'Cannot exceed bird count';

      const cuVal = data.culling === '' ? 0 : Number(data.culling);
      if (isNaN(cuVal) || cuVal < 0) errors.culling = 'Enter a valid non-negative whole number';
      else if (birdCount > 0 && cuVal > birdCount) errors.culling = 'Cannot exceed bird count';
      else if (birdCount > 0 && moVal + cuVal > birdCount) errors.culling = 'Mortality + Culling exceeds bird count';
      break;
    }
    case 1: {
      const ep = Number(data.eggsProduced);
      if (data.eggsProduced === '') errors.eggsProduced = 'Required';
      else if (!Number.isInteger(ep) || ep < 0) errors.eggsProduced = 'Enter a valid non-negative whole number';
      else if (birdCount > 0 && ep > birdCount) errors.eggsProduced = 'Cannot exceed bird count';

      const se = Number(data.selectionEggs);
      if (data.selectionEggs === '') errors.selectionEggs = 'Required';
      else if (!Number.isInteger(se) || se < 0) errors.selectionEggs = 'Enter a valid non-negative whole number';
      else if (ep > 0 && se > ep) errors.selectionEggs = 'Cannot exceed eggs produced';

      const tMin = Number(data.tempMin);
      if (data.tempMin === '') errors.tempMin = 'Required';
      else if (isNaN(tMin) || tMin < -10 || tMin > 60) errors.tempMin = 'Must be between -10 and 60';

      const tMax = Number(data.tempMax);
      if (data.tempMax === '') errors.tempMax = 'Required';
      else if (isNaN(tMax) || tMax < -10 || tMax > 60) errors.tempMax = 'Must be between -10 and 60';

      if (!errors.tempMin && !errors.tempMax && !isNaN(tMin) && !isNaN(tMax) && tMin > tMax) {
        errors.tempMin = 'Min temp cannot exceed max temp';
      }
      break;
    }
    case 2: {
      validateWeight(errors, data, 'eggWeight');
      validateWeight(errors, data, 'bodyWeight');

      const a = Number(data.ammoniaPpm);
      if (data.ammoniaPpm === '') errors.ammoniaPpm = 'Required';
      else if (isNaN(a) || a < 0) errors.ammoniaPpm = 'Enter a valid non-negative number';
      else if (a > 100) errors.ammoniaPpm = 'Cannot exceed 100 PPM';

      if (data.remarks.length > 1000) errors.remarks = 'Max 1000 characters';
      break;
    }
  }

  return errors;
}

function validateWeight(errors: FarmFormErrors, data: FarmFormData, prefix: 'eggWeight' | 'bodyWeight') {
  const minKey = `${prefix}Min`;
  const maxKey = `${prefix}Max`;
  const avgKey = `${prefix}Avg`;
  const min = Number(data[minKey as keyof FarmFormData]);
  const max = Number(data[maxKey as keyof FarmFormData]);

  if (data[minKey as keyof FarmFormData] === '' || isNaN(min)) errors[minKey] = 'Required';
  else if (min < 0) errors[minKey] = 'Cannot be negative';

  if (data[maxKey as keyof FarmFormData] === '' || isNaN(max)) errors[maxKey] = 'Required';
  else if (max < 0) errors[maxKey] = 'Cannot be negative';

  if (!errors[minKey] && !errors[maxKey] && !isNaN(min) && !isNaN(max)) {
    if (min > max) {
      errors[minKey] = 'Min cannot exceed max';
    }
  }
}
