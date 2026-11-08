import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/dashboard/DashboardLayout';
import { LoadingState } from '../../components/dashboard/LoadingState';
import { createSupervisor, type CreateSupervisorPayload } from '../../services/userDataService';
import { getAllFarms, type FarmDoc } from '../../services/farmDataService';
import { FarmMultiSelect } from '../../components/common/FarmMultiSelect';
import { FormLoadingOverlay } from '../../components/common/FormLoadingOverlay';
import {
  validateName,
  validateEmail,
  validatePhone,
  validatePassword,
  validateConfirmPassword,
  isValidPhoneInput,
} from '../../utils/validationRules';

export function AdminCreateSupervisorPage() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();

  const [farms, setFarms] = useState<FarmDoc[]>([]);
  const [loadingFarms, setLoadingFarms] = useState(true);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNo, setPhoneNo] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedFarmIds, setSelectedFarmIds] = useState<string[]>([]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const farmList = await getAllFarms();
        setFarms(farmList);
      } catch (err) {
        console.error('[AdminCreateSupervisor] Load farms error:', err);
      } finally {
        setLoadingFarms(false);
      }
    }
    load();
  }, []);

  const clearFieldError = (field: string) => {
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    clearFieldError('name');
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    clearFieldError('email');
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (isValidPhoneInput(val)) {
      setPhoneNo(val);
      clearFieldError('phone_no');
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

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    clearFieldError('password');
    if (confirmPassword && e.target.value === confirmPassword) {
      clearFieldError('confirmPassword');
    }
  };

  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmPassword(e.target.value);
    clearFieldError('confirmPassword');
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    const nameRes = validateName(name, 'Full Name');
    if (!nameRes.valid) errs.name = nameRes.error!;

    const emailRes = validateEmail(email);
    if (!emailRes.valid) errs.email = emailRes.error!;

    const phoneRes = validatePhone(phoneNo);
    if (!phoneRes.valid) errs.phone_no = phoneRes.error!;

    const passRes = validatePassword(password);
    if (!passRes.valid) errs.password = passRes.error!;

    const confRes = validateConfirmPassword(password, confirmPassword);
    if (!confRes.valid) errs.confirmPassword = confRes.error!;

    if (selectedFarmIds.length === 0) {
      errs.farmIds = 'At least one farm must be assigned to supervisor.';
    }

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
      const payload: CreateSupervisorPayload = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone_no: phoneNo.trim(),
        password,
        farmIds: selectedFarmIds,
      };

      const result = await createSupervisor(payload);
      setSuccessMessage(`Supervisor "${result.email}" created successfully.`);
      setSubmitting(false);

      setTimeout(() => {
        navigate('/admin/users');
      }, 1200);
    } catch (err: any) {
      console.error('[AdminCreateSupervisor] Error:', err);
      setSubmitting(false);
      if (err.fields && Object.keys(err.fields).length > 0) {
        setErrors(err.fields);
      } else {
        setGeneralError(err.message || 'Failed to create supervisor account');
      }
    }
  };

  if (loadingFarms) {
    return (
      <DashboardLayout role="admin" userName={userProfile?.name}>
        <LoadingState />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin" userName={userProfile?.name}>
      <div className="mgmt-page" style={{ maxWidth: 700, margin: '0 auto', padding: '24px 16px' }}>
        <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2>Create Supervisor Account</h2>
            <p style={{ color: '#6b7280', marginTop: 4 }}>Add a new supervisor and assign multiple farm responsibilities</p>
          </div>
          <button className="btn btn--outline" onClick={() => navigate('/admin/users')} disabled={submitting}>
            ← Back to Users
          </button>
        </div>

        <div className="section-card" style={{ position: 'relative', padding: 24, borderRadius: 8, backgroundColor: '#ffffff', border: '1px solid #e5e7eb', minHeight: 300 }}>
          {submitting && (
            <FormLoadingOverlay
              title="Creating supervisor account..."
              subtitle="Please wait while we securely save the account details."
              role="supervisor"
            />
          )}

          {generalError && <div className="alert alert--error" style={{ marginBottom: 16 }}>{generalError}</div>}
          {successMessage && <div className="alert alert--success" style={{ marginBottom: 16 }}>{successMessage}</div>}

          <form onSubmit={handleSubmit} noValidate>
            <div className="field" style={{ marginBottom: 16 }}>
              <label htmlFor="sup-name" style={{ display: 'block', fontWeight: 500, marginBottom: 6 }}>Full Name *</label>
              <input
                id="sup-name"
                type="text"
                maxLength={100}
                placeholder="Enter supervisor full name"
                className={`form-input ${errors.name ? 'input--error' : ''}`}
                value={name}
                onChange={handleNameChange}
                disabled={submitting}
              />
              {errors.name && <div className="field-error">{errors.name}</div>}
            </div>

            <div className="field" style={{ marginBottom: 16 }}>
              <label htmlFor="sup-email" style={{ display: 'block', fontWeight: 500, marginBottom: 6 }}>Email Address *</label>
              <input
                id="sup-email"
                type="email"
                maxLength={254}
                placeholder="supervisor@example.com"
                className={`form-input ${errors.email ? 'input--error' : ''}`}
                value={email}
                onChange={handleEmailChange}
                disabled={submitting}
              />
              {errors.email && <div className="field-error">{errors.email}</div>}
            </div>

            <div className="field" style={{ marginBottom: 16 }}>
              <label htmlFor="sup-phone" style={{ display: 'block', fontWeight: 500, marginBottom: 6 }}>Phone Number *</label>
              <input
                id="sup-phone"
                type="tel"
                maxLength={20}
                placeholder="+91 9876543210"
                className={`form-input ${errors.phone_no ? 'input--error' : ''}`}
                value={phoneNo}
                onChange={handlePhoneChange}
                onPaste={handlePhonePaste}
                disabled={submitting}
              />
              {errors.phone_no && <div className="field-error">{errors.phone_no}</div>}
            </div>

            <div className="field" style={{ marginBottom: 16 }}>
              <label htmlFor="sup-password" style={{ display: 'block', fontWeight: 500, marginBottom: 6 }}>Password *</label>
              <input
                id="sup-password"
                type="password"
                maxLength={128}
                placeholder="Minimum 8 characters"
                className={`form-input ${errors.password ? 'input--error' : ''}`}
                value={password}
                onChange={handlePasswordChange}
                disabled={submitting}
              />
              {errors.password && <div className="field-error">{errors.password}</div>}
            </div>

            <div className="field" style={{ marginBottom: 24 }}>
              <label htmlFor="sup-confirm" style={{ display: 'block', fontWeight: 500, marginBottom: 6 }}>Confirm Password *</label>
              <input
                id="sup-confirm"
                type="password"
                maxLength={128}
                placeholder="Re-enter password"
                className={`form-input ${errors.confirmPassword ? 'input--error' : ''}`}
                value={confirmPassword}
                onChange={handleConfirmPasswordChange}
                disabled={submitting}
              />
              {errors.confirmPassword && <div className="field-error">{errors.confirmPassword}</div>}
            </div>

            <div className="field" style={{ marginBottom: 24 }}>
              <FarmMultiSelect
                label="Assign Managed Farms"
                required
                farms={farms}
                selectedFarmIds={selectedFarmIds}
                onChange={(ids) => {
                  setSelectedFarmIds(ids);
                  if (ids.length > 0) clearFieldError('farmIds');
                }}
                disabled={submitting}
                error={errors.farmIds}
              />
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button type="submit" className="btn btn--primary" disabled={submitting}>
                {submitting ? 'Creating Supervisor...' : 'Create Supervisor Account'}
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
