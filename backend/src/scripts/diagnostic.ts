import * as dotenv from 'dotenv';
dotenv.config();
import { initializeFirebase } from '../config/firebase';
import * as admin from 'firebase-admin';

async function run() {
  console.log('--- STARTING DIAGNOSTIC ---');
  initializeFirebase();
  const db = admin.firestore();
  
  const farmsSnap = await db.collection('farms').get();
  console.log(`Found ${farmsSnap.size} farms.`);
  farmsSnap.forEach(f => console.log('Farm:', f.id, f.data()));

  const logsSnap = await db.collectionGroup('dailyLogs').get();
  console.log(`\nFound ${logsSnap.size} daily logs.`);
  logsSnap.forEach(d => console.log('Log:', d.ref.path, d.data()));
  
  const usersSnap = await db.collection('users').get();
  console.log(`\nFound ${usersSnap.size} users.`);
  usersSnap.forEach(u => console.log('User:', u.id, u.data()));
  
  console.log('--- END DIAGNOSTIC ---');
}

run().catch(console.error);
