import * as admin from 'firebase-admin';
import * as path from 'path';
import { getEnv } from './environment';

let firebaseApp: admin.app.App | null = null;

export function initializeFirebase(): admin.app.App {
  if (firebaseApp) {
    return firebaseApp;
  }

  const env = getEnv();

  let credentialObj: any = null;

  if (process.env['FIREBASE_SERVICE_ACCOUNT_JSON']) {
    try {
      credentialObj = JSON.parse(process.env['FIREBASE_SERVICE_ACCOUNT_JSON']);
    } catch {
      credentialObj = null;
    }
  } else if (process.env['FIREBASE_SERVICE_ACCOUNT_BASE64']) {
    try {
      const decoded = Buffer.from(process.env['FIREBASE_SERVICE_ACCOUNT_BASE64'], 'base64').toString('utf8');
      credentialObj = JSON.parse(decoded);
    } catch {
      credentialObj = null;
    }
  }

  if (!credentialObj) {
    const serviceAccountPath = path.resolve(process.cwd(), env.FIREBASE_SERVICE_ACCOUNT_PATH);
    credentialObj = require(serviceAccountPath);
  }

  if (credentialObj && typeof credentialObj.private_key === 'string') {
    credentialObj.private_key = credentialObj.private_key.replace(/\\n/g, '\n');
  }

  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert(credentialObj),
    projectId: env.FIREBASE_PROJECT_ID,
  });

  return firebaseApp;
}

export function getFirebaseApp(): admin.app.App {
  if (!firebaseApp) {
    throw new Error('Firebase not initialized. Call initializeFirebase() first.');
  }
  return firebaseApp;
}

export function getFirestore(): admin.firestore.Firestore {
  return getFirebaseApp().firestore();
}

export function getAuth(): admin.auth.Auth {
  return getFirebaseApp().auth();
}
