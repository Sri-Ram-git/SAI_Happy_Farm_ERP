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
  batchNumber?: number;
  isInitialFlock?: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type CreateFlockDTO = {
  farmId: string;
  flockName?: string;
  initialBirds?: number;
  startDate: string;
  breedType?: string;
  productionCurve?: 'CF_STD' | 'FR_STD';
  notes?: string;
};
