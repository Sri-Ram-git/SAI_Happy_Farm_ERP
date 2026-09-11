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

      const flockRef = await db.collection('flocks').add({
        farmId: data.farmId,
        flockName: data.flockName,
        initialBirds: data.initialBirds,
        currentBirds: data.initialBirds,
        totalMortality: 0,
        totalCulling: 0,
        totalEggs: 0,
        startDate: data.startDate,
        currentAgeWeeks: ageWeeks,
        breedType: data.breedType,
        productionCurve: data.productionCurve,
        status: 'active',
        createdAt: now,
        updatedAt: now,
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
