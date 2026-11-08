import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/dashboard/DashboardLayout';
import { createFarmer, type CreateFarmerPayload } from '../../services/userDataService';
import { FormLoadingOverlay } from '../../components/common/FormLoadingOverlay';
import {
  validateName,
  validateEmail,
  validatePhone,
  validatePassword,
  validateConfirmPassword,
  validateFarmName,
  validateFarmId,
  validateBirdCount,
  validateFeedKg,
  isValidPhoneInput,
  isValidFarmIdInput,
  isValidIntegerInput,
  isValidDecimalInput,
  handleIntegerKeyDown,
  handleDecimalKeyDown,
  MAX_BIRD_COUNT,
  MAX_FEED_QUANTITY_KG,
} from '../../utils/validationRules';

interface FarmerForm {
  name: string;
  email: string;
  phone_no: string;
  password: string;
  confirmPassword: string;
  farmName: string;
  farmId: string;
  initialBirdCount: string;
  initialFeedKg: string;
}

const emptyForm: FarmerForm = {
  name: '',
  email: '',
  phone_no: '',
  password: '',
  confirmPassword: '',
  farmName: '',
  farmId: '',
  initialBirdCount: '0',
  initialFeedKg: '0',
};

export function AdminCreateFarmerPage() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState<FarmerForm>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const clearFieldError = (field: string) => {
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleFieldChange = (field: keyof FarmerForm, value: string) => {
    setForm((p) => ({ ...p, [field]: value }));
    clearFieldError(field);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (isValidPhoneInput(val)) {
      handleFieldChange('phone_no', val);
    }
  };

  const handlePhonePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text');
    const input = e.currentTarget;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const prospective = input.value.slice(0, start) + pasted + input.value.slice(end);
    if (!isValidPhoneInput(prospective)) {
      e.preventDefault();
    }
  };

  const handleFarmIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase();
    if (isValidFarmIdInput(val)) {
      handleFieldChange('farmId', val);
    }
  };

  const handleFarmIdPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').toUpperCase();
    const input = e.currentTarget;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const prospective = input.value.slice(0, start) + pasted + input.value.slice(end);
    if (!isValidFarmIdInput(prospective)) {
      e.preventDefault();
    }
  };

  const handleBirdCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (isValidIntegerInput(val, MAX_BIRD_COUNT)) {
      handleFieldChange('initialBirdCount', val);
    }
  };

  const handleBirdCountPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text');
    const input = e.currentTarget;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const prospective = input.value.slice(0, start) + pasted + input.value.slice(end);
    if (!isValidIntegerInput(prospective, MAX_BIRD_COUNT)) {
      e.preventDefault();
    }
  };

  const handleFeedKgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (isValidDecimalInput(val, 7, 2, MAX_FEED_QUANTITY_KG)) {
      handleFieldChange('initialFeedKg', val);
    }
  };

  const handleFeedKgPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text');
    const input = e.currentTarget;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const prospective = input.value.slice(0, start) + pasted + input.value.slice(end);
    if (!isValidDecimalInput(prospective, 7, 2, MAX_FEED_QUANTITY_KG)) {
      e.preventDefault();
    }
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    const nameRes = validateName(form.name, 'Full Name');
    if (!nameRes.valid) errs.name = nameRes.error!;

    const emailRes = validateEmail(form.email);
    if (!emailRes.valid) errs.email = emailRes.error!;

    const phoneRes = validatePhone(form.phone_no);
    if (!phoneRes.valid) errs.phone_no = phoneRes.error!;

    const passRes = validatePassword(form.password);
    if (!passRes.valid) errs.password = passRes.error!;

    const confRes = validateConfirmPassword(form.password, form.confirmPassword);
    if (!confRes.valid) errs.confirmPassword = confRes.error!;

    const farmNameRes = validateFarmName(form.farmName);
    if (!farmNameRes.valid) errs.farmName = farmNameRes.error!;

    const farmIdRes = validateFarmId(form.farmId);
    if (!farmIdRes.valid) errs.farmId = farmIdRes.error!;

    const birdRes = validateBirdCount(form.initialBirdCount, false, 0, MAX_BIRD_COUNT);
    if (!birdRes.valid) errs.initialBirdCount = birdRes.error!;

    const feedRes = validateFeedKg(form.initialFeedKg, false, 0, MAX_FEED_QUANTITY_KG);
    if (!feedRes.valid) errs.initialFeedKg = feedRes.error!;

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!validate()) return;

    setSubmitting(true);
    setGeneralError(null);
    setSuccessMessage(null);

    try {
      const birdValidation = validateBirdCount(form.initialBirdCount, false, 0, MAX_BIRD_COUNT);
      const feedValidation = validateFeedKg(form.initialFeedKg, false, 0, MAX_FEED_QUANTITY_KG);

      const payload: CreateFarmerPayload = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone_no: form.phone_no.trim(),
        password: form.password,
        farmName: form.farmName.trim(),
        farmId: form.farmId.trim().toUpperCase(),
        initialBirdCount: birdValidation.value ?? 0,
        initialFeedKg: feedValidation.value ?? 0,
      };

      const result = await createFarmer(payload);
      const flockNotice = result.flockId ? ' with opening flock initialized' : '';
      const farmNotice = result.farmId ? ` [Farm ID: ${result.farmId}]` : '';
      setSuccessMessage(`Farmer "${result.email}" created successfully${farmNotice}${flockNotice}.`);
      setSubmitting(false);

      setTimeout(() => {
        navigate('/admin/users');
      }, 1200);
    } catch (err: any) {
      console.error('[AdminCreateFarmer] Error:', err);
      setSubmitting(false);
      if (err.fields && Object.keys(err.fields).length > 0) {
        setErrors(err.fields);
      } else {
        setGeneralError(err.message || 'Failed to create farmer account');
      }
    }
  };

  return (
    <DashboardLayout role="admin" userName={userProfile?.name}>
      <div className="mgmt-page" style={{ maxWidth: 700, margin: '0 auto', padding: '24px 16px' }}>
        <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2>Create Farmer Account</h2>
            <p style={{ color: '#6b7280', marginTop: 4 }}>Add a new farmer and assign farm details</p>
          </div>
          <button className="btn btn--outline" onClick={() => navigate('/admin/users')} disabled={submitting}>
            ← Back to Users
          </button>
        </div>

        <div className="section-card" style={{ position: 'relative', padding: 24, borderRadius: 8, backgroundColor: '#ffffff', border: '1px solid #e5e7eb', minHeight: 300 }}>
          {submitting && (
            <FormLoadingOverlay
              title="Creating farmer account..."
              subtitle="Please wait while we securely save the account details."
              role="farmer"
            />
          )}

          {generalError && <div className="alert alert--error" style={{ marginBottom: 16 }}>{generalError}</div>}
          {successMessage && <div className="alert alert--success" style={{ marginBottom: 16 }}>{successMessage}</div>}

          <form onSubmit={handleSubmit} noValidate>
            <div className="field" style={{ marginBottom: 16 }}>
              <label htmlFor="farmer-name" style={{ display: 'block', fontWeight: 500, marginBottom: 6 }}>Full Name *</label>
              <input
                id="farmer-name"
                type="text"
                maxLength={100}
                placeholder="Enter farmer full name"
                className={`form-input ${errors.name ? 'input--error' : ''}`}
                value={form.name}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                disabled={submitting}
              />
              {errors.name && <div className="field-error">{errors.name}</div>}
            </div>

            <div className="field" style={{ marginBottom: 16 }}>
              <label htmlFor="farmer-email" style={{ display: 'block', fontWeight: 500, marginBottom: 6 }}>Email Address *</label>
              <input
                id="farmer-email"
                type="email"
                maxLength={254}
                placeholder="farmer@example.com"
                className={`form-input ${errors.email ? 'input--error' : ''}`}
                value={form.email}
                onChange={(e) => handleFieldChange('email', e.target.value)}
                disabled={submitting}
              />
              {errors.email && <div className="field-error">{errors.email}</div>}
            </div>

            <div className="field" style={{ marginBottom: 16 }}>
              <label htmlFor="farmer-phone" style={{ display: 'block', fontWeight: 500, marginBottom: 6 }}>Phone Number *</label>
              <input
                id="farmer-phone"
                type="tel"
                maxLength={20}
                placeholder="+91 9876543210"
                className={`form-input ${errors.phone_no ? 'input--error' : ''}`}
                value={form.phone_no}
                onChange={handlePhoneChange}
                onPaste={handlePhonePaste}
                disabled={submitting}
              />
              {errors.phone_no && <div className="field-error">{errors.phone_no}</div>}
            </div>

            <div className="field" style={{ marginBottom: 16 }}>
              <label htmlFor="farmer-password" style={{ display: 'block', fontWeight: 500, marginBottom: 6 }}>Password *</label>
              <input
                id="farmer-password"
                type="password"
                maxLength={128}
                placeholder="Minimum 8 characters"
                className={`form-input ${errors.password ? 'input--error' : ''}`}
                value={form.password}
                onChange={(e) => {
                  handleFieldChange('password', e.target.value);
                  if (form.confirmPassword && e.target.value === form.confirmPassword) {
                    clearFieldError('confirmPassword');
                  }
                }}
                disabled={submitting}
              />
              {errors.password && <div className="field-error">{errors.password}</div>}
            </div>

            <div className="field" style={{ marginBottom: 16 }}>
              <label htmlFor="farmer-confirm-password" style={{ display: 'block', fontWeight: 500, marginBottom: 6 }}>Confirm Password *</label>
              <input
                id="farmer-confirm-password"
                type="password"
                maxLength={128}
                placeholder="Re-enter password"
                className={`form-input ${errors.confirmPassword ? 'input--error' : ''}`}
                value={form.confirmPassword}
                onChange={(e) => handleFieldChange('confirmPassword', e.target.value)}
                disabled={submitting}
              />
              {errors.confirmPassword && <div className="field-error">{errors.confirmPassword}</div>}
            </div>

            <div className="field" style={{ marginBottom: 16 }}>
              <label htmlFor="farmer-farm-name" style={{ display: 'block', fontWeight: 500, marginBottom: 6 }}>Farm Name *</label>
              <input
                id="farmer-farm-name"
                type="text"
                maxLength={100}
                placeholder="Enter farm name"
                className={`form-input ${errors.farmName ? 'input--error' : ''}`}
                value={form.farmName}
                onChange={(e) => handleFieldChange('farmName', e.target.value)}
                disabled={submitting}
              />
              {errors.farmName && <div className="field-error">{errors.farmName}</div>}
            </div>

            <div className="field" style={{ marginBottom: 16 }}>
              <label htmlFor="farmer-initial-birds" style={{ display: 'block', fontWeight: 500, marginBottom: 6 }}>Initial Bird Count</label>
              <input
                id="farmer-initial-birds"
                type="text"
                inputMode="numeric"
                maxLength={8}
                placeholder="0"
                className={`form-input ${errors.initialBirdCount ? 'input--error' : ''}`}
                value={form.initialBirdCount}
                onChange={handleBirdCountChange}
                onPaste={handleBirdCountPaste}
                onKeyDown={handleIntegerKeyDown}
                disabled={submitting}
              />
              <span style={{ fontSize: '11.5px', color: 'var(--gray-500)', marginTop: 4, display: 'block' }}>
                Whole number of birds (0 to 10,000,000).
              </span>
              {errors.initialBirdCount && <div className="field-error">{errors.initialBirdCount}</div>}
            </div>

            <div className="field" style={{ marginBottom: 16 }}>
              <label htmlFor="farmer-initial-feed" style={{ display: 'block', fontWeight: 500, marginBottom: 6 }}>Initial Feed Stock (Kg)</label>
              <input
                id="farmer-initial-feed"
                type="text"
                inputMode="decimal"
                maxLength={10}
                placeholder="0"
                className={`form-input ${errors.initialFeedKg ? 'input--error' : ''}`}
                value={form.initialFeedKg}
                onChange={handleFeedKgChange}
                onPaste={handleFeedKgPaste}
                onKeyDown={handleDecimalKeyDown}
                disabled={submitting}
              />
              <span style={{ fontSize: '11.5px', color: 'var(--gray-500)', marginTop: 4, display: 'block' }}>
                Up to 7 digits before decimal and 2 decimal places (max 9,999,999.99 Kg).
              </span>
              {errors.initialFeedKg && <div className="field-error">{errors.initialFeedKg}</div>}
            </div>

            <div className="field" style={{ marginBottom: 24 }}>
              <label htmlFor="farmer-farm-id" style={{ display: 'block', fontWeight: 500, marginBottom: 6 }}>Farm ID *</label>
              <input
                id="farmer-farm-id"
                type="text"
                maxLength={50}
                placeholder="Enter Farm ID (e.g. AP17)"
                className={`form-input ${errors.farmId ? 'input--error' : ''}`}
                value={form.farmId}
                onChange={handleFarmIdChange}
                onPaste={handleFarmIdPaste}
                disabled={submitting}
              />
              {errors.farmId && <div className="field-error">{errors.farmId}</div>}
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button type="submit" className="btn btn--primary" disabled={submitting}>
                {submitting ? 'Creating Farmer...' : 'Create Farmer Account'}
              </button>
              <button type="button" className="btn btn--outline" onClick={() => navigate('/admin/users')} disabled={submitting}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}
