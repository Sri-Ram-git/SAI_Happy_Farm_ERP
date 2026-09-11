const f = (window as any).firebase;

if (f && typeof f.initializeApp === 'function' && (!f.apps || f.apps.length === 0)) {
  f.initializeApp({
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'farm-form.firebaseapp.com',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'farm-form',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'farm-form.firebasestorage.app',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '429169430487',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:429169430487:web:5de26e54e3fc7b72c18592',
  });
}

export const auth = f.auth();
export const db = f.firestore();

// Enable official Firestore persistent offline caching for Firebase JS Compat SDK v12.18.0
if (db && typeof db.enablePersistence === 'function') {
  db.enablePersistence({ synchronizeTabs: true }).catch((err: any) => {
    if (err.code === 'failed-precondition') {
      console.warn('[Firestore Persistence] Multiple tabs open; persistence enabled in primary tab');
    } else if (err.code === 'unimplemented') {
      console.warn('[Firestore Persistence] Persistence unimplemented by browser');
    } else {
      console.warn('[Firestore Persistence] Error:', err);
    }
  });
}
