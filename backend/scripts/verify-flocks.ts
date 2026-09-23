import 'dotenv/config';
import { initializeFirebase, getFirestore } from '../src/config/firebase';

async function verifyFlockSetup() {
  initializeFirebase();
  const db = getFirestore();

  console.log('====================================================');
  console.log('VERIFYING FIRESTORE TOP-LEVEL "flocks" AND "farms"');
  console.log('====================================================\n');

  // 1. Check top-level flocks
  const flocksSnap = await db.collection('flocks').get();
  console.log(`Total Top-Level Flocks Found: ${flocksSnap.size}`);

  const flockDocs: any[] = [];
  flocksSnap.forEach((doc) => {
    const data = doc.data();
    flockDocs.push({ id: doc.id, ...data });
    console.log(`\nFlock Document: /flocks/${doc.id}`);
    console.log(`- farmId:         ${data.farmId}`);
    console.log(`- flockName:      ${data.flockName}`);
    console.log(`- initialBirds:   ${data.initialBirds}`);
    console.log(`- currentBirds:   ${data.currentBirds}`);
    console.log(`- totalMortality: ${data.totalMortality}`);
    console.log(`- batchNumber:    ${data.batchNumber}`);
    console.log(`- isInitialFlock: ${data.isInitialFlock}`);
    console.log(`- status:         ${data.status}`);
    console.log(`- startDate:      ${data.startDate}`);
  });

  // 2. Check farms to ensure they were untouched
  console.log('\n--- VERIFYING FARM DOCUMENTS UNTOUCHED ---');
  const farmsSnap = await db.collection('farms').get();
  console.log(`Total Farms Found: ${farmsSnap.size}`);

  farmsSnap.forEach((doc) => {
    const data = doc.data();
    console.log(`\nFarm Document: /farms/${doc.id}`);
    console.log(`- name:             ${data.name}`);
    console.log(`- initialBirdCount: ${data.initialBirdCount}`);
    console.log(`- currentBirdCount: ${data.currentBirdCount}`);
  });

  // 3. Confirm specific business rules
  console.log('\n--- VERIFYING EXACT BUSINESS RULES ---');
  const ap12Flock = flockDocs.find((f) => f.farmId === 'AP12');
  const ap13Flock = flockDocs.find((f) => f.farmId === 'AP13');

  if (!ap12Flock) {
    throw new Error('AP12 flock missing!');
  }
  if (!ap13Flock) {
    throw new Error('AP13 flock missing!');
  }

  // AP12: Farm initial=2000, current=1986. Flock initial MUST be 2000, NOT 1986.
  if (ap12Flock.initialBirds !== 2000) {
    throw new Error(`AP12 flock initialBirds is ${ap12Flock.initialBirds}, expected 2000!`);
  }
  if (ap12Flock.currentBirds !== 1986) {
    throw new Error(`AP12 flock currentBirds is ${ap12Flock.currentBirds}, expected 1986!`);
  }
  console.log('✓ AP12 Rule Passed: Flock initialBirds = 2000 (NOT 1986), currentBirds = 1986');

  // AP13: Farm initial=3000, current=2978. Flock initial MUST be 3000, NOT 2978.
  if (ap13Flock.initialBirds !== 3000) {
    throw new Error(`AP13 flock initialBirds is ${ap13Flock.initialBirds}, expected 3000!`);
  }
  if (ap13Flock.currentBirds !== 2978) {
    throw new Error(`AP13 flock currentBirds is ${ap13Flock.currentBirds}, expected 2978!`);
  }
  console.log('✓ AP13 Rule Passed: Flock initialBirds = 3000 (NOT 2978), currentBirds = 2978');

  // Check subcollections under farms to ensure no erroneous farms/{id}/flocks exists
  for (const farmDoc of farmsSnap.docs) {
    const subColls = await farmDoc.ref.listCollections();
    const hasFlockSubcoll = subColls.some((c) => c.id === 'flocks' || c.id === 'flock');
    if (hasFlockSubcoll) {
      throw new Error(`Farm ${farmDoc.id} has an invalid subcollection 'flocks'!`);
    }
  }
  console.log('✓ Hierarchy Rule Passed: No farms/{farmId}/flocks subcollections exist. All flocks are in top-level /flocks/{flockId}.');

  console.log('\n====================================================');
  console.log('ALL VERIFICATION CHECKS PASSED PERFECTLY!');
  console.log('====================================================\n');

  process.exit(0);
}

verifyFlockSetup().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
