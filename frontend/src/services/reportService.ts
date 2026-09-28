import { db } from '../config/firebase';

export function getIstDate(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const y = parts.find((p) => p.type === 'year')?.value ?? '';
  const m = parts.find((p) => p.type === 'month')?.value ?? '';
  const d = parts.find((p) => p.type === 'day')?.value ?? '';
  return `${y}-${m}-${d}`;
}

export interface AllowedReportDateOption {
  key: 'yesterday' | 'today' | 'tomorrow';
  labelKey: string;
  isoDate: string;
  displayFormatted: string;
  dayOfWeekName: string;
}

export function getAllowedReportDates(baseDateIso?: string): AllowedReportDateOption[] {
  const todayIso = baseDateIso || getIstDate();
  const parts = todayIso.split('-').map(Number);
  if (parts.length < 3 || isNaN(parts[0])) {
    return [];
  }
  const [y, m, d] = parts;

  const todayUtc = new Date(Date.UTC(y, m - 1, d));
  const yesterdayUtc = new Date(todayUtc.getTime() - 24 * 3600 * 1000);
  const tomorrowUtc = new Date(todayUtc.getTime() + 24 * 3600 * 1000);

  const formatIso = (dateObj: Date): string => {
    const yr = dateObj.getUTCFullYear();
    const mo = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
    const dy = String(dateObj.getUTCDate()).padStart(2, '0');
    return `${yr}-${mo}-${dy}`;
  };

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const createOption = (key: 'yesterday' | 'today' | 'tomorrow', dateObj: Date): AllowedReportDateOption => {
    const isoDate = formatIso(dateObj);
    const dayOfWeekName = daysOfWeek[dateObj.getUTCDay()];
    const displayFormatted = formatDisplayDate(isoDate);
    return {
      key,
      labelKey: key === 'yesterday' ? 'farmer.yesterday' : key === 'today' ? 'farmer.today' : 'farmer.tomorrow',
      isoDate,
      displayFormatted,
      dayOfWeekName,
    };
  };

  return [
    createOption('yesterday', yesterdayUtc),
    createOption('today', todayUtc),
    createOption('tomorrow', tomorrowUtc),
  ];
}

export function normalizeDateToIstString(val: any): string | null {
  if (!val) return null;

  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      try {
        const parts = new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).formatToParts(parsed);
        const y = parts.find((p) => p.type === 'year')?.value;
        const m = parts.find((p) => p.type === 'month')?.value;
        const d = parts.find((p) => p.type === 'day')?.value;
        if (y && m && d) return `${y}-${m}-${d}`;
      } catch {
        // fallback
      }
      return trimmed.split('T')[0];
    }
    return trimmed.split('T')[0];
  }

  let dateObj: Date | null = null;
  if (typeof val === 'object') {
    if (typeof val.toDate === 'function') {
      try {
        dateObj = val.toDate();
      } catch {
        // fallback
      }
    } else if (typeof val.seconds === 'number') {
      dateObj = new Date(val.seconds * 1000);
    } else if (val instanceof Date) {
      dateObj = val;
    }
  } else if (typeof val === 'number') {
    const ms = val < 10000000000 ? val * 1000 : val;
    dateObj = new Date(ms);
  }

  if (dateObj && !isNaN(dateObj.getTime())) {
    try {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(dateObj);
      const y = parts.find((p) => p.type === 'year')?.value;
      const m = parts.find((p) => p.type === 'month')?.value;
      const d = parts.find((p) => p.type === 'day')?.value;
      if (y && m && d) return `${y}-${m}-${d}`;
    } catch {
      // fallback
    }
    return dateObj.toISOString().split('T')[0];
  }

  try {
    const str = String(val);
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
      return str.substring(0, 10);
    }
    return str;
  } catch {
    return null;
  }
}

