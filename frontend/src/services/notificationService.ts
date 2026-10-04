import { db } from '../config/firebase';
import { getIstDate, formatDisplayDate, getDaysAgo } from '../utils/dateUtils';
import { KPI_THRESHOLDS } from '../config/kpiThresholds';
import {
  calcMortalityRate,
  calcProductionRate,
  calcSelectionRate,
  evaluateFarmHealth,
  getEligibleBirdCount,
  calcAverage,
} from '../utils/kpiCalculations';
import { getAllReports, getReportsByFarms, type ReportDoc } from './reportDataService';
import { getAllFarms, getFarmsByIds, type FarmDoc } from './farmDataService';
import { getAllUsers } from './userDataService';

// ============================================================
// DELIVERY CHANNEL ARCHITECTURE (future-ready, in-app only now)
// ============================================================
// notification
//   ├── inApp:  active (current)
//   ├── email:  not implemented (future)
//   └── sms:    not implemented (future)

export type NotificationChannel = 'IN_APP' | 'EMAIL' | 'SMS';

const ACTIVE_CHANNEL: NotificationChannel = 'IN_APP';
const NOTIFICATION_ROLES = ['admin', 'supervisor'];
const SUPERVISOR_QUERY_CHUNK_SIZE = 30;

export interface AppNotification {
  id: string;
  type: string;
  priority: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  message: string;
  farmId: string;
  farmName?: string;
  reportDate?: string;
  targetRoles: string[];
  channels?: NotificationChannel[];
  delivery?: {
    inApp: 'active';
    email: 'future';
    sms: 'future';
  };
  createdAt: string;
  readBy: string[];
  source?: string;
  actionType?: string;
  actionData?: string;
}

// ============================================================
// ID + HELPERS
// ============================================================

function notificationId(type: string, farmId: string, eventDate: string): string {
  return `${type}_${farmId}_${eventDate}`;
}

function getEventDate(report: any): string {
  return report.submissionDate || report.reportDate || getIstDate();
}

function getFirebaseFieldValue() {
  try {
    const f = typeof window !== 'undefined' ? (window as any).firebase : undefined;
    if (f?.firestore?.FieldValue) return f.firestore.FieldValue;
  } catch {
    // ignore
  }
  return null;
}

type NotificationWrite = Omit<AppNotification, 'readBy'>;

function baseNotification(
  id: string,
  data: Pick<AppNotification, 'type' | 'priority' | 'title' | 'message'>,
  farmId: string,
  farmName: string,
  createdAt: string,
  reportDate?: string,
  source?: string,
): Omit<NotificationWrite, 'id'> & { id: string } {
  return {
    id,
    ...data,
    farmId,
    farmName: farmName || farmId,
    reportDate: reportDate || '',
    targetRoles: NOTIFICATION_ROLES,
    channels: [ACTIVE_CHANNEL],
    delivery: { inApp: 'active', email: 'future', sms: 'future' },
    createdAt,
    source: source || 'daily_report',
  };
}

/**
 * Writes notification documents in Firestore-safe chunks. Notification
 * documents deliberately omit readBy here: merge writes must never reset the
 * per-user read state of an existing notification.
 */
async function commitNotificationWrites(
  writes: Array<{ id: string; data: NotificationWrite }>,
): Promise<void> {
  for (let index = 0; index < writes.length; index += 450) {
    const batch = db.batch();
    writes.slice(index, index + 450).forEach(({ id, data }) => {
      batch.set(db.collection('notifications').doc(id), data, { merge: true });
    });
    await batch.commit();
  }
}

// ============================================================
// PER-REPORT NOTIFICATION GENERATION (called on submission)
// ============================================================

