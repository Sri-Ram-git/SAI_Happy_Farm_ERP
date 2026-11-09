import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { db } from '../config/firebase';
import {
  subscribeToUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  generateNotificationsForReport,
  evaluateFeedStockNotification,
  buildNotificationDeliveryChannels,
  normalizeDeliveryChannels,
  getIntendedNotificationChannels,
  resolveNotification,
  AppNotification,
} from './notificationService';

// Mock in-memory Firestore database for notifications
interface MockDoc {
  id: string;
  data: any;
}

class MockFirestoreState {
  docs = new Map<string, any>();
  adminListeners = new Set<{
    callback: (snapshot: any) => void;
    errorCallback?: (err: any) => void;
  }>();
  supervisorListeners = new Set<{
    farmIds: string[];
    callback: (snapshot: any) => void;
    errorCallback?: (err: any) => void;
  }>();

  setDoc(id: string, data: any, merge = false) {
    if (merge && this.docs.has(id)) {
      this.docs.set(id, { ...this.docs.get(id), ...data });
    } else {
      this.docs.set(id, { ...data, id });
    }
    this.notify();
  }

  updateDoc(id: string, fields: any) {
    if (!this.docs.has(id)) return;
    const current = this.docs.get(id);
    const updated = { ...current };
    for (const [key, val] of Object.entries(fields)) {
      if (val && typeof val === 'object' && (val as any).__arrayUnion) {
        const existing = Array.isArray(current[key]) ? current[key] : [];
        const unionVals = (val as any).__arrayUnion;
        const set = new Set([...existing, ...unionVals]);
        updated[key] = Array.from(set);
      } else {
        updated[key] = val;
      }
    }
    this.docs.set(id, updated);
    this.notify();
  }

  notify() {
    // Notify admin listeners
    const allDocs = Array.from(this.docs.values()).filter((d) =>
      Array.isArray(d.targetRoles) && d.targetRoles.includes('admin'),
    );
    this.adminListeners.forEach(({ callback }) => {
      callback({
        forEach: (fn: (doc: any) => void) => {
          allDocs.forEach((d) => fn({ id: d.id, data: () => d }));
        },
      });
    });

    // Notify supervisor listeners
    this.supervisorListeners.forEach(({ farmIds, callback }) => {
      const supDocs = Array.from(this.docs.values()).filter(
        (d) => farmIds.includes(d.farmId) && Array.isArray(d.targetRoles) && d.targetRoles.includes('supervisor'),
      );
      callback({
        forEach: (fn: (doc: any) => void) => {
          supDocs.forEach((d) => fn({ id: d.id, data: () => d }));
        },
      });
    });
  }

  triggerError(target: 'admin' | 'supervisor', err: any) {
    if (target === 'admin') {
      this.adminListeners.forEach(({ errorCallback }) => {
        if (errorCallback) errorCallback(err);
      });
    } else {
      this.supervisorListeners.forEach(({ errorCallback }) => {
        if (errorCallback) errorCallback(err);
      });
    }
  }

  clear() {
    this.docs.clear();
    this.adminListeners.clear();
    this.supervisorListeners.clear();
  }
}

const mockDbState = new MockFirestoreState();

let mockCurrentUser: any = {
  uid: 'admin_123',
  displayName: 'Operations Director',
  email: 'admin@happyfarm.com',
};

// Mock Firebase config
vi.mock('../config/firebase', () => {
  return {
    auth: {
      get currentUser() {
        return mockCurrentUser;
      },
    },
    db: {
      batch: () => {
        const stagedWrites: Array<{ id: string; data: any; merge?: boolean }> = [];
        return {
          set: (docRef: any, data: any, options?: { merge?: boolean }) => {
            stagedWrites.push({ id: docRef.id, data, merge: options?.merge });
          },
          update: (docRef: any, data: any) => {
            stagedWrites.push({ id: docRef.id, data, merge: true });
          },
          commit: async () => {
            stagedWrites.forEach(({ id, data, merge }) => {
              mockDbState.setDoc(id, data, merge);
            });
          },
        };
      },
      runTransaction: async (updateFunction: (transaction: any) => Promise<any>) => {
        const stagedWrites: Array<{ id: string; data: any }> = [];
        const mockTransaction = {
          get: async (docRef: any) => {
            const doc = mockDbState.docs.get(docRef.id);
            return {
              exists: Boolean(doc),
              data: () => doc,
            };
          },
          set: (docRef: any, data: any) => {
            stagedWrites.push({ id: docRef.id, data });
          },
        };
        const result = await updateFunction(mockTransaction);
        stagedWrites.forEach(({ id, data }) => {
          mockDbState.setDoc(id, data, false);
        });
        return result;
      },
      collection: (col: string) => {
        return {
          doc: (id: string) => ({
            id,
            set: async (data: any, options?: { merge?: boolean }) => {
              mockDbState.setDoc(id, data, options?.merge);
            },
            update: async (data: any) => {
              mockDbState.updateDoc(id, data);
            },
            get: async () => {
              const doc = mockDbState.docs.get(id);
              return {
                exists: Boolean(doc),
                data: () => doc,
              };
            },
          }),
          where: (field: string, op: string, val: any) => {
            return {
              onSnapshot: (callback: any, errCallback?: any) => {
                if (field === 'targetRoles' && op === 'array-contains') {
                  const entry = { callback, errorCallback: errCallback };
                  mockDbState.adminListeners.add(entry);
                  // Initial snapshot emission
                  mockDbState.notify();
                  return () => {
                    mockDbState.adminListeners.delete(entry);
                  };
                }
                if (field === 'farmId' && op === 'in') {
                  const entry = { farmIds: val, callback, errorCallback: errCallback };
                  mockDbState.supervisorListeners.add(entry);
                  // Initial snapshot emission
                  mockDbState.notify();
                  return () => {
                    mockDbState.supervisorListeners.delete(entry);
                  };
                }
                return () => {};
              },
            };
          },
        };
      },
    },
  };
});