export function formatDisplayDate(isoDate: any): string {
  if (!isoDate) return '';
  const dateStr = normalizeDateToIstString(isoDate);
  if (!dateStr || typeof dateStr !== 'string') return '';
  try {
    const cleanIso = dateStr.split('T')[0];
    const parts = cleanIso.split('-');
    if (parts.length < 3) return cleanIso;
    const [y, m, d] = parts;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthIdx = parseInt(m, 10) - 1;
    if (isNaN(monthIdx) || monthIdx < 0 || monthIdx > 11) return cleanIso;
    return `${d} ${months[monthIdx]} ${y}`;
  } catch {
    return String(isoDate);
  }
}

export interface ReportingWeekInfo {
  weekNumber: number | null;
  dayInWeek: number | null;
  daysElapsed: number | null;
  label: string;
  isValid: boolean;
  error?: string;
}

export function calculateReportingWeek(startDateInput: any, reportDateInput: any, baseWeek = 3): ReportingWeekInfo {
  if (!startDateInput || !reportDateInput) {
    return {
      weekNumber: null,
      dayInWeek: null,
      daysElapsed: null,
      label: '',
      isValid: false,
      error: !startDateInput ? 'Reporting anchor (user createdat) is missing' : 'Report date is missing',
    };
  }

  const startDateStr = normalizeDateToIstString(startDateInput);
  const reportDateStr = normalizeDateToIstString(reportDateInput);

  if (!startDateStr || typeof startDateStr !== 'string' || !reportDateStr || typeof reportDateStr !== 'string') {
    return {
      weekNumber: null,
      dayInWeek: null,
      daysElapsed: null,
      label: '',
      isValid: false,
      error: 'Invalid date format',
    };
  }

  try {
    const startIso = startDateStr.split('T')[0];
    const reportIso = reportDateStr.split('T')[0];

    const startParts = startIso.split('-').map(Number);
    const reportParts = reportIso.split('-').map(Number);

    if (startParts.length < 3 || reportParts.length < 3 || isNaN(startParts[0]) || isNaN(reportParts[0])) {
      return {
        weekNumber: null,
        dayInWeek: null,
        daysElapsed: null,
        label: '',
        isValid: false,
        error: 'Malformed date',
      };
    }

    const startDate = new Date(Date.UTC(startParts[0], startParts[1] - 1, startParts[2]));
    const reportDate = new Date(Date.UTC(reportParts[0], reportParts[1] - 1, reportParts[2]));

    const diffMs = reportDate.getTime() - startDate.getTime();
    if (isNaN(diffMs)) {
      return {
        weekNumber: null,
        dayInWeek: null,
        daysElapsed: null,
        label: '',
        isValid: false,
        error: 'Invalid timestamp difference',
      };
    }

    const daysElapsed = Math.max(0, Math.floor(diffMs / (24 * 3600 * 1000)));

    // Calendar week alignment based on Happy Hens poultry reporting convention:
    // - Sunday (day 0) is the whole number main week (e.g. 3, 4, ..., 7)
    // - Monday through Saturday are subperiods .1 through .6
    // - All 7 days within a Sunday-to-Saturday cycle share the exact same main weekNumber
    const repDayOfWeek = reportDate.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
    const startDayOfWeek = startDate.getUTCDay();

    // Sunday on or before reportDate
    const repSundayMs = reportDate.getTime() - repDayOfWeek * 24 * 3600 * 1000;
    // Sunday on or before startDate (anchor Sunday of the initial week)
    const startSundayMs = startDate.getTime() - startDayOfWeek * 24 * 3600 * 1000;

    if (repSundayMs < startSundayMs) {
      return {
        weekNumber: null,
        dayInWeek: null,
        daysElapsed: null,
        label: '',
        isValid: false,
        error: 'Report date is before start anchor date',
      };
    }

    const elapsedCalendarWeeks = Math.round((repSundayMs - startSundayMs) / (7 * 24 * 3600 * 1000));
    const weekNumber = baseWeek + elapsedCalendarWeeks;
    const dayInWeek = repDayOfWeek;
    const label = dayInWeek === 0 ? String(weekNumber) : `${weekNumber}.${dayInWeek}`;

    return {
      weekNumber,
      dayInWeek,
      daysElapsed,
      label,
      isValid: true,
    };
  } catch (err: any) {
    console.warn('[calculateReportingWeek] Failed to parse dates:', err);
    return {
      weekNumber: null,
      dayInWeek: null,
      daysElapsed: null,
      label: '',
      isValid: false,
      error: err?.message || 'Error parsing dates',
    };
  }
}

