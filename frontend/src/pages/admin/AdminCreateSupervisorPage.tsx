import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/dashboard/DashboardLayout';
import { LoadingState } from '../../components/dashboard/LoadingState';
import { createSupervisor, type CreateSupervisorPayload } from '../../services/userDataService';
import { getAllFarms, type FarmDoc } from '../../services/farmDataService';
import { FarmMultiSelect } from '../../components/common/FarmMultiSelect';
import { FormLoadingOverlay } from '../../components/common/FormLoadingOverlay';

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

  const toggleFarm = (farmId: string) => {
    setSelectedFarmIds((prev) =>
      prev.includes(farmId) ? prev.filter((id) => id !== farmId) : [...prev, farmId]
    );
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!name.trim()) errs.name = 'Full name is required';
    if (!email.trim()) errs.email = 'Email address is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Invalid email format';

    if (!phoneNo.trim()) errs.phone_no = 'Phone number is required';

    if (!password) errs.password = 'Password is required';
    else if (password.length < 8) errs.password = 'Password must be at least 8 characters';

    if (!confirmPassword) errs.confirmPassword = 'Please confirm password';
    else if (password !== confirmPassword) errs.confirmPassword = 'Passwords do not match';

    if (selectedFarmIds.length === 0) errs.farmIds = 'At least one farm must be assigned';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !validate()) return;

    setSubmitting(true);
    setGeneralError(null);
    setSuccessMessage(null);

    try {
      const payload: CreateSupervisorPayload = {
        name: name.trim(),
        email: email.trim(),
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

          <form onSubmit={handleSubmit}>
            <div className="field" style={{ marginBottom: 16 }}>
              <label htmlFor="sup-name" style={{ display: 'block', fontWeight: 500, marginBottom: 6 }}>Full Name *</label>
              <input
                id="sup-name"
                type="text"
                placeholder="Enter supervisor full name"
                className="form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={submitting}
              />
              {errors.name && <div className="field-error" style={{ color: '#dc2626', fontSize: 13, marginTop: 4 }}>{errors.name}</div>}
            </div>

            <div className="field" style={{ marginBottom: 16 }}>
              <label htmlFor="sup-email" style={{ display: 'block', fontWeight: 500, marginBottom: 6 }}>Email Address *</label>
              <input
                id="sup-email"
                type="email"
                placeholder="supervisor@example.com"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
              />
              {errors.email && <div className="field-error" style={{ color: '#dc2626', fontSize: 13, marginTop: 4 }}>{errors.email}</div>}
            </div>

            <div className="field" style={{ marginBottom: 16 }}>
              <label htmlFor="sup-phone" style={{ display: 'block', fontWeight: 500, marginBottom: 6 }}>Phone Number *</label>
              <input
                id="sup-phone"
                type="tel"
                placeholder="Enter phone number"
                className="form-input"
                value={phoneNo}
                onChange={(e) => setPhoneNo(e.target.value)}
                disabled={submitting}
              />
              {errors.phone_no && <div className="field-error" style={{ color: '#dc2626', fontSize: 13, marginTop: 4 }}>{errors.phone_no}</div>}
            </div>

            <div className="field" style={{ marginBottom: 16 }}>
              <label htmlFor="sup-password" style={{ display: 'block', fontWeight: 500, marginBottom: 6 }}>Password *</label>
              <input
                id="sup-password"
                type="password"
                placeholder="Minimum 6 characters"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
              />
              {errors.password && <div className="field-error" style={{ color: '#dc2626', fontSize: 13, marginTop: 4 }}>{errors.password}</div>}
            </div>

            <div className="field" style={{ marginBottom: 20 }}>
              <label htmlFor="sup-confirm" style={{ display: 'block', fontWeight: 500, marginBottom: 6 }}>Confirm Password *</label>
              <input
                id="sup-confirm"
                type="password"
                placeholder="Re-enter password"
                className="form-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={submitting}
              />
              {errors.confirmPassword && <div className="field-error" style={{ color: '#dc2626', fontSize: 13, marginTop: 4 }}>{errors.confirmPassword}</div>}
            </div>

            <div className="field" style={{ marginBottom: 24 }}>
              <FarmMultiSelect
                farms={farms}
                selectedFarmIds={selectedFarmIds}
                onChange={setSelectedFarmIds}
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
