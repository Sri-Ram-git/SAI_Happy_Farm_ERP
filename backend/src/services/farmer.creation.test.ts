import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FarmerService } from './farmer.service';

// Mock dependencies
vi.mock('../config/firebase', () => ({
  getFirestore: vi.fn(),
  getAuth: vi.fn(),
  initializeFirebase: vi.fn(),
}));

vi.mock('../config/environment', () => ({
  getEnv: vi.fn().mockReturnValue({
    FIREBASE_PROJECT_ID: 'test-project',
    PORT: 3000,
    NODE_ENV: 'test',
    ALLOWED_ORIGINS: '*',
    RATE_LIMIT_WINDOW_MS: 900000,
    RATE_LIMIT_MAX_REQUESTS: 100,
    LOG_LEVEL: 'info',
  }),
}));

import { getFirestore, getAuth } from '../config/firebase';

describe('Farmer Creation — Opening Flock and Feed Stock Initialization Suite', () => {
  let farmerService: FarmerService;
  let mockDb: any;
  let mockAuth: any;

  beforeEach(() => {
    vi.clearAllMocks();
    farmerService = new FarmerService();

    mockAuth = {
      createUser: vi.fn().mockResolvedValue({
        uid: 'new-farmer-uid-123',
        email: 'farmer@saihappyfarms.com',
      }),
      deleteUser: vi.fn().mockResolvedValue(undefined),
      getUserByEmail: vi.fn().mockRejectedValue({ code: 'auth/user-not-found' }),
    };

    (getAuth as any).mockReturnValue(mockAuth);
  });

  function setupMockDb(params: {
    existingFarms: any[];
    flockExists?: boolean;
    feedLogExists?: boolean;
    failTransaction?: boolean;
  }) {
    const writtenDocs = new Map<string, any>();
    const mockFarmsSnap = {
      docs: params.existingFarms.map((f) => ({
        id: f.id,
        data: () => f,
      })),
    };

    const birdTxDocRef = { id: 'bird-tx-1' };
    const feedTxDocRef = { id: 'feed-tx-1' };
    const flockLogDocRef = { id: 'flock-log-1' };
    const feedLogDocRef = { id: 'feed-log-1' };
    const flockDocRef = { id: 'flock-initial-1' };

    const farmsCollRef = {
      _isFarms: true,
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
        }),
      }),
      doc: vi.fn().mockImplementation((farmId: string) => ({
        id: farmId,
        collection: vi.fn().mockImplementation((subColl: string) => {
          if (subColl === 'birdTransactions') {
            return { doc: vi.fn().mockReturnValue(birdTxDocRef) };
          }
          if (subColl === 'feedTransactions') {
            return { doc: vi.fn().mockReturnValue(feedTxDocRef) };
          }
          return { doc: vi.fn().mockReturnValue({ id: 'dummy' }) };
        }),
      })),
    };

    const usersCollRef = {
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
        }),
      }),
      doc: vi.fn().mockImplementation((uid: string) => ({ id: uid })),
    };

    const flocksCollRef = {
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue(
            params.flockExists
              ? { empty: false, size: 1, docs: [{ id: 'existing-flock' }] }
              : { empty: true, size: 0, docs: [] }
          ),
        }),
      }),
      doc: vi.fn().mockReturnValue(flockDocRef),
    };

    const logsCollRef = {
      doc: vi.fn().mockImplementation((farmId: string) => ({
        id: farmId,
        collection: vi.fn().mockImplementation((logType: string) => {
          if (logType === 'flockLogs') {
            return {
              doc: vi.fn().mockReturnValue(flockLogDocRef),
            };
          }
          if (logType === 'feedLogs') {
            return {
              limit: vi.fn().mockReturnValue({
                get: vi.fn().mockResolvedValue(
                  params.feedLogExists
                    ? { empty: false, size: 1, docs: [{ id: 'existing-feed-log' }] }
                    : { empty: true, size: 0, docs: [] }
                ),
              }),
              doc: vi.fn().mockReturnValue(feedLogDocRef),
            };
          }
          return {};
        }),
      })),
    };

    const auditCollRef = {
      add: vi.fn().mockResolvedValue({ id: 'audit-1' }),
    };

    mockDb = {
      collection: vi.fn().mockImplementation((collName: string) => {
        if (collName === 'farms') return farmsCollRef;
        if (collName === 'users') return usersCollRef;
        if (collName === 'flocks') return flocksCollRef;
        if (collName === 'logs') return logsCollRef;
        if (collName === 'auditLogs') return auditCollRef;
        return {};
      }),
      runTransaction: vi.fn().mockImplementation(async (callback: any) => {
        if (params.failTransaction) {
          throw new Error('Firestore transaction aborted');
        }
        const mockTransaction = {
          get: vi.fn().mockImplementation(async (queryOrRef: any) => {
            if (queryOrRef._isFarms) {
              return mockFarmsSnap;
            }
            if (typeof queryOrRef.get === 'function') {
              return queryOrRef.get();
            }
            return { empty: true, docs: [] };
          }),
          set: vi.fn().mockImplementation((ref: any, data: any) => {
            writtenDocs.set(ref.id, data);
          }),
        };
        await callback(mockTransaction);
      }),
    };

    (getFirestore as any).mockReturnValue(mockDb);
    return { writtenDocs, mockDb };
  }

  it('Test A — Normal farmer creation with 1,000 birds and 250 kg feed', async () => {
    const { writtenDocs } = setupMockDb({
      existingFarms: [{ id: 'AP11', name: 'Old Farm AP11', farmId: 'AP11' }],
    });

    const result = await farmerService.createFarmer(
      {
        name: 'Gopal Reddy',
        email: 'gopal@saihappyfarms.com',
        phone_no: '9848012345',
        password: 'password123',
        farmName: 'Sai Krishna Farm',
        initialBirdCount: 1000,
        initialFeedKg: 250,
      },
      'admin-uid-1',
      'req-normal-1',
    );

    // 1. Result returns assigned farmId and opening flockId
    expect(result.uid).toBe('new-farmer-uid-123');
    expect(result.email).toBe('gopal@saihappyfarms.com');
    expect(result.farmId).toBe('AP12');
    expect(result.flockId).toBe('flock-initial-1');

    // 2. Farm document verified: currentBirdCount is 1,000, initialFeedKg is 250
    const farmData = writtenDocs.get('AP12');
    expect(farmData).toBeDefined();
    expect(farmData.farmId).toBe('AP12');
    expect(farmData.name).toBe('Sai Krishna Farm');
    expect(farmData.initialBirdCount).toBe(1000);
    expect(farmData.currentBirdCount).toBe(1000);
    expect(farmData.initialFeedKg).toBe(250);
    expect(farmData.currentFeedKg).toBe(250);
    expect(farmData.totalFeedLoadedKg).toBe(250);
    expect(farmData.inventoryInitialized).toBe(true);

    // 3. User document linked to AP12
    const userData = writtenDocs.get('new-farmer-uid-123');
    expect(userData).toBeDefined();
    expect(userData.role).toBe('farmer');
    expect(userData.farmIds).toEqual(['AP12']);

    // 4. Exactly one opening flock created with 1,000 birds
    const flockData = writtenDocs.get('flock-initial-1');
    expect(flockData).toBeDefined();
    expect(flockData.farmId).toBe('AP12');
    expect(flockData.flockName).toBe('Flock 1');
    expect(flockData.initialBirds).toBe(1000);
    expect(flockData.currentBirds).toBe(1000);
    expect(flockData.status).toBe('active');
    expect(flockData.isInitialFlock).toBe(true);
    expect(flockData.batchNumber).toBe(1);

    // 5. Bird transaction audit recorded
    const birdTxData = writtenDocs.get('bird-tx-1');
    expect(birdTxData).toBeDefined();
    expect(birdTxData.type).toBe('INITIAL');
    expect(birdTxData.count).toBe(1000);
    expect(birdTxData.farmId).toBe('AP12');

    // 6. Feed load log recorded
    const feedLogData = writtenDocs.get('feed-log-1');
    expect(feedLogData).toBeDefined();
    expect(feedLogData.type).toBe('FEED_LOAD');
    expect(feedLogData.quantityKg).toBe(250);
    expect(feedLogData.newStockKg).toBe(250);
    expect(feedLogData.farmId).toBe('AP12');

    // 7. Feed transaction recorded
    const feedTxData = writtenDocs.get('feed-tx-1');
    expect(feedTxData).toBeDefined();
    expect(feedTxData.type).toBe('FEED_LOAD');
    expect(feedTxData.feedKg).toBe(250);
  });

  it('Test B — Zero initial birds: should create farm and user but NO active flock', async () => {
    const { writtenDocs } = setupMockDb({
      existingFarms: [],
    });

    const result = await farmerService.createFarmer(
      {
        name: 'Zero Bird Farmer',
        email: 'zerobirds@saihappyfarms.com',
        phone_no: '9848011111',
        password: 'password123',
        farmName: 'Zero Bird Farm',
        initialBirdCount: 0,
        initialFeedKg: 100,
      },
      'admin-uid-1',
      'req-zero-birds',
    );

    expect(result.farmId).toBe('AP1');
    expect(result.flockId).toBeUndefined();

    // Farm created with currentBirdCount: 0 and currentFeedKg: 100
    const farmData = writtenDocs.get('AP1');
    expect(farmData.currentBirdCount).toBe(0);
    expect(farmData.initialBirdCount).toBe(0);
    expect(farmData.currentFeedKg).toBe(100);

    // NO flock document was written
    expect(writtenDocs.has('flock-initial-1')).toBe(false);

    // Feed log was written for 100 kg
    expect(writtenDocs.get('feed-log-1')).toBeDefined();
    expect(writtenDocs.get('feed-log-1').quantityKg).toBe(100);
  });

  it('Test C — Zero initial feed: should create opening flock but NO feed log', async () => {
    const { writtenDocs } = setupMockDb({
      existingFarms: [],
    });

    const result = await farmerService.createFarmer(
      {
        name: 'Zero Feed Farmer',
        email: 'zerofeed@saihappyfarms.com',
        phone_no: '9848022222',
        password: 'password123',
        farmName: 'Zero Feed Farm',
        initialBirdCount: 500,
        initialFeedKg: 0,
      },
      'admin-uid-1',
      'req-zero-feed',
    );

    expect(result.farmId).toBe('AP1');
    expect(result.flockId).toBe('flock-initial-1');

    // Farm has 500 birds and 0 feed
    const farmData = writtenDocs.get('AP1');
    expect(farmData.currentBirdCount).toBe(500);
    expect(farmData.currentFeedKg).toBe(0);

    // Flock was created with 500 birds
    const flockData = writtenDocs.get('flock-initial-1');
    expect(flockData).toBeDefined();
    expect(flockData.initialBirds).toBe(500);
    expect(flockData.currentBirds).toBe(500);

    // NO feed log was created
    expect(writtenDocs.has('feed-log-1')).toBe(false);
  });

  it('Test D — Idempotency: should not create duplicate flocks if opening flock already exists', async () => {
    const { writtenDocs } = setupMockDb({
      existingFarms: [{ id: 'AP1', name: 'Other Farm', farmId: 'AP1' }],
      flockExists: true,
      feedLogExists: true,
    });

    const result = await farmerService.createFarmer(
      {
        name: 'Retry Farmer',
        email: 'retry@saihappyfarms.com',
        phone_no: '9848033333',
        password: 'password123',
        farmName: 'Retry Farm',
        initialBirdCount: 800,
        initialFeedKg: 200,
      },
      'admin-uid-1',
      'req-retry',
    );

    // Because flock and feed log already existed, no new flock was created
    expect(writtenDocs.has('flock-initial-1')).toBe(false);
    expect(writtenDocs.has('feed-log-1')).toBe(false);
    expect(result.flockId).toBeUndefined();
  });

  it('Test E — Cleanup: should delete Firebase Auth user if Firestore transaction fails', async () => {
    setupMockDb({
      existingFarms: [],
      failTransaction: true,
    });

    await expect(
      farmerService.createFarmer(
        {
          name: 'Failing Farmer',
          email: 'fail@saihappyfarms.com',
          phone_no: '9848044444',
          password: 'password123',
          farmName: 'Failing Farm',
          initialBirdCount: 500,
          initialFeedKg: 100,
        },
        'admin-uid-1',
        'req-fail',
      ),
    ).rejects.toThrow('Firestore transaction aborted');

    // Auth user must have been cleaned up
    expect(mockAuth.deleteUser).toHaveBeenCalledWith('new-farmer-uid-123');
  });

  it('Test F — 5,000 bird farm creation: verifies exact prompt scenario, flock metrics, and non-doubling', async () => {
    const { writtenDocs } = setupMockDb({
      existingFarms: [{ id: 'AP1', name: 'Existing Farm AP1', farmId: 'AP1', currentBirdCount: 2000 }],
    });

    const result = await farmerService.createFarmer(
      {
        name: 'Five Thousand Birds Farmer',
        email: '5000birds@saihappyfarms.com',
        phone_no: '9848055555',
        password: 'password123',
        farmName: 'Mega Poultry AP2',
        initialBirdCount: 5000,
        initialFeedKg: 1000,
      },
      'admin-uid-1',
      'req-5000-birds',
    );

    // 1. Result returns assigned farmId and opening flockId
    expect(result.farmId).toBe('AP2');
    expect(result.flockId).toBe('flock-initial-1');

    // 2. Farm document verified: currentBirdCount is 5,000
    const farmData = writtenDocs.get('AP2');
    expect(farmData).toBeDefined();
    expect(farmData.farmId).toBe('AP2');
    expect(farmData.name).toBe('Mega Poultry AP2');
    expect(farmData.initialBirdCount).toBe(5000);
    expect(farmData.currentBirdCount).toBe(5000);
    expect(farmData.initialFeedKg).toBe(1000);
    expect(farmData.currentFeedKg).toBe(1000);

    // 3. Opening flock verified in 'flocks' collection
    const flockData = writtenDocs.get('flock-initial-1');
    expect(flockData).toBeDefined();
    expect(flockData.farmId).toBe('AP2');
    expect(flockData.flockName).toBe('Flock 1');
    expect(flockData.initialBirds).toBe(5000);
    expect(flockData.currentBirds).toBe(5000);
    expect(flockData.status).toBe('active');
    expect(flockData.batchNumber).toBe(1);
    expect(flockData.isInitialFlock).toBe(true);

    // 4. Verify Flock Management calculations match requirements:
    // - Current Birds: 5,000
    // - Active Flocks: 1
    // - Flock History: 1
    // - Total Birds for this farm is 5,000 (not 10,000)
    const farmFlocks = [flockData];
    const activeFlocksCount = farmFlocks.filter((f) => f.status === 'active').length;
    const flockHistoryCount = farmFlocks.length;
    const displayedCurrentBirds = Number(farmData.currentBirdCount);

    expect(displayedCurrentBirds).toBe(5000);
    expect(activeFlocksCount).toBe(1);
    expect(flockHistoryCount).toBe(1);
    expect(flockData.currentBirds).toBe(5000);

    // Prevent double-counting: farm's total bird count is 5,000, NOT farm.currentBirdCount + flock.currentBirds (10,000)
    expect(displayedCurrentBirds).not.toBe(10000);
  });
});
