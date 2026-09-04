import { getFirestore, collection, getDocs, doc, writeBatch } from 'firebase/firestore';

/**
 * Migration Script: Upgrades old `farms` documents to the new Master Inventory schema.
 * 
 * Safe rules:
 * - Never deletes data.
 * - Never overwrites initialized inventory.
 * - Supports DRY_RUN mode.
 */
export async function migrateFarmInventory(db: any, dryRun: boolean = true): Promise<void> {
  console.log(`\n=== FARM INVENTORY MIGRATION STARTED [DRY_RUN=${dryRun}] ===`);
  
  const farmsRef = collection(db, 'farms');
  const snapshot = await getDocs(farmsRef);
  
  if (snapshot.empty) {
    console.log('No farms found to migrate.');
    return;
  }

  const batch = writeBatch(db);
  let migratedCount = 0;
  let skippedCount = 0;
  const now = new Date().toISOString();

  snapshot.docs.forEach((farmDoc) => {
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
      totalFeedLoadedKg: legacyFeedKg + legacyTotalFeedConsumed, // educated guess for history
      totalFeedConsumedKg: legacyTotalFeedConsumed,
      
      inventoryInitialized: true,
      inventoryInitializedAt: now,
      inventoryUpdatedAt: now,
      updatedAt: data.updatedAt || now
    };

    console.log(`[MIGRATE] Farm ${farmDoc.id} (${data.name}) will be upgraded:`, upgradeData);
    
    if (!dryRun) {
      batch.set(farmDoc.ref, upgradeData, { merge: true });
    }
    migratedCount++;
  });

  if (!dryRun && migratedCount > 0) {
    await batch.commit();
    console.log(`\n=== SUCCESS: Committed migration for ${migratedCount} farms ===`);
  } else {
    console.log(`\n=== DRY RUN COMPLETED (Would migrate ${migratedCount}, Skipped ${skippedCount}) ===`);
  }
}
