import admin from "firebase-admin";
import { readFileSync } from "fs";

const serviceAccount = JSON.parse(
  readFileSync("./serviceAccountKey.json", "utf8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const FARM_INVENTORY = {
  API2: {
    initialBirdCount: 1000,
    currentBirdCount: 1000,
    initialFeedKg: 5000,
    currentFeedKg: 5000,
    totalFeedLoadedKg: 5000,
    totalFeedConsumedKg: 0
  },
  // AP13: {
  //   initialBirdCount: 1200,
  //   currentBirdCount: 1200,
  //   initialFeedKg: 6000,
  //   currentFeedKg: 6000,
  //   totalFeedLoadedKg: 6000,
  //   totalFeedConsumedKg: 0
  // },
};

async function initializeFarmInventory() {
  console.log("\n====================================");
  console.log("STARTING FARM INVENTORY INITIALIZATION");
  console.log("====================================\n");

  for (const [farmId, inventory] of Object.entries(FARM_INVENTORY)) {
    const farmRef = db.collection("farms").doc(farmId);
    const farmSnapshot = await farmRef.get();

    if (!farmSnapshot.exists) {
      console.error(`Farm document does not exist: farms/${farmId}`);
      console.error(`Skipping ${farmId}. No inventory was created.`);
      continue;
    }

    const existingFarm = farmSnapshot.data();
    console.log(`Processing farm: ${farmId}`);
    console.log("Existing farm data:", existingFarm);

    const updateData = {
      inventoryInitialized: true,
      inventoryUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (existingFarm.initialBirdCount === undefined || existingFarm.initialBirdCount === null) {
      updateData.initialBirdCount = inventory.initialBirdCount;
    }

    if (existingFarm.currentBirdCount === undefined || existingFarm.currentBirdCount === null) {
      updateData.currentBirdCount = inventory.currentBirdCount;
    }

    if (existingFarm.initialFeedKg === undefined || existingFarm.initialFeedKg === null) {
      updateData.initialFeedKg = inventory.initialFeedKg;
    }

    if (existingFarm.currentFeedKg === undefined || existingFarm.currentFeedKg === null) {
      updateData.currentFeedKg = inventory.currentFeedKg;
    }

    if (existingFarm.totalFeedLoadedKg === undefined || existingFarm.totalFeedLoadedKg === null) {
      updateData.totalFeedLoadedKg = inventory.totalFeedLoadedKg;
    }

    if (existingFarm.totalFeedConsumedKg === undefined || existingFarm.totalFeedConsumedKg === null) {
      updateData.totalFeedConsumedKg = inventory.totalFeedConsumedKg;
    }

    await farmRef.set(updateData, { merge: true });
    console.log(`Inventory initialized successfully for ${farmId}`);
  }

  console.log("\n====================================");
  console.log("FARM INVENTORY INITIALIZATION COMPLETE");
  console.log("====================================\n");
}

initializeFarmInventory()
  .then(() => {
    console.log("Migration completed successfully.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Inventory migration failed:");
    console.error(error);
    process.exit(1);
  });
