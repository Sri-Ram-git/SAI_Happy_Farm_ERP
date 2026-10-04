import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { logoutUser } from '../services/authService';
import {
  submitReport,
  syncPendingSubmissions,
  subscribeToTodayReport,
  getIstDate,
  formatDisplayDate,
  calculateWeekNumber,
  calculateReportingWeek,
  subscribeToWeeklyMetrics,
  getAllowedReportDates,
  type WeeklyMetricsDoc,
  type AllowedReportDateOption,
} from '../services/reportService';
import { saveFarmerDraft, getFarmerDraft, clearFarmerDraft } from '../services/offlineDraftService';
import { subscribeToFlocksByFarm, type FlockDoc } from '../services/flockDataService';
import { subscribeToFarm, type FarmDoc } from '../services/farmDataService';
import { LanguageSelector } from '../components/LanguageSelector';
import { OverwriteConfirmationModal } from '../components/OverwriteConfirmationModal';
import { TotalMortalityConfirmationModal } from '../components/TotalMortalityConfirmationModal';
import { Calendar, Check, Home, Lock, LogOut, AlertTriangle } from 'lucide-react';
import { KPI_THRESHOLDS } from '../config/kpiThresholds';
import {
  FarmFormData,
  INITIAL_FARM_FORM_DATA,
  FarmFormErrors,
  STEP_NAMES,
  validateStep,
  calculateFeedGramsPerBird,
  isHighAmmonia,
} from '../utils/formValidation';

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {error && <span className="field-error">{error.startsWith('validation.') ? t(error) : error}</span>}
    </div>
  );
}

function VerifyCard({ title, onEdit, children, t }: { title: string; onEdit: () => void; children: React.ReactNode; t: any }) {
  return (
    <div className="verify-card">
      <div className="verify-header">
        <h4 className="verify-title">{title}</h4>
        <button className="verify-edit" onClick={onEdit} type="button">{t('common.edit')}</button>
      </div>
      {children}
    </div>
  );
}

function VerifyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="verify-row">
      <span className="verify-label">{label}</span>
      <span className="verify-value">{value}</span>
    </div>
  );
}

interface VerifyProps {
  data: FarmFormData;
  farmId: string;
  reportDate: string;
  weekNumber: number | null;
  weekLabel: string;
  birdCount: number;
  mortalityPct: string;
  cullingPct: string;
  eggProdPct: string;
  selectionPct: string;
  feedKgDisplay: number;
  feedPerBirdDisplay: number;
  weeklyMetrics: WeeklyMetricsDoc | null;
  onEdit: (step: number) => void;
  t: any;
  flockName: string;
}

function VerifyScreen({
  data,
  farmId,
  reportDate,
  weekNumber,
  weekLabel,
  birdCount,
  mortalityPct,
  cullingPct,
  eggProdPct,
  selectionPct,
  feedKgDisplay,
  feedPerBirdDisplay,
  weeklyMetrics,
  onEdit,
  t,
  flockName,
}: VerifyProps) {
  return (
    <>
      <h3 className="form-section-title">{t('farmer.verifyReport')}</h3>

      <VerifyCard title={t('common.info')} onEdit={() => onEdit(0)} t={t}>
        <VerifyRow label={t('common.date')} value={formatDisplayDate(reportDate)} />
        <VerifyRow label={t('flock.farm')} value={farmId} />
        <VerifyRow label={t('farmer.week')} value={weekLabel ? `${t('farmer.week')} ${weekLabel}` : '--'} />
        {flockName && <VerifyRow label={t('flock.flockName')} value={flockName} />}
      </VerifyCard>

      <VerifyCard title={t('farmer.step1')} onEdit={() => onEdit(0)} t={t}>
        <VerifyRow label={t('farmer.openingBirds')} value={birdCount.toLocaleString()} />
        <VerifyRow label={t('farmer.closingBirds')} value={`${(birdCount - Number(data.mortality || 0) - Number(data.culling || 0)).toLocaleString()}`} />
      </VerifyCard>

      <VerifyCard title={t('farmer.feed')} onEdit={() => onEdit(0)} t={t}>
        <VerifyRow label={`${t('farmer.feedUsed', 'Feed Used')} (kg)`} value={`${feedKgDisplay.toFixed(2)} kg`} />
        <VerifyRow label={`${t('farmer.feedPerBird', 'Feed per Bird')} (g/bird)`} value={birdCount > 0 && feedKgDisplay > 0 ? `${feedPerBirdDisplay} g/bird` : '--'} />
        <VerifyRow label={t('farmer.equivalentWeight')} value={`${(feedKgDisplay * 1000).toLocaleString()} g`} />
      </VerifyCard>

      <VerifyCard title={t('farmer.mortality')} onEdit={() => onEdit(0)} t={t}>
        <VerifyRow label={t('farmer.count')} value={data.mortality || '0'} />
        <VerifyRow label={t('farmer.rate')} value={`${mortalityPct}%`} />
      </VerifyCard>

      <VerifyCard title={t('farmer.culling')} onEdit={() => onEdit(0)} t={t}>
        <VerifyRow label={t('farmer.count')} value={data.culling || '0'} />
        <VerifyRow label={t('farmer.rate')} value={`${cullingPct}%`} />
      </VerifyCard>

      <VerifyCard title={t('farmer.eggProduction')} onEdit={() => onEdit(1)} t={t}>
        <VerifyRow label={t('farmer.produced')} value={`${data.eggsProduced} (${eggProdPct}%)`} />
      </VerifyCard>

      <VerifyCard title={t('farmer.selectionEggs')} onEdit={() => onEdit(1)} t={t}>
        <VerifyRow label={t('farmer.count')} value={`${data.selectionEggs} (${selectionPct}%)`} />
      </VerifyCard>

      <VerifyCard title={t('farmer.damagedEggs')} onEdit={() => onEdit(1)} t={t}>
        <VerifyRow label={t('farmer.count')} value={data.damagedEggs || '0'} />
      </VerifyCard>

      <VerifyCard title={t('farmer.floorEggs')} onEdit={() => onEdit(1)} t={t}>
        <VerifyRow label={t('farmer.count')} value={data.floorEggs || '0'} />
      </VerifyCard>

      <VerifyCard title={t('farmer.temperature')} onEdit={() => onEdit(1)} t={t}>
        <VerifyRow label={t('farmer.minTemp')} value={`${data.tempMin} °C`} />
        <VerifyRow label={t('farmer.maxTemp')} value={`${data.tempMax} °C`} />
        <VerifyRow label={t('farmer.avgTemp')} value={`${((Number(data.tempMin) + Number(data.tempMax)) / 2).toFixed(1)} °C`} />
      </VerifyCard>

      <VerifyCard title={t('farmer.eggWeight')} onEdit={() => onEdit(2)} t={t}>
        <VerifyRow label={t('farmer.min')} value={`${data.eggWeightMin} g`} />
        <VerifyRow label={t('farmer.max')} value={`${data.eggWeightMax} g`} />
        <VerifyRow label={t('farmer.avg')} value={`${data.eggWeightAvg} g`} />
      </VerifyCard>

      <VerifyCard title={t('farmer.bodyWeight')} onEdit={() => onEdit(2)} t={t}>
        {data.bodyWeightMin ? (
          <>
            <VerifyRow label={t('farmer.min')} value={`${data.bodyWeightMin} g`} />
            <VerifyRow label={t('farmer.max')} value={`${data.bodyWeightMax} g`} />
            <VerifyRow label={t('farmer.avg')} value={`${data.bodyWeightAvg} g`} />
          </>
        ) : weeklyMetrics ? (
          <div style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: '6px', fontSize: '13px', color: '#475569' }}>
            {t('farmer.weeklyAlreadyRecorded', { week: weekNumber, date: formatDisplayDate(weeklyMetrics.reportDate) })}: <strong>{weeklyMetrics.bodyWeight.avg} g</strong> ({weeklyMetrics.bodyWeight.min} – {weeklyMetrics.bodyWeight.max} g)
          </div>
        ) : (
          <div style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: '6px', fontSize: '13px', color: '#64748b' }}>
            {t('farmer.optionalWeekly')}
          </div>
        )}
      </VerifyCard>

      <VerifyCard title={t('common.other')} onEdit={() => onEdit(2)} t={t}>
        {data.ammoniaPpm !== '' ? (
          <>
            <VerifyRow label={t('farmer.ammonium')} value={`${data.ammoniaPpm} PPM`} />
            {isHighAmmonia(data.ammoniaPpm) && (
              <div style={{ marginTop: '8px', padding: '10px 14px', background: '#fffbeb', borderLeft: '4px solid #f59e0b', borderRadius: '6px' }}>
                <strong style={{ color: '#92400e', display: 'block', marginBottom: '2px', fontSize: '12px' }}>
                  ⚠️ {t('farmer.ammoniaAlertTitle')}
                </strong>
                <p style={{ margin: 0, fontSize: '12px', color: '#78350f' }}>
                  {t('farmer.ammoniaAlertMessage')}
                </p>
              </div>
            )}
          </>
        ) : (
          <VerifyRow label={t('farmer.ammonium')} value={`-- ${t('farmer.optionalDailyWeekly')}`} />
        )}
        {data.remarks && <VerifyRow label={t('farmer.remarks')} value={data.remarks} />}
      </VerifyCard>
    </>
  );
}

