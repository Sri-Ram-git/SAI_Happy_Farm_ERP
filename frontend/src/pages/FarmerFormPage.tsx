import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { logoutUser } from '../services/authService';
import { submitReport, subscribeToTodayReport, getIstDate, formatDisplayDate } from '../services/reportService';
import { subscribeToFlocksByFarm, type FlockDoc } from '../services/flockDataService';
import { subscribeToFarm, type FarmDoc } from '../services/farmDataService';
import { LanguageSelector } from '../components/LanguageSelector';
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

function VerifyScreen({ data, farmId, reportDate, birdCount, mortalityPct, cullingPct, eggProdPct, selectionPct, feedKgDisplay, onEdit, t, flockName }: VerifyProps) {
  return (
    <>
      <h3 className="form-section-title">{t('farmer.verifyReport')}</h3>

      <VerifyCard title={t('common.info')} onEdit={() => onEdit(0)} t={t}>
        <VerifyRow label={t('common.date')} value={formatDisplayDate(reportDate)} />
        <VerifyRow label={t('flock.farm')} value={farmId} />
        {flockName && <VerifyRow label={t('flock.flockName')} value={flockName} />}
      </VerifyCard>

      <VerifyCard title={t('farmer.step1')} onEdit={() => onEdit(0)} t={t}>
        <VerifyRow label={t('farmer.openingBirds')} value={birdCount.toLocaleString()} />
        <VerifyRow label={t('farmer.closingBirds')} value={`${(birdCount - Number(data.mortality || 0) - Number(data.culling || 0)).toLocaleString()}`} />
      </VerifyCard>

      <VerifyCard title={t('farmer.feed')} onEdit={() => onEdit(0)} t={t}>
        <VerifyRow label={`${t('farmer.quantity')} (Kg)`} value={`${feedKgDisplay.toFixed(2)} Kg`} />
        <VerifyRow label="Equivalent Weight (Grams)" value={`${(feedKgDisplay * 1000).toLocaleString()} G`} />
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
  const [submitError, setSubmitError] = useState('');
  
  const [flocks, setFlocks] = useState<FlockDoc[]>([]);
  const [farmDoc, setFarmDoc] = useState<FarmDoc | null>(null);
  const [todayReport, setTodayReport] = useState<any | null>(null);

  const farmId = userProfile?.farmIds?.[0] ?? '';
  const userName = userProfile?.name || firebaseUser?.displayName || 'Farmer';
  const reportDate = getIstDate();
  const birdCount = Number(data.birdCount) || 0;
  const DRAFT_KEY = `happy_farm_draft_${farmId}_${reportDate}`;

  // Subscribe to today's canonical report for current farm & date
  useEffect(() => {
    if (!userProfile?.uid || !farmId) return;
    const effectiveFlockId = data.flockId || flocks[0]?.flockId || `${farmId}_FL01`;
    const unsub = subscribeToTodayReport(userProfile.uid, effectiveFlockId, reportDate, (rep) => {
      setTodayReport(rep);
      if (rep) {
        // Pre-fill existing submitted report data into form state
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

  // Restore draft from localStorage if available
  useEffect(() => {
    if (!farmId) return;
    try {
      const cached = localStorage.getItem(DRAFT_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.data) {
          setData(parsed.data);
        }
        if (parsed && typeof parsed.step === 'number' && parsed.step < 3) {
          setStep(parsed.step);
        }
      }
    } catch (err) {
      console.error('[FarmerForm] Error loading draft:', err);
    }
  }, [farmId, reportDate]);

  useEffect(() => {
    if (!farmId) return;
    const unsubFlocks = subscribeToFlocksByFarm(farmId, (fetchedFlocks) => {
      setFlocks(fetchedFlocks);
      if (fetchedFlocks.length > 0) {
        const primaryFlock = fetchedFlocks[0];
        setData((prev) => ({
          ...prev,
          flockId: prev.flockId || primaryFlock.flockId,
          birdCount: prev.birdCount || String(primaryFlock.currentBirds ?? ''),
        }));
      }
    });
    const unsubFarm = subscribeToFarm(farmId, (fetchedFarm) => {
      setFarmDoc(fetchedFarm);
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
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        data: nextData,
        step: nextStep,
        updatedAt: Date.now(),
      }));
    } catch (err) {
      console.error('[FarmerForm] Error caching draft:', err);
    }
  };

  const handleChange = (field: keyof FarmFormData, value: string) => {
    setData((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === 'flockId') {
        const selectedFlock = flocks.find(f => f.flockId === value);
        if (selectedFlock) {
          updated.birdCount = String(selectedFlock.currentBirds);
        }
      }

      // Auto-calculate Egg Weight Avg when Egg Weight Min or Max changes
      if (field === 'eggWeightMin' || field === 'eggWeightMax') {
        const minStr = field === 'eggWeightMin' ? value : prev.eggWeightMin;
        const maxStr = field === 'eggWeightMax' ? value : prev.eggWeightMax;
        const min = Number(minStr);
        const max = Number(maxStr);
        if (minStr !== '' && maxStr !== '' && !isNaN(min) && !isNaN(max) && min >= 0 && max >= 0 && min <= max) {
          updated.eggWeightAvg = String(Number(((min + max) / 2).toFixed(1)));
        }
      }

      // Auto-calculate Body Weight Avg when Body Weight Min or Max changes
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
    const effectiveBirdCount = birdCount || (flocks[0]?.currentBirds ?? farmDoc?.currentBirds ?? 0);
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
      };

      // Validate all numeric fields to prevent NaN or undefined
      for (const [key, val] of Object.entries(payload)) {
        if (typeof val === 'number' && !Number.isFinite(val)) {
          throw new Error(`Invalid numeric value for field: ${key}`);
        }
      }
      if (!Number.isFinite(payload.eggWeight.min) || !Number.isFinite(payload.bodyWeight.min)) {
          throw new Error(`Invalid numeric value in weight fields`);
      }

      await submitReport(payload);

      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch (e) {}

      setSubmitted(true);
    } catch (err: any) {
      console.error('[FarmForm] Submit error:', err);
      if (err.message === 'NO_CHANGES_DETECTED') {
        setSubmitError(t('farmer.noChangesDetected'));
      } else if (err.message === 'CORRECTION_LIMIT_REACHED' || err.message === 'DUPLICATE_REPORT') {
        setSubmitError(t('farmer.correctionLimitReached'));
      } else if (err.message === 'INSUFFICIENT_FEED') {
        setSubmitError('Insufficient feed stock available on the farm for this quantity.');
      } else if (err.message === 'INSUFFICIENT_BIRDS') {
        setSubmitError('Insufficient bird count available on the farm for this quantity.');
      } else if (err.message === 'INVENTORY_NOT_INITIALIZED') {
        setSubmitError('Farm inventory is not initialized. Contact an administrator.');
      } else if (err.message === 'FLOCK_NOT_FOUND' || err.message === 'FARM_NOT_FOUND') {
        setSubmitError('Farm or Flock data not found. Please contact an administrator.');
      } else if (err.message === 'USER_NOT_FOUND' || err.message === 'USER_NOT_AUTHORIZED' || err.message === 'FARM_NOT_ASSIGNED') {
        setSubmitError('You are not authorized to submit reports for this farm.');
      } else {
        setSubmitError(err.message || t('common.error'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch (e) {}
    setData(INITIAL_FARM_FORM_DATA);
    setErrors({});
    setStep(0);
    setSubmitted(false);
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

  if (submitted) {
    return (
      <div className="dashboard-page">
        <header className="dash-header">
          <div className="dash-header-left">
            <img src="/happy_farm_logo.jpg" alt="SAI Happy Farms" className="dash-logo-img" />
            <div>
              <h1>SAI Happy Farms</h1>
              <p className="dash-subtitle">{t('farmer.title')}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="farm-id-chip">
              <Home size={14} />
              <span>{t('flock.farm')}: {farmId}</span>
            </div>
            <LanguageSelector />
            <button className="btn btn--outline" onClick={handleLogout}>
              <LogOut size={16} />
              <span>{t('auth.logout')}</span>
            </button>
          </div>
        </header>
        <main className="dash-main">
          <div className="success-screen">
            <div className="success-icon"><Check size={40} /></div>
            <h2>{t('common.success')}</h2>
            <p>{t('farmer.successMessage')}</p>
            <p className="text-muted">{t('common.date')}: {formatDisplayDate(reportDate)} | {t('flock.farm')}: {farmId}</p>
            <button className="btn btn--primary btn--full" style={{ marginTop: 24 }} onClick={handleReset}>
              {t('common.save')}
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <header className="dash-header">
        <div className="dash-header-left">
          <img src="/happy_farm_logo.jpg" alt="SAI Happy Farms" className="dash-logo-img" />
          <div>
            <h1>SAI Happy Farms</h1>
            <p className="dash-subtitle">{t('farmer.title')}</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="farm-id-chip">
            <Home size={14} />
            <span>{t('flock.farm')}: {farmId}</span>
          </div>
          <LanguageSelector />
          <button className="btn btn--outline" onClick={handleLogout}>
            <LogOut size={16} />
            <span>{t('auth.logout')}</span>
          </button>
        </div>
      </header>
      <main className="dash-main">
        {/* Welcome Message */}
        <div className="welcome-banner">
          <h2>{t('farmer.welcomeBack', { name: userName })}</h2>
          <p className="welcome-subtitle">{t('farmer.welcomeSubtitle')}</p>
        </div>

        {farmDoc && farmDoc.inventoryInitialized !== true && (
          <div className="alert alert--critical" style={{ marginBottom: '16px', fontWeight: 600 }}>
            ⚠️ Your farm inventory has not been initialized. You cannot submit daily reports until an Admin sets up the initial bird and feed inventory.
          </div>
        )}

        {farmDoc && farmDoc.inventoryInitialized === true && todayReport && (todayReport.submissionVersion >= 2 || todayReport.status === 'corrected' || todayReport.status === 'finalized') && (
          <div className="alert alert--warning" style={{ marginBottom: '16px', fontWeight: 600 }}>
            ⚠️ {t('farmer.v2Banner')}
          </div>
        )}
        {farmDoc && farmDoc.inventoryInitialized === true && todayReport && (todayReport.submissionVersion === 1 && todayReport.status !== 'corrected' && todayReport.status !== 'finalized') && (
          <div className="alert alert--info" style={{ marginBottom: '16px', fontWeight: 600 }}>
            ℹ️ {t('farmer.v1Banner')}
          </div>
        )}

        {(!farmDoc || farmDoc.inventoryInitialized === true) && (
          <>
            {/* Reference Information Card */}
        <div className="locked-card">
          <div className="locked-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="locked-row">
              <span className="locked-label">{t('common.date').toUpperCase()}</span>
              <span className="locked-value" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                {formatDisplayDate(reportDate)} <Lock size={13} style={{ color: 'var(--gray-400)' }} />
              </span>
            </div>
            <div className="locked-row">
              <span className="locked-label">{t('farmer.openingBirds').toUpperCase()}</span>
              <span className="locked-value">
                {birdCount > 0 ? birdCount.toLocaleString() : (flocks[0]?.currentBirds ? flocks[0].currentBirds.toLocaleString() : '--')}
              </span>
            </div>
            <div className="locked-row">
              <span className="locked-label">{t('farmer.totalFeedAvailable').toUpperCase()}</span>
              <span className="locked-value" style={{ color: 'var(--green-700)' }}>
                {farmDoc?.currentFeedKg != null ? `${farmDoc.currentFeedKg.toLocaleString()} Kg` : '--'}
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
                  <div className="field-row">
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
                    <Field label="Equivalent Weight (G)">
                      <input
                        type="text"
                        readOnly
                        className="form-input read-only-input"
                        value={data.feedQuantity ? `${(Number(data.feedQuantity) * 1000).toLocaleString()} G (Auto)` : '0 G (Auto)'}
                      />
                    </Field>
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
                    <div className="calc-value">
                      {t('farmer.rate')}: {mortalityPct}%
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
                    <div className="calc-value">
                      {t('farmer.rate')}: {cullingPct}%
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
                    <div className="calc-value">
                      {t('farmer.rate')}: {eggProdPct}%
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
                    <div className="calc-value">
                      {t('farmer.rate')}: {selectionPct}%
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
                        placeholder="45"
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
                        placeholder="55"
                      />
                    </Field>
                    <Field label="Avg (g) (Auto)" error={errors.eggWeightAvg}>
                      <input
                        type="text"
                        readOnly
                        className="form-input read-only-input"
                        value={data.eggWeightAvg ? `${data.eggWeightAvg} g (Auto)` : ''}
                        placeholder="Auto Calculated"
                      />
                    </Field>
                  </div>

                  <h4 className="form-sub-title">{t('farmer.bodyWeight')}</h4>
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
                        placeholder="1200"
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
                        placeholder="1800"
                      />
                    </Field>
                    <Field label="Avg (g) (Auto)" error={errors.bodyWeightAvg}>
                      <input
                        type="text"
                        readOnly
                        className="form-input read-only-input"
                        value={data.bodyWeightAvg ? `${data.bodyWeightAvg} g (Auto)` : ''}
                        placeholder="Auto Calculated"
                      />
                    </Field>
                  </div>

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
            <button type="button" className="btn btn--outline" onClick={handleBack} disabled={submitting}>
              {t('farmer.back')}
            </button>
          )}
          {step < 3 ? (
            <button type="button" className="btn btn--primary" onClick={handleNext} style={{ flex: 1 }}>
              {step === 2 ? t('farmer.verify') : t('farmer.next')}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleSubmit}
              disabled={submitting || (todayReport && (todayReport.submissionVersion >= 2 || todayReport.status === 'corrected' || todayReport.status === 'finalized'))}
              style={{
                flex: 1,
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
    </div>
  );
}
