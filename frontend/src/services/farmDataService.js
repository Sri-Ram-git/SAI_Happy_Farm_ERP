"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFarmById = getFarmById;
exports.subscribeToFarm = subscribeToFarm;
exports.getFarmsByIds = getFarmsByIds;
exports.getAllFarms = getAllFarms;
exports.subscribeToAllFarms = subscribeToAllFarms;
exports.subscribeToFarms = subscribeToFarms;
const firebase_1 = require("../config/firebase");
async function getFarmById(farmId) {
    const doc = await firebase_1.db.collection('farms').doc(farmId).get();
    if (!doc.exists)
        return null;
    return { farmId: doc.id, ...(doc.data() || {}) };
}
function subscribeToFarm(farmId, callback) {
    if (!farmId)
        return () => { };
    return firebase_1.db.collection('farms').doc(farmId).onSnapshot((doc) => {
        if (!doc.exists) {
            callback(null);
        }
        else {
            callback({ farmId: doc.id, ...(doc.data() || {}) });
        }
    }, (err) => {
        console.error('[farmDataService] subscribeToFarm error:', err.message || err);
    });
}
async function getFarmsByIds(farmIds) {
    if (farmIds.length === 0)
        return [];
    const results = [];
    const batchSize = 10;
    for (let i = 0; i < farmIds.length; i += batchSize) {
        const batch = farmIds.slice(i, i + batchSize);
        const snap = await firebase_1.db.collection('farms').where('__name__', 'in', batch).get();
        for (const doc of snap.docs) {
            results.push({ farmId: doc.id, ...(doc.data() || {}) });
        }
    }
    return results;
}
async function getAllFarms() {
    const snap = await firebase_1.db.collection('farms').get();
    return snap.docs.map((doc) => ({ farmId: doc.id, ...(doc.data() || {}) }));
}
function subscribeToAllFarms(callback) {
    return firebase_1.db.collection('farms').onSnapshot((snap) => {
        const farms = snap.docs.map((doc) => ({ farmId: doc.id, ...(doc.data() || {}) }));
        callback(farms);
    }, (err) => {
        console.error('[farmDataService] subscribeToAllFarms error:', err.message || err);
    });
}
function subscribeToFarms(farmIds, callback) {
    if (farmIds === undefined) {
        return subscribeToAllFarms(callback);
    }
    if (farmIds.length === 0) {
        callback([]);
        return () => { };
    }
    const farmMap = new Map();
    const unsubs = farmIds.map((id) => subscribeToFarm(id, (farm) => {
        if (farm) {
            farmMap.set(id, farm);
        }
        else {
            farmMap.delete(id);
        }
        callback(Array.from(farmMap.values()));
    }));
    return () => {
        unsubs.forEach((unsub) => unsub());
    };
}
//# sourceMappingURL=farmDataService.js.map