/** Generates in-app events from the same health calculation used by Overview. */
export async function generateNotificationsForReport(
  report: any,
  farmName: string,
  base: number,
): Promise<void> {
  const eventDate = getEventDate(report);
  const createdAt = new Date().toISOString();
  const batch = db.batch();
  let operationsCount = 0;

  const farmId = String(report.farmId || '');
  const farmLabel = farmName ? `Farm ${farmId} (${farmName})` : `Farm ${farmId}`;
  const mort = Number(report.mortality) || 0;
  const prodPct = base > 0 ? calcProductionRate(report.eggsProduced ?? 0, base) : 0;
  const selectPct = calcSelectionRate(report.selectionEggs ?? 0, report.eggsProduced ?? 0);

  const health = evaluateFarmHealth({
    reports: [{ ...report, openingBirdCount: base > 0 ? base : report.openingBirdCount }],
    days: 1,
    liveBirds: base,
    farmId,
  });

  const events: Array<{ id: string; data: Pick<AppNotification, 'type' | 'priority' | 'title' | 'message'> }> = [];

  if (health.isInvalid) {
    events.push({
      id: notificationId('report_invalid', farmId, eventDate),
      data: {
        type: 'report_invalid',
        priority: 'CRITICAL',
        title: 'Daily Report Requires Review',
        message: `${farmLabel} has a daily report requiring review: ${health.reason || 'invalid operational values were reported.'}`,
      },
    });
  } else if (health.hasTotalFlockLoss) {
    events.push({
      id: notificationId('mort_disaster', farmId, eventDate),
      data: {
        type: 'mortality_disaster',
        priority: 'CRITICAL',
        title: 'TOTAL FLOCK MORTALITY DISASTER',
        message: `${farmLabel} reported 100% loss of the entire eligible flock (${mort.toLocaleString()} dead birds). Immediate operational intervention required.`,
      },
    });
  } else if (health.statusLabel === 'CRITICAL' && health.mortalityRate >= (KPI_THRESHOLDS.mortalityRateCritical ?? 10)) {
    events.push({
      id: notificationId('mort_crit', farmId, eventDate),
      data: {
        type: 'mortality_critical',
        priority: 'CRITICAL',
        title: `High Mortality Alert (${health.mortalityRate}%)`,
        message: `${farmLabel} recorded ${mort} dead birds (${health.mortalityRate}% mortality rate, exceeding critical threshold of ${KPI_THRESHOLDS.mortalityRateCritical}%).`,
      },
    });
  } else if (health.statusLabel === 'NEEDS ATTENTION' && health.mortalityRate >= (KPI_THRESHOLDS.mortalityRateWarning ?? 5)) {
    events.push({
      id: notificationId('mort_warn', farmId, eventDate),
      data: {
        type: 'mortality_warning',
        priority: 'WARNING',
        title: `Elevated Mortality Alert (${health.mortalityRate}%)`,
        message: `${farmLabel} recorded ${mort} dead birds (${health.mortalityRate}% mortality rate, approaching critical threshold).`,
      },
    });
  } else if (health.statusLabel === 'CRITICAL') {
    events.push({
      id: notificationId('farm_health_critical', farmId, eventDate),
      data: {
        type: 'farm_health_critical',
        priority: 'CRITICAL',
        title: 'Critical Farm Health Status',
        message: `${farmLabel} is marked CRITICAL by the Operations overview${health.reason ? `: ${health.reason}` : '.'}`,
      },
    });
  }

  if (prodPct < KPI_THRESHOLDS.productionRateLow && base > 0) {
    events.push({
      id: notificationId('production_drop', farmId, eventDate),
      data: {
        type: 'production_drop',
        priority: 'WARNING',
        title: 'Low Egg Production Alert',
        message: `${farmLabel} production is ${prodPct}% (${(report.eggsProduced ?? 0).toLocaleString()} eggs), below the ${KPI_THRESHOLDS.productionRateLow}% threshold.`,
      },
    });
  }

  if (selectPct < 80 && Number(report.eggsProduced) > 0) {
    events.push({
      id: notificationId('selection_warning', farmId, eventDate),
      data: {
        type: 'selection_warning',
        priority: 'WARNING',
        title: 'Egg Quality / Selection Warning',
        message: `${farmLabel} selection egg rate is ${selectPct}% (${Number(report.selectionEggs) || 0} selection eggs from ${Number(report.eggsProduced)} produced).`,
      },
    });
  }

  if (report.temperature != null && (Number(report.temperature) > 50 || Number(report.temperature) < 10)) {
    events.push({
      id: notificationId('temperature_abnormal', farmId, eventDate),
      data: {
        type: 'temperature_abnormal',
        priority: 'WARNING',
        title: 'Abnormal Temperature Warning',
        message: `${farmLabel} temperature recorded at ${report.temperature}°C (acceptable range: 10°C – 50°C).`,
      },
    });
  }

  if (report.ammoniaPpm != null && Number(report.ammoniaPpm) > 10) {
    events.push({
      id: notificationId('ammonia_high', farmId, eventDate),
      data: {
        type: 'ammonia_high',
        priority: 'WARNING',
        title: 'High Ammonia Level Detected',
        message: `${farmLabel} reported ammonia level at ${report.ammoniaPpm} ppm (threshold: >10 ppm).`,
      },
    });
  }

  events.forEach(({ id, data }) => {
    batch.set(
      db.collection('notifications').doc(id),
      baseNotification(id, data, farmId, farmName, createdAt, eventDate, 'daily_report'),
      { merge: true },
    );
    operationsCount += 1;
  });

  if (operationsCount > 0) {
    try {
      await batch.commit();
    } catch (err) {
      console.error('[NotificationService] Failed to commit notifications:', err);
    }
  }
}

