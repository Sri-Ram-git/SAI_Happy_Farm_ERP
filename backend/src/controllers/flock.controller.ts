import { Request, Response } from 'express';
import { getFirestore } from '../config/firebase';
import { CreateFlockDTO } from '../types/flock';

export class FlockController {
  static async createFlock(req: Request, res: Response) {
    try {
      const db = getFirestore();
      const data: CreateFlockDTO = req.body;
      const now = new Date().toISOString();
      const startMs = new Date(data.startDate + 'T00:00:00+05:30').getTime();
      const nowMs = Date.now();
      const ageWeeks = Math.max(0, Math.floor((nowMs - startMs) / (7 * 24 * 3600 * 1000)));

      // Query existing flocks for this farm to determine per-farm sequence
      const existingFlocksSnap = await db.collection('flocks')
        .where('farmId', '==', data.farmId)
        .get();

      const farmFlockCount = existingFlocksSnap.size;
      const batchNumber = farmFlockCount + 1;
      const isInitialFlock = farmFlockCount === 0;

      const resolvedFlockName = data.flockName?.trim()
        ? data.flockName.trim()
        : isInitialFlock
          ? 'Flock 1'
          : `Flock ${batchNumber}`;

      const flockRef = db.collection('flocks').doc();
      const farmRef = db.collection('farms').doc(data.farmId);
      const birdTxRef = farmRef.collection('birdTransactions').doc();

      await db.runTransaction(async (transaction) => {
        const farmSnap = await transaction.get(farmRef);
        const farmData = farmSnap.exists ? farmSnap.data() : null;

        const farmDocInitialBirds = Number(farmData?.initialBirdCount ?? farmData?.totalBirds ?? 0);
        const farmDocCurrentBirds = Number(farmData?.currentBirdCount ?? farmData?.currentBirds ?? farmDocInitialBirds);

        let flockInitialBirds: number;
        let flockCurrentBirds: number;
        let newFarmCurrentBirds: number;
        let newFarmInitialBirds: number;

        if (isInitialFlock) {
          // THE EXACT BUSINESS RULE:
          // When establishing the initial flock for an existing farm, initialBirds MUST come directly
          // from the farm document's initialBirdCount (e.g. 2000), NOT currentBirdCount (e.g. 1986).
          flockInitialBirds = farmDocInitialBirds > 0
            ? farmDocInitialBirds
            : (data.initialBirds && data.initialBirds > 0 ? data.initialBirds : farmDocCurrentBirds);

          // Current birds of the flock corresponds to current remaining count (e.g. 1986)
          flockCurrentBirds = farmDocCurrentBirds > 0 ? farmDocCurrentBirds : flockInitialBirds;

          // Initial flock creation MUST NOT modify, double, or recalculate farms/{farmId}.currentBirdCount
          newFarmCurrentBirds = farmDocCurrentBirds > 0 ? farmDocCurrentBirds : flockInitialBirds;
          newFarmInitialBirds = farmDocInitialBirds > 0 ? farmDocInitialBirds : flockInitialBirds;
        } else {
          // Subsequent new bird batch arrival (e.g. Flock 2 with 300 birds):
          const batchBirds = Number(data.initialBirds ?? 0);
          if (batchBirds <= 0) {
            throw new Error('Please enter a valid bird count for the new flock batch.');
          }
          flockInitialBirds = batchBirds;
          flockCurrentBirds = batchBirds;

          // Adds new birds to existing farm current bird population (e.g. 1986 + 300 = 2286)
          newFarmCurrentBirds = farmDocCurrentBirds + batchBirds;
          newFarmInitialBirds = farmDocInitialBirds > 0 ? farmDocInitialBirds : farmDocCurrentBirds;
        }

        const initialMortality = Math.max(0, flockInitialBirds - flockCurrentBirds);

        // 1. Create Flock doc
        transaction.set(flockRef, {
          flockId: flockRef.id,
          farmId: data.farmId,
          flockName: resolvedFlockName,
          initialBirds: flockInitialBirds,
          currentBirds: flockCurrentBirds,
          totalMortality: initialMortality,
          totalCulling: 0,
          totalEggs: 0,
          startDate: data.startDate,
          currentAgeWeeks: ageWeeks,
          breedType: data.breedType || 'BV-300',
          productionCurve: data.productionCurve || 'CF_STD',
          status: 'active',
          batchNumber,
          isInitialFlock,
          notes: data.notes || '',
          createdAt: now,
          updatedAt: now,
        });

        // 2. Update Master Farm Inventory
        transaction.set(farmRef, {
          currentBirdCount: newFarmCurrentBirds,
          initialBirdCount: newFarmInitialBirds,
          inventoryInitialized: true,
          inventoryInitializedAt: farmData?.inventoryInitializedAt || now,
          inventoryUpdatedAt: now,
          updatedAt: now,
        }, { merge: true });

        // 3. Record Bird Transaction Audit
        transaction.set(birdTxRef, {
          farmId: data.farmId,
          flockId: flockRef.id,
          type: isInitialFlock ? 'INITIAL' : 'ADDITION',
          count: flockInitialBirds,
          reportDate: data.startDate,
          createdAt: now,
          notes: data.notes || (isInitialFlock ? 'Initial flock creation from farm inventory' : `Flock batch ${batchNumber} addition`),
        });
      });

      res.status(201).json({ id: flockRef.id, message: 'Flock created successfully' });
    } catch (error) {
      console.error('Create flock error:', error);
      res.status(500).json({ error: 'Failed to create flock' });
    }
  }

  static async updateFlockStatus(req: Request, res: Response) {
    try {
      const db = getFirestore();
      const { flockId } = req.params;
      const { status } = req.body;
      const now = new Date().toISOString();

      await db.collection('flocks').doc(flockId as string).update({
        status,
        updatedAt: now,
      });

      res.json({ message: 'Flock status updated successfully' });
    } catch (error) {
      console.error('Update flock status error:', error);
      res.status(500).json({ error: 'Failed to update flock status' });
    }
  }
}
