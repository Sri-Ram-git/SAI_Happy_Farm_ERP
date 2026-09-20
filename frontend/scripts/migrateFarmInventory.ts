/**
 * Migration Script: Upgrades old `farms` documents to the new Master Inventory schema.
 * 
 * Safe rules:
 * - Never deletes data.
 * - Never overwrites initialized inventory.
 * - Supports DRY_RUN mode.
 * 
 * Usage in Browser Console (with frontend Firebase compat SDK):
 *   import { migrateFarmInventory } from '../scripts/migrateFarmInventory';
 *   migrateFarmInventory((window as any).firebase.firestore(), false);
 */

export interface FarmDocSnapshot {
  id: string;
  data: () => Record<string, any>;
  ref: any;
}

export async function migrateFarmInventory(db: any, dryRun: boolean = true): Promise<void> {
  console.log(`\n=== FARM INVENTORY MIGRATION STARTED [DRY_RUN=${dryRun}] ===`);
  
  if (!db) {
    console.error('Firestore database instance (db) is required.');
    return;
  }

  // Support Firebase compat SDK (db.collection) as well as modular SDK if provided
  let snapshot: any;
  if (typeof db.collection === 'function') {
    snapshot = await db.collection('farms').get();
  } else {
    console.error('Unsupported Firestore instance format. Please pass window.firebase.firestore().');
    return;
  }
  
  if (!snapshot || snapshot.empty) {
    console.log('No farms found to migrate.');
    return;
  }

  const batch = typeof db.batch === 'function' ? db.batch() : null;
  let migratedCount = 0;
  let skippedCount = 0;
  const now = new Date().toISOString();

  snapshot.docs.forEach((farmDoc: FarmDocSnapshot) => {
    const data = farmDoc.data();
    
    // Check if already initialized in the new schema
    if (data.inventoryInitialized === true) {
      console.log(`[SKIP] Farm ${farmDoc.id} (${data.name}) already has inventoryInitialized=true.`);
      skippedCount++;
      return;
    }

    // Default legacy fields to 0 if they don't exist
    const legacyBirdCount = Number(data.currentBirds ?? data.totalBirds ?? 0);
    const legacyFeedKg = Number(data.currentFeedKg ?? 0);
    const legacyTotalFeedConsumed = Number(data.totalFeedConsumedKg ?? 0);

    const upgradeData = {
      initialBirdCount: legacyBirdCount,
      currentBirdCount: legacyBirdCount,
      
      initialFeedKg: legacyFeedKg,
      currentFeedKg: legacyFeedKg,
      totalFeedLoadedKg: legacyFeedKg + legacyTotalFeedConsumed,
      totalFeedConsumedKg: legacyTotalFeedConsumed,
      
      inventoryInitialized: true,
      inventoryInitializedAt: now,
      inventoryUpdatedAt: now,
      updatedAt: data.updatedAt || now
    };

    console.log(`[MIGRATE] Farm ${farmDoc.id} (${data.name}) will be upgraded:`, upgradeData);
    
    if (!dryRun && batch) {
      batch.set(farmDoc.ref, upgradeData, { merge: true });
    }
    migratedCount++;
  });

  if (!dryRun && migratedCount > 0 && batch) {
    await batch.commit();
    console.log(`\n=== SUCCESS: Committed migration for ${migratedCount} farms ===`);
  } else {
    console.log(`\n=== DRY RUN COMPLETED (Would migrate ${migratedCount}, Skipped ${skippedCount}) ===`);
  }
}
