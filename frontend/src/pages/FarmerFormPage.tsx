import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { logoutUser } from '../services/authService';
import { submitReport, syncPendingSubmissions, subscribeToTodayReport, getIstDate, formatDisplayDate, calculateWeekNumber } from '../services/reportService';
import { saveFarmerDraft, getFarmerDraft, clearFarmerDraft } from '../services/offlineDraftService';
import { subscribeToFlocksByFarm, type FlockDoc } from '../services/flockDataService';
import { subscribeToFarm, type FarmDoc } from '../services/farmDataService';
import { LanguageSelector } from '../components/LanguageSelector';
import { ReportStatusModal } from '../components/ReportStatusModal';
import { Check, Home, Lock, LogOut } from 'lucide-react';
import {
  FarmFormData,
  INITIAL_FARM_FORM_DATA,
  FarmFormErrors,
  STEP_NAMES,
  validateStep,
} from '../utils/formValidation';

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {error && <span className="field-error">{error}</span>}
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
  weekNumber: number;
  birdCount: number;
  mortalityPct: string;
  cullingPct: string;
  eggProdPct: string;
  selectionPct: string;
  feedKgDisplay: number;
  onEdit: (step: number) => void;
  t: any;
  flockName: string;
}

function VerifyScreen({ data, farmId, reportDate, weekNumber, birdCount, mortalityPct, cullingPct, eggProdPct, selectionPct, feedKgDisplay, onEdit, t, flockName }: VerifyProps) {
  return (
    <>
      <h3 className="form-section-title">{t('farmer.verifyReport')}</h3>

      <VerifyCard title={t('common.info')} onEdit={() => onEdit(0)} t={t}>
        <VerifyRow label={t('common.date')} value={formatDisplayDate(reportDate)} />
        <VerifyRow label={t('flock.farm')} value={farmId} />
        <VerifyRow label="Week" value={`Week ${weekNumber}`} />
        {flockName && <VerifyRow label={t('flock.flockName')} value={flockName} />}
      </VerifyCard>

      <VerifyCard title={t('farmer.step1')} onEdit={() => onEdit(0)} t={t}>
        <VerifyRow label={t('farmer.openingBirds')} value={birdCount.toLocaleString()} />
        <VerifyRow label={t('farmer.closingBirds')} value={`${(birdCount - Number(data.mortality || 0) - Number(data.culling || 0)).toLocaleString()}`} />
      </VerifyCard>

      <VerifyCard title={t('farmer.feed')} onEdit={() => onEdit(0)} t={t}>
        <VerifyRow label={`${t('farmer.quantity')} (Kg)`} value={`${feedKgDisplay.toFixed(2)} Kg`} />
        <VerifyRow label="Equivalent Weight" value={`${(feedKgDisplay * 1000).toLocaleString()} G`} />
      </VerifyCard>

      <VerifyCard title={t('farmer.mortality')} onEdit={() => onEdit(0)} t={t}>
        <VerifyRow label={t('farmer.count')} value={data.mortality} />
        <VerifyRow label={t('farmer.rate')} value={`${mortalityPct}%`} />
      </VerifyCard>

      <VerifyCard title={t('farmer.culling')} onEdit={() => onEdit(0)} t={t}>
        <VerifyRow label={t('farmer.count')} value={data.culling} />
        <VerifyRow label={t('farmer.rate')} value={`${cullingPct}%`} />
      </VerifyCard>

      <VerifyCard title={t('farmer.eggProduction')} onEdit={() => onEdit(1)} t={t}>
        <VerifyRow label={t('farmer.produced')} value={`${data.eggsProduced} (${eggProdPct}%)`} />
      </VerifyCard>

      <VerifyCard title={t('farmer.selectionEggs')} onEdit={() => onEdit(1)} t={t}>
        <VerifyRow label={t('farmer.count')} value={`${data.selectionEggs} (${selectionPct}%)`} />
      </VerifyCard>

      <VerifyCard title={t('farmer.temperature')} onEdit={() => onEdit(1)} t={t}>
        <VerifyRow label="Min Temp" value={`${data.tempMin} °C`} />
        <VerifyRow label="Max Temp" value={`${data.tempMax} °C`} />
        <VerifyRow label="Avg Temp" value={`${((Number(data.tempMin) + Number(data.tempMax)) / 2).toFixed(1)} °C`} />
      </VerifyCard>

      <VerifyCard title={t('farmer.eggWeight')} onEdit={() => onEdit(2)} t={t}>
        <VerifyRow label="Min" value={`${data.eggWeightMin} g`} />
        <VerifyRow label="Max" value={`${data.eggWeightMax} g`} />
        <VerifyRow label="Avg" value={`${data.eggWeightAvg} g`} />
      </VerifyCard>

      <VerifyCard title={t('farmer.bodyWeight')} onEdit={() => onEdit(2)} t={t}>
        <VerifyRow label="Min" value={`${data.bodyWeightMin} g`} />
        <VerifyRow label="Max" value={`${data.bodyWeightMax} g`} />
        <VerifyRow label="Avg" value={`${data.bodyWeightAvg} g`} />
      </VerifyCard>

      <VerifyCard title={t('common.other')} onEdit={() => onEdit(2)} t={t}>
        <VerifyRow label={t('farmer.ammonium')} value={`${data.ammoniaPpm} PPM`} />
        {data.remarks && <VerifyRow label={t('farmer.remarks')} value={data.remarks} />}
      </VerifyCard>
    </>
  );
}

