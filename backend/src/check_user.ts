import * as dotenv from 'dotenv';
dotenv.config();

import * as admin from 'firebase-admin';
import { initializeFirebase } from './config/firebase';

initializeFirebase();
const db = admin.firestore();

async function checkFlock() {
  const doc = await db.collection('flocks').doc('kvbXqSu81HpVsdyOoDmQ').get();
  console.log('Flock data:', doc.data());
  process.exit(0);
}

checkFlock();