export function formatReportingWeekLabel(startDateInput: any, reportDateInput: any, baseWeek = 3): string {
  const res = calculateReportingWeek(startDateInput, reportDateInput, baseWeek);
  return res.isValid ? res.label : '';
}

export function calculateWeekNumber(startDateInput: any, reportDateInput: any, baseWeek = 3): number | null {
  const res = calculateReportingWeek(startDateInput, reportDateInput, baseWeek);
  return res.isValid ? res.weekNumber : null;
}

export interface SubmitReportInput {
  farmId: string;
  flockId: string;
  birdCount: number;
  feedKg: number;
  feedGrams?: number;
  feedG?: number;
  feedGramsPerBird?: number;
  mortality: number;
  culling: number;
  eggsProduced: number;
  selectionEggs: number;
  damagedEggs?: number;
  floorEggs?: number;
  temperature: number;
  tempMin?: number;
  tempMax?: number;
  eggWeight: { min: number; max: number; avg: number };
  bodyWeight?: { min: number; max: number; avg: number } | null;
  remarks: string;
  ammoniaPpm?: number | null;
  submittedBy: string;
  weekNumber?: number | null;
  weekLabel?: string;
  submissionDate?: string;
  reportDate?: string;
  submissionKey?: string;
}

export interface WeeklyMetricsDoc {
  farmId: string;
  weekNumber: number;
  reportDate: string;
  bodyWeight: { min: number; max: number; avg: number };
  ammoniaPpm?: number | null;
  submittedBy: string;
  submittedAt: string;
  updatedAt: string;
}

export function getWeeklyLockId(farmId: string, weekNumber: number): string {
  return `weekly_${farmId}_W${weekNumber}`;
}

export function subscribeToWeeklyMetrics(
  farmId: string,
  weekNumber: number,
  callback: (metrics: WeeklyMetricsDoc | null) => void,
): () => void {
  const docRef = db.collection('dailyReportLocks').doc(getWeeklyLockId(farmId, weekNumber));
  return docRef.onSnapshot(
    (doc: any) => {
      if (doc && doc.exists) {
        callback(doc.data() as WeeklyMetricsDoc);
      } else {
        callback(null);
      }
    },
    (err: any) => {
      console.warn('[reportService] subscribeToWeeklyMetrics error:', err);
      callback(null);
    },
  );
}

export async function saveWeeklyMetrics(
  farmId: string,
  weekNumber: number,
  userId: string,
  reportDate: string,
  bodyWeight: { min: number; max: number; avg: number },
  ammoniaPpm?: number | null,
): Promise<void> {
  const docRef = db.collection('dailyReportLocks').doc(getWeeklyLockId(farmId, weekNumber));
  const now = new Date().toISOString();
  await docRef.set({
    farmId,
    weekNumber,
    reportDate,
    bodyWeight,
    ammoniaPpm: ammoniaPpm ?? null,
    submittedBy: userId,
    submittedAt: now,
    updatedAt: now,
  }, { merge: true });
}

