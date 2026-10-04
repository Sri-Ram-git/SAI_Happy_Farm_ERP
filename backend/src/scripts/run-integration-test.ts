import * as dotenv from 'dotenv';
dotenv.config();
import { initializeFirebase, getFirestore } from '../config/firebase';
import { ImportService } from '../services/import.service';

async function run() {
  console.log('--- ISOLATION PROOF ---');
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
  process.env.FIREBASE_PROJECT_ID = 'demo-test';
  console.log('FIRESTORE_EMULATOR_HOST set to:', process.env.FIRESTORE_EMULATOR_HOST);
  
  const app = initializeFirebase();
  const db = getFirestore();
  
  // Prove it's pointing to the emulator by doing a tiny write and verifying project ID
  console.log('Firebase App Project ID:', app.options.projectId);
  console.log('Firestore emulator settings applied automatically by Admin SDK.');
  console.log('--- STARTING IMPORT TEST ---');

  const importService = new ImportService();
  const adminUser: any = { uid: 'admin1', role: 'admin', email: 'admin@test.com' };

  // Setup mock users and farms in the emulator so the backend validations pass
  await db.collection('users').doc('farmer-a').set({ role: 'farmer', farmIds: ['FARM_A'], active: true });
  await db.collection('users').doc('farmer-b').set({ role: 'farmer', farmIds: ['FARM_B'], active: true });
  await db.collection('farms').doc('FARM_A').set({ farmId: 'FARM_A' });
  await db.collection('farms').doc('FARM_B').set({ farmId: 'FARM_B' });

  const syntheticData = [
    { recordType: 'DAILY_REPORT', farmId: 'FARM_A', submissionDate: '2025-10-01', birdCount: 1000, feedKg: 100, sourceFile: 'test.csv', sourceRow: 1 },
    { recordType: 'DAILY_REPORT', farmId: 'FARM_A', submissionDate: '2025-10-02', birdCount: 990, feedKg: 110, sourceFile: 'test.csv', sourceRow: 2 },
    { recordType: 'DAILY_REPORT', farmId: 'FARM_B', submissionDate: '2025-10-01', birdCount: 2000, feedKg: 200, sourceFile: 'test.csv', sourceRow: 3 },
  ] as any[];

  console.log('\n--- EXECUTING FIRST IMPORT ---');
  const res1 = await importService.executeImport(
    { records: syntheticData, conflictAction: 'skip', sourceFiles: ['test.csv'] },
    adminUser,
    'req-1'
  );
  console.log('First Import Result:', res1);

  console.log('\n--- INSPECTING EMULATOR PATHS ---');
  const dailyReportsSnap = await db.collection('dailyReports').get();
  console.log('Top-level dailyReports documents:');
  for (const doc of dailyReportsSnap.docs) {
    console.log(`- Path: ${doc.ref.path}`);
    console.log(`  Data:`, doc.data());
  }

  const dailyLogsSnap = await db.collectionGroup('dailyLogs').get();
  console.log('\nNested dailyLogs documents (Canonical Payload):');
  for (const doc of dailyLogsSnap.docs) {
    console.log(`- Path: ${doc.ref.path}`);
    console.log(`  Data Keys:`, Object.keys(doc.data()));
  }

  const locksSnap = await db.collection('dailyReportLocks').get();
  console.log('\nLock documents:');
  for (const doc of locksSnap.docs) {
    console.log(`- Path: ${doc.ref.path}`);
  }

  console.log('\n--- EXECUTING REPEAT IMPORT ---');
  const res2 = await importService.executeImport(
    { records: syntheticData, conflictAction: 'skip', sourceFiles: ['test.csv'] },
    adminUser,
    'req-2'
  );
  console.log('Repeat Import Result:', res2);

}

run().catch(console.error);
