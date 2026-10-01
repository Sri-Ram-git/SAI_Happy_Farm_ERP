import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/dashboard/DashboardLayout';
import { createAdmin, type CreateAdminPayload } from '../../services/userDataService';
import { FormLoadingOverlay } from '../../components/common/FormLoadingOverlay';

export function AdminCreateAdminPage() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNo, setPhoneNo] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
      const payload: CreateAdminPayload = {
        name: name.trim(),
        email: email.trim(),
        phone_no: phoneNo.trim(),
        password,
      };

      const result = await createAdmin(payload);
      setSuccessMessage(`Admin "${result.email}" created successfully.`);
      setSubmitting(false);

      setTimeout(() => {
        navigate('/admin/users');
      }, 1200);
    } catch (err: any) {
      console.error('[AdminCreateAdmin] Error:', err);
      setSubmitting(false);
      if (err.fields && Object.keys(err.fields).length > 0) {
        setErrors(err.fields);
      } else {
        setGeneralError(err.message || 'Failed to create admin account');
      }
    }
  };

  return (
    <DashboardLayout role="admin" userName={userProfile?.name}>
      <div className="mgmt-page" style={{ maxWidth: 700, margin: '0 auto', padding: '24px 16px' }}>
        <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2>Create Admin Account</h2>
            <p style={{ color: '#6b7280', marginTop: 4 }}>Add a new administrator account with system-wide privileges</p>
          </div>
          <button className="btn btn--outline" onClick={() => navigate('/admin/users')} disabled={submitting}>
            ← Back to Users
          </button>
        </div>

        <div className="section-card" style={{ position: 'relative', padding: 24, borderRadius: 8, backgroundColor: '#ffffff', border: '1px solid #e5e7eb', minHeight: 300 }}>
          {submitting && (
            <FormLoadingOverlay
              title="Creating admin account..."
              subtitle="Please wait while we securely save the account details."
              role="admin"
            />
          )}

          {generalError && <div className="alert alert--error" style={{ marginBottom: 16 }}>{generalError}</div>}
          {successMessage && <div className="alert alert--success" style={{ marginBottom: 16 }}>{successMessage}</div>}

          <form onSubmit={handleSubmit}>
            <div className="field" style={{ marginBottom: 16 }}>
              <label htmlFor="admin-name" style={{ display: 'block', fontWeight: 500, marginBottom: 6 }}>Full Name *</label>
              <input
                id="admin-name"
                type="text"
                placeholder="Enter administrator full name"
                className="form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={submitting}
              />
              {errors.name && <div className="field-error" style={{ color: '#dc2626', fontSize: 13, marginTop: 4 }}>{errors.name}</div>}
            </div>

            <div className="field" style={{ marginBottom: 16 }}>
              <label htmlFor="admin-email" style={{ display: 'block', fontWeight: 500, marginBottom: 6 }}>Email Address *</label>
              <input
                id="admin-email"
                type="email"
                placeholder="admin@example.com"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
              />
              {errors.email && <div className="field-error" style={{ color: '#dc2626', fontSize: 13, marginTop: 4 }}>{errors.email}</div>}
            </div>

            <div className="field" style={{ marginBottom: 16 }}>
              <label htmlFor="admin-phone" style={{ display: 'block', fontWeight: 500, marginBottom: 6 }}>Phone Number *</label>
              <input
                id="admin-phone"
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
              <label htmlFor="admin-password" style={{ display: 'block', fontWeight: 500, marginBottom: 6 }}>Password *</label>
              <input
                id="admin-password"
                type="password"
                placeholder="Minimum 6 characters"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
              />
              {errors.password && <div className="field-error" style={{ color: '#dc2626', fontSize: 13, marginTop: 4 }}>{errors.password}</div>}
            </div>

            <div className="field" style={{ marginBottom: 24 }}>
              <label htmlFor="admin-confirm" style={{ display: 'block', fontWeight: 500, marginBottom: 6 }}>Confirm Password *</label>
              <input
                id="admin-confirm"
                type="password"
                placeholder="Re-enter password"
                className="form-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={submitting}
              />
              {errors.confirmPassword && <div className="field-error" style={{ color: '#dc2626', fontSize: 13, marginTop: 4 }}>{errors.confirmPassword}</div>}
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button type="submit" className="btn btn--primary" disabled={submitting}>
                {submitting ? 'Creating Admin...' : 'Create Admin Account'}
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
