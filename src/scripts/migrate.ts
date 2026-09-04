import * as dotenv from 'dotenv';
dotenv.config();
import { initializeFirebase } from '../config/firebase';
import * as admin from 'firebase-admin';

async function run() {
  console.log('--- STARTING MIGRATION ---');
  initializeFirebase();
  const db = admin.firestore();
  
  const farmsSnap = await db.collection('farms').get();
  console.log(`Found ${farmsSnap.size} farms.`);
  
  const batch = db.batch();
  
  farmsSnap.forEach(f => {
    const data = f.data();
    console.log(`Processing Farm: ${f.id}`);
    
    // 1. Clean keys (remove trailing/leading spaces)
    const cleanData: any = {};
    for (const [key, value] of Object.entries(data)) {
      const cleanKey = key.trim();
      cleanData[cleanKey] = value;
    }
    
    // 2. Set up Master Inventory
    const legacyBirdCount = Number(cleanData.currentBirds ?? cleanData.totalBirds ?? 1000);
    const legacyFeedKg = Number(cleanData.currentFeedKg ?? 5000);
    const legacyTotalFeedConsumed = Number(cleanData.totalFeedConsumedKg ?? 0);
    
    cleanData.farmId = f.id;
    cleanData.name = cleanData.name || `Farm ${f.id}`;
    cleanData.location = cleanData.location || 'Unknown';
    cleanData.active = cleanData.active !== false;
    
    cleanData.initialBirdCount = cleanData.initialBirdCount ?? legacyBirdCount;
    cleanData.currentBirdCount = cleanData.currentBirdCount ?? legacyBirdCount;
    
    cleanData.initialFeedKg = cleanData.initialFeedKg ?? legacyFeedKg;
    cleanData.currentFeedKg = cleanData.currentFeedKg ?? legacyFeedKg;
    cleanData.totalFeedLoadedKg = cleanData.totalFeedLoadedKg ?? (legacyFeedKg + legacyTotalFeedConsumed);
    cleanData.totalFeedConsumedKg = legacyTotalFeedConsumed;
    
    cleanData.inventoryInitialized = true;
    cleanData.inventoryInitializedAt = cleanData.inventoryInitializedAt || admin.firestore.FieldValue.serverTimestamp();
    cleanData.inventoryUpdatedAt = admin.firestore.FieldValue.serverTimestamp();
    cleanData.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    
    // We want to completely replace the document with the cleanData to eliminate space-keys.
    batch.set(f.ref, cleanData);
    console.log(`  -> Cleaned and prepared update for ${f.id}`);
  });

  // Also fix users (like Supervisor role space)
  const usersSnap = await db.collection('users').get();
  usersSnap.forEach(u => {
    const data = u.data();
    let needsUpdate = false;
    const updateData: any = {};
    
    if (typeof data.role === 'string' && data.role !== data.role.trim().toLowerCase()) {
      updateData.role = data.role.trim().toLowerCase();
      needsUpdate = true;
    }
    
    // Ensure supervisor has farmIds array
    if (updateData.role === 'supervisor' || (data.role && data.role.trim().toLowerCase() === 'supervisor')) {
      if (!data.farmIds || data.farmIds.length === 0) {
        updateData.farmIds = ['AP12', 'AP13']; // Assign all current farms to supervisor so dashboard works
        needsUpdate = true;
      }
    }
    
    if (needsUpdate) {
      batch.update(u.ref, updateData);
      console.log(`  -> Fixing user ${u.id}:`, updateData);
    }
  });

  await batch.commit();
  console.log('--- MIGRATION COMPLETE ---');
}

run().catch(console.error);