// ============================================================
// BOOTSTRAP: Derive notifications from existing Firestore data
// ============================================================
// This runs when Notification Centre opens to catch any farm
// that already has a qualifying condition in persisted data
// (e.g., AP15 was CRITICAL before the notification path existed).
// Uses the same evaluateFarmHealth used by the Overview.
// Deduplication is enforced by deterministic doc IDs.

const BOOTSTRAP_DAYS = 7; // Match Overview default window

export async function bootstrapNotificationsFromFarmReports(
  farmReportMap: Map<string, { reports: ReportDoc[]; farmName: string }>,
): Promise<AppNotification[]> {
  if (!farmReportMap || farmReportMap.size === 0) return [];

  const writes: Array<{ id: string; data: NotificationWrite }> = [];

  for (const [farmId, { reports, farmName }] of farmReportMap.entries()) {
    if (!reports || reports.length === 0) continue;

    const farmLabel = farmName ? `Farm ${farmId} (${farmName})` : `Farm ${farmId}`;

    // Evaluate same way the Overview does: all reports in window, N days
    const health = evaluateFarmHealth({
      reports,
      days: BOOTSTRAP_DAYS,
      farmId,
    });

    // Use the most recent report date as the event anchor for deduplication
    const sortedReports = [...reports].sort((a, b) =>
      (b.submissionDate || '').localeCompare(a.submissionDate || ''),
    );
    const latestReport = sortedReports[0];
    const eventDate = latestReport?.submissionDate || getIstDate();
    const createdAt = new Date().toISOString();

    const events: Array<{ id: string; data: Pick<AppNotification, 'type' | 'priority' | 'title' | 'message'> }> = [];

    // --- Mortality alerts (mirror Overview status logic) ---
    if (health.isInvalid) {
      events.push({
        id: notificationId('report_invalid', farmId, eventDate),
        data: {
          type: 'report_invalid',
          priority: 'CRITICAL',
          title: 'Daily Report Requires Review',
          message: `${farmLabel} has a report with invalid operational values: ${health.reason || 'review required.'}`,
        },
      });
    } else if (health.hasTotalFlockLoss) {
      const lossReport = reports.find((report) => {
        const eligible = getEligibleBirdCount(report);
        return eligible > 0 && Number(report.mortality) >= eligible;
      });
      const eligible = lossReport ? getEligibleBirdCount(lossReport) : 0;
      const deadBirds = lossReport ? Number(lossReport.mortality) || eligible : eligible;
      events.push({
        id: notificationId('mort_disaster', farmId, eventDate),
        data: {
          type: 'mortality_disaster',
          priority: 'CRITICAL',
          title: 'TOTAL FLOCK MORTALITY DISASTER',
          message: `${farmLabel} reported 100% mortality (${deadBirds.toLocaleString()} of ${eligible.toLocaleString()} eligible birds). Immediate operational intervention required.`,
        },
      });
    } else if (health.statusLabel === 'CRITICAL' && health.mortalityRate >= (KPI_THRESHOLDS.mortalityRateCritical ?? 10)) {
      events.push({
        id: notificationId('mort_crit', farmId, eventDate),
        data: {
          type: 'mortality_critical',
          priority: 'CRITICAL',
          title: `High Mortality Alert (${health.mortalityRate}%)`,
          message: `${farmLabel} averaged ${health.mortalityRate}% mortality over the last ${BOOTSTRAP_DAYS} days, exceeding the critical threshold of ${KPI_THRESHOLDS.mortalityRateCritical}%.`,
        },
      });
    } else if ((health.statusLabel === 'NEEDS ATTENTION' || health.statusLabel === 'CRITICAL') && health.mortalityRate >= (KPI_THRESHOLDS.mortalityRateWarning ?? 5)) {
      events.push({
        id: notificationId('mort_warn', farmId, eventDate),
        data: {
          type: 'mortality_warning',
          priority: 'WARNING',
          title: `Elevated Mortality Alert (${health.mortalityRate}%)`,
          message: `${farmLabel} averaged ${health.mortalityRate}% mortality over the last ${BOOTSTRAP_DAYS} days, requiring operational attention.`,
        },
      });
    } else if (health.statusLabel === 'CRITICAL') {
      events.push({
        id: notificationId('farm_health_critical', farmId, eventDate),
        data: {
          type: 'farm_health_critical',
          priority: 'CRITICAL',
          title: 'Critical Farm Health Status',
          message: `${farmLabel} is currently marked CRITICAL by the Operations overview${health.reason ? `: ${health.reason}` : '.'}`,
        },
      });
    }

    // --- Production alert ---
    if (health.productionRate > 0 && health.productionRate < KPI_THRESHOLDS.productionRateLow) {
      events.push({
        id: notificationId('production_drop', farmId, eventDate),
        data: {
          type: 'production_drop',
          priority: 'WARNING',
          title: `Low Egg Production Alert (${health.productionRate}%)`,
          message: `${farmLabel} averaged ${health.productionRate}% production over the last ${BOOTSTRAP_DAYS} days, below the ${KPI_THRESHOLDS.productionRateLow}% threshold.`,
        },
      });
    }

    // --- Egg selection (aggregate across window) ---
    const avgSelectionRate = calcAverage(
      reports.map((r) => calcSelectionRate(r.selectionEggs ?? 0, r.eggsProduced ?? 0)),
    );
    const totalEggs = reports.reduce((s, r) => s + (r.eggsProduced ?? 0), 0);
    if (avgSelectionRate > 0 && avgSelectionRate < 80 && totalEggs > 0) {
      events.push({
        id: notificationId('selection_warning', farmId, eventDate),
        data: {
          type: 'selection_warning',
          priority: 'WARNING',
          title: `Egg Quality / Selection Warning (${avgSelectionRate}%)`,
          message: `${farmLabel} averaged ${avgSelectionRate}% selection egg rate over the last ${BOOTSTRAP_DAYS} days.`,
        },
      });
    }

    // --- Temperature (only check latest report to avoid stale alerts) ---
    const latestTemp = Number(latestReport?.temperature);
    if (!isNaN(latestTemp) && latestTemp > 0 && (latestTemp > 50 || latestTemp < 10)) {
      events.push({
        id: notificationId('temperature_abnormal', farmId, eventDate),
        data: {
          type: 'temperature_abnormal',
          priority: 'WARNING',
          title: 'Abnormal Temperature Warning',
          message: `${farmLabel} recorded temperature at ${latestTemp}°C on ${formatDisplayDate(eventDate)} (acceptable range: 10°C – 50°C).`,
        },
      });
    }

    // --- Ammonia (only check latest report) ---
    const latestAmmonia = Number(latestReport?.ammoniaPpm);
    if (!isNaN(latestAmmonia) && latestAmmonia > 0 && latestAmmonia > 10) {
      events.push({
        id: notificationId('ammonia_high', farmId, eventDate),
        data: {
          type: 'ammonia_high',
          priority: 'WARNING',
          title: 'High Ammonia Level Detected',
          message: `${farmLabel} reported ammonia at ${latestAmmonia} ppm on ${formatDisplayDate(eventDate)} (threshold: >10 ppm).`,
        },
      });
    }

    events.forEach(({ id, data }) => {
      // The deterministic ID guarantees deduplication. Omitting readBy from
      // the merge payload preserves every user's existing read state.
      writes.push({
        id,
        data: baseNotification(id, data, farmId, farmName, createdAt, eventDate, 'bootstrap'),
      });
    });
  }

  if (writes.length > 0) {
    try {
      await commitNotificationWrites(writes);
    } catch (err) {
      console.error('[NotificationService] Bootstrap batch commit error:', err);
    }
  }

  return writes.map(w => ({ ...w.data, readBy: [] }) as AppNotification);
}