function hasDataChanged(input: SubmitReportInput, existing: any): boolean {
  if (Number(input.feedKg) !== Number(existing.feedKg ?? 0)) return true;
  if (Number(input.mortality) !== Number(existing.mortality ?? 0)) return true;
  if (Number(input.culling) !== Number(existing.culling ?? 0)) return true;
  if (Number(input.eggsProduced) !== Number(existing.eggsProduced ?? 0)) return true;
  if (Number(input.selectionEggs) !== Number(existing.selectionEggs ?? 0)) return true;
  if (Number(input.damagedEggs ?? 0) !== Number(existing.damagedEggs ?? 0)) return true;
  if (Number(input.floorEggs ?? 0) !== Number(existing.floorEggs ?? 0)) return true;
  if (Number(input.tempMin ?? input.temperature) !== Number(existing.tempMin ?? existing.temperature ?? 0)) return true;
  if (Number(input.tempMax ?? input.temperature) !== Number(existing.tempMax ?? existing.temperature ?? 0)) return true;
  if (Number(input.eggWeight?.min) !== Number(existing.eggWeight?.min ?? 0)) return true;
  if (Number(input.eggWeight?.max) !== Number(existing.eggWeight?.max ?? 0)) return true;
  if (Number(input.eggWeight?.avg) !== Number(existing.eggWeight?.avg ?? 0)) return true;
  
  const hasInputBw = Boolean(input.bodyWeight && (input.bodyWeight.min || input.bodyWeight.max));
  const hasExistingBw = Boolean(existing.bodyWeight && (existing.bodyWeight.min || existing.bodyWeight.max));
  if (hasInputBw !== hasExistingBw) return true;
  if (hasInputBw && hasExistingBw) {
    if (Number(input.bodyWeight!.min) !== Number(existing.bodyWeight.min ?? 0)) return true;
    if (Number(input.bodyWeight!.max) !== Number(existing.bodyWeight.max ?? 0)) return true;
    if (Number(input.bodyWeight!.avg) !== Number(existing.bodyWeight.avg ?? 0)) return true;
  }

  const inputAmmonia = input.ammoniaPpm != null && !isNaN(Number(input.ammoniaPpm)) ? Number(input.ammoniaPpm) : null;
  const existingAmmonia = existing.ammoniaPpm != null && !isNaN(Number(existing.ammoniaPpm)) ? Number(existing.ammoniaPpm) : null;
  if (inputAmmonia !== existingAmmonia) return true;

  if ((input.remarks || '').trim() !== (existing.remarks || '').trim()) return true;
  return false;
}

export function subscribeToTodayReport(
  userId: string,
  flockId: string,
  submissionDate: string,
  callback: (report: any | null) => void,
): () => void {
  const dailyLogRef = db.collection('dailyReports').doc(userId).collection('dailyLogs').doc(submissionDate);
  return dailyLogRef.onSnapshot(
    (doc: any) => {
      if (doc && doc.exists) {
        callback(doc.data());
      } else {
        callback(null);
      }
    },
    (err: any) => {
      console.warn('[reportService] subscribeToTodayReport error:', err);
      callback(null);
    },
  );
}

