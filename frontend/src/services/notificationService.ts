import { db } from '../config/firebase';
import { getIstDate, formatDisplayDate } from '../utils/dateUtils';
import { KPI_THRESHOLDS } from '../config/kpiThresholds';
import { calcMortalityRate, calcProductionRate, calcSelectionRate, getEligibleBirdCount } from '../utils/kpiCalculations';
import { ReportDoc } from './reportDataService';
import { FarmDoc } from './farmDataService';

export interface AppNotification {
  id: string; // Document ID
  type: string; // 'missing_report', 'mortality_disaster', etc.
  priority: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  message: string;
  farmId: string;
  farmName?: string;
  targetRoles: string[]; // ['admin', 'supervisor']
  createdAt: string;
  readBy: string[]; // Array of user UIDs who have read the notification
  actionType?: string;
  actionData?: string;
}

export async function generateNotificationsForReport(
  report: any,
  farmName: string,
  base: number
): Promise<void> {
  const today = getIstDate();
  const batch = db.batch();
  let operationsCount = 0;

  const farmLabel = farmName ? `Farm ${report.farmId} (${farmName})` : `Farm ${report.farmId}`;

  const mort = Number(report.mortality) || 0;
  const mortPct = base > 0 ? calcMortalityRate(mort, base) : 0;
  const prodPct = base > 0 ? calcProductionRate(report.eggsProduced ?? 0, base) : 0;
  const selectPct = calcSelectionRate(report.selectionEggs ?? 0, report.eggsProduced ?? 0);

  let docId = '';
  let alertData: Partial<AppNotification> | null = null;

  if (base > 0 && mort >= base) {
    docId = `mort_disaster_${report.farmId}_${today}`;
    alertData = {
      type: 'mortality_disaster',
      priority: 'CRITICAL',
      title: `TOTAL FLOCK MORTALITY DISASTER`,
      message: `${farmLabel} reported 100% loss of the entire eligible flock (${mort.toLocaleString()} dead birds). Immediate operational intervention required.`
    };
  } else if (mortPct >= (KPI_THRESHOLDS.mortalityRateCritical ?? 10)) {
    docId = `mort_crit_${report.farmId}_${today}`;
    alertData = {
      type: 'mortality_critical',
      priority: 'CRITICAL',
      title: `CRITICAL Mortality Alert (${mortPct}%)`,
      message: `${farmLabel} recorded ${mort} dead birds (${mortPct}% mortality rate, exceeding critical threshold).`
    };
  } else if (mortPct >= (KPI_THRESHOLDS.mortalityRateWarning ?? 5)) {
    docId = `mort_warn_${report.farmId}_${today}`;
    alertData = {
      type: 'mortality_warning',
      priority: 'WARNING',
      title: `High Daily Mortality Alert (${mortPct}%)`,
      message: `${farmLabel} recorded ${mort} dead birds (${mortPct}% mortality rate).`
    };
  }

  if (alertData && docId) {
    const docRef = db.collection('notifications').doc(docId);
    batch.set(docRef, {
      id: docId,
      ...alertData,
      farmId: report.farmId,
      farmName: farmName || report.farmId,
      targetRoles: ['admin', 'supervisor'],
      createdAt: new Date().toISOString(),
    }, { merge: true });
    operationsCount++;
  }

  if (prodPct < 55.0 && base > 0) {
    const pDocId = `prod_drop_${report.farmId}_${today}`;
    batch.set(db.collection('notifications').doc(pDocId), {
      id: pDocId,
      type: 'production_drop',
      priority: 'CRITICAL',
      title: `Low Production Drop Alert`,
      message: `${farmLabel} production dropped to ${prodPct}% (${report.eggsProduced.toLocaleString()} eggs).`,
      farmId: report.farmId,
      farmName: farmName || report.farmId,
      targetRoles: ['admin', 'supervisor'],
      createdAt: new Date().toISOString(),
    }, { merge: true });
    operationsCount++;
  }

  if (selectPct < 80.0 && report.eggsProduced > 0) {
    const sDocId = `select_warn_${report.farmId}_${today}`;
    batch.set(db.collection('notifications').doc(sDocId), {
      id: sDocId,
      type: 'selection_warning',
      priority: 'WARNING',
      title: `Egg Quality / Selection Warning`,
      message: `${farmLabel} selection egg rate is ${selectPct}% (${report.selectionEggs} selection eggs).`,
      farmId: report.farmId,
      farmName: farmName || report.farmId,
      targetRoles: ['admin', 'supervisor'],
      createdAt: new Date().toISOString(),
    }, { merge: true });
    operationsCount++;
  }

  if (report.temperature && (report.temperature > 50 || report.temperature < 10)) {
    const tDocId = `temp_abnormal_${report.farmId}_${today}`;
    batch.set(db.collection('notifications').doc(tDocId), {
      id: tDocId,
      type: 'temperature_abnormal',
      priority: 'WARNING',
      title: `Abnormal Temperature Warning`,
      message: `${farmLabel} temperature recorded at ${report.temperature}°C (acceptable: 10°C – 50°C).`,
      farmId: report.farmId,
      farmName: farmName || report.farmId,
      targetRoles: ['admin', 'supervisor'],
      createdAt: new Date().toISOString(),
    }, { merge: true });
    operationsCount++;
  }

  if (operationsCount > 0) {
    try {
      await batch.commit();
    } catch (err) {
      console.error('[NotificationService] Failed to commit notifications:', err);
    }
  }
}