// ============================================================
// MISSING REPORT NOTIFICATIONS
// ============================================================

/** Checks for missing reports; call this only from an existing scheduled job. */
export async function generateMissingReportNotifications(
  todayReports: ReportDoc[],
  activeFarms: FarmDoc[],
  farmers: { uid: string; farmIds?: string[] }[],
): Promise<AppNotification[]> {
  const today = getIstDate();
  const writes: Array<{ id: string; data: NotificationWrite }> = [];

  const expectedFarmsToReport = activeFarms.filter((f) =>
    farmers.some((u) => u.farmIds?.some((id) => id?.trim().toUpperCase() === f.farmId?.trim().toUpperCase())),
  );
  const submittedFarmIdsSet = new Set(
    todayReports.filter((r) => r.status !== 'draft').map((r) => r.farmId?.trim().toUpperCase()).filter(Boolean),
  );

  expectedFarmsToReport.forEach((farm) => {
    if (submittedFarmIdsSet.has(farm.farmId?.trim().toUpperCase())) return;
    const id = notificationId('missing_report', farm.farmId, today);
    const farmLabel = farm.name ? `Farm ${farm.farmId} (${farm.name})` : `Farm ${farm.farmId}`;
    writes.push({
      id,
      data: baseNotification(
        id,
        {
          type: 'missing_report',
          priority: 'WARNING',
          title: 'Missing Daily Report',
          message: `${farmLabel} has not submitted a report for ${formatDisplayDate(today)}.`,
        },
        farm.farmId,
        farm.name || farm.farmId,
        new Date().toISOString(),
        today,
        'missing_report_check',
      ),
    });
  });

  if (writes.length > 0) {
    try {
      await commitNotificationWrites(writes);
    } catch (err) {
      console.error('[NotificationService] Failed to commit missing report notifications:', err);
    }
  }

  return writes.map(w => ({ ...w.data, readBy: [] }) as AppNotification);
}

