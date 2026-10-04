import * as dotenv from 'dotenv';
dotenv.config();
import { initializeFirebase, getFirestore } from '../config/firebase';
import { ImportService } from '../services/import.service';

async function run() {
  console.log('--- ISOLATION PROOF ---');
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
  process.env.FIREBASE_PROJECT_ID = 'demo-test';
  console.log('FIRESTORE_EMULATOR_HOST set to:', process.env.FIRESTORE_EMULATOR_HOST);
  
  initializeFirebase();
  const db = getFirestore();
  const importService = new ImportService();
  const adminUser: any = { uid: 'admin1', role: 'admin', email: 'admin@test.com' };

  console.log('\n--- SETTING UP UNRELATED PRE-EXISTING DATA ---');
  const unrelatedRef = db.collection('dailyReports').doc('farmer-c').collection('dailyLogs').doc('2020-01-01');
  await db.collection('users').doc('farmer-c').set({ role: 'farmer', farmIds: ['FARM_C'], active: true });
  await db.collection('farms').doc('FARM_C').set({ farmId: 'FARM_C' });
  await unrelatedRef.set({ farmId: 'FARM_C', birdCount: 9999, isUnrelated: true });
  console.log('Created unrelated report at:', unrelatedRef.path);

  console.log('\n--- RUNNING FRESH IMPORT FOR ROLLBACK TEST ---');
  await db.collection('users').doc('farmer-r').set({ role: 'farmer', farmIds: ['FARM_R'], active: true });
  await db.collection('farms').doc('FARM_R').set({ farmId: 'FARM_R' });
  
  const syntheticData = [
    { recordType: 'DAILY_REPORT', farmId: 'FARM_R', submissionDate: '2025-11-01', birdCount: 500, sourceFile: 'rollback.csv', sourceRow: 1 },
    { recordType: 'DAILY_REPORT', farmId: 'FARM_R', submissionDate: '2025-11-02', birdCount: 490, sourceFile: 'rollback.csv', sourceRow: 2 },
  ] as any[];

  const importResult = await importService.executeImport(
    { records: syntheticData, conflictAction: 'skip', sourceFiles: ['rollback.csv'] },
    adminUser,
    'req-roll-1'
  );
  const newBatchId = importResult.batchId;
  console.log('Imported batch ID:', newBatchId);

  console.log('\n--- VERIFYING DOCUMENTS BEFORE ROLLBACK ---');
  const beforeLogs = await db.collectionGroup('dailyLogs').where('farmId', '==', 'FARM_R').get();
  console.log('FARM_R logs before rollback:');
  beforeLogs.forEach(d => console.log(d.ref.path));

  const beforeLocks = await db.collection('dailyReportLocks').where('farmId', '==', 'FARM_R').get();
  console.log('FARM_R locks before rollback:');
  beforeLocks.forEach(d => console.log(d.ref.path));
  
  const beforeUnrelated = await unrelatedRef.get();
  console.log('Unrelated report exists before rollback:', beforeUnrelated.exists);

  console.log('\n--- EXECUTING ROLLBACK ---');
  const rollbackResult = await importService.revertImportBatch(
    newBatchId,
    { confirmationBatchId: newBatchId },
    adminUser,
    'req-roll-revert'
  );
  console.log('Rollback Result:', rollbackResult);

  console.log('\n--- VERIFYING DOCUMENTS AFTER ROLLBACK ---');
  const afterLogs = await db.collectionGroup('dailyLogs').where('farmId', '==', 'FARM_R').get();
  console.log(`FARM_R logs after rollback: ${afterLogs.docs.length} found`);
  
  const afterLocks = await db.collection('dailyReportLocks').where('farmId', '==', 'FARM_R').get();
  console.log(`FARM_R locks after rollback: ${afterLocks.docs.length} found`);
  
  const afterUnrelated = await unrelatedRef.get();
  console.log('Unrelated report exists after rollback:', afterUnrelated.exists);

  // Check legacy fallback behavior: we'll create a synthetic legacy batch manifest in the DB
  console.log('\n--- SETTING UP SYNTHETIC LEGACY BATCH ---');
  const legacyBatchId = 'legacy_batch_123';
  await db.collection('importBatches').doc(legacyBatchId).set({
    batchId: legacyBatchId,
    status: 'COMPLETED',
    overwrittenRecords: [
      {
        collectionPath: 'dailyReports',
        docId: 'LEGACYFARM_2019-01-01',
        beforeData: { oldLegacyData: true }
      }
    ],
    // Deliberately omitting targetDocs and manifest arrays to simulate old batches
  });
  console.log('Created legacy batch manifest without targetDocs');

  // We don't actually need to execute the revert if it might fail on missing locks, 
  // but let's check how resolveBatchItems handles it by running getRevertPreview
  const preview = await importService.getRevertPreview(legacyBatchId, adminUser, 'req-prev', undefined);
  console.log('Legacy Revert Preview items count:', preview.sampleRecords?.length);
  if (preview.sampleRecords && preview.sampleRecords.length > 0) {
    console.log('Legacy Revert Preview first item:', preview.sampleRecords[0]);
  }

}

run().catch(console.error);
