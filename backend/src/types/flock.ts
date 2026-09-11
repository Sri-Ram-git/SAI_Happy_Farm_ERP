export interface Flock {
  flockId: string;
  farmId: string;
  flockName: string;
  initialBirds: number;
  currentBirds: number;
  totalMortality: number;
  totalCulling: number;
  totalEggs: number;
  startDate: string;
  currentAgeWeeks: number;
  breedType: string;
  productionCurve: 'CF_STD' | 'FR_STD';
  status: 'active' | 'completed';
  createdAt: string;
  updatedAt: string;
}

export type CreateFlockDTO = Pick<
  Flock,
  'farmId' | 'flockName' | 'initialBirds' | 'startDate' | 'breedType' | 'productionCurve'
>;
