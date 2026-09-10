import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/dashboard/DashboardLayout';
import { LoadingState } from '../../components/dashboard/LoadingState';
import { EmptyState } from '../../components/dashboard/EmptyState';
import { DetailDrawer } from '../../components/dashboard/DetailDrawer';
import { getAllUsers, updateUserStatus, createFarmer, type UserDoc, type CreateFarmerPayload } from '../../services/userDataService';
import { getAllFarms, type FarmDoc } from '../../services/farmDataService';

interface FarmerForm {
  name: string;
  email: string;
  phone_no: string;
  password: string;
  confirmPassword: string;
  farmName: string;
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
  initialBirdCount: '0',
  initialFeedKg: '0',
};

export function AdminUsersPage() {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [filter, setFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [form, setForm] = useState<FarmerForm>(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [formGeneralError, setFormGeneralError] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const usrs = await getAllUsers();
      setUsers(usrs);
    } catch (err) {
      console.error('[AdminUsers] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleToggleStatus = async (uid: string, currentActive: boolean) => {
    setActionLoading(uid);
    try {
      await updateUserStatus(uid, !currentActive);
      setUsers((prev) => prev.map((u) => u.uid === uid ? { ...u, active: !currentActive } : u));
    } catch (err) {
      console.error('[AdminUsers] Toggle error:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!form.name.trim()) errors.name = 'Full name is required';
    if (!form.email.trim()) errors.email = 'Email address is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Invalid email format';
    
    if (!form.phone_no.trim()) errors.phone_no = 'Phone number is required';
    
    if (!form.password) errors.password = 'Password is required';
    else if (form.password.length < 6) errors.password = 'Password must be at least 6 characters';
    
    if (!form.confirmPassword) errors.confirmPassword = 'Please confirm password';
    else if (form.password !== form.confirmPassword) errors.confirmPassword = 'Passwords do not match';
    
    if (!form.farmName.trim()) errors.farmName = 'Farm name is required';
    
    if (form.initialBirdCount && Number(form.initialBirdCount) < 0) errors.initialBirdCount = 'Cannot be negative';
    if (form.initialFeedKg && Number(form.initialFeedKg) < 0) errors.initialFeedKg = 'Cannot be negative';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateFarmer = async () => {
    if (!validateForm()) return;

    setFormSubmitting(true);
    setFormGeneralError(null);
    setFormSuccess(null);

    try {
      const payload: CreateFarmerPayload = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone_no: form.phone_no.trim(),
        password: form.password,
        farmName: form.farmName.trim(),
        initialBirdCount: Number(form.initialBirdCount || 0),
        initialFeedKg: Number(form.initialFeedKg || 0),
      };

      const result = await createFarmer(payload);
      setFormSuccess(`Farmer "${result.email}" created successfully (UID: ${result.uid})`);
      setForm(emptyForm);
      setFormErrors({});

      await loadUsers();

      setTimeout(() => {
        setShowCreateForm(false);
        setFormSuccess(null);
      }, 2000);
    } catch (err: any) {
      console.error('[AdminUsers] Create farmer error:', err);
      if (err.fields && Object.keys(err.fields).length > 0) {
        setFormErrors(err.fields);
      } else {
        setFormGeneralError(err.message || 'Failed to create farmer');
      }
    } finally {
      setFormSubmitting(false);
    }
  };

  const filtered = filter === 'all' ? users : users.filter((u) => u.role === filter);

  if (loading) return <DashboardLayout role="admin" userName={userProfile?.name}><LoadingState /></DashboardLayout>;

  return (
    <DashboardLayout role="admin" userName={userProfile?.name}>
      <div className="mgmt-page">
        <div className="mgmt-page-header">
          <h2>User Management</h2>
          <div className="header-controls">
            <div className="filter-group">
              {['all', 'farmer', 'supervisor', 'admin'].map((r) => (
                <button
                  key={r}
                  className={`filter-btn ${filter === r ? 'filter-btn--active' : ''}`}
                  onClick={() => setFilter(r)}
                >
                  {r === 'all' ? 'All' : r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>
            <button
              className="btn btn--primary"
              onClick={() => setShowCreateForm(true)}
            >
              + Create Farmer
            </button>
          </div>
        </div>

        <div className="table-container table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Farms</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.uid}>
                  <td className="td-bold">{u.name}</td>
                  <td>{u.email}</td>
                  <td><span className={`role-badge role-badge--${u.role}`}>{u.role}</span></td>
                  <td>{u.farmIds.join(', ') || '--'}</td>
                  <td>
                    <span className={`status-badge ${u.active ? 'status-badge--ok' : 'status-badge--warn'}`}>
                      {u.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn btn--sm"
                      disabled={actionLoading === u.uid || u.uid === userProfile?.uid}
                      onClick={() => handleToggleStatus(u.uid, u.active)}
                    >
                      {actionLoading === u.uid ? '...' : u.active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && <EmptyState message="No users found." />}
      </div>

      <DetailDrawer open={showCreateForm} title="Create Farmer Account" onClose={() => { setShowCreateForm(false); setFormErrors({}); setFormGeneralError(null); setFormSuccess(null); }}>
        <div className="create-farmer-form">
          {formGeneralError && (
            <div className="alert alert--error" style={{ marginBottom: 16 }}>{formGeneralError}</div>
          )}
          {formSuccess && (
            <div className="alert alert--success" style={{ marginBottom: 16 }}>{formSuccess}</div>
          )}

          <div className="field">
            <label htmlFor="farmer-name">Full Name *</label>
            <input
              id="farmer-name"
              type="text"
              placeholder="Enter farmer name"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              disabled={formSubmitting}
            />
            {formErrors.name && <div className="field-error">{formErrors.name}</div>}
          </div>

          <div className="field">
            <label htmlFor="farmer-email">Email Address *</label>
            <input
              id="farmer-email"
              type="email"
              placeholder="farmer@example.com"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              disabled={formSubmitting}
            />
            {formErrors.email && <div className="field-error">{formErrors.email}</div>}
          </div>

          <div className="field">
            <label htmlFor="farmer-phone">Phone Number *</label>
            <input
              id="farmer-phone"
              type="tel"
              placeholder="Enter phone number"
              value={form.phone_no}
              onChange={(e) => setForm((p) => ({ ...p, phone_no: e.target.value }))}
              disabled={formSubmitting}
            />
            {formErrors.phone_no && <div className="field-error">{formErrors.phone_no}</div>}
          </div>

          <div className="field">
            <label htmlFor="farmer-password">Password *</label>
            <input
              id="farmer-password"
              type="password"
              placeholder="Minimum 6 characters"
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              disabled={formSubmitting}
            />
            {formErrors.password && <div className="field-error">{formErrors.password}</div>}
          </div>

          <div className="field">
            <label htmlFor="farmer-confirm-password">Confirm Password *</label>
            <input
              id="farmer-confirm-password"
              type="password"
              placeholder="Re-enter password"
              value={form.confirmPassword}
              onChange={(e) => setForm((p) => ({ ...p, confirmPassword: e.target.value }))}
              disabled={formSubmitting}
            />
            {formErrors.confirmPassword && <div className="field-error">{formErrors.confirmPassword}</div>}
          </div>

          <div className="field">
            <label htmlFor="farmer-farm-name">Farm Name *</label>
            <input
              id="farmer-farm-name"
              type="text"
              placeholder="Enter farm name"
              value={form.farmName}
              onChange={(e) => setForm((p) => ({ ...p, farmName: e.target.value }))}
              disabled={formSubmitting}
            />
            {formErrors.farmName && <div className="field-error">{formErrors.farmName}</div>}
          </div>

          <div className="field">
            <label htmlFor="farmer-initial-birds">Initial Bird Count</label>
            <input
              id="farmer-initial-birds"
              type="number"
              min="0"
              placeholder="Enter initial birds"
              value={form.initialBirdCount}
              onChange={(e) => setForm((p) => ({ ...p, initialBirdCount: e.target.value }))}
              disabled={formSubmitting}
            />
            {formErrors.initialBirdCount && <div className="field-error">{formErrors.initialBirdCount}</div>}
          </div>

          <div className="field">
            <label htmlFor="farmer-initial-feed">Initial Feed Stock (Kg)</label>
            <input
              id="farmer-initial-feed"
              type="number"
              min="0"
              step="any"
              placeholder="Enter initial feed in kg"
              value={form.initialFeedKg}
              onChange={(e) => setForm((p) => ({ ...p, initialFeedKg: e.target.value }))}
              disabled={formSubmitting}
            />
            {formErrors.initialFeedKg && <div className="field-error">{formErrors.initialFeedKg}</div>}
          </div>

          <div className="field">
            <label htmlFor="farmer-farm-id">Farm ID</label>
            <input
              id="farmer-farm-id"
              type="text"
              placeholder="Automatically assigned based on the latest Farm ID."
              disabled={true}
              style={{ backgroundColor: '#f9fafb', color: '#6b7280', cursor: 'not-allowed' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button
              className="btn btn--primary"
              onClick={handleCreateFarmer}
              disabled={formSubmitting}
            >
              {formSubmitting ? 'Creating...' : 'Create Farmer Account'}
            </button>
            <button
              className="btn btn--outline"
              onClick={() => { setShowCreateForm(false); setFormErrors({}); setFormGeneralError(null); setFormSuccess(null); }}
              disabled={formSubmitting}
            >
              Cancel
            </button>
          </div>
        </div>
      </DetailDrawer>
    </DashboardLayout>
  );
}