function DateSelectionOverlay({
  allowedOptions,
  selectedDate,
  onSelectDate,
  onClose,
  t,
}: {
  allowedOptions: AllowedReportDateOption[];
  selectedDate: string;
  onSelectDate: (isoDate: string) => void;
  onClose: () => void;
  t: any;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={overlayRef}
      className="date-selection-popover"
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-label={t('farmer.selectReportDate', 'Select report date')}
    >
      <div className="date-popover-header">
        <span className="date-popover-title">{t('farmer.selectReportDate', 'Select report date')}</span>
        <button
          type="button"
          className="date-popover-close"
          onClick={onClose}
          aria-label={t('common.close', 'Close')}
        >
          ✕
        </button>
      </div>

      <div className="date-popover-options">
        {allowedOptions.map((option) => {
          const isSelected = option.isoDate === selectedDate;
          const labelText = t(option.labelKey, option.key === 'yesterday' ? 'Yesterday' : 'Today');

          return (
            <button
              key={option.isoDate}
              type="button"
              className={`date-option-card ${isSelected ? 'selected' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onSelectDate(option.isoDate);
              }}
            >
              <div className="date-option-left">
                <span className="date-option-label">{labelText}</span>
                <span className="date-option-sub">
                  {option.dayOfWeekName}, {option.displayFormatted}
                </span>
              </div>
              {isSelected && <Check size={16} className="date-option-check" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function FarmerFormPage() {
  const { t } = useTranslation();
  const { userProfile, firebaseUser, loading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const allowedOptions = getAllowedReportDates();
  const allowedIsoDates = allowedOptions.map((o) => o.isoDate);
  const todayIso = allowedOptions.find((o) => o.key === 'today')?.isoDate || getIstDate();

  const [reportDate, setReportDate] = useState<string>(() => {
    const qDate = searchParams.get('date');
    if (qDate && allowedIsoDates.includes(qDate)) {
      return qDate;
    }
    return todayIso;
  });

  const [isDateOverlayOpen, setIsDateOverlayOpen] = useState(false);
  const [showOverwriteModal, setShowOverwriteModal] = useState(false);

  useEffect(() => {
    const qDate = searchParams.get('date');
    if (qDate && qDate !== reportDate) {
      if (allowedIsoDates.includes(qDate)) {
        setReportDate(qDate);
      } else {
        setReportDate(todayIso);
        setSearchParams({ date: todayIso }, { replace: true });
      }
    }
  }, [searchParams]);

  const handleDateChange = (newDate: string) => {
    if (!newDate || !allowedIsoDates.includes(newDate)) return;
    setReportDate(newDate);
    setSearchParams({ date: newDate }, { replace: true });
    setIsDateOverlayOpen(false);
  };

  const [step, setStep] = useState(0);
  const [data, setData] = useState<FarmFormData>(INITIAL_FARM_FORM_DATA);
  const [errors, setErrors] = useState<FarmFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedOffline, setSubmittedOffline] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const [flocks, setFlocks] = useState<FlockDoc[]>([]);
  const [farmDoc, setFarmDoc] = useState<FarmDoc | null>(null);
  const [todayReport, setTodayReport] = useState<any | null>(null);
  const [showLimitModal, setShowLimitModal] = useState<boolean>(false);
  const [showDisclaimerModal, setShowDisclaimerModal] = useState<boolean>(false);
  const [hasDismissedModal, setHasDismissedModal] = useState<boolean>(false);
  const [showTotalMortalityModal, setShowTotalMortalityModal] = useState<boolean>(false);
  const [totalMortalityConfirmed, setTotalMortalityConfirmed] = useState<boolean>(false);
  const [weeklyMetrics, setWeeklyMetrics] = useState<WeeklyMetricsDoc | null>(null);
  const [isEditingWeekly, setIsEditingWeekly] = useState<boolean>(false);

  const isInitialSnapshotRef = useRef<boolean>(true);
  const hasSubmittedInSessionRef = useRef<boolean>(false);

  const farmId = userProfile?.farmIds?.[0] ?? (userProfile as any)?.farmId ?? (userProfile as any)?.farmID ?? '';
  const userName = userProfile?.name || firebaseUser?.displayName || 'Farmer';

  // When reportDate or farmId changes, reset form to empty defaults so newly opened reports never show stale/zero values
  useEffect(() => {
    isInitialSnapshotRef.current = true;
    hasSubmittedInSessionRef.current = false;
    setTodayReport(null);
    setData({
      ...INITIAL_FARM_FORM_DATA,
    });
    setStep(0);
    setErrors({});
    setSubmitted(false);
    setSubmittedOffline(false);
    setSubmitError('');
    setShowLimitModal(false);
    setShowDisclaimerModal(false);
    setHasDismissedModal(false);
    setIsEditingWeekly(false);
  }, [reportDate, farmId]);

  const birdCount =
    Number(data.birdCount) ||
    todayReport?.openingBirdCount ||
    todayReport?.birdCount ||
    farmDoc?.currentBirdCount ||
    farmDoc?.currentBirds ||
    farmDoc?.initialBirdCount ||
    flocks[0]?.currentBirds ||
    flocks[0]?.initialBirds ||
    0;

  // Authoritative Report-Week Calculation from authenticated farmer's users document createdat
  const isLoadingUser = authLoading || !userProfile;
  const userCreatedAt = userProfile?.createdat ?? userProfile?.createdAt ?? (userProfile as any)?.created_at ?? null;
  const reportingWeek = userCreatedAt
    ? calculateReportingWeek(userCreatedAt, reportDate, 3)
    : { weekNumber: null, dayInWeek: null, daysElapsed: null, label: '', isValid: false, error: 'Missing creation date' };
  const weekNumber = reportingWeek.weekNumber;
  const weekLabel = reportingWeek.label;

  // Subscribe to weekly metrics lock for this farm & week
  useEffect(() => {
    if (!farmId || !weekNumber) return;
    const unsub = subscribeToWeeklyMetrics(farmId, weekNumber, (metrics) => {
      setWeeklyMetrics(metrics);
      if (metrics && metrics.bodyWeight) {
        setData((prev) => {
          if (!prev.bodyWeightMin && !prev.bodyWeightMax) {
            return {
              ...prev,
              bodyWeightMin: String(metrics.bodyWeight.min ?? ''),
              bodyWeightMax: String(metrics.bodyWeight.max ?? ''),
              bodyWeightAvg: String(metrics.bodyWeight.avg ?? ''),
            };
          }
          return prev;
        });
      }
    });
    return () => unsub();
  }, [farmId, weekNumber]);

  // Subscribe to today's canonical report for current farm & date
  useEffect(() => {
    if (!userProfile?.uid || !farmId) return;
    isInitialSnapshotRef.current = true;
    const unsub = subscribeToTodayReport(userProfile.uid, farmId, reportDate, (rep) => {
      const isInitial = isInitialSnapshotRef.current;
      isInitialSnapshotRef.current = false;

      setTodayReport(rep);
      if (!rep) {
        setShowLimitModal(false);
    setShowDisclaimerModal(false);
        return;
      }

      // Only display the "Report Already Submitted" modal if an existing report was detected
      // upon the initial snapshot load of this date and it was not an administrative import.
      // Never display it when a report is submitted in the current active session.
      if (
        isInitial &&
        rep &&
        rep.submissionMethod !== 'HISTORICAL_IMPORT' &&
        (rep.submissionVersion != null || rep.status) &&
        !hasSubmittedInSessionRef.current
      ) {
        setSubmitted(true);
      }

      if (rep && (rep.submissionVersion != null || rep.status === 'submitted' || rep.status === 'corrected')) {
        setData((prev) => ({
          ...prev,
          flockId: rep.flockId || prev.flockId,
          birdCount: (rep.openingBirdCount && rep.openingBirdCount > 0)
            ? String(rep.openingBirdCount)
            : (rep.birdCount && rep.birdCount > 0)
              ? String(rep.birdCount)
              : prev.birdCount || (farmDoc?.currentBirdCount ? String(farmDoc.currentBirdCount) : ''),
          feedQuantity: rep.feedKg != null ? String(rep.feedKg) : prev.feedQuantity,
          mortality: rep.mortality != null ? String(rep.mortality) : prev.mortality,
          culling: rep.culling != null ? String(rep.culling) : prev.culling,
          eggsProduced: rep.eggsProduced != null ? String(rep.eggsProduced) : prev.eggsProduced,
          selectionEggs: rep.selectionEggs != null ? String(rep.selectionEggs) : prev.selectionEggs,
          damagedEggs: rep.damagedEggs != null ? String(rep.damagedEggs) : prev.damagedEggs,
          floorEggs: rep.floorEggs != null ? String(rep.floorEggs) : prev.floorEggs,
          temperature: rep.temperature != null ? String(rep.temperature) : prev.temperature,
          tempMin: rep.tempMin != null ? String(rep.tempMin) : prev.tempMin,
          tempMax: rep.tempMax != null ? String(rep.tempMax) : prev.tempMax,
          eggWeightMin: rep.eggWeight?.min != null ? String(rep.eggWeight.min) : prev.eggWeightMin,
          eggWeightMax: rep.eggWeight?.max != null ? String(rep.eggWeight.max) : prev.eggWeightMax,
          eggWeightAvg: rep.eggWeight?.avg != null ? String(rep.eggWeight.avg) : prev.eggWeightAvg,
          bodyWeightMin: rep.bodyWeight?.min != null ? String(rep.bodyWeight.min) : prev.bodyWeightMin,
          bodyWeightMax: rep.bodyWeight?.max != null ? String(rep.bodyWeight.max) : prev.bodyWeightMax,
          bodyWeightAvg: rep.bodyWeight?.avg != null ? String(rep.bodyWeight.avg) : prev.bodyWeightAvg,
          remarks: rep.remarks ?? prev.remarks,
          ammoniaPpm: rep.ammoniaPpm != null ? String(rep.ammoniaPpm) : prev.ammoniaPpm,
        }));
      }
    });
    return () => unsub();
  }, [userProfile?.uid, farmId, reportDate]);

  // Network Connectivity & Auto-Sync Listener
  useEffect(() => {
    if (!userProfile?.uid) return;

    const handleOnline = async () => {
      setIsOnline(true);
      setIsSyncing(true);
      try {
        const synced = await syncPendingSubmissions(userProfile.uid);
        if (synced > 0) {
          console.log(`[FarmerForm] Successfully synced ${synced} pending report(s).`);

  if (submittedOffline) {
            setSubmittedOffline(false);
            setSubmitted(true);
          }
        }
      } catch (err) {
        console.error('[FarmerForm] Error syncing pending submissions:', err);
      } finally {
        setIsSyncing(false);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (navigator.onLine) {
      handleOnline();
    } else {
      setIsOnline(false);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [userProfile?.uid, submittedOffline]);

  // Restore draft from IndexedDB on initial load
  useEffect(() => {
    if (!userProfile?.uid || !farmId) return;

    async function restoreDraft() {
      const draft = await getFarmerDraft(userProfile!.uid, farmId, reportDate);
      if (draft && draft.data) {
        if (!todayReport || !todayReport.submissionVersion) {
          setData(draft.data);
          if (typeof draft.step === 'number' && draft.step < 3) {
            setStep(draft.step);
          }
        } else {
          // Report for today is already submitted; clean up any lingering local draft
          await clearFarmerDraft(userProfile!.uid, farmId, reportDate);
        }
      }
    }

    restoreDraft();
  }, [userProfile?.uid, farmId, reportDate, todayReport?.submissionVersion]);

  // Debounced Auto-Save to IndexedDB on data or step changes (~500ms)
  useEffect(() => {
    if (!userProfile?.uid || !farmId || submitted || submittedOffline) return;

    const timer = setTimeout(() => {
      const draftKey = `draft_${userProfile.uid}_${farmId}_${reportDate}`;
      saveFarmerDraft({
        draftKey,
        userId: userProfile.uid,
        farmId,
        reportDate,
        step,
        data,
        updatedAt: Date.now(),
      });
    }, 500);

    return () => clearTimeout(timer);
  }, [data, step, userProfile?.uid, farmId, reportDate, submitted, submittedOffline]);

  useEffect(() => {
    if (!farmId) return;
    const unsubFlocks = subscribeToFlocksByFarm(farmId, (fetchedFlocks) => {
      setFlocks(fetchedFlocks);
      if (fetchedFlocks.length > 0) {
        const primaryFlock = fetchedFlocks[0];
        setData((prev) => ({
          ...prev,
          flockId: prev.flockId || primaryFlock.flockId,
          birdCount: prev.birdCount || String(primaryFlock.currentBirds ?? primaryFlock.initialBirds ?? ''),
        }));
      }
    });
    const unsubFarm = subscribeToFarm(farmId, (fetchedFarm) => {
      setFarmDoc(fetchedFarm);
      if (fetchedFarm) {
        const count = fetchedFarm.currentBirdCount ?? fetchedFarm.currentBirds ?? fetchedFarm.initialBirdCount;
        if (count != null) {
          setData((prev) => ({
            ...prev,
            birdCount: prev.birdCount || String(count),
          }));
        }
      }
    });
    return () => {
      unsubFlocks();
      unsubFarm();
    };
  }, [farmId]);

  // Prevent mouse scroll wheel from accidentally altering number inputs
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (document.activeElement && (document.activeElement as HTMLInputElement).type === 'number') {
        (document.activeElement as HTMLInputElement).blur();
      }
    };
    window.addEventListener('wheel', handleWheel, { passive: true });
    return () => {
      window.removeEventListener('wheel', handleWheel);
    };
  }, []);

  const cacheCurrentState = (nextStep: number, nextData: FarmFormData) => {
    if (!userProfile?.uid || !farmId) return;
    const draftKey = `draft_${userProfile.uid}_${farmId}_${reportDate}`;
    saveFarmerDraft({
      draftKey,
      userId: userProfile.uid,
      farmId,
      reportDate,
      step: nextStep,
      data: nextData,
      updatedAt: Date.now(),
    });
  };

  const handleChange = (field: keyof FarmFormData, value: string) => {
    setData((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === 'flockId') {
      }

      if (field === 'eggWeightMin' || field === 'eggWeightMax') {
        const minStr = field === 'eggWeightMin' ? value : prev.eggWeightMin;
        const maxStr = field === 'eggWeightMax' ? value : prev.eggWeightMax;
        const min = Number(minStr);
        const max = Number(maxStr);
        if (minStr !== '' && maxStr !== '' && !isNaN(min) && !isNaN(max) && min >= 0 && max >= 0 && min <= max) {
          updated.eggWeightAvg = String(Number(((min + max) / 2).toFixed(1)));
        } else {
          updated.eggWeightAvg = '';
        }
      }

      if (field === 'bodyWeightMin' || field === 'bodyWeightMax') {
        const minStr = field === 'bodyWeightMin' ? value : prev.bodyWeightMin;
        const maxStr = field === 'bodyWeightMax' ? value : prev.bodyWeightMax;
        const min = Number(minStr);
        const max = Number(maxStr);
        if (minStr !== '' && maxStr !== '' && !isNaN(min) && !isNaN(max) && min >= 0 && max >= 0 && min <= max) {
          updated.bodyWeightAvg = String(Number(((min + max) / 2).toFixed(1)));
        } else {
          updated.bodyWeightAvg = '';
        }
      }

      return updated;
    });

    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      delete next.eggWeightAvg;
      delete next.bodyWeightAvg;

      if (field === 'eggsProduced' || field === 'selectionEggs' || field === 'damagedEggs') {
        const epVal = field === 'eggsProduced' ? value : data.eggsProduced;
        const seVal = field === 'selectionEggs' ? value : data.selectionEggs;
        const deVal = field === 'damagedEggs' ? value : data.damagedEggs;

        const ep = Number(epVal);
        const se = seVal !== '' ? Number(seVal) : 0;
        const de = deVal !== '' ? Number(deVal) : 0;

        if (epVal !== '' && !isNaN(ep) && !isNaN(se) && !isNaN(de)) {
          if (se > ep && ep >= 0) {
            next.selectionEggs = t('validation.exceedsEggsProduced', 'Cannot exceed eggs produced');
          } else if (se + de > ep) {
            next.selectionEggs = t('validation.selectionDamagedExceeds', 'Selection + Damaged eggs cannot exceed Egg Production');
            if (deVal !== '') {
              next.damagedEggs = t('validation.selectionDamagedExceeds', 'Selection + Damaged eggs cannot exceed Egg Production');
            }
          } else {
            if (next.selectionEggs && (next.selectionEggs.includes('cannot exceed Egg Production') || next.selectionEggs.includes('Cannot exceed eggs produced'))) {
              delete next.selectionEggs;
            }
            if (next.damagedEggs && next.damagedEggs.includes('cannot exceed Egg Production')) {
              delete next.damagedEggs;
            }
          }
        }
      }

      return next;
    });

    if (field === 'mortality') {
      setTotalMortalityConfirmed(false);
    }
  };

  const handleNext = () => {
    const effectiveFlockId = data.flockId || flocks[0]?.flockId || '';
    const effectiveBirdCount = birdCount || (farmDoc?.currentBirdCount ?? flocks[0]?.currentBirds ?? 0);
    const avgTemp = (Number(data.tempMin) + Number(data.tempMax)) / 2;

    const effectiveData: FarmFormData = {
      ...data,
      flockId: effectiveFlockId,
      birdCount: data.birdCount || String(effectiveBirdCount || ''),
      temperature: String(avgTemp || data.temperature || ''),
    };

    const stepErrors = validateStep(step, effectiveData, effectiveBirdCount, t);
    if (Object.keys(stepErrors).length > 0) {
      console.warn('[FarmerForm] Cannot advance, stepErrors:', stepErrors);
      setErrors(stepErrors);
      return;
    }

    setErrors({});
    setData(effectiveData);
    const nextStep = Math.min(step + 1, 3);
    cacheCurrentState(nextStep, effectiveData);
    setStep(nextStep);
  };

  const handleBack = () => {
    setErrors({});
    const prevStep = step - 1;
    cacheCurrentState(prevStep, data);
    setStep(prevStep);
  };

  const handleEditStep = (targetStep: number) => {
    setErrors({});
    setStep(targetStep);
  };

  const handleSubmit = async () => {
    if (submitting || submitted) return;

    // Phase 2: Serious Mortality Check (100% flock loss)
    const enteredMortality = Number(data.mortality) || 0;
    if (birdCount > 0 && enteredMortality === birdCount && !totalMortalityConfirmed) {
      setShowTotalMortalityModal(true);
      return;
    }

    const hasExistingReport =
      todayReport &&
      (todayReport.submissionVersion >= 1 ||
        todayReport.status === 'submitted' ||
        todayReport.status === 'corrected');

    if (hasExistingReport) {
      setShowOverwriteModal(true);
      return;
    }

    await executeSubmission();
  };

  const handleConfirmTotalMortality = async () => {
    setShowTotalMortalityModal(false);
    setTotalMortalityConfirmed(true);

    const hasExistingReport =
      todayReport &&
      (todayReport.submissionVersion >= 1 ||
        todayReport.status === 'submitted' ||
        todayReport.status === 'corrected');

    if (hasExistingReport) {
      setShowOverwriteModal(true);
      return;
    }

    await executeSubmission();
  };

  const handleCancelTotalMortality = () => {
    setShowTotalMortalityModal(false);
    setTotalMortalityConfirmed(false);
  };

  const executeSubmission = async () => {
    setShowOverwriteModal(false);
    setShowLimitModal(false);
    setShowDisclaimerModal(false);
    setHasDismissedModal(true);
    hasSubmittedInSessionRef.current = true;
    setSubmitting(true);
    setSubmitError('');
    try {
      if (!reportingWeek.isValid || reportingWeek.weekNumber == null) {
        setSubmitError(t('farmer.reportingPeriodUnavailable', 'Reporting period is unavailable or invalid. Farmer account creation date is missing.'));
        setSubmitting(false);
        return;
      }

      if (!allowedIsoDates.includes(reportDate)) {
        setSubmitError(t('farmer.invalidDateError', 'Invalid report date. Only Today and Yesterday are allowed for daily reporting.'));
        setSubmitting(false);
        return;
      }

      let feedKg = Number(data.feedQuantity) || 0;
      if (data.feedUnit === 'g') {
        feedKg = feedKg / 1000;
      }

      const effectiveFlockId = data.flockId || flocks[0]?.flockId || '';
      const avgTemp = (Number(data.tempMin) + Number(data.tempMax)) / 2;

      const hasBw = data.bodyWeightMin !== '' && data.bodyWeightMax !== '';
      const bodyWeightPayload = hasBw
        ? {
          min: Number(data.bodyWeightMin),
          max: Number(data.bodyWeightMax),
          avg:
            Number(data.bodyWeightAvg) ||
            Number(
              (
                (Number(data.bodyWeightMin) + Number(data.bodyWeightMax)) /
                2
              ).toFixed(1)
            ),
        }
        : weeklyMetrics && !isEditingWeekly
          ? weeklyMetrics.bodyWeight
          : null;

      const feedGramsPerBirdVal = calculateFeedGramsPerBird(feedKg, birdCount);

      const payload = {
        farmId,
        flockId: effectiveFlockId,
        birdCount,
        feedKg,
        feedGrams: feedKg * 1000,
        feedG: feedKg * 1000,
        feedGramsPerBird: feedGramsPerBirdVal,
        mortality: Number(data.mortality) || 0,
        culling: Number(data.culling) || 0,
        eggsProduced: Number(data.eggsProduced) || 0,
        selectionEggs: Number(data.selectionEggs) || 0,
        damagedEggs: Number(data.damagedEggs) || 0,
        floorEggs: Number(data.floorEggs) || 0,
        temperature: avgTemp || 0,
        tempMin: Number(data.tempMin) || 0,
        tempMax: Number(data.tempMax) || 0,
        eggWeight: {
          min: Number(data.eggWeightMin) || 0,
          max: Number(data.eggWeightMax) || 0,
          avg: Number(data.eggWeightAvg) || 0,
        },
        bodyWeight: bodyWeightPayload,
        remarks: data.remarks || '',
        ammoniaPpm: data.ammoniaPpm !== '' ? Number(data.ammoniaPpm) : null,
        submittedBy: userProfile!.uid,
        weekNumber,
        weekLabel,
        submissionDate: reportDate,
        reportDate: reportDate,
        submissionKey: `sub_${userProfile!.uid}_${farmId}_${reportDate}`,
      };

      for (const [key, val] of Object.entries(payload)) {
        if (typeof val === 'number' && !Number.isFinite(val)) {
          throw new Error(`Invalid numeric value for field: ${key}`);
        }
      }
      if (!Number.isFinite(payload.eggWeight.min) || !Number.isFinite(payload.eggWeight.max)) {
        throw new Error(`Invalid numeric value in weight fields`);
      }
      if (payload.bodyWeight && (!Number.isFinite(payload.bodyWeight.min) || !Number.isFinite(payload.bodyWeight.max))) {
        throw new Error(`Invalid numeric value in body weight fields`);
      }

      const res = await submitReport(payload);

      // Explicit race-safe check: If backend didn't bump the version when we expected a V2 write
      if (todayReport?.submissionVersion === 1 && res.version === 1 && !res.isOffline) {
        // This means they tried to submit a correction but NO data was changed,
        // or something failed silently. We should NOT let them think V2 succeeded.
        setSubmitError(t('farmer.noChangesDetected', 'No changes detected. Please modify the data to submit a correction.'));
        setSubmitting(false);
        return;
      }

      if (res.isOffline) {
        setSubmittedOffline(true);
      } else {
        if (userProfile?.uid && farmId) {
          await clearFarmerDraft(userProfile.uid, farmId, reportDate);
        }
        // Prevent UI race conditions by manually syncing the returned version immediately
        setTodayReport((prev: any) => prev ? { ...prev, submissionVersion: res.version } : { submissionVersion: res.version });
        setSubmitted(true);
      }
    } catch (err: any) {
      console.error('[FarmForm] Submit error:', err);
      if (err.message === 'NO_CHANGES_DETECTED') {
        setSubmitError(t('farmer.noChangesDetected'));
      } else if (err.message === 'CORRECTION_LIMIT_REACHED' || err.message === 'DUPLICATE_REPORT') {
        setSubmitError(t('farmer.correctionLimitReached'));
      } else {
        setSubmitError(err.message || t('common.error'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartCorrection = () => {
    if (todayReport?.submissionVersion >= 2 || todayReport?.status === 'finalized') {
      setShowLimitModal(true);
    } else {
      setShowDisclaimerModal(true);
    }
  };

  const handleConfirmCorrection = () => {
    setShowDisclaimerModal(false);
    if (userProfile?.uid && farmId) {
      clearFarmerDraft(userProfile.uid, farmId, reportDate);
    }
    setErrors({});
    setStep(0);
    setSubmitted(false);
    setSubmittedOffline(false);
    setSubmitError('');
    setShowLimitModal(false);
    setHasDismissedModal(true);
  };

  const handleLogout = async () => {
    await logoutUser();
  };

  const mortalityPct =
    birdCount > 0 && data.mortality !== '' && !isNaN(Number(data.mortality))
      ? ((Number(data.mortality) / birdCount) * 100).toFixed(1)
      : '0.0';
  const cullingPct =
    birdCount > 0 && data.culling !== '' && !isNaN(Number(data.culling))
      ? ((Number(data.culling) / birdCount) * 100).toFixed(1)
      : '0.0';
  const eggProdPct =
    birdCount > 0 && data.eggsProduced !== '' && !isNaN(Number(data.eggsProduced))
      ? ((Number(data.eggsProduced) / birdCount) * 100).toFixed(1)
      : '0.0';
  const selectionPct =
    Number(data.eggsProduced) > 0 &&
      data.selectionEggs !== '' &&
      !isNaN(Number(data.selectionEggs)) &&
      Number(data.selectionEggs) >= 0
      ? ((Number(data.selectionEggs) / Number(data.eggsProduced)) * 100).toFixed(1)
      : '0.0';
  const feedKgDisplay = data.feedQuantity ? Number(data.feedQuantity) : 0;
  const feedPerBirdDisplay = calculateFeedGramsPerBird(feedKgDisplay, birdCount);
  const maxEggsAllowed = birdCount > 0 ? Math.floor(birdCount * 0.95) : 0;


  const renderModals = () => (
    <>
      {showLimitModal && (
        <div className="farmer-modal-overlay" onClick={() => setShowLimitModal(false)} role="dialog">
          <div className="farmer-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="farmer-modal-icon-badge" style={{ background: '#fef2f2', color: '#dc2626' }}>
              <AlertTriangle size={26} strokeWidth={2.5} />
            </div>
            <h3 className="farmer-modal-title">Daily submission limit reached</h3>
            <p className="farmer-modal-desc">
              You have already completed the maximum of 2 submissions for today. Your next submission will be available on the next allowed day.
            </p>
            <button type="button" className="farmer-modal-action-btn" onClick={() => setShowLimitModal(false)}>
              {t('common.ok', 'OK')}
            </button>
          </div>
        </div>
      )}

      {showDisclaimerModal && (
        <div className="farmer-modal-overlay" onClick={() => setShowDisclaimerModal(false)} role="dialog">
          <div className="farmer-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="farmer-modal-icon-badge" style={{ background: '#fffbeb', color: '#d97706' }}>
              <AlertTriangle size={26} strokeWidth={2.5} />
            </div>
            <h3 className="farmer-modal-title">Second submission for today</h3>
            <p className="farmer-modal-desc">
              You have already submitted today's farm report once. You are allowed one additional submission today. Please continue only if you need to submit the second report.
            </p>
            <div className="farmer-modal-tiles" style={{ display: 'flex', gap: '10px', marginTop: '20px', flexDirection: 'column' }}>
              <button type="button" className="btn btn--primary" style={{ width: '100%', padding: '14px', borderRadius: '8px' }} onClick={handleConfirmCorrection}>
                Continue to Second Submission
              </button>
              <button type="button" className="btn btn--outline" style={{ width: '100%', padding: '14px', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'transparent' }} onClick={() => setShowDisclaimerModal(false)}>
                {t('common.cancel', 'Cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (submittedOffline) {
    return (
      <div className="dashboard-page">
        <header className="dash-header farmer-app-header">
          <div className="farmer-brand-row">
            <img src="/happy_farm_logo.jpg" alt="SAI Happy Farms" className="farmer-brand-logo" />
            <div className="farmer-brand-info">
              <h1 className="farmer-brand-title">SAI Happy Farms</h1>
              <p className="farmer-brand-subtitle">{t('farmer.title')}</p>
            </div>
          </div>
          <div className="farmer-header-divider" />
          <div className="farmer-controls-row">
            <div className="farmer-context-info">
              <Home size={13} className="farmer-context-icon" />
              <span>{t('flock.farm')}: <strong>{farmId}</strong></span>
              <span className="offline-status-badge offline">🟠 {t('farmer.offlineSaved')}</span>
            </div>
            <div className="farmer-controls-right">
              <LanguageSelector />
              <button type="button" className="farmer-logout-btn" onClick={handleLogout} title={t('auth.logout')}>
                <LogOut size={13} />
                <span className="logout-text">{t('auth.logout')}</span>
              </button>
            </div>
          </div>
        </header>
        <main className="dash-main">
          <div className="success-screen">
            <div className="success-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
              <Check size={36} />
            </div>
            <h2>{t('farmer.reportSavedLocally')}</h2>
            <p style={{ marginTop: '10px', fontSize: '14px', color: '#475569' }}>
              {t('farmer.offlineSyncNotice')}
            </p>
            <p className="text-muted" style={{ marginTop: '14px' }}>
              {t('common.date')}: {formatDisplayDate(reportDate)} | {t('farmer.week')} {weekLabel} | {t('flock.farm')}: {farmId}
            </p>
            {(todayReport && todayReport.submissionVersion === 1 && todayReport.submissionMethod !== 'HISTORICAL_IMPORT') && (
              <button className="btn btn--primary btn--full" style={{ marginTop: 20 }} onClick={handleStartCorrection}>
                {t('farmer.submitCorrection')}
              </button>
            )}
          {renderModals()}
        </div>
        </main>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="dashboard-page">
        <header className="dash-header farmer-app-header">
          <div className="farmer-brand-row">
            <img src="/happy_farm_logo.jpg" alt="SAI Happy Farms" className="farmer-brand-logo" />
            <div className="farmer-brand-info">
              <h1 className="farmer-brand-title">SAI Happy Farms</h1>
              <p className="farmer-brand-subtitle">{t('farmer.title')}</p>
            </div>
          </div>
          <div className="farmer-header-divider" />
          <div className="farmer-controls-row">
            <div className="farmer-context-info">
              <Home size={13} className="farmer-context-icon" />
              <span>{t('flock.farm')}: <strong>{farmId}</strong></span>
              <span className={`offline-status-badge ${!isOnline ? 'offline' : isSyncing ? 'syncing' : 'online'}`}>
                {!isOnline ? `🟠 ${t('farmer.offlineSaved')}` : isSyncing ? `🔵 ${t('farmer.syncing')}` : `🟢 ${t('farmer.online')}`}
              </span>
            </div>
            <div className="farmer-controls-right">
              <LanguageSelector />
              <button type="button" className="farmer-logout-btn" onClick={handleLogout} title={t('auth.logout')}>
                <LogOut size={13} />
                <span className="logout-text">{t('auth.logout')}</span>
              </button>
            </div>
          </div>
        </header>
        <main className="dash-main">
          <div className="success-screen">
            <div className="success-icon"><Check size={36} /></div>
            <h2>{t('common.success')}</h2>
            <p>
              {todayReport && todayReport.submissionVersion >= 2
                ? t('farmer.correctionSuccessMsg', 'Correction submitted successfully.')
                : t('farmer.successMessage')}
            </p>
            <p className="text-muted">{t('common.date')}: {formatDisplayDate(reportDate)} | {t('farmer.week')} {weekLabel} | {t('flock.farm')}: {farmId}</p>
            {(todayReport && todayReport.submissionVersion === 1 && todayReport.submissionMethod !== 'HISTORICAL_IMPORT') && (
              <button className="btn btn--primary btn--full" style={{ marginTop: 20 }} onClick={handleStartCorrection}>
                {t('farmer.submitCorrection')}
              </button>
            )}
          {renderModals()}
        </div>
        </main>
      </div>
    );
  }

  const displayOpeningBirds =
    todayReport?.openingBirdCount ??
    todayReport?.birdCount ??
    (birdCount > 0 ? birdCount : null) ??
    farmDoc?.currentBirdCount ??
    farmDoc?.currentBirds ??
    farmDoc?.initialBirdCount ??
    flocks[0]?.currentBirds ??
    flocks[0]?.initialBirds ??
    null;

  const displayTotalFeed =
    todayReport?.openingFeedKg ??
    farmDoc?.currentFeedKg ??
    farmDoc?.initialFeedKg ??
    null;

  return (
    <div className="dashboard-page">
      <header className="dash-header farmer-app-header">
        <div className="farmer-brand-row">
          <img src="/happy_farm_logo.jpg" alt="SAI Happy Farms" className="farmer-brand-logo" />
          <div className="farmer-brand-info">
            <h1 className="farmer-brand-title">SAI Happy Farms</h1>
            <p className="farmer-brand-subtitle">{t('farmer.title')}</p>
          </div>
        </div>
        <div className="farmer-header-divider" />
        <div className="farmer-controls-row">
          <div className="farmer-context-info">
            <Home size={13} className="farmer-context-icon" />
            <span>{t('flock.farm')}: <strong>{farmId}</strong></span>
            <span className={`offline-status-badge ${!isOnline ? 'offline' : isSyncing ? 'syncing' : 'online'}`}>
              {!isOnline ? `🟠 ${t('farmer.offlineSaved')}` : isSyncing ? `🔵 ${t('farmer.syncing')}` : `🟢 ${t('farmer.online')}`}
            </span>
          </div>
          <div className="farmer-controls-right">
            <LanguageSelector />
            <button type="button" className="farmer-logout-btn" onClick={handleLogout} title={t('auth.logout')}>
              <LogOut size={13} />
              <span className="logout-text">{t('auth.logout')}</span>
            </button>
          </div>
        </div>
      </header>
      <main className="dash-main">

        {farmDoc && farmDoc.inventoryInitialized !== true && (
          <div className="alert alert--critical" style={{ marginBottom: '14px', fontWeight: 600 }}>
            ⚠️ {t('farmer.inventoryNotInitialized')}
          </div>
        )}

        {!isLoadingUser && !reportingWeek.isValid && (
          <div className="alert alert--critical" style={{ marginBottom: '14px', fontWeight: 600 }}>
            ⚠️ {t('farmer.reportingPeriodUnavailable', 'Reporting period is unavailable. Farmer account creation date is missing or invalid.')}
          </div>
        )}

        {(!farmDoc || farmDoc.inventoryInitialized === true) && (
          <>
            <div className="locked-card">
              <div className="locked-card-title">{t('farmer.reportInformation').toUpperCase()}</div>
              <div className="locked-grid">
                <div
                  className="locked-item locked-item--interactive"
                  style={{ position: 'relative' }}
                  role="button"
                  tabIndex={0}
                  onClick={() => setIsDateOverlayOpen((prev) => !prev)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setIsDateOverlayOpen((prev) => !prev);
                    }
                  }}
                  aria-haspopup="dialog"
                  aria-expanded={isDateOverlayOpen}
                  aria-label={t('farmer.selectReportDate', 'Select report date')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <span className="locked-label">{t('common.date').toUpperCase()}</span>
                    <span style={{ fontSize: '10px', color: '#059669', fontWeight: 700, lineHeight: 1 }}>
                      ▼
                    </span>
                  </div>
                  <span className="locked-value">{formatDisplayDate(reportDate)}</span>
                  {isDateOverlayOpen && (
                    <DateSelectionOverlay
                      allowedOptions={allowedOptions}
                      selectedDate={reportDate}
                      onSelectDate={handleDateChange}
                      onClose={() => setIsDateOverlayOpen(false)}
                      t={t}
                    />
                  )}
                </div>
                <div className="locked-item">
                  <span className="locked-label">{t('farmer.openingBirds').toUpperCase()}</span>
                  <span className="locked-value">
                    {displayOpeningBirds != null ? displayOpeningBirds.toLocaleString() : '--'}
                  </span>
                </div>
                <div className="locked-item">
                  <span className="locked-label">{t('farmer.week').toUpperCase()}</span>
                  <span className="locked-value week-val">
                    {isLoadingUser ? '--' : reportingWeek.isValid ? `${t('farmer.week')} ${weekLabel}` : '--'}
                  </span>
                </div>
                <div className="locked-item">
                  <span className="locked-label">{t('farmer.totalFeedAvailable').toUpperCase()}</span>
                  <span className="locked-value feed-val">
                    {displayTotalFeed != null ? `${displayTotalFeed.toLocaleString()} Kg` : '--'}
                  </span>
                </div>
              </div>
            </div>

            <div className="form-progress">
              <div className="form-progress-text">
                {step < 3 ? `${t('farmer.step', { current: step + 1, total: 3 })} — ${t(`farmer.step${step + 1}`)}` : t('farmer.verifyReport')}
              </div>
              <div className="form-progress-track">
                <div className="form-progress-fill" style={{ width: `${Math.min(((step + 1) / 4) * 100, 100)}%` }} />
              </div>
            </div>

            <div className="form-card">
              {step < 3 ? (
                <>
                  <h3 className="form-section-title">{t(`farmer.step${step + 1}`)}</h3>

                  {step === 0 && (
                    <>
                      <div className="field-row">
                        <Field label={`${t('farmer.feedUsed', 'Feed Used')} (kg)`} error={errors.feedQuantity}>
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            value={data.feedQuantity}
                            onChange={(e) => handleChange('feedQuantity', e.target.value)}
                            onWheel={(e) => e.currentTarget.blur()}
                            placeholder="e.g. 250"
                          />
                        </Field>
                        <Field label={`${t('farmer.feedPerBird', 'Feed per Bird')} (g/bird)`}>
                          <input
                            type="text"
                            readOnly
                            tabIndex={-1}
                            value={
                              data.feedQuantity === ''
                                ? '--'
                                : birdCount <= 0 || !Number.isFinite(birdCount)
                                  ? '--'
                                  : Number(data.feedQuantity) < 0 || isNaN(Number(data.feedQuantity))
                                    ? '--'
                                    : `${calculateFeedGramsPerBird(data.feedQuantity, birdCount)} g/bird`
                            }
                            style={{
                              background: '#f1f5f9',
                              color: '#334155',
                              fontWeight: 600,
                              cursor: 'not-allowed',
                              borderColor: '#cbd5e1',
                            }}
                          />
                        </Field>
                      </div>
                      {Number(data.feedQuantity) > 0 && (
                        <div className="calc-inline">
                          <span className="calc-inline-label">{t('farmer.equivalentWeight', 'EQUIVALENT WEIGHT')}:</span>
                          <span className="calc-inline-value">{(Number(data.feedQuantity) * 1000).toLocaleString()} G</span>
                          <span className="calc-inline-sub">{t('farmer.calculated', 'Calculated automatically')}</span>
                        </div>
                      )}

                      <Field label={t('farmer.mortality')} error={errors.mortality}>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="0"
                          max={birdCount || undefined}
                          value={data.mortality}
                          onChange={(e) => handleChange('mortality', e.target.value)}
                          onWheel={(e) => e.currentTarget.blur()}
                          placeholder="e.g. 12"
                        />
                      </Field>
                      {data.mortality !== '' && (
                        <div className="calc-inline">
                          <span className="calc-inline-label">{t('farmer.rate', 'RATE')}:</span>
                          <span
                            className="calc-inline-value"
                            style={{
                              color: birdCount > 0 && Number(data.mortality) >= birdCount ? '#dc2626' : undefined,
                              fontWeight: birdCount > 0 && Number(data.mortality) >= birdCount ? 700 : undefined,
                            }}
                          >
                            {birdCount > 0 ? `${mortalityPct}%` : '--'}
                          </span>
                          <span className="calc-inline-sub">{t('farmer.calculated', 'Calculated automatically')}</span>
                        </div>
                      )}

                      {birdCount > 0 && Number(data.mortality) === birdCount && (
                        <div
                          className="alert alert--error"
                          role="alert"
                          style={{
                            marginTop: '8px',
                            background: '#fef2f2',
                            color: '#991b1b',
                            border: '1.5px solid #f87171',
                            borderRadius: '8px',
                            padding: '12px 14px',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '10px',
                            fontSize: '13.5px',
                            lineHeight: 1.4,
                          }}
                        >
                          <AlertTriangle size={20} color="#dc2626" style={{ flexShrink: 0, marginTop: '2px' }} />
                          <div>
                            <strong style={{ display: 'block', marginBottom: '2px', color: '#b91c1c' }}>
                              CRITICAL ALERT: Total Flock Loss (100%)
                            </strong>
                            Entered mortality ({data.mortality}) equals the total eligible bird count ({birdCount.toLocaleString()}).
                            This represents the loss of the entire flock. Please verify that this number is correct.
                          </div>
                        </div>
                      )}

                      {birdCount > 0 && Number(data.mortality) < birdCount && Number(mortalityPct) >= (KPI_THRESHOLDS.mortalityRateWarning ?? 5) && (
                        <div
                          className="alert"
                          role="alert"
                          style={{
                            marginTop: '8px',
                            background: '#fffbeb',
                            color: '#92400e',
                            border: '1px solid #fcd34d',
                            borderRadius: '8px',
                            padding: '10px 12px',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '8px',
                            fontSize: '13px',
                          }}
                        >
                          <AlertTriangle size={18} color="#d97706" style={{ flexShrink: 0, marginTop: '2px' }} />
                          <div>
                            <strong>High Mortality Warning:</strong> Entered mortality represents {mortalityPct}% of the flock (Threshold: {KPI_THRESHOLDS.mortalityRateWarning ?? 5}%). Please verify before submitting.
                          </div>
                        </div>
                      )}

                      <Field label={t('farmer.culling')} error={errors.culling}>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="0"
                          max={birdCount || undefined}
                          value={data.culling}
                          onChange={(e) => handleChange('culling', e.target.value)}
                          onWheel={(e) => e.currentTarget.blur()}
                          placeholder="e.g. 5"
                        />
                      </Field>
                      {data.culling !== '' && (
                        <div className="calc-inline">
                          <span className="calc-inline-label">{t('farmer.rate', 'RATE')}:</span>
                          <span className="calc-inline-value">{birdCount > 0 ? `${cullingPct}%` : '--'}</span>
                          <span className="calc-inline-sub">{t('farmer.calculated', 'Calculated automatically')}</span>
                        </div>
                      )}
                    </>
                  )}

                  {step === 1 && (
                    <>
                      <Field label={t('farmer.eggProduction')} error={errors.eggsProduced}>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="0"
                          max={maxEggsAllowed || undefined}
                          value={data.eggsProduced}
                          onChange={(e) => handleChange('eggsProduced', e.target.value)}
                          onWheel={(e) => e.currentTarget.blur()}
                          placeholder="e.g. 4200"
                        />
                      </Field>
                      {birdCount > 0 && (
                        <div className="calc-inline">
                          <span className="calc-inline-label">{t('farmer.rate')}:</span>
                          <span className="calc-inline-value">{eggProdPct}%</span>
                          <span className="calc-inline-sub">{`Max 95%: ${maxEggsAllowed.toLocaleString()}`}</span>
                        </div>
                      )}

                      <Field label={t('farmer.selectionEggs')} error={errors.selectionEggs}>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="0"
                          value={data.selectionEggs}
                          onChange={(e) => handleChange('selectionEggs', e.target.value)}
                          onWheel={(e) => e.currentTarget.blur()}
                          placeholder="e.g. 3800"
                        />
                      </Field>
                      {(data.selectionEggs !== '' || Number(data.eggsProduced) > 0) && (
                        <div className="calc-inline">
                          <span className="calc-inline-label">{t('farmer.selectionRate', 'Selection Rate')}:</span>
                          <span className="calc-inline-value">{selectionPct}%</span>
                          <span className="calc-inline-sub">{t('farmer.calculated', 'Calculated automatically')}</span>
                        </div>
                      )}

                      <Field label={t('farmer.damagedEggs')} error={errors.damagedEggs}>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="0"
                          value={data.damagedEggs}
                          onChange={(e) => handleChange('damagedEggs', e.target.value)}
                          onWheel={(e) => e.currentTarget.blur()}
                          placeholder="e.g. 15"
                        />
                      </Field>

                      <Field label={t('farmer.floorEggs')} error={errors.floorEggs}>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="0"
                          value={data.floorEggs}
                          onChange={(e) => handleChange('floorEggs', e.target.value)}
                          onWheel={(e) => e.currentTarget.blur()}
                          placeholder="e.g. 8"
                        />
                      </Field>

                      <h4 className="form-sub-title" style={{ marginTop: '16px' }}>{t('farmer.temperature')} (10°C – 50°C)</h4>
                      <div className="field-row">
                        <Field label={t('farmer.tempMin')} error={errors.tempMin}>
                          <input
                            type="number"
                            inputMode="decimal"
                            min="10"
                            max="50"
                            step="0.1"
                            value={data.tempMin}
                            onChange={(e) => handleChange('tempMin', e.target.value)}
                            onWheel={(e) => e.currentTarget.blur()}
                            placeholder="e.g. 28.5"
                          />
                        </Field>
                        <Field label={t('farmer.tempMax')} error={errors.tempMax}>
                          <input
                            type="number"
                            inputMode="decimal"
                            min="10"
                            max="50"
                            step="0.1"
                            value={data.tempMax}
                            onChange={(e) => handleChange('tempMax', e.target.value)}
                            onWheel={(e) => e.currentTarget.blur()}
                            placeholder="e.g. 34.0"
                          />
                        </Field>
                      </div>
                      {(data.tempMin !== '' || data.tempMax !== '') && (
                        <div className="calc-inline">
                          <span className="calc-inline-label">{t('farmer.avgTemp')}:</span>
                          <span className="calc-inline-value">
                            {(() => {
                              const min = Number(data.tempMin);
                              const max = Number(data.tempMax);
                              const hasMin = data.tempMin !== '' && !isNaN(min);
                              const hasMax = data.tempMax !== '' && !isNaN(max);
                              if (hasMin && hasMax) return `${((min + max) / 2).toFixed(1)} °C`;
                              if (hasMin) return `${min.toFixed(1)} °C`;
                              if (hasMax) return `${max.toFixed(1)} °C`;
                              return '--';
                            })()}
                          </span>
                          <span className="calc-inline-sub">{t('farmer.calculated')}</span>
                        </div>
                      )}
                    </>
                  )}

                  {step === 2 && (
                    <>
                      <h4 className="form-sub-title">{t('farmer.eggWeight')} (30g – 80g)</h4>
                      <div className="field-row">
                        <Field label={t('farmer.minG')} error={errors.eggWeightMin}>
                          <input
                            type="number"
                            inputMode="decimal"
                            min="30"
                            max="80"
                            step="0.1"
                            value={data.eggWeightMin}
                            onChange={(e) => handleChange('eggWeightMin', e.target.value)}
                            onWheel={(e) => e.currentTarget.blur()}
                            placeholder="e.g. 50"
                          />
                        </Field>
                        <Field label={t('farmer.maxG')} error={errors.eggWeightMax}>
                          <input
                            type="number"
                            inputMode="decimal"
                            min="30"
                            max="80"
                            step="0.1"
                            value={data.eggWeightMax}
                            onChange={(e) => handleChange('eggWeightMax', e.target.value)}
                            onWheel={(e) => e.currentTarget.blur()}
                            placeholder="e.g. 65"
                          />
                        </Field>
                      </div>
                      {data.eggWeightAvg && (
                        <div className="calc-inline">
                          <span className="calc-inline-label">{t('farmer.avgEggWeight')}:</span>
                          <span className="calc-inline-value">{data.eggWeightAvg} g</span>
                          <span className="calc-inline-sub">{t('farmer.calculated')}</span>
                        </div>
                      )}

                      <div style={{ marginTop: '20px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <div>
                            <h4 className="form-sub-title" style={{ margin: 0 }}>
                              {t('farmer.weeklyBodyWeight')} (500g – 3,000g)
                            </h4>
                            <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
                              {t('farmer.weeklyMetricsDesc')}
                            </p>
                          </div>
                          {weeklyMetrics && (
                            <button
                              type="button"
                              className="btn btn--outline btn--sm"
                              style={{ fontSize: '12px', padding: '4px 10px' }}
                              onClick={() => setIsEditingWeekly(!isEditingWeekly)}
                            >
                              {isEditingWeekly
                                ? t('farmer.cancelEditWeekly', { week: weekNumber })
                                : t('farmer.editWeeklyMetrics', { week: weekNumber })}
                            </button>
                          )}
                        </div>

                        {weeklyMetrics && !isEditingWeekly ? (
                          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '12px 16px', marginBottom: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#166534', fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>
                              <span>✓</span>
                              <span>{t('farmer.weeklyAlreadyRecorded', { week: weekNumber, date: formatDisplayDate(weeklyMetrics.reportDate) })}</span>
                            </div>
                            <div style={{ fontSize: '13px', color: '#15803d' }}>
                              {t('farmer.min')}: <strong>{weeklyMetrics.bodyWeight.min} g</strong> | {t('farmer.max')}: <strong>{weeklyMetrics.bodyWeight.max} g</strong> | {t('farmer.avg')}: <strong>{weeklyMetrics.bodyWeight.avg} g</strong>
                              {weeklyMetrics.ammoniaPpm != null && (
                                <span style={{ marginLeft: '12px' }}>| {t('farmer.ammonium')}: <strong>{weeklyMetrics.ammoniaPpm} PPM</strong></span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="field-row">
                              <Field label={t('farmer.minG')} error={errors.bodyWeightMin}>
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  min="500"
                                  max="3000"
                                  step="1"
                                  value={data.bodyWeightMin}
                                  onChange={(e) => handleChange('bodyWeightMin', e.target.value)}
                                  onWheel={(e) => e.currentTarget.blur()}
                                  placeholder="e.g. 1500"
                                />
                              </Field>
                              <Field label={t('farmer.maxG')} error={errors.bodyWeightMax}>
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  min="500"
                                  max="3000"
                                  step="1"
                                  value={data.bodyWeightMax}
                                  onChange={(e) => handleChange('bodyWeightMax', e.target.value)}
                                  onWheel={(e) => e.currentTarget.blur()}
                                  placeholder="e.g. 1850"
                                />
                              </Field>
                            </div>
                            {data.bodyWeightAvg && (
                              <div className="calc-inline">
                                <span className="calc-inline-label">{t('farmer.avgBodyWeight')}:</span>
                                <span className="calc-inline-value">{data.bodyWeightAvg} g</span>
                                <span className="calc-inline-sub">{t('farmer.calculated')}</span>
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      <div style={{ marginTop: '16px' }}>
                        <Field label={`${t('farmer.ammonium')} (0–50 PPM) ${t('farmer.optionalDailyWeekly')}`} error={errors.ammoniaPpm}>
                          <input
                            type="number"
                            inputMode="numeric"
                            min="0"
                            max="50"
                            value={data.ammoniaPpm}
                            onChange={(e) => handleChange('ammoniaPpm', e.target.value)}
                            onWheel={(e) => e.currentTarget.blur()}
                            placeholder="e.g. 8"
                          />
                        </Field>
                        {isHighAmmonia(data.ammoniaPpm) && (
                          <div style={{
                            marginTop: '8px',
                            padding: '10px 14px',
                            background: '#fffbeb',
                            borderLeft: '4px solid #f59e0b',
                            borderRadius: '6px'
                          }}>
                            <div style={{ fontWeight: 600, color: '#92400e', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>⚠️</span>
                              <span>{t('farmer.ammoniaAlertTitle')}</span>
                            </div>
                            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#78350f', lineHeight: 1.4 }}>
                              {t('farmer.ammoniaAlertMessage')}
                            </p>
                          </div>
                        )}
                      </div>

                      <Field label={t('farmer.remarks')} error={errors.remarks}>
                        <textarea
                          value={data.remarks}
                          onChange={(e) => handleChange('remarks', e.target.value)}
                          placeholder={t('farmer.remarksPlaceholder')}
                          rows={3}
                          maxLength={1000}
                        />
                      </Field>
                      <div className="char-count">{data.remarks.length}/1000</div>
                    </>
                  )}
                </>
              ) : (
                <VerifyScreen
                  data={data}
                  farmId={farmId}
                  reportDate={reportDate}
                  weekNumber={weekNumber}
                  weekLabel={weekLabel}
                  birdCount={birdCount}
                  mortalityPct={mortalityPct}
                  cullingPct={cullingPct}
                  eggProdPct={eggProdPct}
                  selectionPct={selectionPct}
                  feedKgDisplay={feedKgDisplay}
                  feedPerBirdDisplay={feedPerBirdDisplay}
                  weeklyMetrics={weeklyMetrics}
                  onEdit={handleEditStep}
                  t={t}
                  flockName={flocks.find(f => f.flockId === data.flockId)?.flockName || data.flockId}
                />
              )}
            </div>

            {Object.keys(errors).length > 0 && (
              <div className="alert alert--error" style={{ marginBottom: '12px' }}>
                {t('farmer.fillRequiredFields')}
              </div>
            )}
            {submitError && <div className="alert alert--error" style={{ marginBottom: '12px' }}>{submitError}</div>}

            <div className="nav-bar">
              {step > 0 && (
                <button type="button" className="btn btn--outline btn--nav-back" onClick={handleBack} disabled={submitting}>
                  {t('farmer.back')}
                </button>
              )}
              {step < 3 ? (
                <button type="button" className="btn btn--primary btn--nav-next" onClick={handleNext}>
                  {step === 2 ? t('farmer.verify') : t('farmer.next')}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn--primary btn--nav-next"
                  onClick={handleSubmit}
                  disabled={
                    submitting ||
                    isLoadingUser ||
                    !reportingWeek.isValid ||
                    Boolean(todayReport && todayReport.submissionMethod !== 'HISTORICAL_IMPORT' && (todayReport.submissionVersion >= 2 || todayReport.status === 'corrected' || todayReport.status === 'finalized'))
                  }
                  style={{
                    opacity: (isLoadingUser || !reportingWeek.isValid || Boolean(todayReport && todayReport.submissionMethod !== 'HISTORICAL_IMPORT' && (todayReport.submissionVersion >= 2 || todayReport.status === 'corrected' || todayReport.status === 'finalized'))) ? 0.6 : 1,
                    cursor: (isLoadingUser || !reportingWeek.isValid || Boolean(todayReport && todayReport.submissionMethod !== 'HISTORICAL_IMPORT' && (todayReport.submissionVersion >= 2 || todayReport.status === 'corrected' || todayReport.status === 'finalized'))) ? 'not-allowed' : 'pointer',
                  }}
                >
                  {submitting ? (
                    <span className="spinner" />
                  ) : (todayReport && todayReport.submissionMethod !== 'HISTORICAL_IMPORT' && (todayReport.submissionVersion >= 2 || todayReport.status === 'corrected' || todayReport.status === 'finalized')) ? (
                    t('farmer.correctionLimitReached')
                  ) : (todayReport && todayReport.submissionMethod !== 'HISTORICAL_IMPORT' && todayReport.submissionVersion === 1) ? (
                    t('farmer.submitCorrection')
                  ) : (
                    t('farmer.submitReport')
                  )}
                </button>
              )}
            </div>
          </>
        )}
      </main>
      {renderModals()}
      <OverwriteConfirmationModal
        isOpen={showOverwriteModal}
        onClose={() => setShowOverwriteModal(false)}
        onConfirm={executeSubmission}
        reportDate={reportDate}
        farmId={farmId}
        submitting={submitting}
      />
      <TotalMortalityConfirmationModal
        isOpen={showTotalMortalityModal}
        onClose={handleCancelTotalMortality}
        onConfirm={handleConfirmTotalMortality}
        mortality={Number(data.mortality) || 0}
        birdCount={birdCount}
        farmId={farmId}
        reportDate={reportDate}
        submitting={submitting}
      />
    </div>
  );
}
