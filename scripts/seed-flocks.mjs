import { readFileSync } from 'fs';
import admin from 'firebase-admin';
import path from 'path';

// Load service account key
const SERVICE_ACCOUNT_PATH = path.resolve('./service-account.json');

try {
  const serviceAccount = JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, 'utf-8'));
  
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }
} catch (err) {
  console.error('Error loading service account. Make sure service-account.json is present.', err);
  process.exit(1);
}

const db = admin.firestore();

async function seedFlocks() {
  console.log('Seeding flocks...');
  try {
    const flockRef = db.collection('flocks').doc('F1_B1');
    const now = new Date().toISOString();
    
    await flockRef.set({
      flockId: 'F1_B1',
      farmId: 'FARM_001',
      flockName: 'Batch 1 (Demo)',
      breed: 'BV-300',
      hatchDate: '2023-01-01',
      initialBirds: 10000,
      currentBirds: 9900,
      totalMortality: 100,
      totalCulling: 0,
      totalEggs: 50000,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });
    
    console.log('Successfully seeded flock F1_B1 for FARM_001');
    process.exit(0);
  } catch (err) {
    console.error('Failed to seed flock:', err);
    process.exit(1);
  }
}

seedFlocks();