/**
 * Checks for missing reports and creates persistent notifications in Firestore.
 * This can be hooked up to a daily cron job.
 */
export async function generateMissingReportNotifications(
  todayReports: ReportDoc[],
  activeFarms: FarmDoc[],
  farmers: { uid: string; farmIds?: string[] }[]
): Promise<void> {
  const today = getIstDate();
  const batch = db.batch();
  let operationsCount = 0;

  const expectedFarmsToReport = activeFarms.filter((f) =>
    farmers.some((u) => u.farmIds?.some((id) => id?.trim().toUpperCase() === f.farmId?.trim().toUpperCase()))
  );

  const validTodayReports = todayReports.filter((r) => r.status !== 'draft');
  const submittedFarmIdsSet = new Set(
    validTodayReports.map((r) => r.farmId?.trim().toUpperCase()).filter(Boolean)
  );

  expectedFarmsToReport.forEach((f) => {
    const normalizedId = f.farmId?.trim().toUpperCase();
    if (!submittedFarmIdsSet.has(normalizedId)) {
      const docId = `missing_${f.farmId}_${today}`;
      const docRef = db.collection('notifications').doc(docId);
      const farmLabel = f.name ? `Farm ${f.farmId} (${f.name})` : `Farm ${f.farmId}`;
      
      batch.set(docRef, {
        id: docId,
        type: 'missing_report',
        priority: 'WARNING',
        title: `Missing Daily Report Today`,
        message: `${farmLabel} has not submitted a report for ${formatDisplayDate(today)}.`,
        farmId: f.farmId,
        farmName: f.name || f.farmId,
        targetRoles: ['admin', 'supervisor'],
        createdAt: new Date().toISOString(),
      }, { merge: true }); 
      operationsCount++;
    }
  });

  if (operationsCount > 0) {
    try {
      await batch.commit();
    } catch (err) {
      console.error('[NotificationService] Failed to commit missing report notifications:', err);
    }
  }
}


export function subscribeToUserNotifications(
  userRole: string,
  userFarmIds: string[] | undefined,
  callback: (notifications: AppNotification[]) => void
): () => void {
  let query = db.collection('notifications').where('targetRoles', 'array-contains', userRole);

  return query.onSnapshot((snap: any) => {
    let notifications: AppNotification[] = [];
    snap.forEach((doc: any) => {
      const data = doc.data() as AppNotification;
      notifications.push(data);
    });

    // Supervisor scoping
    if (userRole === 'supervisor' && userFarmIds) {
      const farmSet = new Set(userFarmIds);
      notifications = notifications.filter((n) => !n.farmId || farmSet.has(n.farmId));
    }

    // Sort by descending createdAt
    notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    callback(notifications);
  }, (err: any) => {
    console.error('[NotificationService] Error subscribing to notifications:', err);
    callback([]);
  });
}

export async function markNotificationAsRead(notificationId: string, userId: string): Promise<void> {
  const docRef = db.collection('notifications').doc(notificationId);
  try {
    await db.runTransaction(async (transaction: any) => {
      const doc = await transaction.get(docRef);
      if (doc.exists) {
        const data = doc.data() as AppNotification;
        const readBy = data.readBy || [];
        if (!readBy.includes(userId)) {
          readBy.push(userId);
          transaction.update(docRef, { readBy });
        }
      }
    });
  } catch (err) {
    console.error('[NotificationService] markNotificationAsRead error:', err);
  }
}

export async function markAllNotificationsAsRead(notifications: AppNotification[], userId: string): Promise<void> {
  const unread = notifications.filter(n => !(n.readBy || []).includes(userId));
  if (unread.length === 0) return;
  
  const batch = db.batch();
  unread.forEach(n => {
    const docRef = db.collection('notifications').doc(n.id);
    batch.update(docRef, {
      readBy: (window as any).firebase.firestore.FieldValue.arrayUnion(userId)
    });
  });
  
  try {
    await batch.commit();
  } catch (err) {
    console.error('[NotificationService] markAllNotificationsAsRead error:', err);
  }
}
