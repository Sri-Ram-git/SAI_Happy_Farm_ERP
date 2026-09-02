import { getFirestore } from '../config/firebase';
import { Farm } from '../types/reports';
import { NotFoundError, InternalError } from '../utils/errors';
import { logger } from '../utils/logger';

export class FarmsRepository {
  private get db() {
    return getFirestore();
  }

  async getFarmById(farmId: string, requestId: string): Promise<Farm> {
    try {
      const doc = await this.db.collection('farms').doc(farmId).get();

      if (!doc.exists) {
        throw new NotFoundError('Farm');
      }

      return doc.data() as Farm;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Failed to fetch farm', {
        requestId,
        farmId,
        errorName: error instanceof Error ? error.name : 'Unknown',
      });
      throw new InternalError('Failed to fetch farm');
    }
  }

  async getFarmsByIds(farmIds: string[], requestId: string): Promise<Farm[]> {
    try {
      if (farmIds.length === 0) return [];

      const farms: Farm[] = [];
      const batchSize = 10;

      for (let i = 0; i < farmIds.length; i += batchSize) {
        const batch = farmIds.slice(i, i + batchSize);
        const snapshot = await this.db
          .collection('farms')
          .where('__name__', 'in', batch)
          .get();

        for (const doc of snapshot.docs) {
          farms.push(doc.data() as Farm);
        }
      }

      return farms;
    } catch (error) {
      logger.error('Failed to fetch farms', {
        requestId,
        farmIds,
        errorName: error instanceof Error ? error.name : 'Unknown',
      });
      throw new InternalError('Failed to fetch farms');
    }
  }

  async getAllFarms(requestId: string): Promise<Farm[]> {
    try {
      const snapshot = await this.db.collection('farms').get();
      return snapshot.docs.map((doc) => doc.data() as Farm);
    } catch (error) {
      logger.error('Failed to fetch all farms', {
        requestId,
        errorName: error instanceof Error ? error.name : 'Unknown',
      });
      throw new InternalError('Failed to fetch all farms');
    }
  }

  async validateFarmExists(farmId: string, requestId: string): Promise<boolean> {
    try {
      const doc = await this.db.collection('farms').doc(farmId).get();
      return doc.exists;
    } catch (error) {
      logger.error('Failed to validate farm existence', {
        requestId,
        farmId,
        errorName: error instanceof Error ? error.name : 'Unknown',
      });
      throw new InternalError('Failed to validate farm');
    }
  }
}