export function FarmerFormPage() {
  const { t } = useTranslation();
  const { userProfile, firebaseUser } = useAuth();
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
  const [showStatusModal, setShowStatusModal] = useState<boolean>(false);
  const [hasDismissedModal, setHasDismissedModal] = useState<boolean>(false);

  useEffect(() => {
    if (todayReport && (todayReport.submissionVersion != null || todayReport.status) && !hasDismissedModal) {
      setShowStatusModal(true);
    }
  }, [todayReport?.submissionVersion, todayReport?.status, hasDismissedModal]);

  const farmId = userProfile?.farmIds?.[0] ?? '';
  const userName = userProfile?.name || firebaseUser?.displayName || 'Farmer';
  const reportDate = getIstDate();
  const birdCount = Number(data.birdCount) || 0;

  // Calculate Week Number from authoritative creation / start date
  const creationDateSource = flocks[0]?.startDate || flocks[0]?.createdAt || (userProfile as any)?.createdAt || (userProfile as any)?.created_at || farmDoc?.inventoryInitializedAt || (farmDoc as any)?.createdAt;
  const weekNumber = calculateWeekNumber(creationDateSource, reportDate);

  // Subscribe to today's canonical report for current farm & date
  useEffect(() => {
    if (!userProfile?.uid || !farmId) return;
    const effectiveFlockId = data.flockId || flocks[0]?.flockId || `${farmId}_FL01`;
    const unsub = subscribeToTodayReport(userProfile.uid, effectiveFlockId, reportDate, (rep) => {
      setTodayReport(rep);
      if (rep) {
        setData((prev) => ({
          ...prev,
          flockId: rep.flockId || prev.flockId,
          birdCount: String(rep.openingBirdCount ?? rep.birdCount ?? prev.birdCount),
          feedQuantity: String(rep.feedKg ?? prev.feedQuantity),
          mortality: String(rep.mortality ?? prev.mortality),
          culling: String(rep.culling ?? prev.culling),
          eggsProduced: String(rep.eggsProduced ?? prev.eggsProduced),
          selectionEggs: String(rep.selectionEggs ?? prev.selectionEggs),
          temperature: String(rep.temperature ?? prev.temperature),
          tempMin: String(rep.tempMin ?? prev.tempMin ?? ''),
          tempMax: String(rep.tempMax ?? prev.tempMax ?? ''),
          eggWeightMin: String(rep.eggWeight?.min ?? prev.eggWeightMin),
          eggWeightMax: String(rep.eggWeight?.max ?? prev.eggWeightMax),
          eggWeightAvg: String(rep.eggWeight?.avg ?? prev.eggWeightAvg),
          bodyWeightMin: String(rep.bodyWeight?.min ?? prev.bodyWeightMin),
          bodyWeightMax: String(rep.bodyWeight?.max ?? prev.bodyWeightMax),
          bodyWeightAvg: String(rep.bodyWeight?.avg ?? prev.bodyWeightAvg),
          remarks: rep.remarks ?? prev.remarks,
          ammoniaPpm: String(rep.ammoniaPpm ?? prev.ammoniaPpm),
        }));
      }
    });
    return () => unsub();
  }, [userProfile?.uid, farmId, reportDate, flocks.length]);

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
        }));
      }
    });
    const unsubFarm = subscribeToFarm(farmId, (fetchedFarm) => {
      setFarmDoc(fetchedFarm);
      if (fetchedFarm && fetchedFarm.currentBirdCount != null) {
        setData((prev) => {
          if (!prev.birdCount) {
            return { ...prev, birdCount: String(fetchedFarm.currentBirdCount) };
          }
          return prev;
        });
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
        }
      }

      if (field === 'bodyWeightMin' || field === 'bodyWeightMax') {
        const minStr = field === 'bodyWeightMin' ? value : prev.bodyWeightMin;
        const maxStr = field === 'bodyWeightMax' ? value : prev.bodyWeightMax;
        const min = Number(minStr);
        const max = Number(maxStr);
        if (minStr !== '' && maxStr !== '' && !isNaN(min) && !isNaN(max) && min >= 0 && max >= 0 && min <= max) {
          updated.bodyWeightAvg = String(Number(((min + max) / 2).toFixed(1)));
        }
      }

      return updated;
    });

    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      delete next.eggWeightAvg;
      delete next.bodyWeightAvg;
      return next;
    });
  };

  const handleNext = () => {
    const effectiveFlockId = data.flockId || flocks[0]?.flockId || `${farmId}_FL01`;
    const effectiveBirdCount = birdCount || (farmDoc?.currentBirdCount ?? flocks[0]?.currentBirds ?? 0);
    const avgTemp = (Number(data.tempMin) + Number(data.tempMax)) / 2;

    const effectiveData: FarmFormData = {
      ...data,
      flockId: effectiveFlockId,
      birdCount: data.birdCount || String(effectiveBirdCount || ''),
      mortality: data.mortality === '' ? '0' : data.mortality,
      culling: data.culling === '' ? '0' : data.culling,
      temperature: String(avgTemp || data.temperature || ''),
    };

    const stepErrors = validateStep(step, effectiveData, effectiveBirdCount);
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
    setSubmitting(true);
    setSubmitError('');
    try {
      let feedKg = Number(data.feedQuantity) || 0;
      if (data.feedUnit === 'g') {
        feedKg = feedKg / 1000;
      }
      
      const effectiveFlockId = data.flockId || flocks[0]?.flockId || `${farmId}_FL01`;
      const avgTemp = (Number(data.tempMin) + Number(data.tempMax)) / 2;

      const payload = {
        farmId,
        flockId: effectiveFlockId,
        birdCount,
        feedKg,
        feedGrams: feedKg * 1000,
        feedG: feedKg * 1000,
        mortality: Number(data.mortality) || 0,
        culling: Number(data.culling) || 0,
        eggsProduced: Number(data.eggsProduced) || 0,
        selectionEggs: Number(data.selectionEggs) || 0,
        temperature: avgTemp || 0,
        tempMin: Number(data.tempMin) || 0,
        tempMax: Number(data.tempMax) || 0,
        eggWeight: {
          min: Number(data.eggWeightMin) || 0,
          max: Number(data.eggWeightMax) || 0,
          avg: Number(data.eggWeightAvg) || 0,
        },
        bodyWeight: {
          min: Number(data.bodyWeightMin) || 0,
          max: Number(data.bodyWeightMax) || 0,
          avg: Number(data.bodyWeightAvg) || 0,
        },
        remarks: data.remarks || '',
        ammoniaPpm: Number(data.ammoniaPpm) || 0,
        submittedBy: userProfile!.uid,
        weekNumber,
        submissionDate: reportDate,
        reportDate: reportDate,
        submissionKey: `sub_${userProfile!.uid}_${farmId}_${reportDate}`,
      };

      for (const [key, val] of Object.entries(payload)) {
        if (typeof val === 'number' && !Number.isFinite(val)) {
          throw new Error(`Invalid numeric value for field: ${key}`);
        }
      }
      if (!Number.isFinite(payload.eggWeight.min) || !Number.isFinite(payload.bodyWeight.min)) {
          throw new Error(`Invalid numeric value in weight fields`);
      }

      const res = await submitReport(payload);

      if (res.isOffline) {
        setSubmittedOffline(true);
      } else {
        if (userProfile?.uid && farmId) {
          await clearFarmerDraft(userProfile.uid, farmId, reportDate);
        }
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

  const handleReset = () => {
    if (userProfile?.uid && farmId) {
      clearFarmerDraft(userProfile.uid, farmId, reportDate);
    }
    setData(INITIAL_FARM_FORM_DATA);
    setErrors({});
    setStep(0);
    setSubmitted(false);
    setSubmittedOffline(false);
    setSubmitError('');
  };

  const handleLogout = async () => {
    await logoutUser();
  };

  const mortalityPct = birdCount > 0 ? ((Number(data.mortality) / birdCount) * 100).toFixed(1) : '0.0';
  const cullingPct = birdCount > 0 ? ((Number(data.culling) / birdCount) * 100).toFixed(1) : '0.0';
  const eggProdPct = birdCount > 0 ? ((Number(data.eggsProduced) / birdCount) * 100).toFixed(1) : '0.0';
  const selectionPct = Number(data.eggsProduced) > 0 ? ((Number(data.selectionEggs) / Number(data.eggsProduced)) * 100).toFixed(1) : '0.0';
  const feedKgDisplay = data.feedQuantity ? Number(data.feedQuantity) : 0;

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
              <span className="offline-status-badge offline">🟠 Offline (Saved)</span>
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
            <h2>Report saved on this device</h2>
            <p style={{ marginTop: '10px', fontSize: '14px', color: '#475569' }}>
              It will be submitted automatically when internet connection returns.
            </p>
            <p className="text-muted" style={{ marginTop: '14px' }}>
              {t('common.date')}: {formatDisplayDate(reportDate)} | Week {weekNumber} | {t('flock.farm')}: {farmId}
            </p>
            <button className="btn btn--primary btn--full" style={{ marginTop: 20 }} onClick={handleReset}>
              {t('common.save')}
            </button>
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
                {!isOnline ? '🟠 Offline (Saved)' : isSyncing ? '🔵 Syncing...' : '🟢 Online'}
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
            <p>{t('farmer.successMessage')}</p>
            <p className="text-muted">{t('common.date')}: {formatDisplayDate(reportDate)} | Week {weekNumber} | {t('flock.farm')}: {farmId}</p>
            <button className="btn btn--primary btn--full" style={{ marginTop: 20 }} onClick={handleReset}>
              {t('common.save')}
            </button>
          </div>
        </main>
      </div>
    );
  }

  const displayOpeningBirds = todayReport?.openingBirdCount ?? (birdCount > 0 ? birdCount : farmDoc?.currentBirdCount);
  const displayTotalFeed = todayReport?.openingFeedKg ?? farmDoc?.currentFeedKg;

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
              {!isOnline ? '🟠 Offline (Saved)' : isSyncing ? '🔵 Syncing...' : '🟢 Online'}
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
            ⚠️ Your farm inventory has not been initialized. You cannot submit daily reports until an Admin sets up the initial bird and feed inventory.
          </div>
        )}

        {(!farmDoc || farmDoc.inventoryInitialized === true) && (
          <>
            <div className="locked-card">
              <div className="locked-card-title">REPORT INFORMATION</div>
              <div className="locked-grid">
                <div className="locked-item">
                  <span className="locked-label">{t('common.date').toUpperCase()}</span>
                  <span className="locked-value">
                    {formatDisplayDate(reportDate)} <Lock size={12} className="lock-icon" />
                  </span>
                </div>
                <div className="locked-item">
                  <span className="locked-label">{t('farmer.openingBirds').toUpperCase()}</span>
                  <span className="locked-value">
                    {displayOpeningBirds != null ? displayOpeningBirds.toLocaleString() : '--'}
                  </span>
                </div>
                <div className="locked-item">
                  <span className="locked-label">WEEK</span>
                  <span className="locked-value week-val">
                    Week {weekNumber}
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
                {step < 3 ? `Step ${step + 1} of 3 — ${t(`farmer.step${step + 1}`)}` : t('farmer.verifyReport')}
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
                      <Field label={`${t('farmer.feed')} (KG)`} error={errors.feedQuantity}>
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
                      <div className="calc-inline">
                        <span className="calc-inline-label">Equivalent Weight:</span>
                        <span className="calc-inline-value">{data.feedQuantity ? `${(Number(data.feedQuantity) * 1000).toLocaleString()} G` : '0 G'}</span>
                        <span className="calc-inline-sub">Calculated automatically</span>
                      </div>

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
                      {birdCount > 0 && (
                        <div className="calc-inline">
                          <span className="calc-inline-label">{t('farmer.rate')}:</span>
                          <span className="calc-inline-value">{mortalityPct}%</span>
                          <span className="calc-inline-sub">Calculated automatically</span>
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
                      {birdCount > 0 && (
                        <div className="calc-inline">
                          <span className="calc-inline-label">{t('farmer.rate')}:</span>
                          <span className="calc-inline-value">{cullingPct}%</span>
                          <span className="calc-inline-sub">Calculated automatically</span>
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
                          max={birdCount || undefined}
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
                          <span className="calc-inline-sub">Calculated automatically</span>
                        </div>
                      )}

                      <Field label={t('farmer.selectionEggs')} error={errors.selectionEggs}>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="0"
                          max={Number(data.eggsProduced) || undefined}
                          value={data.selectionEggs}
                          onChange={(e) => handleChange('selectionEggs', e.target.value)}
                          onWheel={(e) => e.currentTarget.blur()}
                          placeholder="e.g. 3800"
                        />
                      </Field>
                      {Number(data.eggsProduced) > 0 && (
                        <div className="calc-inline">
                          <span className="calc-inline-label">{t('farmer.rate')}:</span>
                          <span className="calc-inline-value">{selectionPct}%</span>
                          <span className="calc-inline-sub">Calculated automatically</span>
                        </div>
                      )}

                      <h4 className="form-sub-title" style={{ marginTop: '16px' }}>{t('farmer.temperature')}</h4>
                      <div className="field-row">
                        <Field label={t('farmer.tempMin')} error={errors.tempMin}>
                          <input
                            type="number"
                            inputMode="decimal"
                            min="-10"
                            max="60"
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
                            min="-10"
                            max="60"
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
                          <span className="calc-inline-label">Avg Temp:</span>
                          <span className="calc-inline-value">
                            {((Number(data.tempMin || 0) + Number(data.tempMax || 0)) / (data.tempMin && data.tempMax ? 2 : 1)).toFixed(1)} °C
                          </span>
                          <span className="calc-inline-sub">Calculated automatically</span>
                        </div>
                      )}
                    </>
                  )}

                  {step === 2 && (
                    <>
                      <h4 className="form-sub-title">{t('farmer.eggWeight')}</h4>
                      <div className="field-row">
                        <Field label="Min (g)" error={errors.eggWeightMin}>
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.1"
                            value={data.eggWeightMin}
                            onChange={(e) => handleChange('eggWeightMin', e.target.value)}
                            onWheel={(e) => e.currentTarget.blur()}
                            placeholder="e.g. 45"
                          />
                        </Field>
                        <Field label="Max (g)" error={errors.eggWeightMax}>
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.1"
                            value={data.eggWeightMax}
                            onChange={(e) => handleChange('eggWeightMax', e.target.value)}
                            onWheel={(e) => e.currentTarget.blur()}
                            placeholder="e.g. 55"
                          />
                        </Field>
                      </div>
                      {data.eggWeightAvg && (
                        <div className="calc-inline">
                          <span className="calc-inline-label">Avg Egg Weight:</span>
                          <span className="calc-inline-value">{data.eggWeightAvg} g</span>
                          <span className="calc-inline-sub">Calculated automatically</span>
                        </div>
                      )}

                      <h4 className="form-sub-title" style={{ marginTop: '16px' }}>{t('farmer.bodyWeight')}</h4>
                      <div className="field-row">
                        <Field label="Min (g)" error={errors.bodyWeightMin}>
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.1"
                            value={data.bodyWeightMin}
                            onChange={(e) => handleChange('bodyWeightMin', e.target.value)}
                            onWheel={(e) => e.currentTarget.blur()}
                            placeholder="e.g. 1200"
                          />
                        </Field>
                        <Field label="Max (g)" error={errors.bodyWeightMax}>
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.1"
                            value={data.bodyWeightMax}
                            onChange={(e) => handleChange('bodyWeightMax', e.target.value)}
                            onWheel={(e) => e.currentTarget.blur()}
                            placeholder="e.g. 1800"
                          />
                        </Field>
                      </div>
                      {data.bodyWeightAvg && (
                        <div className="calc-inline">
                          <span className="calc-inline-label">Avg Body Weight:</span>
                          <span className="calc-inline-value">{data.bodyWeightAvg} g</span>
                          <span className="calc-inline-sub">Calculated automatically</span>
                        </div>
                      )}

                      <Field label={t('farmer.ammonium')} error={errors.ammoniaPpm}>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="0"
                          max="100"
                          value={data.ammoniaPpm}
                          onChange={(e) => handleChange('ammoniaPpm', e.target.value)}
                          onWheel={(e) => e.currentTarget.blur()}
                          placeholder="e.g. 10"
                        />
                      </Field>

                      <Field label={t('farmer.remarks')} error={errors.remarks}>
                        <textarea
                          value={data.remarks}
                          onChange={(e) => handleChange('remarks', e.target.value)}
                          placeholder="Any observations or notes..."
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
                  birdCount={birdCount}
                  mortalityPct={mortalityPct}
                  cullingPct={cullingPct}
                  eggProdPct={eggProdPct}
                  selectionPct={selectionPct}
                  feedKgDisplay={feedKgDisplay}
                  onEdit={handleEditStep}
                  t={t}
                  flockName={flocks.find(f => f.flockId === data.flockId)?.flockName || data.flockId}
                />
              )}
            </div>

            {Object.keys(errors).length > 0 && (
              <div className="alert alert--error" style={{ marginBottom: '12px' }}>
                Please fill in all required fields on this step to proceed.
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
                  disabled={submitting || (todayReport && (todayReport.submissionVersion >= 2 || todayReport.status === 'corrected' || todayReport.status === 'finalized'))}
                  style={{
                    opacity: (todayReport && (todayReport.submissionVersion >= 2 || todayReport.status === 'corrected' || todayReport.status === 'finalized')) ? 0.6 : 1,
                    cursor: (todayReport && (todayReport.submissionVersion >= 2 || todayReport.status === 'corrected' || todayReport.status === 'finalized')) ? 'not-allowed' : 'pointer',
                  }}
                >
                  {submitting ? (
                    <span className="spinner" />
                  ) : (todayReport && (todayReport.submissionVersion >= 2 || todayReport.status === 'corrected' || todayReport.status === 'finalized')) ? (
                    t('farmer.correctionLimitReached')
                  ) : (todayReport && todayReport.submissionVersion === 1) ? (
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
      <ReportStatusModal
        isOpen={showStatusModal}
        onClose={() => {
          setShowStatusModal(false);
          setHasDismissedModal(true);
        }}
        submissionVersion={todayReport?.submissionVersion || 1}
      />
    </div>
  );
}