/**
 * Development/manual trigger for the real notification pipeline. It reads
 * current persisted data, applies the same bootstrap rules used by the
 * Notification Centre, and writes no synthetic/demo notification.
 */
export async function bootstrapNotificationsForUser(
  userRole: string,
  userFarmIds?: string[],
): Promise<{ farmCount: number; reportCount: number }> {
  const startDate = getDaysAgo(6);
  const endDate = getIstDate();
  const isSupervisor = userRole.trim().toLowerCase() === 'supervisor';
  const farms = isSupervisor
    ? await getFarmsByIds(userFarmIds || [])
    : await getAllFarms();
  const activeFarms = farms.filter((farm) => farm.active !== false);
  const reports = isSupervisor
    ? await getReportsByFarms(userFarmIds || [], startDate, endDate)
    : await getAllReports(startDate, endDate);
  const farmReportMap = new Map<string, { reports: ReportDoc[]; farmName: string }>();

  activeFarms.forEach((farm) => {
    farmReportMap.set(farm.farmId, {
      reports: reports.filter((report) => report.farmId === farm.farmId),
      farmName: farm.name || farm.farmId,
    });
  });

  const users = await getAllUsers();
  const farmers = users.filter((user) =>
    user.active !== false && String(user.role || '').trim().toLowerCase() === 'farmer'
  );
  await Promise.all([
    bootstrapNotificationsFromFarmReports(farmReportMap),
    generateMissingReportNotifications(reports, activeFarms, farmers),
  ]);

  return { farmCount: activeFarms.length, reportCount: reports.length };
}

// ============================================================
// TIMESTAMP NORMALIZATION
// ============================================================