export async function submitReport(input: SubmitReportInput): Promise<{ reportId: string; version: number; isOffline?: boolean }> {
  const userId = input.submittedBy;
  const submissionDate = input.submissionDate || input.reportDate || getIstDate();
  const now = new Date().toISOString();

  const submissionKey = input.submissionKey || `sub_${userId}_${input.farmId}_${submissionDate}`;

  // If browser is explicitly offline, save to pending queue immediately
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    await savePendingSubmission({
      submissionKey,
      userId,
      farmId: input.farmId,
      reportDate: submissionDate,
      payload: { ...input, submissionDate, reportDate: submissionDate, submissionKey },
      createdAt: Date.now(),
      status: 'PENDING_SYNC',
    });
    return { reportId: `${userId}_${submissionDate}_${input.flockId}`, version: 1, isOffline: true };
  }

  const parentRef = db.collection('dailyReports').doc(userId);
  const dailyLogRef = db.collection('dailyReports').doc(userId).collection('dailyLogs').doc(submissionDate);
  const flockRef = db.collection('flocks').doc(input.flockId);
  const farmRef = db.collection('farms').doc(input.farmId);
  const userRef = db.collection('users').doc(userId);

  let finalVersion = 1;

  try {
    await db.runTransaction(async (transaction: any) => {
      // 0. Validate Report Date Window (Must be Yesterday, Today, or Tomorrow in IST)
      const allowedOptions = getAllowedReportDates();
      const allowedIsoDates = allowedOptions.map((o) => o.isoDate);
      if (!allowedIsoDates.includes(submissionDate)) {
        throw new Error('INVALID_REPORT_DATE_WINDOW');
      }

      // 1. Verify User Authorization
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) {
        throw new Error('USER_NOT_FOUND');
      }
      const userData = userDoc.data();
      if (userData.role !== 'farmer' || userData.active !== true) {
        throw new Error('USER_NOT_AUTHORIZED');
      }
      if (!userData.farmIds || !userData.farmIds.includes(input.farmId)) {
        throw new Error('FARM_NOT_ASSIGNED');
      }

      // Authoritative Report-Week Calculation from farmer's users document createdat
      const userCreatedAt = userData.createdat ?? userData.createdAt ?? userData.created_at ?? null;
      if (!userCreatedAt) {
        throw new Error('USER_CREATEDAT_MISSING');
      }
      const authReportingInfo = calculateReportingWeek(userCreatedAt, submissionDate, 3);
      if (!authReportingInfo.isValid || authReportingInfo.weekNumber == null) {
        throw new Error('INVALID_REPORTING_PERIOD');
      }
      const authoritativeWeekNumber = authReportingInfo.weekNumber;
      const authoritativeWeekLabel = authReportingInfo.label;

      const existingLog = await transaction.get(dailyLogRef);
      const flockDoc = await transaction.get(flockRef);
      const flockData = flockDoc.exists ? flockDoc.data() : null;

      const farmDoc = await transaction.get(farmRef);
      if (!farmDoc.exists) {
        throw new Error('FARM_NOT_FOUND');
      }
      const farmData = farmDoc.data();
      
      // Master Inventory Guards
      if (farmData.inventoryInitialized !== true) {
        throw new Error('INVENTORY_NOT_INITIALIZED');
      }

      const currentFeedStock = Number(farmData.currentFeedKg ?? 0);
      const currentBirdCount = Number(farmData.currentBirdCount ?? 0);

      if (!existingLog.exists) {
        // INITIAL SUBMISSION (VERSION 1)
        finalVersion = 1;
        
        if (input.feedKg > 0 && currentFeedStock < input.feedKg) {
          throw new Error('INSUFFICIENT_FEED');
        }
        
        const totalBirdDeduction = input.mortality + input.culling;
        if (totalBirdDeduction > 0 && currentBirdCount < totalBirdDeduction) {
          throw new Error('INSUFFICIENT_BIRDS');
        }

        const openingBirdCount = currentBirdCount; // Derived natively from master inventory
        const closingBirdCount = openingBirdCount - totalBirdDeduction;

        // Update Legacy Flock as requested (only if it exists)
        if (flockData) {
          transaction.set(flockRef, {
            currentBirds: closingBirdCount,
            totalMortality: (flockData.totalMortality || 0) + input.mortality,
            totalCulling: (flockData.totalCulling || 0) + input.culling,
            totalEggs: (flockData.totalEggs || 0) + input.eggsProduced,
            updatedAt: now,
          }, { merge: true });
        }

        transaction.set(parentRef, {
          userId,
          farmId: input.farmId,
          flockId: input.flockId,
          lastSubmissionDate: submissionDate,
          updatedAt: now,
        }, { merge: true });

        transaction.set(dailyLogRef, {
          userId,
          submittedBy: userId,
          farmId: input.farmId,
          flockId: input.flockId,
          submissionDate,
          submissionMethod: 'DIGITAL_FORM',
          submissionVersion: 1,
          status: 'submitted',
          submittedAt: now,
          createdAt: now,
          updatedAt: now,
          openingBirdCount,
          closingBirdCount,
          birdCount: closingBirdCount,
          openingFeedKg: currentFeedStock,
          feedKg: input.feedKg,
          closingFeedKg: currentFeedStock - input.feedKg,
          feedGrams: input.feedGrams ?? input.feedKg * 1000,
          feedG: input.feedG ?? input.feedKg * 1000,
          feedGramsPerBird:
            input.feedGramsPerBird ??
            (openingBirdCount > 0 && input.feedKg > 0
              ? Number(((input.feedKg * 1000) / openingBirdCount).toFixed(1))
              : null),
          mortality: input.mortality,
          culling: input.culling,
          eggsProduced: input.eggsProduced,
          selectionEggs: input.selectionEggs,
          damagedEggs: input.damagedEggs ?? 0,
          floorEggs: input.floorEggs ?? 0,
          temperature: input.temperature,
          tempMin: input.tempMin ?? input.temperature,
          tempMax: input.tempMax ?? input.temperature,
          eggWeight: input.eggWeight,
          bodyWeight: input.bodyWeight ?? null,
          remarks: input.remarks,
          ammoniaPpm: input.ammoniaPpm ?? null,
          weekNumber: authoritativeWeekNumber,
          weekLabel: authoritativeWeekLabel,
        }, { merge: true });

        if (input.bodyWeight) {
          const weeklyLockRef = db.collection('dailyReportLocks').doc(getWeeklyLockId(input.farmId, authoritativeWeekNumber));
          transaction.set(weeklyLockRef, {
            farmId: input.farmId,
            weekNumber: authoritativeWeekNumber,
            reportDate: submissionDate,
            bodyWeight: input.bodyWeight,
            ammoniaPpm: input.ammoniaPpm ?? null,
            submittedBy: userId,
            submittedAt: now,
            updatedAt: now,
          }, { merge: true });
        }

        if (input.mortality > 0) {
          const birdTxRef = db.collection('farms').doc(input.farmId).collection('birdTransactions').doc();
          transaction.set(birdTxRef, {
            farmId: input.farmId,
            flockId: input.flockId,
            type: 'MORTALITY',
            count: input.mortality,
            reportDate: submissionDate,
            createdAt: now,
            userId,
          });
        }

        if (input.culling > 0) {
          const birdTxRef = db.collection('farms').doc(input.farmId).collection('birdTransactions').doc();
          transaction.set(birdTxRef, {
            farmId: input.farmId,
            flockId: input.flockId,
            type: 'CULLING',
            count: input.culling,
            reportDate: submissionDate,
            createdAt: now,
            userId,
          });
        }

        // Update master farm inventory (Atomic)
        transaction.set(farmRef, {
          currentBirdCount: closingBirdCount,
          currentFeedKg: currentFeedStock - input.feedKg,
          totalFeedConsumedKg: (farmData.totalFeedConsumedKg || 0) + input.feedKg,
          inventoryUpdatedAt: now,
          updatedAt: now,
        }, { merge: true });

        if (input.feedKg > 0) {
          const feedTxRef = db.collection('farms').doc(input.farmId).collection('feedTransactions').doc();
          transaction.set(feedTxRef, {
            farmId: input.farmId,
            flockId: input.flockId,
            type: 'FEED_USAGE',
            feedKg: input.feedKg,
            reportDate: submissionDate,
            createdAt: now,
            userId,
          });
        }

      } else {
        // EXISTING REPORT: CORRECTION / REVISION (VERSION 2)
        const existingData = existingLog.data();
        const currentVersion = Number(existingData.submissionVersion || 1);

        if (currentVersion >= 2 || existingData.status === 'corrected' || existingData.status === 'finalized') {
          throw new Error('CORRECTION_LIMIT_REACHED');
        }

        if (!hasDataChanged(input, existingData)) {
          throw new Error('NO_CHANGES_DETECTED');
        }

        finalVersion = 2;

        // 1. Archive Version 1 into subcollection
        const revRef = dailyLogRef.collection('revisions').doc('v1');
        transaction.set(revRef, {
          ...existingData,
          archivedAt: now,
          archivedReason: 'FARMER_CORRECTION_V2',
        });

        // 2. Calculate diffs
        const feedDiff = input.feedKg - Number(existingData.feedKg || 0);
        const mortalityDiff = input.mortality - Number(existingData.mortality || 0);
        const cullingDiff = input.culling - Number(existingData.culling || 0);
        const eggsDiff = input.eggsProduced - Number(existingData.eggsProduced || 0);

        if (feedDiff > 0 && currentFeedStock < feedDiff) {
          throw new Error('INSUFFICIENT_FEED');
        }

        const totalBirdDeductionDiff = mortalityDiff + cullingDiff;
        if (totalBirdDeductionDiff > 0 && currentBirdCount < totalBirdDeductionDiff) {
          throw new Error('INSUFFICIENT_BIRDS');
        }

        // 3. Update Legacy flock totals (if exists)
        if (flockData) {
          transaction.set(flockRef, {
            currentBirds: (flockData.currentBirds || 0) - totalBirdDeductionDiff,
            totalMortality: (flockData.totalMortality || 0) + mortalityDiff,
            totalCulling: (flockData.totalCulling || 0) + cullingDiff,
            totalEggs: (flockData.totalEggs || 0) + eggsDiff,
            updatedAt: now,
          }, { merge: true });
        }

        // 4. Update master farm inventory (Atomic Delta)
        const newFarmBirdCount = currentBirdCount - totalBirdDeductionDiff;
        transaction.set(farmRef, {
          currentBirdCount: newFarmBirdCount,
          currentFeedKg: currentFeedStock - feedDiff,
          totalFeedConsumedKg: (farmData.totalFeedConsumedKg || 0) + feedDiff,
          inventoryUpdatedAt: now,
          updatedAt: now,
        }, { merge: true });

        const openingBirdCount = existingData.openingBirdCount ?? currentBirdCount;
        const closingBirdCount = openingBirdCount - input.mortality - input.culling;

        if (feedDiff !== 0) {
          const feedTxRef = db.collection('farms').doc(input.farmId).collection('feedTransactions').doc();
          transaction.set(feedTxRef, {
            farmId: input.farmId,
            flockId: input.flockId,
            type: 'FEED_USAGE_CORRECTION',
            feedKg: feedDiff,
            reportDate: submissionDate,
            createdAt: now,
            userId,
          });
        }

        // 5. Update canonical daily report with Version 2 values
        transaction.set(dailyLogRef, {
          submissionVersion: 2,
          status: 'corrected',
          updatedAt: now,
          correctedAt: now,
          openingBirdCount,
          closingBirdCount,
          birdCount: closingBirdCount,
          openingFeedKg: existingData.openingFeedKg ?? currentFeedStock,
          feedKg: input.feedKg,
          closingFeedKg: (existingData.openingFeedKg ?? currentFeedStock) - input.feedKg,
          feedGrams: input.feedGrams ?? input.feedKg * 1000,
          feedG: input.feedG ?? input.feedKg * 1000,
          feedGramsPerBird:
            input.feedGramsPerBird ??
            (openingBirdCount > 0 && input.feedKg > 0
              ? Number(((input.feedKg * 1000) / openingBirdCount).toFixed(1))
              : null),
          mortality: input.mortality,
          culling: input.culling,
          eggsProduced: input.eggsProduced,
          selectionEggs: input.selectionEggs,
          damagedEggs: input.damagedEggs ?? 0,
          floorEggs: input.floorEggs ?? 0,
          temperature: input.temperature,
          tempMin: input.tempMin ?? input.temperature,
          tempMax: input.tempMax ?? input.temperature,
          eggWeight: input.eggWeight,
          bodyWeight: input.bodyWeight ?? null,
          remarks: input.remarks,
          ammoniaPpm: input.ammoniaPpm ?? null,
          weekNumber: authoritativeWeekNumber,
          weekLabel: authoritativeWeekLabel,
          previousVersionData: {
            feedKg: existingData.feedKg,
            mortality: existingData.mortality,
            culling: existingData.culling,
            eggsProduced: existingData.eggsProduced,
            selectionEggs: existingData.selectionEggs,
            damagedEggs: existingData.damagedEggs,
            floorEggs: existingData.floorEggs,
            submittedAt: existingData.submittedAt || existingData.createdAt,
          },
        }, { merge: true });

        if (input.bodyWeight) {
          const weeklyLockRef = db.collection('dailyReportLocks').doc(getWeeklyLockId(input.farmId, authoritativeWeekNumber));
          transaction.set(weeklyLockRef, {
            farmId: input.farmId,
            weekNumber: authoritativeWeekNumber,
            reportDate: submissionDate,
            bodyWeight: input.bodyWeight,
            ammoniaPpm: input.ammoniaPpm ?? null,
            submittedBy: userId,
            updatedAt: now,
          }, { merge: true });
        }
      }
    });

    // Clean up any pending queue item if online submission succeeded
    await removePendingSubmission(submissionKey);

    return { reportId: `${userId}_${submissionDate}_${input.flockId}`, version: finalVersion };
  } catch (err: any) {
    const errMsg = String(err?.message || err || '').toLowerCase();
    const isNetworkError =
      err?.code === 'unavailable' ||
      err?.code === 'failed-precondition' ||
      errMsg.includes('offline') ||
      errMsg.includes('network') ||
      errMsg.includes('fetch');

    if (isNetworkError) {
      console.warn('[reportService] Transaction failed due to network/offline state. Saving to pending queue.');
      await savePendingSubmission({
        submissionKey,
        userId,
        farmId: input.farmId,
        reportDate: submissionDate,
        payload: input,
        createdAt: Date.now(),
        status: 'PENDING_SYNC',
      });
      return { reportId: `${userId}_${submissionDate}_${input.flockId}`, version: 1, isOffline: true };
    }

    throw err;
  }
}

