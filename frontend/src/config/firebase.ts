const f = (window as any).firebase;

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
