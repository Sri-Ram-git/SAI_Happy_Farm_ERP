import { AuthenticatedUser, UserRole } from '../types/auth';
import { Farm } from '../types/reports';
import { FarmsRepository } from '../repositories/farms.repository';

export class FarmsService {
  private farmsRepository = new FarmsRepository();

  async getFarmById(farmId: string, requestId: string): Promise<Farm> {
    return this.farmsRepository.getFarmById(farmId, requestId);
  }

  async getAuthorizedFarms(user: AuthenticatedUser, requestId: string): Promise<Farm[]> {
    if (user.role === UserRole.ADMIN || user.role === UserRole.OFFICE_STAFF) {
      if (user.farmIds.length === 0) {
        return this.farmsRepository.getAllFarms(requestId);
      }
      return this.farmsRepository.getFarmsByIds(user.farmIds, requestId);
    }

    return this.farmsRepository.getFarmsByIds(user.farmIds, requestId);
  }
}

export const farmsService = new FarmsService();
