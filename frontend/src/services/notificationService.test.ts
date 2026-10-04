import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateNotificationsForReport } from './notificationService';
import { db } from '../config/firebase';
import { getIstDate } from '../utils/dateUtils';

vi.mock('../config/firebase', () => {
  const setMock = vi.fn();
  const commitMock = vi.fn().mockResolvedValue(undefined);
  return {
    db: {
      batch: () => ({
        set: setMock,
        commit: commitMock,
      }),
      collection: (col: string) => ({
        doc: (id: string) => ({ id, col, set: setMock }),
      }),
    },
  };
});

describe('notificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates 100% mortality disaster notification', async () => {
    const report = {
      farmId: 'FARM_100',
      mortality: 1000,
    };
    const batchSet = db.batch().set;
    await generateNotificationsForReport(report, 'Test Farm', 1000);
    
    expect(batchSet).toHaveBeenCalled();
    const callArgs = (batchSet as any).mock.calls[0];
    expect(callArgs[0].id).toContain('mort_disaster_FARM_100');
    expect(callArgs[1].type).toBe('mortality_disaster');
    expect(callArgs[1].priority).toBe('CRITICAL');
  });

  it('generates ammonia high notification', async () => {
    const report = {
      farmId: 'FARM_AM',
      ammoniaPpm: 15,
      mortality: 0,
      eggsProduced: 1000,
      selectionEggs: 900
    };
    const batchSet = db.batch().set;
    await generateNotificationsForReport(report, 'Test Farm', 1000);
    
    const callArgs = (batchSet as any).mock.calls.find((call: any) => call[1].type === 'ammonia_high');
    expect(callArgs).toBeDefined();
    expect(callArgs[1].priority).toBe('WARNING');
    expect(callArgs[1].title).toBe('High Ammonia Level Detected');
  });


  it('generates feed stock depleted notification when stock is 0', async () => {
    const { evaluateFeedStockNotification } = await import('./notificationService');
    const batchSet = db.collection('notifications').doc('temp').set;
    
    await evaluateFeedStockNotification('FARM_FEED', 'Farm Feed', 0);
    
    const callArgs = (batchSet as any).mock.calls.find((call: any) => call[0].type === 'feed_stock_depleted');
    expect(callArgs).toBeDefined();
    expect(callArgs[0].priority).toBe('CRITICAL');
  });
});

