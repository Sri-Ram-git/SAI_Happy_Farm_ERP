import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FlockController } from './flock.controller';
import { Request, Response } from 'express';

vi.mock('../config/firebase', () => ({
  getFirestore: vi.fn(),
}));

import { getFirestore } from '../config/firebase';

describe('FlockController - Initial and Batch Flock Creation Business Rules', () => {
  let mockDb: any;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let resStatus: any;
  let resJson: any;

  beforeEach(() => {
    vi.clearAllMocks();

    resJson = vi.fn();
    resStatus = vi.fn().mockReturnValue({ json: resJson });
    mockRes = {
      status: resStatus,
      json: resJson,
    };
  });

  it('should establish initial flock using farm authoritative initialBirdCount (2000) not currentBirdCount (1986)', async () => {
    const farmId = 'AP12';
    mockReq = {
      body: {
        farmId,
        startDate: '2026-03-01',
        breedType: 'BV-300',
        productionCurve: 'CF_STD',
      },
    };

    const mockFlockDocRef = { id: 'flock-initial-123' };
    const mockBirdTxRef = { id: 'tx-123' };
    const mockFarmDocRef = {
      collection: vi.fn().mockReturnValue({
        doc: vi.fn().mockReturnValue(mockBirdTxRef),
      }),
    };

    // Existing flocks query returns 0 flocks (initial flock scenario)
    const mockFlocksQuery = {
      where: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({
          size: 0,
          docs: [],
        }),
      }),
      doc: vi.fn().mockReturnValue(mockFlockDocRef),
    };

    const mockFarmSnap = {
      exists: true,
      data: () => ({
        farmId: 'AP12',
        name: 'AP12 Farm',
        initialBirdCount: 2000,
        currentBirdCount: 1986,
      }),
    };

    let setFlockData: any = null;
    let setFarmData: any = null;
    let setBirdTxData: any = null;

    mockDb = {
      collection: vi.fn().mockImplementation((collName: string) => {
        if (collName === 'flocks') return mockFlocksQuery;
        if (collName === 'farms') {
          return {
            doc: vi.fn().mockReturnValue(mockFarmDocRef),
          };
        }
        return {};
      }),
      runTransaction: vi.fn().mockImplementation(async (callback: any) => {
        const mockTransaction = {
          get: vi.fn().mockResolvedValue(mockFarmSnap),
          set: vi.fn().mockImplementation((ref: any, data: any) => {
            if (ref === mockFlockDocRef) setFlockData = data;
            if (ref === mockFarmDocRef) setFarmData = data;
            if (ref === mockBirdTxRef) setBirdTxData = data;
          }),
        };
        await callback(mockTransaction);
      }),
    };

    (getFirestore as any).mockReturnValue(mockDb);

    await FlockController.createFlock(mockReq as Request, mockRes as Response);

    expect(resStatus).toHaveBeenCalledWith(201);
    expect(resJson).toHaveBeenCalledWith({
      id: 'flock-initial-123',
      message: 'Flock created successfully',
    });

    // 1. Initial flock must have initialBirds: 2000, currentBirds: 1986
    expect(setFlockData).toBeDefined();
    expect(setFlockData.flockName).toBe('Flock 1');
    expect(setFlockData.initialBirds).toBe(2000);
    expect(setFlockData.currentBirds).toBe(1986);
    expect(setFlockData.totalMortality).toBe(14); // 2000 - 1986
    expect(setFlockData.isInitialFlock).toBe(true);
    expect(setFlockData.batchNumber).toBe(1);

    // 2. Farm currentBirdCount MUST NOT be doubled or recalculated (stays 1986)
    expect(setFarmData).toBeDefined();
    expect(setFarmData.initialBirdCount).toBe(2000);
    expect(setFarmData.currentBirdCount).toBe(1986);
    expect(setFarmData.inventoryInitialized).toBe(true);

    // 3. Bird transaction audit
    expect(setBirdTxData).toBeDefined();
    expect(setBirdTxData.type).toBe('INITIAL');
    expect(setBirdTxData.count).toBe(2000);
  });

  it('should add new batch flock (Flock 2 with 300 birds) and increment farm currentBirdCount from 1986 to 2286', async () => {
    const farmId = 'AP12';
    mockReq = {
      body: {
        farmId,
        flockName: 'Flock 2',
        initialBirds: 300,
        startDate: '2026-03-24',
        breedType: 'BV-300',
        productionCurve: 'CF_STD',
      },
    };

    const mockFlockDocRef = { id: 'flock-batch2-456' };
    const mockBirdTxRef = { id: 'tx-456' };
    const mockFarmDocRef = {
      collection: vi.fn().mockReturnValue({
        doc: vi.fn().mockReturnValue(mockBirdTxRef),
      }),
    };

    // Existing flocks query returns 1 flock (Flock 1 already exists)
    const mockFlocksQuery = {
      where: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({
          size: 1,
          docs: [{ id: 'flock-1' }],
        }),
      }),
      doc: vi.fn().mockReturnValue(mockFlockDocRef),
    };

    const mockFarmSnap = {
      exists: true,
      data: () => ({
        farmId: 'AP12',
        name: 'AP12 Farm',
        initialBirdCount: 2000,
        currentBirdCount: 1986,
      }),
    };

    let setFlockData: any = null;
    let setFarmData: any = null;
    let setBirdTxData: any = null;

    mockDb = {
      collection: vi.fn().mockImplementation((collName: string) => {
        if (collName === 'flocks') return mockFlocksQuery;
        if (collName === 'farms') {
          return {
            doc: vi.fn().mockReturnValue(mockFarmDocRef),
          };
        }
        return {};
      }),
      runTransaction: vi.fn().mockImplementation(async (callback: any) => {
        const mockTransaction = {
          get: vi.fn().mockResolvedValue(mockFarmSnap),
          set: vi.fn().mockImplementation((ref: any, data: any) => {
            if (ref === mockFlockDocRef) setFlockData = data;
            if (ref === mockFarmDocRef) setFarmData = data;
            if (ref === mockBirdTxRef) setBirdTxData = data;
          }),
        };
        await callback(mockTransaction);
      }),
    };

    (getFirestore as any).mockReturnValue(mockDb);

    await FlockController.createFlock(mockReq as Request, mockRes as Response);

    expect(resStatus).toHaveBeenCalledWith(201);

    // 1. Flock 2 has initialBirds: 300, currentBirds: 300
    expect(setFlockData).toBeDefined();
    expect(setFlockData.flockName).toBe('Flock 2');
    expect(setFlockData.initialBirds).toBe(300);
    expect(setFlockData.currentBirds).toBe(300);
    expect(setFlockData.isInitialFlock).toBe(false);
    expect(setFlockData.batchNumber).toBe(2);

    // 2. Farm currentBirdCount increments by 300 (1986 + 300 = 2286)
    expect(setFarmData).toBeDefined();
    expect(setFarmData.currentBirdCount).toBe(2286);
    expect(setFarmData.initialBirdCount).toBe(2000);

    // 3. Bird transaction audit
    expect(setBirdTxData).toBeDefined();
    expect(setBirdTxData.type).toBe('ADDITION');
    expect(setBirdTxData.count).toBe(300);
  });
});