function toIsoDate(value: any): string {
  if (typeof value === 'string') return value;
  if (value && typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return new Date(0).toISOString();
}

function normalizeNotification(doc: any): AppNotification {
  const data = doc.data() as Partial<AppNotification>;
  return {
    ...data,
    id: data.id || doc.id,
    targetRoles: Array.isArray(data.targetRoles) ? data.targetRoles : [],
    readBy: Array.isArray(data.readBy) ? data.readBy : [],
    createdAt: toIsoDate(data.createdAt),
  } as AppNotification;
}

// ============================================================
// REAL-TIME SUBSCRIPTION
// ============================================================

function emitNotifications(snapshots: Map<string, any>, callback: (notifications: AppNotification[]) => void): void {
  callback(
    Array.from(snapshots.values())
      .map(normalizeNotification)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
  );
}

export function subscribeToUserNotifications(
  userRole: string,
  userFarmIds: string[] | undefined,
  callback: (notifications: AppNotification[]) => void,
): () => void {
  const snapshots = new Map<string, Map<string, any>>();
  const emit = () => emitNotifications(
    new Map(Array.from(snapshots.values()).flatMap((querySnapshot) => Array.from(querySnapshot.entries()))),
    callback,
  );
  const roleQuery = () => db.collection('notifications').where('targetRoles', 'array-contains', userRole);

  if (userRole === 'supervisor') {
    const farmIds = Array.from(new Set((userFarmIds || []).filter(Boolean)));
    if (farmIds.length === 0) {
      callback([]);
      return () => {};
    }

    const unsubscribers: Array<() => void> = [];
    for (let index = 0; index < farmIds.length; index += SUPERVISOR_QUERY_CHUNK_SIZE) {
      const chunk = farmIds.slice(index, index + SUPERVISOR_QUERY_CHUNK_SIZE);
      const queryKey = `farm-chunk-${index}`;
      const queryNotifications = new Map<string, any>();
      snapshots.set(queryKey, queryNotifications);
      // Keep supervisor scoping in the Firestore query so security rules can
      // prove farm access without requiring a compound index. Filter the role
      // locally because every notification document is still role-tagged.
      const unsubscribe = db.collection('notifications').where('farmId', 'in', chunk).onSnapshot(
        (snapshot: any) => {
          queryNotifications.clear();
          snapshot.forEach((doc: any) => {
            const data = doc.data();
            if (Array.isArray(data.targetRoles) && data.targetRoles.includes(userRole)) {
              queryNotifications.set(doc.id, doc);
            }
          });
          emit();
        },
        (err: any) => {
          console.error('[NotificationService] Supervisor notification subscription error:', err);
          queryNotifications.clear();
          emit();
        },
      );
      unsubscribers.push(unsubscribe);
    }
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }

  // Admin: subscribe to all notifications targetted at their role
  const adminNotifications = new Map<string, any>();
  snapshots.set('admin', adminNotifications);
  const unsubscribe = roleQuery().onSnapshot(
    (snapshot: any) => {
      adminNotifications.clear();
      snapshot.forEach((doc: any) => adminNotifications.set(doc.id, doc));
      emit();
    },
    (err: any) => {
      console.error('[NotificationService] Notification subscription error:', err);
      callback([]);
    },
  );
  return unsubscribe;
}

// ============================================================
// READ STATE (per-user, not global)
// ============================================================

export async function markNotificationAsRead(notificationId: string, userId: string): Promise<void> {
  const FieldValue = getFirebaseFieldValue();
  try {
    if (FieldValue?.arrayUnion) {
      await db.collection('notifications').doc(notificationId).update({
        readBy: FieldValue.arrayUnion(userId),
      });
    } else {
      // Fallback: read-then-write (rare, FieldValue should always be available)
      const snap = await db.collection('notifications').doc(notificationId).get();
      if (snap.exists) {
        const existingReadBy: string[] = snap.data()?.readBy || [];
        if (!existingReadBy.includes(userId)) {
          await db.collection('notifications').doc(notificationId).update({
            readBy: [...existingReadBy, userId],
          });
        }
      }
    }
  } catch (err) {
    console.error('[NotificationService] markNotificationAsRead error:', err);
  }
}

export async function markAllNotificationsAsRead(notifications: AppNotification[], userId: string): Promise<void> {
  const unread = notifications.filter((notification) => !(notification.readBy || []).includes(userId));
  if (unread.length === 0) return;

  const FieldValue = getFirebaseFieldValue();
  const batch = db.batch();

  unread.forEach((notification) => {
    if (FieldValue?.arrayUnion) {
      batch.update(db.collection('notifications').doc(notification.id), {
        readBy: FieldValue.arrayUnion(userId),
      });
    }
  });

  try {
    await batch.commit();
  } catch (err) {
    console.error('[NotificationService] markAllNotificationsAsRead error:', err);
    // Fallback: individual updates
    for (const notification of unread) {
      await markNotificationAsRead(notification.id, userId);
    }
  }
}

// ============================================================
// FEED STOCK NOTIFICATION
// ============================================================

export async function evaluateFeedStockNotification(
  farmId: string,
  farmName: string,
  currentStock: number,
): Promise<void> {
  if (currentStock > 0) return;
  const eventDate = getIstDate();
  const id = notificationId('feed_stock_depleted', farmId, eventDate);
  const farmLabel = farmName ? `Farm ${farmId} (${farmName})` : `Farm ${farmId}`;

  try {
    await db.collection('notifications').doc(id).set(baseNotification(
      id,
      {
        type: 'feed_stock_depleted',
        priority: 'CRITICAL',
        title: 'Feed Stock Depleted',
        message: `${farmLabel} has ${currentStock} Kg of feed stock remaining. Immediate feed replenishment is required.`,
      },
      farmId,
      farmName || farmId,
      new Date().toISOString(),
      eventDate,
      'feed_inventory',
    ), { merge: true });
  } catch (err) {
    console.error('[NotificationService] Failed to create feed stock notification:', err);
  }
}
