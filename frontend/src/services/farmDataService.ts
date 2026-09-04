const f = (window as any).firebase;

export interface FarmDoc {
  farmId: string;
  name: string;
  location: string;
  active: boolean;

  // Master Inventory
  initialBirdCount?: number;
  currentBirdCount?: number;
  initialFeedKg?: number;
  currentFeedKg?: number;
  totalFeedLoadedKg?: number;
  totalFeedConsumedKg?: number;

  inventoryInitialized?: boolean;
  inventoryInitializedAt?: string;
  inventoryUpdatedAt?: string;
  updatedAt?: string;

  // Legacy fields (optional)
  totalBirds?: number;
  currentBirds?: number;
}

export async function getFarmById(farmId: string): Promise<FarmDoc | null> {
  const db = f.firestore();
  const doc = await db.collection('farms').doc(farmId).get();
  if (!doc.exists) return null;
  return doc.data() as FarmDoc;
}

export function subscribeToFarm(farmId: string, callback: (farm: FarmDoc | null) => void): () => void {
  if (!farmId) return () => {};
  const db = f.firestore();
  return db.collection('farms').doc(farmId).onSnapshot(
    (doc: any) => {
      if (!doc.exists) {
        callback(null);
      } else {
        callback(doc.data() as FarmDoc);
      }
    },
    (err: any) => {
      console.error('[farmDataService] subscribeToFarm error:', err.message || err);
    }
  );
}

export async function getFarmsByIds(farmIds: string[]): Promise<FarmDoc[]> {
  if (farmIds.length === 0) return [];
  const db = f.firestore();
  const results: FarmDoc[] = [];
  const batchSize = 10;
  for (let i = 0; i < farmIds.length; i += batchSize) {
    const batch = farmIds.slice(i, i + batchSize);
    const snap = await db.collection('farms').where('__name__', 'in', batch).get();
    for (const doc of snap.docs) {
      results.push(doc.data() as FarmDoc);
    }
  }
  return results;
}

export async function getAllFarms(): Promise<FarmDoc[]> {
  const db = f.firestore();
  const snap = await db.collection('farms').get();
  return snap.docs.map((doc: any) => doc.data() as FarmDoc);
}

export function subscribeToAllFarms(callback: (farms: FarmDoc[]) => void): () => void {
  const db = f.firestore();
  return db.collection('farms').onSnapshot(
    (snap: any) => {
      const farms = snap.docs.map((doc: any) => doc.data() as FarmDoc);
      callback(farms);
    },
    (err: any) => {
      console.error('[farmDataService] subscribeToAllFarms error:', err.message || err);
    },
  );
}
