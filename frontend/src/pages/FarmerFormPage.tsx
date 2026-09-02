import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { logoutUser } from '../services/authService';
import { submitReport, getIstDate, formatDisplayDate } from '../services/reportService';
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

function VerifyCard({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <div className="verify-card">
      <div className="verify-header">
        <h4 className="verify-title">{title}</h4>
        <button className="verify-edit" onClick={onEdit} type="button">Edit</button>
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
}

function VerifyScreen({ data, farmId, reportDate, birdCount, mortalityPct, cullingPct, eggProdPct, selectionPct, feedKgDisplay, onEdit }: VerifyProps) {
  return (
    <>
      <h3 className="form-section-title">Verify Report</h3>

      <VerifyCard title="Report Info" onEdit={() => onEdit(0)}>
        <VerifyRow label="Date" value={formatDisplayDate(reportDate)} />
        <VerifyRow label="Farm ID" value={farmId} />
      </VerifyCard>

      <VerifyCard title="Bird Data" onEdit={() => onEdit(0)}>
        <VerifyRow label="Current Birds" value={birdCount.toLocaleString()} />
        <VerifyRow label="Closing Birds (after mortality/culling)" value={`${(birdCount - Number(data.mortality || 0) - Number(data.culling || 0)).toLocaleString()}`} />
      </VerifyCard>

      <VerifyCard title="Feed" onEdit={() => onEdit(0)}>
        <VerifyRow label="Quantity" value={`${data.feedQuantity} ${data.feedUnit.toUpperCase()}`} />
        <VerifyRow label="In Kg" value={`${feedKgDisplay.toFixed(2)} Kg`} />
      </VerifyCard>

      <VerifyCard title="Mortality" onEdit={() => onEdit(0)}>
        <VerifyRow label="Count" value={data.mortality} />
        <VerifyRow label="Rate" value={`${mortalityPct}%`} />
      </VerifyCard>

      <VerifyCard title="Culling" onEdit={() => onEdit(0)}>
        <VerifyRow label="Count" value={data.culling} />
        <VerifyRow label="Rate" value={`${cullingPct}%`} />
      </VerifyCard>

      <VerifyCard title="Egg Production" onEdit={() => onEdit(1)}>
        <VerifyRow label="Produced" value={`${data.eggsProduced} (${eggProdPct}%)`} />
      </VerifyCard>

      <VerifyCard title="Selection Eggs" onEdit={() => onEdit(1)}>
        <VerifyRow label="Count" value={`${data.selectionEggs} (${selectionPct}%)`} />
      </VerifyCard>

      <VerifyCard title="Temperature" onEdit={() => onEdit(1)}>
        <VerifyRow label="Value" value={`${data.temperature} °C`} />
      </VerifyCard>

      <VerifyCard title="Egg Weight" onEdit={() => onEdit(2)}>
        <VerifyRow label="Min" value={`${data.eggWeightMin} g`} />
        <VerifyRow label="Max" value={`${data.eggWeightMax} g`} />
        <VerifyRow label="Avg" value={`${data.eggWeightAvg} g`} />
      </VerifyCard>

      <VerifyCard title="Body Weight" onEdit={() => onEdit(2)}>
        <VerifyRow label="Min" value={`${data.bodyWeightMin} g`} />
        <VerifyRow label="Max" value={`${data.bodyWeightMax} g`} />
        <VerifyRow label="Avg" value={`${data.bodyWeightAvg} g`} />
      </VerifyCard>

      <VerifyCard title="Other" onEdit={() => onEdit(2)}>
        <VerifyRow label="Ammonium" value={`${data.ammoniaPpm} PPM`} />
        {data.remarks && <VerifyRow label="Remarks" value={data.remarks} />}
      </VerifyCard>
    </>
  );
}

function renderStep(
  step: number,
  data: FarmFormData,
  errors: FarmFormErrors,
  onChange: (field: keyof FarmFormData, value: string) => void,
  birdCount: number,
) {
  const mortalityVal = Number(data.mortality) || 0;
  const cullingVal = Number(data.culling) || 0;
  const eggsVal = Number(data.eggsProduced) || 0;
  const selectionVal = Number(data.selectionEggs) || 0;

  if (step === 0) {
    return (
      <>
        <Field label="Bird Count" error={errors.birdCount}>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            value={data.birdCount}
            onChange={(e) => onChange('birdCount', e.target.value)}
            placeholder="e.g. 1000"
          />
        </Field>

        <Field label="Feed Quantity" error={errors.feedQuantity}>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            value={data.feedQuantity}
            onChange={(e) => onChange('feedQuantity', e.target.value)}
            placeholder="e.g. 250"
          />
        </Field>
        <div className="unit-group">
          <button
            className={`unit-btn ${data.feedUnit === 'kg' ? 'unit-btn--active' : ''}`}
            onClick={() => onChange('feedUnit', 'kg')}
            type="button"
          >
            Kg
          </button>
          <button
            className={`unit-btn ${data.feedUnit === 'g' ? 'unit-btn--active' : ''}`}
            onClick={() => onChange('feedUnit', 'g')}
            type="button"
          >
            g
          </button>
        </div>

        <Field label="Mortality Count" error={errors.mortality}>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            max={birdCount || undefined}
            value={data.mortality}
            onChange={(e) => onChange('mortality', e.target.value)}
            placeholder="e.g. 12"
          />
        </Field>
        {birdCount > 0 && (
          <div className="calc-value">
            Mortality Rate: {((mortalityVal / birdCount) * 100).toFixed(1)}%
          </div>
        )}

        <Field label="Culling Count" error={errors.culling}>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            max={birdCount || undefined}
            value={data.culling}
            onChange={(e) => onChange('culling', e.target.value)}
            placeholder="e.g. 5"
          />
        </Field>
        {birdCount > 0 && (
          <div className="calc-value">
            Culling Rate: {((cullingVal / birdCount) * 100).toFixed(1)}%
          </div>
        )}
      </>
    );
  }

  if (step === 1) {
    return (
      <>
        <Field label="Eggs Produced" error={errors.eggsProduced}>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            max={birdCount || undefined}
            value={data.eggsProduced}
            onChange={(e) => onChange('eggsProduced', e.target.value)}
            placeholder="e.g. 4200"
          />
        </Field>
        {birdCount > 0 && (
          <div className="calc-value">
            Production Rate: {((eggsVal / birdCount) * 100).toFixed(1)}%
          </div>
        )}

        <Field label="Selection Eggs" error={errors.selectionEggs}>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            max={eggsVal || undefined}
            value={data.selectionEggs}
            onChange={(e) => onChange('selectionEggs', e.target.value)}
            placeholder="e.g. 3800"
          />
        </Field>
        {eggsVal > 0 && (
          <div className="calc-value">
            Selection Rate: {((selectionVal / eggsVal) * 100).toFixed(1)}%
          </div>
        )}

        <Field label="Temperature (°C)" error={errors.temperature}>
          <input
            type="number"
            inputMode="decimal"
            min="-10"
            max="60"
            step="0.1"
            value={data.temperature}
            onChange={(e) => onChange('temperature', e.target.value)}
            placeholder="e.g. 33.5"
          />
        </Field>
      </>
    );
  }

  if (step === 2) {
    return (
      <>
        <h4 className="form-sub-title">Egg Weight</h4>
        <div className="field-row">
          <Field label="Min (g)" error={errors.eggWeightMin}>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.1"
              value={data.eggWeightMin}
              onChange={(e) => onChange('eggWeightMin', e.target.value)}
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
              onChange={(e) => onChange('eggWeightMax', e.target.value)}
              placeholder="55"
            />
          </Field>
          <Field label="Avg (g)" error={errors.eggWeightAvg}>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.1"
              value={data.eggWeightAvg}
              onChange={(e) => onChange('eggWeightAvg', e.target.value)}
              placeholder="50"
            />
          </Field>
        </div>

        <h4 className="form-sub-title">Body Weight</h4>
        <div className="field-row">
          <Field label="Min (g)" error={errors.bodyWeightMin}>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.1"
              value={data.bodyWeightMin}
              onChange={(e) => onChange('bodyWeightMin', e.target.value)}
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
              onChange={(e) => onChange('bodyWeightMax', e.target.value)}
              placeholder="1800"
            />
          </Field>
          <Field label="Avg (g)" error={errors.bodyWeightAvg}>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.1"
              value={data.bodyWeightAvg}
              onChange={(e) => onChange('bodyWeightAvg', e.target.value)}
              placeholder="1500"
            />
          </Field>
        </div>

        <Field label="Ammonium Test (PPM)" error={errors.ammoniaPpm}>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            max="100"
            value={data.ammoniaPpm}
            onChange={(e) => onChange('ammoniaPpm', e.target.value)}
            placeholder="e.g. 10"
          />
        </Field>

        <Field label="Remarks (optional)" error={errors.remarks}>
          <textarea
            value={data.remarks}
            onChange={(e) => onChange('remarks', e.target.value)}
            placeholder="Any observations or notes..."
            rows={3}
            maxLength={1000}
          />
        </Field>
        <div className="char-count">{data.remarks.length}/1000</div>
      </>
    );
  }

  return null;
}

export function FarmerFormPage() {
  const { userProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<FarmFormData>(INITIAL_FARM_FORM_DATA);
  const [errors, setErrors] = useState<FarmFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const farmId = userProfile?.farmIds?.[0] ?? '';
  const reportDate = getIstDate();
  const birdCount = Number(data.birdCount) || 0;

  const handleChange = (field: keyof FarmFormData, value: string) => {
    setData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleNext = () => {
    const stepErrors = validateStep(step, data, birdCount);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      return;
    }
    setErrors({});
    setStep((s) => s + 1);
  };

  const handleBack = () => {
    setErrors({});
    setStep((s) => s - 1);
  };

  const handleEditStep = (targetStep: number) => {
    setErrors({});
    setStep(targetStep);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError('');
    try {
      const feedKg = data.feedUnit === 'kg' ? Number(data.feedQuantity) : Number(data.feedQuantity) / 1000;
      await submitReport({
        farmId,
        birdCount,
        feedKg,
        mortality: Number(data.mortality),
        culling: Number(data.culling),
        eggsProduced: Number(data.eggsProduced),
        selectionEggs: Number(data.selectionEggs),
        temperature: Number(data.temperature),
        eggWeight: {
          min: Number(data.eggWeightMin),
          max: Number(data.eggWeightMax),
          avg: Number(data.eggWeightAvg),
        },
        bodyWeight: {
          min: Number(data.bodyWeightMin),
          max: Number(data.bodyWeightMax),
          avg: Number(data.bodyWeightAvg),
        },
        remarks: data.remarks,
        ammoniaPpm: Number(data.ammoniaPpm),
        submittedBy: userProfile!.uid,
      });
      setSubmitted(true);
    } catch (err: any) {
      console.error('[FarmForm] Submit error:', err);
      if (err.message === 'DUPLICATE_REPORT') {
        setSubmitError('A report for this farm on today\'s date already exists.');
      } else {
        setSubmitError('Failed to submit report. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
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
  const feedKgDisplay = data.feedQuantity ? (data.feedUnit === 'kg' ? Number(data.feedQuantity) : Number(data.feedQuantity) / 1000) : 0;

  if (submitted) {
    return (
      <div className="dashboard-page">
        <header className="dash-header">
          <div className="dash-header-left">
            <img src="/happy_farm_logo.jpg" alt="SAI Happy Farms" className="dash-logo-img" />
            <div>
              <h1>SAI Happy Farms</h1>
              <p className="dash-subtitle">Farmer Daily Report</p>
            </div>
          </div>
          <button className="btn btn--outline" onClick={handleLogout}>Logout</button>
        </header>
        <main className="dash-main">
          <div className="success-screen">
            <div className="success-icon">&#10003;</div>
            <h2>Report Submitted</h2>
            <p>Your daily farm report has been recorded successfully.</p>
            <p className="text-muted">Date: {formatDisplayDate(reportDate)} | Farm: {farmId}</p>
            <button className="btn btn--primary btn--full" style={{ marginTop: 24 }} onClick={handleReset}>
              Submit Another Report
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
            <p className="dash-subtitle">Farmer Daily Report</p>
          </div>
        </div>
        <button className="btn btn--outline" onClick={handleLogout}>Logout</button>
      </header>
      <main className="dash-main">
        <div className="locked-card">
          <div className="locked-row">
            <span className="locked-label">REPORT DATE</span>
            <span className="locked-value">{formatDisplayDate(reportDate)} &#128274;</span>
          </div>
          <div className="locked-row">
            <span className="locked-label">FARM ID</span>
            <span className="locked-value">{farmId} &#128274;</span>
          </div>
        </div>

        <div className="form-progress">
          <div className="form-progress-text">
            {step < 3 ? `Step ${step + 1} of 3 — ${STEP_NAMES[step]}` : 'Verify & Submit'}
          </div>
          <div className="form-progress-track">
            <div className="form-progress-fill" style={{ width: `${Math.min(((step + 1) / 4) * 100, 100)}%` }} />
          </div>
        </div>

        <div className="form-card">
          {step < 3 ? (
            <>
              <h3 className="form-section-title">{STEP_NAMES[step]}</h3>
              {renderStep(step, data, errors, handleChange, birdCount)}
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
            />
          )}
        </div>

        {submitError && <div className="alert alert--error">{submitError}</div>}

        <div className="nav-bar">
          {step > 0 && (
            <button className="btn btn--outline" onClick={handleBack} disabled={submitting}>
              Back
            </button>
          )}
          {step < 3 ? (
            <button className="btn btn--primary" onClick={handleNext} style={{ flex: 1 }}>
              {step === 2 ? 'Verify' : 'Next'}
            </button>
          ) : (
            <button
              className="btn btn--primary"
              onClick={handleSubmit}
              disabled={submitting}
              style={{ flex: 1 }}
            >
              {submitting ? <span className="spinner" /> : 'Submit Report'}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