import {
  savePendingSubmission,
  getPendingSubmissions,
  removePendingSubmission,
  clearFarmerDraft,
} from './offlineDraftService';

let isSyncingPending = false;

export async function syncPendingSubmissions(userId: string): Promise<number> {
  if (isSyncingPending) return 0;
  isSyncingPending = true;

  try {
    const pendingList = await getPendingSubmissions(userId);
    if (!pendingList || pendingList.length === 0) return 0;

    let syncedCount = 0;
    for (const item of pendingList) {
      const targetDate: string = item.reportDate || item.payload.submissionDate || item.payload.reportDate || getIstDate();
      const targetKey = item.submissionKey || `sub_${item.userId}_${item.farmId}_${targetDate}`;

      const payloadWithMeta: SubmitReportInput = {
        ...item.payload,
        submissionDate: targetDate,
        reportDate: targetDate,
        submissionKey: targetKey,
      };

      try {
        const res = await submitReport(payloadWithMeta);
        if (!res.isOffline) {
          await removePendingSubmission(targetKey);
          await clearFarmerDraft(item.userId, item.farmId, targetDate);
          syncedCount++;
        }
      } catch (err: any) {
        console.warn('[reportService] syncPendingSubmissions item error:', err);
        const nonRetryableErrors = [
          'NO_CHANGES_DETECTED',
          'CORRECTION_LIMIT_REACHED',
          'USER_NOT_AUTHORIZED',
          'USER_NOT_FOUND',
          'FARM_NOT_ASSIGNED',
          'INVENTORY_NOT_INITIALIZED',
          'FARM_NOT_FOUND',
          'USER_CREATEDAT_MISSING',
          'INVALID_REPORTING_PERIOD',
          'INVALID_REPORT_DATE_WINDOW',
        ];
        if (nonRetryableErrors.includes(err.message)) {
          await removePendingSubmission(targetKey);
          await clearFarmerDraft(item.userId, item.farmId, targetDate);
        }
      }
    }
    return syncedCount;
  } finally {
    isSyncingPending = false;
  }
}
