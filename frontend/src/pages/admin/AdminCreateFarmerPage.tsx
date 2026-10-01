import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/dashboard/DashboardLayout';
import { createFarmer, type CreateFarmerPayload } from '../../services/userDataService';
import { FormLoadingOverlay } from '../../components/common/FormLoadingOverlay';

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

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!form.name.trim()) errs.name = 'Full name is required';
    if (!form.email.trim()) errs.email = 'Email address is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email format';

    if (!form.phone_no.trim()) errs.phone_no = 'Phone number is required';

    if (!form.password) errs.password = 'Password is required';
    else if (form.password.length < 6) errs.password = 'Password must be at least 6 characters';

    if (!form.confirmPassword) errs.confirmPassword = 'Please confirm password';
    else if (form.password !== form.confirmPassword) errs.confirmPassword = 'Passwords do not match';

    if (!form.farmName.trim()) errs.farmName = 'Farm name is required';

    if (!form.farmId.trim()) errs.farmId = 'Farm ID is required';

    if (form.initialBirdCount !== '') {
      const birds = Number(form.initialBirdCount);
      if (isNaN(birds) || birds < 0) {
        errs.initialBirdCount = 'Cannot be negative';
      } else if (!Number.isInteger(birds)) {
        errs.initialBirdCount = 'Initial bird count must be a whole number';
      }
    }

    if (form.initialFeedKg !== '') {
      const feed = Number(form.initialFeedKg);
      if (isNaN(feed) || feed < 0) {
        errs.initialFeedKg = 'Cannot be negative';
      }
    }

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
      const payload: CreateFarmerPayload = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone_no: form.phone_no.trim(),
        password: form.password,
        farmName: form.farmName.trim(),
        farmId: form.farmId.trim(),
        initialBirdCount: Number(form.initialBirdCount || 0),
        initialFeedKg: Number(form.initialFeedKg || 0),
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

          <form onSubmit={handleSubmit}>
            <div className="field" style={{ marginBottom: 16 }}>
              <label htmlFor="farmer-name" style={{ display: 'block', fontWeight: 500, marginBottom: 6 }}>Full Name *</label>
              <input
                id="farmer-name"
                type="text"
                placeholder="Enter farmer full name"
                className="form-input"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                disabled={submitting}
              />
              {errors.name && <div className="field-error" style={{ color: '#dc2626', fontSize: 13, marginTop: 4 }}>{errors.name}</div>}
            </div>

            <div className="field" style={{ marginBottom: 16 }}>
              <label htmlFor="farmer-email" style={{ display: 'block', fontWeight: 500, marginBottom: 6 }}>Email Address *</label>
              <input
                id="farmer-email"
                type="email"
                placeholder="farmer@example.com"
                className="form-input"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                disabled={submitting}
              />
              {errors.email && <div className="field-error" style={{ color: '#dc2626', fontSize: 13, marginTop: 4 }}>{errors.email}</div>}
            </div>

            <div className="field" style={{ marginBottom: 16 }}>
              <label htmlFor="farmer-phone" style={{ display: 'block', fontWeight: 500, marginBottom: 6 }}>Phone Number *</label>
              <input
                id="farmer-phone"
                type="tel"
                placeholder="Enter phone number"
                className="form-input"
                value={form.phone_no}
                onChange={(e) => setForm((p) => ({ ...p, phone_no: e.target.value }))}
                disabled={submitting}
              />
              {errors.phone_no && <div className="field-error" style={{ color: '#dc2626', fontSize: 13, marginTop: 4 }}>{errors.phone_no}</div>}
            </div>

            <div className="field" style={{ marginBottom: 16 }}>
              <label htmlFor="farmer-password" style={{ display: 'block', fontWeight: 500, marginBottom: 6 }}>Password *</label>
              <input
                id="farmer-password"
                type="password"
                placeholder="Minimum 6 characters"
                className="form-input"
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                disabled={submitting}
              />
              {errors.password && <div className="field-error" style={{ color: '#dc2626', fontSize: 13, marginTop: 4 }}>{errors.password}</div>}
            </div>

            <div className="field" style={{ marginBottom: 16 }}>
              <label htmlFor="farmer-confirm-password" style={{ display: 'block', fontWeight: 500, marginBottom: 6 }}>Confirm Password *</label>
              <input
                id="farmer-confirm-password"
                type="password"
                placeholder="Re-enter password"
                className="form-input"
                value={form.confirmPassword}
                onChange={(e) => setForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                disabled={submitting}
              />
              {errors.confirmPassword && <div className="field-error" style={{ color: '#dc2626', fontSize: 13, marginTop: 4 }}>{errors.confirmPassword}</div>}
            </div>

            <div className="field" style={{ marginBottom: 16 }}>
              <label htmlFor="farmer-farm-name" style={{ display: 'block', fontWeight: 500, marginBottom: 6 }}>Farm Name *</label>
              <input
                id="farmer-farm-name"
                type="text"
                placeholder="Enter farm name"
                className="form-input"
                value={form.farmName}
                onChange={(e) => setForm((p) => ({ ...p, farmName: e.target.value }))}
                disabled={submitting}
              />
              {errors.farmName && <div className="field-error" style={{ color: '#dc2626', fontSize: 13, marginTop: 4 }}>{errors.farmName}</div>}
            </div>

            <div className="field" style={{ marginBottom: 16 }}>
              <label htmlFor="farmer-initial-birds" style={{ display: 'block', fontWeight: 500, marginBottom: 6 }}>Initial Bird Count</label>
              <input
                id="farmer-initial-birds"
                type="number"
                min="0"
                placeholder="0"
                className="form-input"
                value={form.initialBirdCount}
                onChange={(e) => setForm((p) => ({ ...p, initialBirdCount: e.target.value }))}
                disabled={submitting}
              />
              {errors.initialBirdCount && <div className="field-error" style={{ color: '#dc2626', fontSize: 13, marginTop: 4 }}>{errors.initialBirdCount}</div>}
            </div>

            <div className="field" style={{ marginBottom: 16 }}>
              <label htmlFor="farmer-initial-feed" style={{ display: 'block', fontWeight: 500, marginBottom: 6 }}>Initial Feed Stock (Kg)</label>
              <input
                id="farmer-initial-feed"
                type="number"
                min="0"
                step="any"
                placeholder="0"
                className="form-input"
                value={form.initialFeedKg}
                onChange={(e) => setForm((p) => ({ ...p, initialFeedKg: e.target.value }))}
                disabled={submitting}
              />
              {errors.initialFeedKg && <div className="field-error" style={{ color: '#dc2626', fontSize: 13, marginTop: 4 }}>{errors.initialFeedKg}</div>}
            </div>

            <div className="field" style={{ marginBottom: 24 }}>
              <label htmlFor="farmer-farm-id" style={{ display: 'block', fontWeight: 500, marginBottom: 6 }}>Farm ID *</label>
              <input
                id="farmer-farm-id"
                type="text"
                placeholder="Enter Farm ID (e.g. AP17)"
                className="form-input"
                value={form.farmId}
                onChange={(e) => setForm((p) => ({ ...p, farmId: e.target.value }))}
                disabled={submitting}
              />
              {errors.farmId && <div className="field-error" style={{ color: '#dc2626', fontSize: 13, marginTop: 4 }}>{errors.farmId}</div>}
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
