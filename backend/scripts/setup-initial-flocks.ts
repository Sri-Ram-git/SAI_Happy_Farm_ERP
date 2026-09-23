import 'dotenv/config';
import { initializeFirebase, getFirestore } from '../src/config/firebase';

interface InitialFlockResult {
  farmId: string;
  farmName: string;
  farmInitialBirds: number;
  farmCurrentBirds: number;
  flockId: string;
  flockName: string;
  flockInitialBirds: number;
  flockCurrentBirds: number;
  status: 'created' | 'skipped_exists' | 'skipped_no_initial_count';
  reason?: string;
}

export async function setupInitialFlocks(): Promise<{
  totalFarmsDiscovered: number;
  farmsWithValidInitialCount: number;
  initialFlocksCreated: number;
  skippedAlreadyExisted: number;
  skippedNoInitialCount: number;
  results: InitialFlockResult[];
}> {
  initializeFirebase();
  const db = getFirestore();

  console.log('====================================================');
  console.log('STARTING INITIAL FLOCK SETUP IN TOP-LEVEL "flocks"');
  console.log('====================================================\n');

  const farmsSnap = await db.collection('farms').get();
  const totalFarmsDiscovered = farmsSnap.size;
  console.log(`Discovered ${totalFarmsDiscovered} farm document(s) in "farms" collection.`);

  let farmsWithValidInitialCount = 0;
  let initialFlocksCreated = 0;
  let skippedAlreadyExisted = 0;
  let skippedNoInitialCount = 0;
  const results: InitialFlockResult[] = [];

  for (const farmDoc of farmsSnap.docs) {
    const farmId = farmDoc.id;
    const farmData = farmDoc.data();
    const farmName = farmData.name || farmId;

    // 1. Identify INITIAL BIRD COUNT from the farm document
    let rawInitial = farmData.initialBirdCount;
    if (rawInitial === undefined || rawInitial === null) {
      // Check legacy field fallback if present
      rawInitial = farmData.totalBirds;
    }

    const farmInitialBirds = Number(rawInitial);

    if (isNaN(farmInitialBirds) || farmInitialBirds <= 0) {
      console.log(`[SKIP] Farm ${farmId} (${farmName}): Skipped — initial bird count unavailable.`);
      skippedNoInitialCount++;
      results.push({
        farmId,
        farmName,
        farmInitialBirds: 0,
        farmCurrentBirds: Number(farmData.currentBirdCount ?? 0),
        flockId: '',
        flockName: '',
        flockInitialBirds: 0,
        flockCurrentBirds: 0,
        status: 'skipped_no_initial_count',
        reason: 'Initial bird count unavailable or zero',
      });
      continue;
    }

    farmsWithValidInitialCount++;

    // Authoritative current birds (for mortality tracking inside the flock record only)
    const farmCurrentBirds = Number(farmData.currentBirdCount ?? farmData.currentBirds ?? farmInitialBirds);

    // 2. Check top-level 'flocks' collection for existing initial flock belonging to this farm (Idempotency)
    const existingFlocksSnap = await db.collection('flocks')
      .where('farmId', '==', farmId)
      .get();

    const existingInitial = existingFlocksSnap.docs.find((d) => {
      const fd = d.data();
      return fd.isInitialFlock === true || fd.flockName === 'Flock 1' || fd.batchNumber === 1;
    });

    if (existingInitial) {
      const existingData = existingInitial.data();
      console.log(`[SKIP] Farm ${farmId} (${farmName}): Initial flock already exists (Flock ID: ${existingInitial.id}, Name: ${existingData.flockName}).`);
      skippedAlreadyExisted++;
      results.push({
        farmId,
        farmName,
        farmInitialBirds,
        farmCurrentBirds,
        flockId: existingInitial.id,
        flockName: existingData.flockName || 'Flock 1',
        flockInitialBirds: existingData.initialBirds,
        flockCurrentBirds: existingData.currentBirds,
        status: 'skipped_exists',
        reason: 'Initial flock already exists in top-level flocks collection',
      });
      continue;
    }

    // 3. Create initial flock in top-level 'flocks' collection
    const flockRef = db.collection('flocks').doc();
    const now = new Date().toISOString();
    const startDate = '2026-09-01'; // Standard benchmark placement date
    const startMs = new Date(startDate + 'T00:00:00+05:30').getTime();
    const nowMs = Date.now();
    const ageWeeks = Math.max(0, Math.floor((nowMs - startMs) / (7 * 24 * 3600 * 1000)));

    // IMPORTANT: initialBirds MUST be farm's authoritative initialBirdCount (e.g. 2000), NOT currentBirdCount (1986)
    const flockInitialBirds = farmInitialBirds;
    const flockCurrentBirds = farmCurrentBirds > 0 ? farmCurrentBirds : flockInitialBirds;
    const mortality = Math.max(0, flockInitialBirds - flockCurrentBirds);

    const flockDocData = {
      flockId: flockRef.id,
      farmId: farmId,
      flockName: 'Flock 1',
      initialBirds: flockInitialBirds,
      currentBirds: flockCurrentBirds,
      totalMortality: mortality,
      totalCulling: 0,
      totalEggs: 0,
      startDate: startDate,
      currentAgeWeeks: ageWeeks,
      breedType: 'BV-300',
      productionCurve: 'CF_STD' as const,
      status: 'active' as const,
      batchNumber: 1,
      isInitialFlock: true,
      notes: 'Initial flock establishment from farm inventory',
      createdAt: now,
      updatedAt: now,
    };

    // Atomically persist ONLY into top-level flocks collection.
    // ZERO modifications to farms, users, or reports.
    await flockRef.set(flockDocData);

    console.log(`[CREATED] Farm ${farmId} (${farmName}): Created Flock 1 (Flock ID: ${flockRef.id}) with initialBirds=${flockInitialBirds} (currentBirds=${flockCurrentBirds})`);
    initialFlocksCreated++;

    results.push({
      farmId,
      farmName,
      farmInitialBirds,
      farmCurrentBirds,
      flockId: flockRef.id,
      flockName: 'Flock 1',
      flockInitialBirds,
      flockCurrentBirds,
      status: 'created',
    });
  }

  console.log('\n====================================================');
  console.log('SUMMARY OF INITIAL FLOCK SETUP');
  console.log('====================================================');
  console.log(`Total Farms Discovered:            ${totalFarmsDiscovered}`);
  console.log(`Farms With Valid Initial Count:    ${farmsWithValidInitialCount}`);
  console.log(`Initial Flocks Created:            ${initialFlocksCreated}`);
  console.log(`Skipped (Already Existed):         ${skippedAlreadyExisted}`);
  console.log(`Skipped (No Initial Count):        ${skippedNoInitialCount}`);
  console.log('====================================================\n');

  return {
    totalFarmsDiscovered,
    farmsWithValidInitialCount,
    initialFlocksCreated,
    skippedAlreadyExisted,
    skippedNoInitialCount,
    results,
  };
}

if (process.argv[1] && process.argv[1].includes('setup-initial-flocks')) {
  setupInitialFlocks()
    .then(() => {
      console.log('Initial flock setup script completed successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Initial flock setup script failed:', err);
      process.exit(1);
    });
}