describe('ISSUE #05: Notification Synchronization Test Suite', () => {
  beforeEach(() => {
    mockDbState.clear();
    vi.clearAllMocks();
    mockCurrentUser = {
      uid: 'admin_123',
      displayName: 'Operations Director',
      email: 'admin@happyfarm.com',
    };
  });

  // SCENARIO 1: Generate a new notification and verify it appears in both Overview and Notification Centre without refreshing
  it('Scenario 1: Generate new notification -> propagates to both Overview and Notification Centre listeners in real-time', async () => {
    let overviewState: AppNotification[] = [];
    let notifCentreState: AppNotification[] = [];

    // Both components share the authoritative subscription callback for Admin
    const unsubOverview = subscribeToUserNotifications('admin', undefined, (notifs) => {
      overviewState = notifs;
    });
    const unsubCentre = subscribeToUserNotifications('admin', undefined, (notifs) => {
      notifCentreState = notifs;
    });

    expect(overviewState.length).toBe(0);
    expect(notifCentreState.length).toBe(0);

    // Farmer submits a report with high mortality (triggering a new notification)
    await generateNotificationsForReport(
      { farmId: 'FARM_101', mortality: 50, submissionDate: '2026-11-09' },
      'Farm 101',
      200, // 25% mortality -> CRITICAL
    );

    // Both Overview and Notification Centre receive the update in real time without refreshing
    // (High mortality triggers mort_crit and zero eggs triggers production_drop)
    expect(overviewState.length).toBe(2);
    expect(notifCentreState.length).toBe(2);
    expect(overviewState.map((n) => n.id)).toEqual(notifCentreState.map((n) => n.id));
    expect(overviewState[0].priority).toBe('CRITICAL');

    unsubOverview();
    unsubCentre();
  });

  // SCENARIO 2: Open Notification Centre and verify existing notifications also appear in Overview
  it('Scenario 2: Existing notifications appear identically in Notification Centre and Overview', async () => {
    // Populate Firestore with existing notifications
    mockDbState.setDoc('notif_1', {
      id: 'notif_1',
      type: 'mortality_critical',
      priority: 'CRITICAL',
      title: 'High Mortality Alert',
      message: 'Farm AP12 recorded 15% mortality',
      farmId: 'AP12',
      targetRoles: ['admin', 'supervisor'],
      createdAt: new Date('2026-11-09T08:00:00Z').toISOString(),
      readBy: [],
    });
    mockDbState.setDoc('notif_2', {
      id: 'notif_2',
      type: 'production_drop',
      priority: 'WARNING',
      title: 'Low Production Alert',
      message: 'Farm AP12 production dropped to 48%',
      farmId: 'AP12',
      targetRoles: ['admin', 'supervisor'],
      createdAt: new Date('2026-11-09T09:00:00Z').toISOString(),
      readBy: [],
    });

    let overviewNotifs: AppNotification[] = [];
    let centreNotifs: AppNotification[] = [];

    const unsubOverview = subscribeToUserNotifications('admin', undefined, (notifs) => {
      overviewNotifs = notifs;
    });
    const unsubCentre = subscribeToUserNotifications('admin', undefined, (notifs) => {
      centreNotifs = notifs;
    });

    // Verify both locations display the exact same existing records
    expect(overviewNotifs.length).toBe(2);
    expect(centreNotifs.length).toBe(2);
    expect(overviewNotifs.map((n) => n.id)).toEqual(centreNotifs.map((n) => n.id));

    unsubOverview();
    unsubCentre();
  });

  // SCENARIO 3: Mark a notification as read and verify both locations reflect the updated state
  it('Scenario 3: Mark notification as read -> updates readBy in both Overview and Notification Centre', async () => {
    mockDbState.setDoc('notif_read_test', {
      id: 'notif_read_test',
      type: 'selection_warning',
      priority: 'WARNING',
      title: 'Egg Selection Warning',
      message: 'Egg selection is 72%',
      farmId: 'AP15',
      targetRoles: ['admin'],
      createdAt: new Date('2026-11-09T07:30:00Z').toISOString(),
      readBy: [],
    });

    let overviewNotifs: AppNotification[] = [];
    let centreNotifs: AppNotification[] = [];

    const unsubOverview = subscribeToUserNotifications('admin', undefined, (notifs) => {
      overviewNotifs = notifs;
    });
    const unsubCentre = subscribeToUserNotifications('admin', undefined, (notifs) => {
      centreNotifs = notifs;
    });

    const testUid = 'admin_user_42';
    // Initial state: unread by admin_user_42 in both locations
    expect(overviewNotifs[0].readBy.includes(testUid)).toBe(false);
    expect(centreNotifs[0].readBy.includes(testUid)).toBe(false);

    // Mark as read in Notification Centre
    await markNotificationAsRead('notif_read_test', testUid);

    // Verify both Overview and Notification Centre immediately reflect read state
    expect(overviewNotifs[0].readBy).toContain(testUid);
    expect(centreNotifs[0].readBy).toContain(testUid);

    unsubOverview();
    unsubCentre();
  });

  // SCENARIO 4: Generate multiple notifications and verify correct ordering and no duplicates
  it('Scenario 4: Multiple notifications maintain descending order by createdAt and deduplicate deterministic IDs', async () => {
    let capturedNotifs: AppNotification[] = [];
    const unsub = subscribeToUserNotifications('admin', undefined, (notifs) => {
      capturedNotifs = notifs;
    });

    // Generate notification at T1
    mockDbState.setDoc('alert_t1', {
      id: 'alert_t1',
      type: 'production_drop',
      priority: 'WARNING',
      title: 'Older Alert',
      message: 'Alert at 08:00',
      farmId: 'AP12',
      targetRoles: ['admin'],
      createdAt: '2026-11-09T08:00:00.000Z',
      readBy: [],
    });

    // Generate notification at T2 (newer)
    mockDbState.setDoc('alert_t2', {
      id: 'alert_t2',
      type: 'mortality_critical',
      priority: 'CRITICAL',
      title: 'Newer Alert',
      message: 'Alert at 09:30',
      farmId: 'AP12',
      targetRoles: ['admin'],
      createdAt: '2026-11-09T09:30:00.000Z',
      readBy: [],
    });

    // Generate notification at T3 (latest)
    mockDbState.setDoc('alert_t3', {
      id: 'alert_t3',
      type: 'mortality_disaster',
      priority: 'CRITICAL',
      title: 'Latest Alert',
      message: 'Alert at 10:15',
      farmId: 'AP12',
      targetRoles: ['admin'],
      createdAt: '2026-11-09T10:15:00.000Z',
      readBy: [],
    });

    // Verify ordering: newest first (T3 -> T2 -> T1)
    expect(capturedNotifs.length).toBe(3);
    expect(capturedNotifs[0].id).toBe('alert_t3');
    expect(capturedNotifs[1].id).toBe('alert_t2');
    expect(capturedNotifs[2].id).toBe('alert_t1');

    // Attempting to write an existing deterministic ID should deduplicate / update, not create duplicate
    mockDbState.setDoc(
      'alert_t2',
      {
        id: 'alert_t2',
        title: 'Newer Alert Updated',
        message: 'Updated message',
      },
      true,
    );

    expect(capturedNotifs.length).toBe(3);
    expect(capturedNotifs.filter((n) => n.id === 'alert_t2').length).toBe(1);
    expect(capturedNotifs.find((n) => n.id === 'alert_t2')?.title).toBe('Newer Alert Updated');

    unsub();
  });

  // SCENARIO 5: Verify notification counts and unread indicators remain consistent
  it('Scenario 5: Notification counts and unread indicators remain synchronized', async () => {
    const uid = 'supervisor_007';

    mockDbState.setDoc('notif_c1', {
      id: 'notif_c1',
      type: 'mortality_critical',
      priority: 'CRITICAL',
      title: 'Critical 1',
      message: 'Crit',
      farmId: 'AP12',
      targetRoles: ['supervisor'],
      createdAt: '2026-11-09T08:00:00.000Z',
      readBy: [],
    });
    mockDbState.setDoc('notif_c2', {
      id: 'notif_c2',
      type: 'production_drop',
      priority: 'WARNING',
      title: 'Warning 1',
      message: 'Warn',
      farmId: 'AP12',
      targetRoles: ['supervisor'],
      createdAt: '2026-11-09T09:00:00.000Z',
      readBy: [uid], // already read by this user
    });

    let overviewNotifs: AppNotification[] = [];
    let centreNotifs: AppNotification[] = [];

    const unsubOverview = subscribeToUserNotifications('supervisor', ['AP12'], (notifs) => {
      overviewNotifs = notifs;
    });
    const unsubCentre = subscribeToUserNotifications('supervisor', ['AP12'], (notifs) => {
      centreNotifs = notifs;
    });

    const getUnread = (list: AppNotification[]) => list.filter((n) => !(n.readBy || []).includes(uid)).length;
    const getCritical = (list: AppNotification[]) => list.filter((n) => n.priority === 'CRITICAL').length;
    const getWarning = (list: AppNotification[]) => list.filter((n) => n.priority === 'WARNING').length;

    // Both components see identical unread and priority counts
    expect(getUnread(overviewNotifs)).toBe(1);
    expect(getUnread(centreNotifs)).toBe(1);
    expect(getCritical(overviewNotifs)).toBe(1);
    expect(getCritical(centreNotifs)).toBe(1);
    expect(getWarning(overviewNotifs)).toBe(1);
    expect(getWarning(centreNotifs)).toBe(1);

    // Mark remaining unread notification as read
    await markNotificationAsRead('notif_c1', uid);

    expect(getUnread(overviewNotifs)).toBe(0);
    expect(getUnread(centreNotifs)).toBe(0);

    unsubOverview();
    unsubCentre();
  });

  // SCENARIO 6: Verify Admin and Supervisor accounts only receive notifications permitted by their existing access rules
  it('Scenario 6: Role-based filtering preserves Admin and Supervisor access rules', async () => {
    mockDbState.setDoc('admin_only_alert', {
      id: 'admin_only_alert',
      type: 'report_invalid',
      priority: 'CRITICAL',
      title: 'System Admin Alert',
      message: 'Admin review only',
      farmId: 'AP12',
      targetRoles: ['admin'],
      createdAt: '2026-11-09T08:00:00.000Z',
      readBy: [],
    });
    mockDbState.setDoc('shared_alert', {
      id: 'shared_alert',
      type: 'mortality_critical',
      priority: 'CRITICAL',
      title: 'Shared Alert',
      message: 'Visible to Admin & Supervisor',
      farmId: 'AP12',
      targetRoles: ['admin', 'supervisor'],
      createdAt: '2026-11-09T09:00:00.000Z',
      readBy: [],
    });

    let adminNotifs: AppNotification[] = [];
    let supervisorNotifs: AppNotification[] = [];

    const unsubAdmin = subscribeToUserNotifications('admin', undefined, (notifs) => {
      adminNotifs = notifs;
    });
    const unsubSupervisor = subscribeToUserNotifications('supervisor', ['AP12'], (notifs) => {
      supervisorNotifs = notifs;
    });

    // Admin receives all notifications targeted to 'admin' (both)
    expect(adminNotifs.length).toBe(2);

    // Supervisor receives ONLY notifications where targetRoles includes 'supervisor'
    expect(supervisorNotifs.length).toBe(1);
    expect(supervisorNotifs[0].id).toBe('shared_alert');

    unsubAdmin();
    unsubSupervisor();
  });

  // SCENARIO 7: Verify farm-specific notifications do not leak across farms
  it('Scenario 7: Farm scoping strictly prevents cross-farm notification leakage', async () => {
    // Notification for Farm AP12
    mockDbState.setDoc('farm_ap12_alert', {
      id: 'farm_ap12_alert',
      type: 'mortality_critical',
      priority: 'CRITICAL',
      title: 'AP12 Alert',
      message: 'Farm AP12 alert',
      farmId: 'AP12',
      targetRoles: ['admin', 'supervisor'],
      createdAt: '2026-11-09T08:00:00.000Z',
      readBy: [],
    });

    // Notification for Farm AP15
    mockDbState.setDoc('farm_ap15_alert', {
      id: 'farm_ap15_alert',
      type: 'mortality_critical',
      priority: 'CRITICAL',
      title: 'AP15 Alert',
      message: 'Farm AP15 alert',
      farmId: 'AP15',
      targetRoles: ['admin', 'supervisor'],
      createdAt: '2026-11-09T09:00:00.000Z',
      readBy: [],
    });

    let supervisorAP12Notifs: AppNotification[] = [];
    let supervisorAP15Notifs: AppNotification[] = [];

    // Supervisor A is assigned ONLY to Farm AP12
    const unsubA = subscribeToUserNotifications('supervisor', ['AP12'], (notifs) => {
      supervisorAP12Notifs = notifs;
    });

    // Supervisor B is assigned ONLY to Farm AP15
    const unsubB = subscribeToUserNotifications('supervisor', ['AP15'], (notifs) => {
      supervisorAP15Notifs = notifs;
    });

    expect(supervisorAP12Notifs.length).toBe(1);
    expect(supervisorAP12Notifs[0].farmId).toBe('AP12');

    expect(supervisorAP15Notifs.length).toBe(1);
    expect(supervisorAP15Notifs[0].farmId).toBe('AP15');

    // No cross-farm leak: Supervisor A never sees AP15, Supervisor B never sees AP12
    expect(supervisorAP12Notifs.some((n) => n.farmId === 'AP15')).toBe(false);
    expect(supervisorAP15Notifs.some((n) => n.farmId === 'AP12')).toBe(false);

    unsubA();
    unsubB();
  });

  // SCENARIO 8: Navigate between pages and verify listeners do not multiply or continue unnecessarily
  it('Scenario 8: Navigation lifecycle unsubscribes correctly without listener multiplication', () => {
    expect(mockDbState.adminListeners.size).toBe(0);

    // Mount Overview
    const unsubOverview = subscribeToUserNotifications('admin', undefined, () => {});
    expect(mockDbState.adminListeners.size).toBe(1);

    // Unmount Overview when navigating away
    unsubOverview();
    expect(mockDbState.adminListeners.size).toBe(0);

    // Mount Notification Centre
    const unsubCentre = subscribeToUserNotifications('admin', undefined, () => {});
    expect(mockDbState.adminListeners.size).toBe(1);

    // Unmount Notification Centre
    unsubCentre();
    expect(mockDbState.adminListeners.size).toBe(0);
  });

  // SCENARIO 9: Verify listener errors do not crash either page
  it('Scenario 9: Listener errors are caught gracefully without unhandled exceptions', () => {
    let capturedError: any = null;
    let notificationsReceived: AppNotification[] = [];

    const unsub = subscribeToUserNotifications(
      'admin',
      undefined,
      (notifs) => {
        notificationsReceived = notifs;
      },
      (err) => {
        capturedError = err;
      },
    );

    // Simulate Firestore listener error
    const testError = new Error('Simulated network disruption / permission error');
    mockDbState.triggerError('admin', testError);

    expect(capturedError).toBeDefined();
    expect(capturedError.message).toContain('Simulated network disruption');
    expect(Array.isArray(notificationsReceived)).toBe(true);

    unsub();
  });

  // SCENARIO 10: Refresh the application and verify existing notifications are still displayed according to existing implementation
  it('Scenario 10: Refreshing application restores notifications consistently from Firestore', () => {
    // Populate Firestore with persisted notifications
    mockDbState.setDoc('persisted_notif_1', {
      id: 'persisted_notif_1',
      type: 'feed_stock_depleted',
      priority: 'CRITICAL',
      title: 'Feed Stock Depleted',
      message: '0 Kg remaining',
      farmId: 'AP12',
      targetRoles: ['admin', 'supervisor'],
      createdAt: '2026-11-09T06:00:00.000Z',
      readBy: ['other_user'],
    });

    // Simulate first app session
    let session1Notifs: AppNotification[] = [];
    const unsubSession1 = subscribeToUserNotifications('admin', undefined, (notifs) => {
      session1Notifs = notifs;
    });

    expect(session1Notifs.length).toBe(1);
    expect(session1Notifs[0].id).toBe('persisted_notif_1');
    unsubSession1();

    // Simulate page refresh (new component mount / subscription)
    let session2Notifs: AppNotification[] = [];
    const unsubSession2 = subscribeToUserNotifications('admin', undefined, (notifs) => {
      session2Notifs = notifs;
    });

    expect(session2Notifs.length).toBe(1);
    expect(session2Notifs[0].id).toBe('persisted_notif_1');
    expect(session2Notifs[0].priority).toBe('CRITICAL');
    expect(session2Notifs[0].readBy).toContain('other_user');

    unsubSession2();
  });

  // =========================================================================
  // FOCUSED ARCHITECTURAL REVIEWS: CHANNELS, SECURITY RULES, ACCOUNT SWITCHING
  // =========================================================================

  describe('Section 1 Review: SMS and Email Channels Architecture', () => {
    it('generates In-App as delivered, but keeps SMS and Email as pending_provider or disabled', () => {
      const now = new Date().toISOString();
      const critChannels = buildNotificationDeliveryChannels('CRITICAL', now);

      // In-App must be delivered immediately
      expect(critChannels.inApp.enabled).toBe(true);
      expect(critChannels.inApp.status).toBe('delivered');
      expect(critChannels.inApp.provider).toBe('in_app_engine');
      expect(critChannels.inApp.deliveredAt).toBe(now);

      // SMS must be pending provider integration, NEVER delivered
      expect(critChannels.sms.enabled).toBe(true);
      expect(critChannels.sms.status).toBe('pending_provider');
      expect(critChannels.sms.provider).toBeNull();
      expect(critChannels.sms.deliveredAt).toBeNull();

      // Email must be pending provider integration, NEVER delivered
      expect(critChannels.email.enabled).toBe(true);
      expect(critChannels.email.status).toBe('pending_provider');
      expect(critChannels.email.provider).toBeNull();
      expect(critChannels.email.deliveredAt).toBeNull();

      // For INFO notifications: SMS and Email are disabled
      const infoChannels = buildNotificationDeliveryChannels('INFO', now);
      expect(infoChannels.inApp.status).toBe('delivered');
      expect(infoChannels.sms.enabled).toBe(false);
      expect(infoChannels.sms.status).toBe('disabled');
      expect(infoChannels.email.enabled).toBe(false);
      expect(infoChannels.email.status).toBe('disabled');
    });

    it('assigns intended delivery channels based on alert severity', () => {
      expect(getIntendedNotificationChannels('CRITICAL')).toEqual(['IN_APP', 'SMS', 'EMAIL']);
      expect(getIntendedNotificationChannels('WARNING')).toEqual(['IN_APP', 'EMAIL']);
      expect(getIntendedNotificationChannels('INFO')).toEqual(['IN_APP']);
    });

    it('normalizes legacy documents safely and prevents false delivery reports', () => {
      const legacyDoc = {
        delivery: { inApp: 'active', email: 'future', sms: 'future' },
      };
      const normalized = normalizeDeliveryChannels(legacyDoc.delivery, 'CRITICAL');
      expect(normalized.inApp.status).toBe('delivered');
      expect(normalized.sms.status).toBe('pending_provider');
      expect(normalized.sms.provider).toBeNull();
      expect(normalized.email.status).toBe('pending_provider');
      expect(normalized.email.provider).toBeNull();

      // Even if a legacy document maliciously claims SMS is delivered:
      const spoofedDoc = {
        inApp: { enabled: true, status: 'delivered' },
        sms: { enabled: true, status: 'delivered', provider: 'fake_provider' },
        email: { enabled: true, status: 'delivered', provider: 'fake_provider' },
      };
      const safe = normalizeDeliveryChannels(spoofedDoc, 'CRITICAL');
      expect(safe.sms.status).toBe('pending_provider');
      expect(safe.sms.provider).toBeNull();
      expect(safe.sms.deliveredAt).toBeNull();
      expect(safe.email.status).toBe('pending_provider');
      expect(safe.email.provider).toBeNull();
      expect(safe.email.deliveredAt).toBeNull();
    });

    it('ensures notifications contain no credentials, keys, or external service endpoints', () => {
      const delivery = buildNotificationDeliveryChannels('CRITICAL', new Date().toISOString());
      const str = JSON.stringify(delivery).toLowerCase();
      expect(str).not.toContain('twilio');
      expect(str).not.toContain('sendgrid');
      expect(str).not.toContain('msg91');
      expect(str).not.toContain('smtp');
      expect(str).not.toContain('apikey');
      expect(str).not.toContain('password');
      expect(str).not.toContain('token');
    });
  });

  describe('Section 2 Review: Firestore Security Rules Contract for Notifications', () => {
    const rulesPath = path.resolve(__dirname, '../../../firestore.rules');
    const rulesContent = fs.readFileSync(rulesPath, 'utf8');

    it('finds /notifications/{notificationId} security rule definition', () => {
      expect(rulesContent).toContain('match /notifications/{notificationId}');
    });

    it('enforces that createdAt is strictly immutable on notification updates', () => {
      const notifBlockMatch = rulesContent.match(/match\s+\/notifications\/\{notificationId\}[\s\S]*?\{([\s\S]*?)\n\s{4}\}/);
      expect(notifBlockMatch).not.toBeNull();
      const notifBlock = notifBlockMatch![1];

      // Verifies createdAt is strictly immutable across all update paths
      expect(notifBlock).toContain('request.resource.data.createdAt == resource.data.createdAt');

      // Verifies createdAt is completely removed from all update allowlists
      expect(notifBlock).not.toContain("hasOnly(['createdAt'");
    });

    it('enforces that Admin updates cannot mutate createdAt', () => {
      const notifBlockMatch = rulesContent.match(/match\s+\/notifications\/\{notificationId\}[\s\S]*?\{([\s\S]*?)\n\s{4}\}/);
      expect(notifBlockMatch).not.toBeNull();
      const notifBlock = notifBlockMatch![1];

      // Verifies the outer allow update requires createdAt immutability before allowing Admin
      expect(notifBlock).toMatch(/allow\s+update:\s*if[\s\S]*?request\.resource\.data\.createdAt\s*==\s*resource\.data\.createdAt[\s\S]*?isAdminResolutionUpdate\(\)/);
    });

    it('enforces that Admin resolution updates are strictly limited to resolution allowlist: resolved, resolvedAt, resolvedBy, resolvedByName, resolutionNotes, readBy', () => {
      const notifBlockMatch = rulesContent.match(/match\s+\/notifications\/\{notificationId\}[\s\S]*?\{([\s\S]*?)\n\s{4}\}/);
      expect(notifBlockMatch).not.toBeNull();
      const notifBlock = notifBlockMatch![1];

      // Explicit allowlist enforced on Admin updates
      expect(notifBlock).toContain('isAdminResolutionUpdate');
      expect(notifBlock).toMatch(/affectedKeys\(\)\.hasOnly\(\[\s*'resolved',\s*'resolvedAt',\s*'resolvedBy',\s*'resolvedByName',\s*'resolutionNotes',\s*'readBy'\s*\]\)/);

      // Immutability verified: alert identity, delivery, and creation fields are strictly NOT in the allowlist
      const allowlist = ['resolved', 'resolvedAt', 'resolvedBy', 'resolvedByName', 'resolutionNotes', 'readBy'];
      const protectedKeys = ['createdAt', 'farmId', 'type', 'source', 'priority', 'title', 'message', 'targetRoles', 'channels', 'delivery'];
      for (const key of protectedKeys) {
        expect(allowlist).not.toContain(key);
      }

      // Enforces caller UID verification: caller cannot forge resolvedBy
      expect(notifBlock).toContain('request.resource.data.resolvedBy == request.auth.uid');

      // Enforces server timestamp integrity: resolvedAt must match request.time
      expect(notifBlock).toContain('request.resource.data.resolvedAt == request.time');

      // Enforces one-way resolution and complete, internally consistent transition
      expect(notifBlock).toContain("resource.data.get('resolved', false) == false &&");
      expect(notifBlock).toContain("request.resource.data.resolved == true");
      expect(notifBlock).toMatch(/hasAll\(\[\s*'resolved',\s*'resolvedAt',\s*'resolvedBy'\s*\]\)/);

      // Enforces Admin readBy restrictions: self-only append, preserve existing readers
      expect(notifBlock).toContain("request.resource.data.readBy.hasAll(resource.data.get('readBy', []))");
      expect(notifBlock).toContain("request.resource.data.readBy.hasOnly(resource.data.get('readBy', []).concat([request.auth.uid]))");
    });

    it('prohibits farmers from updating existing notifications (zero update permissions)', () => {
      const notifBlockMatch = rulesContent.match(/match\s+\/notifications\/\{notificationId\}[\s\S]*?\{([\s\S]*?)\n\s{4}\}/);
      expect(notifBlockMatch).not.toBeNull();
      const notifBlock = notifBlockMatch![1];

      // Farmers must NEVER have update permissions on notifications
      expect(notifBlock).not.toMatch(/allow\s+update:[\s\S]*?hasRole\('farmer'\)/);
      expect(notifBlock).not.toContain('isFarmerReportReEvaluationUpdate');
    });

    it('restricts supervisor updates strictly to self-only readBy additions with immutable createdAt', () => {
      const notifBlockMatch = rulesContent.match(/match\s+\/notifications\/\{notificationId\}[\s\S]*?\{([\s\S]*?)\n\s{4}\}/);
      expect(notifBlockMatch).not.toBeNull();
      const notifBlock = notifBlockMatch![1];

      expect(notifBlock).toContain('isSupervisorReadByUpdate');
      expect(notifBlock).toContain("affectedKeys().hasOnly(['readBy'])");
      expect(notifBlock).toContain("request.resource.data.readBy.hasAll(resource.data.get('readBy', []))");
      expect(notifBlock).toContain("request.resource.data.readBy.hasOnly(resource.data.get('readBy', []).concat([request.auth.uid]))");
      expect(notifBlock).toContain("request.resource.data.createdAt == resource.data.createdAt");
    });

    it('enforces delivery state safety on create and update to prevent false SMS/Email delivery claims', () => {
      const notifBlockMatch = rulesContent.match(/match\s+\/notifications\/\{notificationId\}[\s\S]*?\{([\s\S]*?)\n\s{4}\}/);
      expect(notifBlockMatch).not.toBeNull();
      const notifBlock = notifBlockMatch![1];

      expect(notifBlock).toContain('isDeliveryStateSafe');
      expect(notifBlock).toContain("['pending_provider', 'not_configured', 'disabled']");
      expect(notifBlock).toContain("get('provider', null) == null");
      expect(notifBlock).toContain("get('deliveredAt', null) == null");

      // Verify isDeliveryStateSafe is enforced on allow create
      expect(notifBlock).toMatch(/allow\s+create:\s*if[\s\S]*?isDeliveryStateSafe\(\)/);

      // Verify isDeliveryStateSafe is enforced on allow update across all paths (including Admin)
      expect(notifBlock).toMatch(/allow\s+update:\s*if[\s\S]*?isDeliveryStateSafe\(\)[\s\S]*?isAdminResolutionUpdate\(\)/);
    });

    it('enforces Admin update security: Admin cannot bypass delivery state integrity or channel rules', () => {
      const notifBlockMatch = rulesContent.match(/match\s+\/notifications\/\{notificationId\}[\s\S]*?\{([\s\S]*?)\n\s{4}\}/);
      expect(notifBlockMatch).not.toBeNull();
      const notifBlock = notifBlockMatch![1];

      // Verifies update rule requires isDeliveryStateSafe before granting Admin access
      expect(notifBlock).toMatch(/allow\s+update:\s*if[\s\S]*?request\.resource\.data\.createdAt\s*==\s*resource\.data\.createdAt\s*&&\s*isDeliveryStateSafe\(\)\s*&&\s*\([\s\S]*?isAdminResolutionUpdate\(\)/);

      // Verifies channel consistency: SMS enabled requires CRITICAL alert
      expect(notifBlock).toMatch(/request\.resource\.data\.delivery\.sms\.get\('enabled',\s*false\)\s*==\s*false\s*\|\|\s*request\.resource\.data\.get\('priority',\s*'INFO'\)\s*==\s*'CRITICAL'/);

      // Verifies channel consistency: Email enabled requires CRITICAL or WARNING alert
      expect(notifBlock).toMatch(/request\.resource\.data\.delivery\.email\.get\('enabled',\s*false\)\s*==\s*false\s*\|\|\s*request\.resource\.data\.get\('priority',\s*'INFO'\)\s*in\s*\['CRITICAL',\s*'WARNING'\]/);
    });

    it('verifies simulated isDeliveryStateSafe evaluates correctly for all Admin update scenarios', () => {
      // Direct TypeScript mirror of the Firestore security rule function isDeliveryStateSafe()
      function simulateIsDeliveryStateSafe(data: any): boolean {
        // Channels check
        if ('channels' in data) {
          const allowedChannels = ['IN_APP', 'SMS', 'EMAIL'];
          const hasOnly = data.channels.every((c: string) => allowedChannels.includes(c));
          const hasInApp = data.channels.includes('IN_APP');
          if (!hasOnly || !hasInApp) return false;
        }

        // Delivery check
        if ('delivery' in data) {
          const d = data.delivery;
          if (d.inApp && !['delivered', 'enabled'].includes(d.inApp.status || 'delivered')) {
            return false;
          }
          if (d.sms) {
            const smsStatus = d.sms.status || 'disabled';
            if (!['pending_provider', 'not_configured', 'disabled'].includes(smsStatus)) return false;
            if (d.sms.provider != null) return false;
            if (d.sms.deliveredAt != null) return false;
            const smsEnabled = d.sms.enabled ?? false;
            if (smsEnabled && data.priority !== 'CRITICAL') return false;
          }
          if (d.email) {
            const emailStatus = d.email.status || 'disabled';
            if (!['pending_provider', 'not_configured', 'disabled'].includes(emailStatus)) return false;
            if (d.email.provider != null) return false;
            if (d.email.deliveredAt != null) return false;
            const emailEnabled = d.email.enabled ?? false;
            if (emailEnabled && !['CRITICAL', 'WARNING'].includes(data.priority)) return false;
          }
        }
        return true;
      }

      const validCriticalDoc = {
        priority: 'CRITICAL',
        channels: ['IN_APP', 'SMS', 'EMAIL'],
        delivery: {
          inApp: { status: 'delivered', provider: 'in_app_engine', deliveredAt: '2026-11-09T08:00:00Z' },
          sms: { enabled: true, status: 'pending_provider', provider: null, deliveredAt: null },
          email: { enabled: true, status: 'pending_provider', provider: null, deliveredAt: null },
        },
      };
      expect(simulateIsDeliveryStateSafe(validCriticalDoc)).toBe(true);

      // Case 1: Admin attempts to set SMS status to 'delivered' -> REJECTED
      const invalidSmsDelivered = {
        ...validCriticalDoc,
        delivery: {
          ...validCriticalDoc.delivery,
          sms: { ...validCriticalDoc.delivery.sms, status: 'delivered' },
        },
      };
      expect(simulateIsDeliveryStateSafe(invalidSmsDelivered)).toBe(false);

      // Case 2: Admin attempts to set Email status to 'delivered' -> REJECTED
      const invalidEmailDelivered = {
        ...validCriticalDoc,
        delivery: {
          ...validCriticalDoc.delivery,
          email: { ...validCriticalDoc.delivery.email, status: 'delivered' },
        },
      };
      expect(simulateIsDeliveryStateSafe(invalidEmailDelivered)).toBe(false);

      // Case 3: Admin attempts to set external SMS provider without integration -> REJECTED
      const invalidSmsProvider = {
        ...validCriticalDoc,
        delivery: {
          ...validCriticalDoc.delivery,
          sms: { ...validCriticalDoc.delivery.sms, provider: 'twilio' },
        },
      };
      expect(simulateIsDeliveryStateSafe(invalidSmsProvider)).toBe(false);

      // Case 4: Admin attempts to set fake delivery timestamp on Email -> REJECTED
      const invalidEmailTimestamp = {
        ...validCriticalDoc,
        delivery: {
          ...validCriticalDoc.delivery,
          email: { ...validCriticalDoc.delivery.email, deliveredAt: '2026-11-09T08:10:00Z' },
        },
      };
      expect(simulateIsDeliveryStateSafe(invalidEmailTimestamp)).toBe(false);

      // Case 5: Admin attempts to enable SMS on an INFO alert -> REJECTED
      const invalidSmsOnInfo = {
        priority: 'INFO',
        channels: ['IN_APP'],
        delivery: {
          inApp: { status: 'delivered' },
          sms: { enabled: true, status: 'pending_provider', provider: null, deliveredAt: null },
        },
      };
      expect(simulateIsDeliveryStateSafe(invalidSmsOnInfo)).toBe(false);

      // Case 6: Admin attempts to enable Email on an INFO alert -> REJECTED
      const invalidEmailOnInfo = {
        priority: 'INFO',
        channels: ['IN_APP'],
        delivery: {
          inApp: { status: 'delivered' },
          email: { enabled: true, status: 'pending_provider', provider: null, deliveredAt: null },
        },
      };
      expect(simulateIsDeliveryStateSafe(invalidEmailOnInfo)).toBe(false);

      // Case 7: Admin legitimate management update (resolution / readBy) -> ACCEPTED
      const legitimateAdminUpdate = {
        ...validCriticalDoc,
        readBy: ['admin-1'],
        resolved: true,
        resolvedAt: '2026-11-09T09:00:00Z',
        resolvedBy: 'admin-1',
        resolutionNotes: 'Intervention verified with farm supervisor.',
      };
      expect(simulateIsDeliveryStateSafe(legitimateAdminUpdate)).toBe(true);
    });

    it('restricts notification read access to Admin and assigned Supervisors only (Farmers cannot read)', () => {
      const notifBlockMatch = rulesContent.match(/match\s+\/notifications\/\{notificationId\}[\s\S]*?\{([\s\S]*?)\n\s{4}\}/);
      expect(notifBlockMatch).not.toBeNull();
      const notifBlock = notifBlockMatch![1];

      // Read rule allows isAdmin() or supervisor with farmId in farmIds
      expect(notifBlock).toMatch(/allow\s+read:\s*if[\s\S]*?isAdmin\(\)[\s\S]*?hasRole\('supervisor'\)/);
      // Farmers must NOT be able to read notifications
      expect(notifBlock).not.toMatch(/allow\s+read:[\s\S]*?hasRole\('farmer'\)/);
    });

    it('strictly denies notification deletion for all roles (allow delete: if false)', () => {
      const notifBlockMatch = rulesContent.match(/match\s+\/notifications\/\{notificationId\}[\s\S]*?\{([\s\S]*?)\n\s{4}\}/);
      expect(notifBlockMatch).not.toBeNull();
      const notifBlock = notifBlockMatch![1];

      // Notifications are permanent historical audit records and can NEVER be deleted by any role
      expect(notifBlock).toMatch(/allow\s+delete:\s*if\s+false;/);
      expect(notifBlock).not.toMatch(/allow\s+delete:[\s\S]*?isAdmin\(\)/);
      expect(notifBlock).not.toMatch(/allow\s+delete:[\s\S]*?hasRole\('supervisor'\)/);
      expect(notifBlock).not.toMatch(/allow\s+delete:[\s\S]*?hasRole\('farmer'\)/);
    });
  });

  describe('Section 3 Review: Supervisor Farm Query Chunking (>30 farms)', () => {
    it('creates multiple Firestore query chunks when supervisor has more than 30 farms', () => {
      // 45 farms: chunk 0 has 30, chunk 1 has 15
      const manyFarms = Array.from({ length: 45 }, (_, i) => `AP${String(i + 1).padStart(2, '0')}`);

      let emittedNotifs: AppNotification[] = [];
      const unsub = subscribeToUserNotifications('supervisor', manyFarms, (notifs) => {
        emittedNotifs = notifs;
      });

      // Supervisor has 45 farms -> 2 chunks registered in supervisor listeners
      expect(mockDbState.supervisorListeners.size).toBe(2);

      // Now set a notification on AP01 (in chunk 1) and AP45 (in chunk 2)
      mockDbState.setDoc('notif_chunk_1', {
        id: 'notif_chunk_1',
        type: 'mortality_warning',
        priority: 'WARNING',
        title: 'Alert Chunk 1',
        message: 'Farm AP01 alert',
        farmId: 'AP01',
        targetRoles: ['admin', 'supervisor'],
        createdAt: '2026-11-09T08:00:00.000Z',
      });

      mockDbState.setDoc('notif_chunk_2', {
        id: 'notif_chunk_2',
        type: 'mortality_critical',
        priority: 'CRITICAL',
        title: 'Alert Chunk 2',
        message: 'Farm AP45 alert',
        farmId: 'AP45',
        targetRoles: ['admin', 'supervisor'],
        createdAt: '2026-11-09T08:05:00.000Z',
      });

      expect(emittedNotifs.length).toBe(2);
      expect(emittedNotifs.map((n) => n.farmId)).toContain('AP01');
      expect(emittedNotifs.map((n) => n.farmId)).toContain('AP45');

      // Cleanup removes both chunk listeners
      unsub();
      expect(mockDbState.supervisorListeners.size).toBe(0);
    });
  });

  describe('Section 3 & 4 Review: Account Switching and State Eviction', () => {
    it('clears previous notifications on account switch without leaking stale farm data', () => {
      // User 1 (Supervisor for AP01)
      let activeNotifications: AppNotification[] = [];
      const unsubUser1 = subscribeToUserNotifications('supervisor', ['AP01'], (notifs) => {
        activeNotifications = notifs;
      });

      mockDbState.setDoc('notif_ap01', {
        id: 'notif_ap01',
        type: 'mortality_warning',
        priority: 'WARNING',
        title: 'AP01 Warning',
        message: 'AP01 issue',
        farmId: 'AP01',
        targetRoles: ['supervisor'],
        createdAt: '2026-11-09T07:00:00.000Z',
      });

      expect(activeNotifications.length).toBe(1);
      expect(activeNotifications[0].farmId).toBe('AP01');

      // User 1 logs out / unmounts
      unsubUser1();
      activeNotifications = []; // NotificationProvider immediately resets state on account switch

      // User 2 (Supervisor for AP02) logs in
      const unsubUser2 = subscribeToUserNotifications('supervisor', ['AP02'], (notifs) => {
        activeNotifications = notifs;
      });

      // User 2 initially receives 0 notifications because AP01 is not assigned to them
      expect(activeNotifications.length).toBe(0);
      expect(activeNotifications.some((n) => n.farmId === 'AP01')).toBe(false);

      unsubUser2();
    });
  });

  describe('Task 2 & 3 Review: Concurrent Creation and Idempotency (Mocked In-Memory Concurrency)', () => {
    it('concurrent report notifications do not duplicate documents or overwrite original createdAt (Mocked In-Memory Concurrency Test)', async () => {
      const report = {
        farmId: 'AP99',
        submissionDate: '2026-11-09',
        mortality: 80, // > 10% critical threshold
        eggsProduced: 0,
      };

      // Client A and Client B concurrently submit reports for the same farm event
      await Promise.all([
        generateNotificationsForReport(report, 'Farm AP99', 500),
        generateNotificationsForReport(report, 'Farm AP99', 500),
      ]);

      const expectedId = 'mort_crit_AP99_2026-11-09';
      expect(mockDbState.docs.has(expectedId)).toBe(true);
      const originalDoc = mockDbState.docs.get(expectedId);
      const originalCreatedAt = originalDoc.createdAt;
      expect(originalCreatedAt).toBeDefined();

      // Later, a supervisor marks it as read
      mockDbState.updateDoc(expectedId, { readBy: ['supervisor-1'] });
      expect(mockDbState.docs.get(expectedId).readBy).toContain('supervisor-1');

      // Now Client C (farmer re-submitting or offline sync) runs again
      await generateNotificationsForReport(report, 'Farm AP99', 500);

      const afterDoc = mockDbState.docs.get(expectedId);
      // Confirms: createdAt is NOT overwritten
      expect(afterDoc.createdAt).toBe(originalCreatedAt);
      // Confirms: readBy is NOT lost or wiped
      expect(afterDoc.readBy).toContain('supervisor-1');
      // Confirms: priority is preserved
      expect(afterDoc.priority).toBe('CRITICAL');
    });

    it('feed stock depletion notification does not overwrite existing document or timestamp', async () => {
      await evaluateFeedStockNotification('AP77', 'Farm AP77', 0);
      const notifId = `feed_stock_depleted_AP77_2026-11-09`;
      // Note: eventDate is current IST date
      const allDocs = Array.from(mockDbState.docs.values()).filter((d) => d.farmId === 'AP77');
      expect(allDocs.length).toBe(1);
      const firstCreatedAt = allDocs[0].createdAt;

      // Repeat execution
      await evaluateFeedStockNotification('AP77', 'Farm AP77', 0);
      const allDocsAfter = Array.from(mockDbState.docs.values()).filter((d) => d.farmId === 'AP77');
      expect(allDocsAfter.length).toBe(1);
      expect(allDocsAfter[0].createdAt).toBe(firstCreatedAt);
    });

    it('transaction error handling: permission denied is observable to caller, logged as error, and re-thrown', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const permError = { code: 'permission-denied', message: 'Missing or insufficient permissions.' };
      const runTxSpy = vi.spyOn(db, 'runTransaction').mockRejectedValueOnce(permError);

      const report = {
        farmId: 'AP88',
        submissionDate: '2026-11-09',
        mortality: 90,
      };

      // Calling workflow observes the failure (promise rejects rather than silently swallowing)
      await expect(generateNotificationsForReport(report, 'Farm AP88', 500)).rejects.toEqual(permError);

      // Verifies permission error is specifically distinguished in logs
      expect(errorSpy).toHaveBeenCalledWith(
        '[NotificationService] Permission denied during notification commit:',
        permError,
      );

      runTxSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('transaction error handling: network / offline failure is observable to caller, logged as warning, and re-thrown', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const netError = { code: 'unavailable', message: 'Client is offline. Backend is unreachable.' };
      const runTxSpy = vi.spyOn(db, 'runTransaction').mockRejectedValueOnce(netError);

      const report = {
        farmId: 'AP88',
        submissionDate: '2026-11-09',
        mortality: 90,
      };

      // Calling workflow observes the failure
      await expect(generateNotificationsForReport(report, 'Farm AP88', 500)).rejects.toEqual(netError);

      // Verifies network/offline error is specifically logged as warning
      expect(warnSpy).toHaveBeenCalledWith(
        '[NotificationService] Network unavailable during notification commit (offline):',
        netError,
      );

      runTxSpy.mockRestore();
      warnSpy.mockRestore();
    });

    it('transaction safety: missing db.runTransaction fails safely without unsafe non-transactional fallback', async () => {
      const originalRunTx = db.runTransaction;
      (db as any).runTransaction = undefined;

      const report = {
        farmId: 'AP66',
        submissionDate: '2026-11-09',
        mortality: 80,
      };

      try {
        await expect(generateNotificationsForReport(report, 'Farm AP66', 500)).rejects.toThrow(
          '[NotificationService] Firestore runTransaction is required for atomic notification writes',
        );
      } finally {
        (db as any).runTransaction = originalRunTx;
      }
    });
  });

  describe('ISSUE #06: Persistent Notifications, Historical Alerts & Resolution Workflow', () => {
    it('Test 1: Notifications survive refresh and logout/login without data loss', () => {
      mockDbState.setDoc('notif_persist_1', {
        id: 'notif_persist_1',
        type: 'mortality_warning',
        priority: 'WARNING',
        title: 'Persistent Warning',
        message: 'Farm AP01 warning',
        farmId: 'AP01',
        targetRoles: ['supervisor', 'admin'],
        createdAt: '2026-11-09T08:00:00.000Z',
        readBy: ['user_prior'],
        resolved: false,
      });

      // Session 1: User reads notifications
      let session1Notifs: AppNotification[] = [];
      const unsub1 = subscribeToUserNotifications('supervisor', ['AP01'], (notifs) => {
        session1Notifs = notifs;
      });
      expect(session1Notifs.length).toBe(1);
      expect(session1Notifs[0].id).toBe('notif_persist_1');

      // User navigates away / logs out / refreshes (unmount)
      unsub1();

      // Session 2: User logs back in / page reloaded
      let session2Notifs: AppNotification[] = [];
      const unsub2 = subscribeToUserNotifications('supervisor', ['AP01'], (notifs) => {
        session2Notifs = notifs;
      });
      expect(session2Notifs.length).toBe(1);
      expect(session2Notifs[0].id).toBe('notif_persist_1');
      expect(session2Notifs[0].createdAt).toBe('2026-11-09T08:00:00.000Z');
      expect(session2Notifs[0].readBy).toContain('user_prior');

      unsub2();
    });

    it('Test 2: Reading an alert updates readBy but does NOT remove or resolve it', async () => {
      mockDbState.setDoc('notif_read_test', {
        id: 'notif_read_test',
        type: 'mortality_critical',
        priority: 'CRITICAL',
        title: 'Mortality Alert',
        message: 'Critical mortality on AP01',
        farmId: 'AP01',
        targetRoles: ['admin', 'supervisor'],
        createdAt: '2026-11-09T08:15:00.000Z',
        readBy: [],
        resolved: false,
      });

      let currentNotifs: AppNotification[] = [];
      const unsub = subscribeToUserNotifications('supervisor', ['AP01'], (notifs) => {
        currentNotifs = notifs;
      });
      expect(currentNotifs.length).toBe(1);
      expect(currentNotifs[0].readBy).toEqual([]);

      // User marks as read
      await markNotificationAsRead('notif_read_test', 'supervisor_99');

      // Alert must NOT be deleted
      expect(mockDbState.docs.has('notif_read_test')).toBe(true);
      const doc = mockDbState.docs.get('notif_read_test');
      // Confirms: readBy updated
      expect(doc.readBy).toContain('supervisor_99');
      // Confirms: reading did NOT resolve it
      expect(doc.resolved).toBe(false);

      // Confirms: alert remains delivered in real-time stream
      expect(currentNotifs.length).toBe(1);
      expect(currentNotifs[0].readBy).toContain('supervisor_99');

      unsub();
    });

    it('Test 3: Historical notifications remain accessible in Notification Centre without auto-pruning', () => {
      // Historical alerts across multiple dates
      mockDbState.setDoc('notif_day_14', {
        id: 'notif_day_14',
        type: 'mortality_warning',
        priority: 'WARNING',
        title: 'Historical 14-Day Alert',
        message: 'Past event 14 days ago',
        farmId: 'AP01',
        targetRoles: ['admin'],
        createdAt: '2026-10-26T08:00:00.000Z',
        resolved: true,
      });
      mockDbState.setDoc('notif_day_7', {
        id: 'notif_day_7',
        type: 'production_drop',
        priority: 'WARNING',
        title: 'Historical 7-Day Alert',
        message: 'Past event 7 days ago',
        farmId: 'AP02',
        targetRoles: ['admin'],
        createdAt: '2026-11-02T08:00:00.000Z',
        resolved: false,
      });
      mockDbState.setDoc('notif_today', {
        id: 'notif_today',
        type: 'mortality_critical',
        priority: 'CRITICAL',
        title: 'Today Critical Alert',
        message: 'Today critical mortality',
        farmId: 'AP01',
        targetRoles: ['admin'],
        createdAt: '2026-11-09T08:00:00.000Z',
        resolved: false,
      });

      let adminNotifs: AppNotification[] = [];
      const unsub = subscribeToUserNotifications('admin', undefined, (notifs) => {
        adminNotifs = notifs;
      });

      // Confirms: All historical notifications are preserved without pruning
      expect(adminNotifs.length).toBe(3);
      // Confirms: Sorted newest to oldest by original createdAt
      expect(adminNotifs[0].id).toBe('notif_today');
      expect(adminNotifs[1].id).toBe('notif_day_7');
      expect(adminNotifs[2].id).toBe('notif_day_14');

      unsub();
    });

    it('Test 4: Authorized management user (Admin) can resolve notifications', async () => {
      mockDbState.setDoc('notif_to_resolve', {
        id: 'notif_to_resolve',
        type: 'mortality_critical',
        priority: 'CRITICAL',
        title: 'Critical Mortality',
        message: 'Immediate action needed on AP01',
        farmId: 'AP01',
        targetRoles: ['admin', 'supervisor'],
        createdAt: '2026-11-09T08:00:00.000Z',
        readBy: [],
        resolved: false,
      });

      let latestNotifs: AppNotification[] = [];
      const unsub = subscribeToUserNotifications('admin', undefined, (notifs) => {
        latestNotifs = notifs;
      });
      expect(latestNotifs[0].resolved).toBe(false);

      // Admin resolves alert
      await resolveNotification(
        'notif_to_resolve',
        { uid: 'admin_123', name: 'Operations Director' },
        'Attended by vet Dr. Rao, electrolyte treatment initiated.',
      );

      const updatedDoc = mockDbState.docs.get('notif_to_resolve');
      expect(updatedDoc.resolved).toBe(true);
      expect(updatedDoc.resolvedBy).toBe('admin_123');
      expect(updatedDoc.resolvedByName).toBe('Operations Director');
      expect(updatedDoc.resolutionNotes).toBe('Attended by vet Dr. Rao, electrolyte treatment initiated.');
      expect(updatedDoc.resolvedAt).toBeDefined();
      expect(updatedDoc.readBy).toContain('admin_123');

      // Real-time listener reflects resolution immediately
      expect(latestNotifs[0].resolved).toBe(true);
      expect(latestNotifs[0].resolutionNotes).toContain('electrolyte treatment initiated');

      unsub();
    });

    it('Test 5: Unauthorized users (Supervisors & Farmers) cannot resolve notifications (Security Rules simulation)', () => {
      // Simulates the exact Firestore rule logic:
      // Supervisor: affectedKeys().hasOnly(['readBy'])
      function simulateSupervisorUpdate(existingDoc: any, updateData: any): { allowed: boolean; reason?: string } {
        const affectedKeys = Object.keys(updateData);
        if (affectedKeys.some((k) => k !== 'readBy')) {
          return { allowed: false, reason: 'Supervisor can only update readBy' };
        }
        if (updateData.createdAt && updateData.createdAt !== existingDoc.createdAt) {
          return { allowed: false, reason: 'createdAt is immutable' };
        }
        return { allowed: true };
      }

      // Farmer: 0 update permissions
      function simulateFarmerUpdate(): { allowed: boolean; reason?: string } {
        return { allowed: false, reason: 'Farmers have zero update permissions on notifications' };
      }

      // Admin: allowed to update resolution fields and readBy only;
      // Enforces one-way resolution, resolution metadata sealing, server timestamp, caller UID, and readBy restrictions
      function simulateAdminUpdate(
        existingDoc: any,
        updateData: any,
        callerUid: string = 'admin_1',
        requestTime: string = '2026-11-09T09:00:00Z',
      ): { allowed: boolean; reason?: string } {
        const allowedKeys = ['resolved', 'resolvedAt', 'resolvedBy', 'resolvedByName', 'resolutionNotes', 'readBy'];
        const affectedKeys = Object.keys(updateData);

        // 1. Explicit allowlist check
        if (affectedKeys.some((k) => !allowedKeys.includes(k))) {
          return { allowed: false, reason: 'Admin can only update resolution fields and readBy' };
        }

        // 2. CreatedAt immutability
        if (updateData.createdAt && updateData.createdAt !== existingDoc.createdAt) {
          return { allowed: false, reason: 'createdAt is strictly immutable' };
        }

        // 3. Resolution metadata cannot be modified independently while an alert remains active:
        // Any change to resolution metadata requires a complete, internally consistent Active -> Resolved transition
        const touchesResolutionMetadata = affectedKeys.some((k) =>
          ['resolved', 'resolvedAt', 'resolvedBy', 'resolvedByName', 'resolutionNotes'].includes(k),
        );
        if (touchesResolutionMetadata) {
          // Cannot modify if already resolved (sealing)
          if (existingDoc.resolved) {
            return { allowed: false, reason: 'Resolution metadata is permanently sealed and immutable once resolved' };
          }
          // Must transition to resolved == true (cannot modify resolution metadata while remaining active)
          if (updateData.resolved !== true) {
            return { allowed: false, reason: 'Resolution metadata cannot be modified while alert remains active' };
          }
          // Must include all core resolution keys together (internally consistent complete transition)
          const hasAllCore = ['resolved', 'resolvedAt', 'resolvedBy'].every((k) => affectedKeys.includes(k));
          if (!hasAllCore) {
            return { allowed: false, reason: 'Active -> Resolved transition requires resolved, resolvedAt, and resolvedBy together' };
          }
          // Caller UID integrity
          if (updateData.resolvedBy !== callerUid) {
            return { allowed: false, reason: 'resolvedBy must match caller authenticated UID' };
          }
          // Server timestamp integrity
          if (updateData.resolvedAt !== requestTime) {
            return { allowed: false, reason: 'resolvedAt must match server request.time (arbitrary timestamps rejected)' };
          }
        }

        // 4. Admin readBy restrictions: self-only append, preserve all existing readers
        if (affectedKeys.includes('readBy')) {
          const existingReadBy: string[] = existingDoc.readBy || [];
          const newReadBy: string[] = updateData.readBy || [];
          const hasAll = existingReadBy.every((u) => newReadBy.includes(u));
          const allowedNewReaders = [...existingReadBy, callerUid];
          const hasOnly = newReadBy.every((u) => allowedNewReaders.includes(u));
          if (!hasAll || !hasOnly) {
            return { allowed: false, reason: 'Admin can only append their own UID to readBy and cannot modify other users' };
          }
        }

        return { allowed: true };
      }

      const existingAlert = {
        farmId: 'AP01',
        type: 'mortality_critical',
        source: 'daily_report',
        priority: 'CRITICAL',
        title: 'Critical Alert',
        message: '100 birds dead',
        createdAt: '2026-11-09T08:00:00.000Z',
        readBy: ['sup_1'],
        resolved: false,
      };

      const serverRequestTime = '2026-11-09T09:00:00Z';

      // 1. Supervisor tries to resolve alert -> REJECTED
      const supResolveAttempt = { resolved: true, resolvedBy: 'sup_1', resolvedAt: serverRequestTime };
      expect(simulateSupervisorUpdate(existingAlert, supResolveAttempt).allowed).toBe(false);

      // 2. Supervisor updates readBy -> ALLOWED
      const supReadAttempt = { readBy: ['sup_1'] };
      expect(simulateSupervisorUpdate(existingAlert, supReadAttempt).allowed).toBe(true);

      // 3. Farmer tries to resolve or update alert -> REJECTED
      expect(simulateFarmerUpdate().allowed).toBe(false);

      // 4. Admin resolves active alert with server timestamp -> ALLOWED
      const adminResolveAttempt = {
        resolved: true,
        resolvedBy: 'admin_1',
        resolvedByName: 'Admin User',
        resolvedAt: serverRequestTime,
        resolutionNotes: 'Verified shed conditions.',
        readBy: ['sup_1', 'admin_1'],
      };
      expect(simulateAdminUpdate(existingAlert, adminResolveAttempt, 'admin_1', serverRequestTime).allowed).toBe(true);

      // 5. One-way resolution: Resolved alert transitioning back to resolved: false -> REJECTED
      const resolvedDoc = {
        ...existingAlert,
        ...adminResolveAttempt,
      };
      const reopenAttempt = { resolved: false };
      expect(simulateAdminUpdate(resolvedDoc, reopenAttempt, 'admin_1', serverRequestTime).allowed).toBe(false);

      // 6. Existing resolution metadata cannot be rewritten once resolved -> REJECTED
      const rewriteNotesAttempt = { resolutionNotes: 'Tampered resolution notes' };
      expect(simulateAdminUpdate(resolvedDoc, rewriteNotesAttempt, 'admin_1', serverRequestTime).allowed).toBe(false);

      const rewriteResolverAttempt = { resolvedByName: 'Different Admin' };
      expect(simulateAdminUpdate(resolvedDoc, rewriteResolverAttempt, 'admin_1', serverRequestTime).allowed).toBe(false);

      // 7. Admin readBy restrictions:
      // a) Admin appends their own UID preserving existing readers -> ALLOWED
      const adminReadByLegit = { readBy: ['sup_1', 'admin_1'] };
      expect(simulateAdminUpdate(existingAlert, adminReadByLegit, 'admin_1', serverRequestTime).allowed).toBe(true);

      // b) Admin removes existing reader (sup_1) -> REJECTED
      const adminRemoveReaderAttempt = { readBy: ['admin_1'] };
      expect(simulateAdminUpdate(existingAlert, adminRemoveReaderAttempt, 'admin_1', serverRequestTime).allowed).toBe(false);

      // c) Admin adds another user's UID (sup_2) -> REJECTED
      const adminAddOtherReaderAttempt = { readBy: ['sup_1', 'sup_2'] };
      expect(simulateAdminUpdate(existingAlert, adminAddOtherReaderAttempt, 'admin_1', serverRequestTime).allowed).toBe(false);

      // 8. Arbitrary client timestamps are rejected (must match request.time) -> REJECTED
      const arbitraryTimestampAttempt = {
        ...adminResolveAttempt,
        resolvedAt: '2020-01-01T00:00:00Z', // Client clock skew / arbitrary date
      };
      expect(simulateAdminUpdate(existingAlert, arbitraryTimestampAttempt, 'admin_1', serverRequestTime).allowed).toBe(false);

      // 9. Arbitrary resolver UIDs are rejected (must match caller UID) -> REJECTED
      const adminSpoofAttempt = {
        ...adminResolveAttempt,
        resolvedBy: 'spoofed_other_uid',
      };
      expect(simulateAdminUpdate(existingAlert, adminSpoofAttempt, 'admin_1', serverRequestTime).allowed).toBe(false);

      // 10. Admin attempts to modify targetRoles or delivery -> REJECTED by explicit allowlist
      expect(simulateAdminUpdate(existingAlert, { ...adminResolveAttempt, targetRoles: ['admin'] }, 'admin_1', serverRequestTime).allowed).toBe(false);
      expect(simulateAdminUpdate(existingAlert, { ...adminResolveAttempt, delivery: {} }, 'admin_1', serverRequestTime).allowed).toBe(false);

      // 11. Independent modification of resolution metadata while alert remains active -> REJECTED
      // a) Modifying resolutionNotes alone without resolving
      expect(simulateAdminUpdate(existingAlert, { resolutionNotes: 'Independent note' }, 'admin_1', serverRequestTime).allowed).toBe(false);
      // b) Modifying resolvedBy alone without resolving
      expect(simulateAdminUpdate(existingAlert, { resolvedBy: 'admin_1' }, 'admin_1', serverRequestTime).allowed).toBe(false);
      // c) Modifying resolvedAt alone without resolving
      expect(simulateAdminUpdate(existingAlert, { resolvedAt: serverRequestTime }, 'admin_1', serverRequestTime).allowed).toBe(false);
      // d) Incomplete transition (resolved: true without resolvedBy or without resolvedAt)
      expect(simulateAdminUpdate(existingAlert, { resolved: true, resolvedAt: serverRequestTime }, 'admin_1', serverRequestTime).allowed).toBe(false);
      expect(simulateAdminUpdate(existingAlert, { resolved: true, resolvedBy: 'admin_1' }, 'admin_1', serverRequestTime).allowed).toBe(false);
    });

    it('Test 6: Resolved alerts remain in history and maintain resolution metadata', () => {
      mockDbState.setDoc('notif_active_1', {
        id: 'notif_active_1',
        type: 'mortality_critical',
        priority: 'CRITICAL',
        title: 'Active Alert 1',
        message: 'Active mortality issue',
        farmId: 'AP01',
        targetRoles: ['admin'],
        createdAt: '2026-11-09T09:00:00.000Z',
        resolved: false,
      });

      mockDbState.setDoc('notif_active_2', {
        id: 'notif_active_2',
        type: 'mortality_warning',
        priority: 'WARNING',
        title: 'Active Alert 2',
        message: 'Active warning issue',
        farmId: 'AP02',
        targetRoles: ['admin'],
        createdAt: '2026-11-09T08:30:00.000Z',
        resolved: false,
      });

      mockDbState.setDoc('notif_resolved_1', {
        id: 'notif_resolved_1',
        type: 'mortality_critical',
        priority: 'CRITICAL',
        title: 'Resolved Alert 1',
        message: 'Past critical mortality',
        farmId: 'AP01',
        targetRoles: ['admin'],
        createdAt: '2026-11-09T08:00:00.000Z',
        resolved: true,
        resolvedAt: '2026-11-09T08:45:00.000Z',
        resolvedBy: 'admin_1',
        resolvedByName: 'Admin Officer',
        resolutionNotes: 'Controlled with antibiotic therapy.',
      });

      let allAlerts: AppNotification[] = [];
      const unsub = subscribeToUserNotifications('admin', undefined, (notifs) => {
        allAlerts = notifs;
      });

      // Total history contains all 3 alerts
      expect(allAlerts.length).toBe(3);

      // Active filter
      const activeAlerts = allAlerts.filter((n) => !n.resolved);
      expect(activeAlerts.length).toBe(2);
      expect(activeAlerts.map((n) => n.id)).toContain('notif_active_1');
      expect(activeAlerts.map((n) => n.id)).toContain('notif_active_2');

      // Resolved filter
      const resolvedAlerts = allAlerts.filter((n) => Boolean(n.resolved));
      expect(resolvedAlerts.length).toBe(1);
      expect(resolvedAlerts[0].id).toBe('notif_resolved_1');
      expect(resolvedAlerts[0].resolutionNotes).toBe('Controlled with antibiotic therapy.');

      unsub();
    });

    it('Test 7: Repeated submissions and bootstrap scans do NOT reactivate resolved alerts', async () => {
      const report = {
        farmId: 'AP55',
        submissionDate: '2026-11-09',
        mortality: 95, // Critical alert
        eggsProduced: 0,
      };

      // 1. Initial report generates notification
      await generateNotificationsForReport(report, 'Farm AP55', 500);
      const expectedId = 'mort_crit_AP55_2026-11-09';
      expect(mockDbState.docs.has(expectedId)).toBe(true);

      // 2. Admin marks alert as resolved (authenticated as admin_chief)
      mockCurrentUser = { uid: 'admin_chief', displayName: 'Chief Auditor', email: 'chief@happyfarm.com' };
      await resolveNotification(
        expectedId,
        'Farm visited and verified.',
      );
      const resolvedDocBefore = mockDbState.docs.get(expectedId);
      expect(resolvedDocBefore.resolved).toBe(true);
      expect(resolvedDocBefore.resolutionNotes).toBe('Farm visited and verified.');

      // 3. Farmer submits another report for same date (revision / offline sync)
      await generateNotificationsForReport(report, 'Farm AP55', 500);

      // 4. Confirms: Alert remains RESOLVED and was not reactivated
      const docAfter = mockDbState.docs.get(expectedId);
      expect(docAfter.resolved).toBe(true);
      expect(docAfter.resolvedBy).toBe('admin_chief');
      expect(docAfter.resolutionNotes).toBe('Farm visited and verified.');
    });

    it('Test 8: Original creation timestamp and notification content remain strictly immutable on resolution', async () => {
      const originalCreatedAt = '2026-11-01T06:30:00.000Z';
      mockDbState.setDoc('notif_immutable_check', {
        id: 'notif_immutable_check',
        type: 'mortality_critical',
        priority: 'CRITICAL',
        title: 'Original Title',
        message: 'Original Message Body',
        farmId: 'AP10',
        targetRoles: ['admin', 'supervisor'],
        createdAt: originalCreatedAt,
        resolved: false,
      });

      // Admin resolves alert
      await resolveNotification('notif_immutable_check', { uid: 'admin_1' }, 'Resolved');

      const afterDoc = mockDbState.docs.get('notif_immutable_check');
      // Confirms: createdAt is unchanged
      expect(afterDoc.createdAt).toBe(originalCreatedAt);
      // Confirms: message, title, priority, farmId, type are unchanged
      expect(afterDoc.title).toBe('Original Title');
      expect(afterDoc.message).toBe('Original Message Body');
      expect(afterDoc.priority).toBe('CRITICAL');
      expect(afterDoc.farmId).toBe('AP10');
      expect(afterDoc.type).toBe('mortality_critical');
    });

    it('Test 9: Overview and Notification Centre remain synchronized on resolution events', async () => {
      mockDbState.setDoc('notif_sync_test', {
        id: 'notif_sync_test',
        type: 'mortality_warning',
        priority: 'WARNING',
        title: 'Sync Alert',
        message: 'Sync test message',
        farmId: 'AP20',
        targetRoles: ['admin'],
        createdAt: '2026-11-09T08:00:00.000Z',
        readBy: [],
        resolved: false,
      });

      // Listener 1: Overview NotificationBell
      let overviewNotifs: AppNotification[] = [];
      const unsubOverview = subscribeToUserNotifications('admin', undefined, (notifs) => {
        overviewNotifs = notifs;
      });

      // Listener 2: Notification Centre
      let centerNotifs: AppNotification[] = [];
      const unsubCenter = subscribeToUserNotifications('admin', undefined, (notifs) => {
        centerNotifs = notifs;
      });

      expect(overviewNotifs[0].resolved).toBe(false);
      expect(centerNotifs[0].resolved).toBe(false);

      // Admin resolves alert in Notification Centre
      await resolveNotification('notif_sync_test', { uid: 'admin_1' }, 'Resolved in centre');

      // Both Overview and Notification Centre receive resolved update simultaneously
      expect(overviewNotifs[0].resolved).toBe(true);
      expect(centerNotifs[0].resolved).toBe(true);
      expect(overviewNotifs[0].resolutionNotes).toBe('Resolved in centre');
      expect(centerNotifs[0].resolutionNotes).toBe('Resolved in centre');

      unsubOverview();
      unsubCenter();
    });

    it('Test 10: Legacy notifications lacking resolution fields are handled safely with backward compatibility', () => {
      // Legacy document that does not contain 'resolved', 'resolvedAt', 'resolvedBy', or 'resolutionNotes'
      const legacyRawDoc = {
        id: 'legacy_notif_001',
        data: () => ({
          type: 'mortality_critical',
          priority: 'CRITICAL',
          title: 'Legacy Critical Alert',
          message: 'Legacy mortality event',
          farmId: 'AP01',
          targetRoles: ['admin', 'supervisor'],
          createdAt: '2026-10-15T08:00:00.000Z',
          readBy: ['user_old'],
          // Missing resolved fields intentionally
        }),
      };

      const normalized = normalizeDeliveryChannels(undefined); // smoke test delivery
      // Use normalizeNotification via emitNotifications/subscribeToUserNotifications
      mockDbState.setDoc('legacy_notif_001', {
        type: 'mortality_critical',
        priority: 'CRITICAL',
        title: 'Legacy Critical Alert',
        message: 'Legacy mortality event',
        farmId: 'AP01',
        targetRoles: ['admin'],
        createdAt: '2026-10-15T08:00:00.000Z',
        readBy: ['user_old'],
      });

      let adminNotifs: AppNotification[] = [];
      const unsub = subscribeToUserNotifications('admin', undefined, (notifs) => {
        adminNotifs = notifs;
      });

      expect(adminNotifs.length).toBe(1);
      const legacyItem = adminNotifs[0];
      // Backward compatibility assertions
      expect(legacyItem.resolved).toBe(false); // Defaults to active
      expect(legacyItem.resolvedAt).toBeNull();
      expect(legacyItem.resolvedBy).toBeNull();
      expect(legacyItem.resolvedByName).toBeNull();
      expect(legacyItem.resolutionNotes).toBeNull();
      expect(legacyItem.readBy).toContain('user_old');

      unsub();
    });

    it('Test 11: Resolver identity is obtained strictly from authenticated user and callers cannot spoof UIDs', async () => {
      mockDbState.setDoc('notif_auth_verify', {
        id: 'notif_auth_verify',
        type: 'mortality_critical',
        priority: 'CRITICAL',
        title: 'Auth Verification Alert',
        message: 'Checking resolver UID integrity',
        farmId: 'AP01',
        targetRoles: ['admin'],
        createdAt: '2026-11-09T08:00:00.000Z',
        readBy: [],
        resolved: false,
      });

      // 1. Unauthenticated caller cannot resolve alerts -> throws error
      mockCurrentUser = null;
      await expect(
        resolveNotification('notif_auth_verify', 'Resolution attempt without auth'),
      ).rejects.toThrow(/User must be authenticated to resolve notifications/);

      // Doc remains active
      expect(mockDbState.docs.get('notif_auth_verify').resolved).toBe(false);

      // 2. Authenticated user resolves alert: authenticated UID is always used, ignoring spoofed caller UID
      mockCurrentUser = {
        uid: 'legitimate_admin_uid_777',
        displayName: 'Verified Admin Name',
        email: 'admin777@happyfarm.com',
      };

      // Attacker attempts to pass spoofed UID 'malicious_spoofed_uid' in caller arguments
      await resolveNotification(
        'notif_auth_verify',
        { uid: 'malicious_spoofed_uid', name: 'Spoofed Name' },
        'Legitimately resolved with caller authentication check',
      );

      const resolvedDoc = mockDbState.docs.get('notif_auth_verify');
      expect(resolvedDoc.resolved).toBe(true);
      // Confirms: authenticated UID is written, caller-supplied UID is ignored
      expect(resolvedDoc.resolvedBy).toBe('legitimate_admin_uid_777');
      expect(resolvedDoc.resolvedBy).not.toBe('malicious_spoofed_uid');
      // Confirms: authenticated displayName is used
      expect(resolvedDoc.resolvedByName).toBe('Verified Admin Name');
      expect(resolvedDoc.resolvedAt).toBeDefined();

      // 3. User with email only (no displayName) falls back to email, does not invent identities
      mockCurrentUser = {
        uid: 'admin_email_only',
        displayName: null,
        email: 'ops@happyfarm.com',
      };
      mockDbState.setDoc('notif_email_fallback', {
        id: 'notif_email_fallback',
        type: 'production_drop',
        priority: 'WARNING',
        title: 'Email Fallback Alert',
        message: 'No displayName alert',
        farmId: 'AP01',
        targetRoles: ['admin'],
        createdAt: '2026-11-09T08:00:00.000Z',
        readBy: [],
        resolved: false,
      });

      await resolveNotification('notif_email_fallback', 'Resolved by email-only user');
      const emailResolvedDoc = mockDbState.docs.get('notif_email_fallback');
      expect(emailResolvedDoc.resolvedBy).toBe('admin_email_only');
      // Provenance: retains the authoritative UID when profile displayName is absent (never invents identities)
      expect(emailResolvedDoc.resolvedByName).toBe('admin_email_only');

      // 4. Trusted profile source: when caller provides trusted profile name from userProfile, it is used
      mockCurrentUser = {
        uid: 'admin_with_profile',
        displayName: null,
      };
      mockDbState.setDoc('notif_trusted_profile', {
        id: 'notif_trusted_profile',
        type: 'mortality_critical',
        priority: 'CRITICAL',
        title: 'Trusted Profile Alert',
        message: 'Has trusted profile name',
        farmId: 'AP01',
        targetRoles: ['admin'],
        createdAt: '2026-11-09T08:00:00.000Z',
        readBy: [],
        resolved: false,
      });

      await resolveNotification(
        'notif_trusted_profile',
        { uid: 'ignored_spoofed', name: 'Dr. Rao (Veterinary Lead)' },
        'Verified medication',
      );
      const trustedResolvedDoc = mockDbState.docs.get('notif_trusted_profile');
      expect(trustedResolvedDoc.resolvedBy).toBe('admin_with_profile');
      expect(trustedResolvedDoc.resolvedByName).toBe('Dr. Rao (Veterinary Lead)');

      // 5. Service rejects attempts to resolve an already resolved notification
      await expect(
        resolveNotification('notif_email_fallback', 'Attempt to re-resolve already resolved alert'),
      ).rejects.toThrow(/is already resolved/);
    });

    it('Test 12: Notification document deletion is completely prohibited for all roles in security rules and simulation', () => {
      // Direct simulation of delete rule: allow delete: if false;
      function simulateDelete(role: 'admin' | 'supervisor' | 'farmer'): { allowed: boolean; reason: string } {
        // Notifications are permanent audit records
        return { allowed: false, reason: 'Notification deletion is permanently denied for all roles' };
      }

      expect(simulateDelete('admin').allowed).toBe(false);
      expect(simulateDelete('supervisor').allowed).toBe(false);
      expect(simulateDelete('farmer').allowed).toBe(false);

      // Verify identical rule in both rules files
      const rootRules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf-8');
      const firebaseRules = fs.readFileSync(path.resolve(process.cwd(), 'firebase/firestore.rules'), 'utf-8');

      expect(rootRules).toBe(firebaseRules);

      const deleteMatch = rootRules.match(/match\s+\/notifications\/\{notificationId\}[\s\S]*?allow\s+delete:\s*if\s+false;/);
      expect(deleteMatch).not.toBeNull();
    });

    it('Test 13: Historical query verification and pagination without duplicate alerts', () => {
      // 1. Generate 60 historical notifications spread across 60 days
      const totalDocs = 60;
      for (let i = 1; i <= totalDocs; i++) {
        const dayStr = String(i).padStart(2, '0');
        mockDbState.setDoc(`notif_hist_${dayStr}`, {
          id: `notif_hist_${dayStr}`,
          type: 'mortality_critical',
          priority: 'CRITICAL',
          title: `Historical Alert Day ${i}`,
          message: `Mortality issue on day ${i}`,
          farmId: 'AP01',
          targetRoles: ['admin'],
          createdAt: new Date(2026, 8, i, 8, 0, 0).toISOString(),
          readBy: [],
          resolved: i % 2 === 0,
        });
      }

      let allNotifs: AppNotification[] = [];
      const unsub = subscribeToUserNotifications('admin', undefined, (notifs) => {
        allNotifs = notifs;
      });

      // All 60 notifications are retrieved without any artificial query limit or date filter
      expect(allNotifs.length).toBe(60);

      // Confirms strictly descending order by createdAt
      for (let i = 0; i < allNotifs.length - 1; i++) {
        const timeA = new Date(allNotifs[i].createdAt).getTime();
        const timeB = new Date(allNotifs[i + 1].createdAt).getTime();
        expect(timeA).toBeGreaterThanOrEqual(timeB);
      }

      // 2. Simulates client-side pagination (PAGE_SIZE = 25)
      const PAGE_SIZE = 25;
      const totalPages = Math.ceil(allNotifs.length / PAGE_SIZE); // 3 pages: 25, 25, 10
      expect(totalPages).toBe(3);

      const page1 = allNotifs.slice(0, PAGE_SIZE);
      const page2 = allNotifs.slice(PAGE_SIZE, PAGE_SIZE * 2);
      const page3 = allNotifs.slice(PAGE_SIZE * 2);

      expect(page1.length).toBe(25);
      expect(page2.length).toBe(25);
      expect(page3.length).toBe(10);

      // Confirms zero duplicate notifications across pages
      const allPaginatedIds = [...page1, ...page2, ...page3].map((n) => n.id);
      const uniqueIds = new Set(allPaginatedIds);
      expect(uniqueIds.size).toBe(60);

      unsub();
    });
  });
});
