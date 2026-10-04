"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = exports.auth = void 0;
exports.getFirebaseAuth = getFirebaseAuth;
exports.getFirebaseDb = getFirebaseDb;
function getFirebaseApp() {
    if (typeof window === 'undefined')
        return null;
    const f = window.firebase;
    if (!f)
        return null;
    if (typeof f.initializeApp === 'function' && (!f.apps || f.apps.length === 0)) {
        const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
        f.initializeApp({
            apiKey: apiKey || 'AIzaSyCfBEshZQtNiGEw5b4qjuHESSoI5qcw9j8',
            authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'farm-form.firebaseapp.com',
            projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'farm-form',
            storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'farm-form.firebasestorage.app',
            messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '429169430487',
            appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:429169430487:web:5de26e54e3fc7b72c18592',
        });
    }
    return f;
}
function getFirebaseAuth() {
    const f = getFirebaseApp();
    if (!f || !f.apps || f.apps.length === 0)
        return null;
    return typeof f.auth === 'function' ? f.auth() : null;
}
function getFirebaseDb() {
    const f = getFirebaseApp();
    if (!f || !f.apps || f.apps.length === 0)
        return null;
    return typeof f.firestore === 'function' ? f.firestore() : null;
}
// Proxies to safely export auth and db without throwing at module load time if CDN is delayed
exports.auth = new Proxy({}, {
    get(_target, prop) {
        const a = getFirebaseAuth();
        if (!a) {
            console.warn('[Firebase] auth accessed before Firebase SDK loaded on window');
            return undefined;
        }
        const val = a[prop];
        return typeof val === 'function' ? val.bind(a) : val;
    }
});
exports.db = new Proxy({}, {
    get(_target, prop) {
        const d = getFirebaseDb();
        if (!d) {
            console.warn('[Firebase] db accessed before Firebase SDK loaded on window');
            return undefined;
        }
        const val = d[prop];
        return typeof val === 'function' ? val.bind(d) : val;
    }
});
// Enable official Firestore persistent offline caching for Firebase JS Compat SDK v12.18.0
try {
    const d = getFirebaseDb();
    if (d && typeof d.enablePersistence === 'function') {
        d.enablePersistence({ synchronizeTabs: true }).catch((err) => {
            if (err.code === 'failed-precondition') {
                console.warn('[Firestore Persistence] Multiple tabs open; persistence enabled in primary tab');
            }
            else if (err.code === 'unimplemented') {
                console.warn('[Firestore Persistence] Persistence unimplemented by browser');
            }
            else {
                console.warn('[Firestore Persistence] Error:', err);
            }
        });
    }
}
catch (e) {
    console.warn('[Firestore Persistence] Skipped initial persistence setup:', e);
}
//# sourceMappingURL=firebase.js.map