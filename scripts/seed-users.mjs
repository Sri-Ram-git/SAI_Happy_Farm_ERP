// Run this once to seed test users: node --experimental-modules scripts/seed-users.mjs
// Requires: service-account.json in project root with Firebase Admin SDK credentials

import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const app = initializeApp({
  projectId: 'farm-form',
});

const auth = getAuth(app);
const db = getFirestore(app);

const testUsers = [
  {
    email: 'farmer@test.com',
    password: 'test1234',
    profile: {
      role: 'farmer',
      farmerId: 'F001',
      farmerName: 'Ramesh',
      farmId: 'AP12',
      farmName: 'AP 12',
      birdCount: 1140,
      isActive: true,
    },
  },
  {
    email: 'supervisor@test.com',
    password: 'test1234',
    profile: {
      role: 'supervisor',
      name: 'Supervisor Kumar',
      isActive: true,
    },
  },
  {
    email: 'admin@test.com',
    password: 'test1234',
    profile: {
      role: 'admin',
      name: 'Admin',
      isActive: true,
    },
  },
];

async function seed() {
  for (const user of testUsers) {
    try {
      let userRecord;
      try {
        userRecord = await auth.getUserByEmail(user.email);
        console.log(`User ${user.email} already exists (uid: ${userRecord.uid})`);
      } catch {
        userRecord = await auth.createUser({
          email: user.email,
          password: user.password,
          emailVerified: true,
        });
        console.log(`Created user ${user.email} (uid: ${userRecord.uid})`);
      }

      await db.collection('users').doc(userRecord.uid).set({
        uid: userRecord.uid,
        email: user.email,
        ...user.profile,
        createdAt: new Date().toISOString(),
      });
      console.log(`  → Firestore profile saved for ${user.email}`);
    } catch (error) {
      console.error(`Error with ${user.email}:`, error.message);
    }
  }

  console.log('\nDone! Test credentials:');
  console.log('Farmer:    farmer@test.com / test1234');
  console.log('Supervisor: supervisor@test.com / test1234');
  console.log('Admin:     admin@test.com / test1234');
}

seed();
