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
  farmIds: string[];
}

const emptyForm: FarmerForm = {
  name: '',
  email: '',
  phone_no: '',
  password: '',
  farmIds: [],
};

export function AdminUsersPage() {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [filter, setFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [farms, setFarms] = useState<FarmDoc[]>([]);
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

  const loadFarms = useCallback(async () => {
    try {
      const frms = await getAllFarms();
      setFarms(frms.filter((f) => f.active));
    } catch (err) {
      console.error('[AdminUsers] Failed to load farms:', err);
    }
  }, []);

  useEffect(() => {
    if (showCreateForm) {
      loadFarms();
    }
  }, [showCreateForm, loadFarms]);

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

    if (!form.name.trim()) errors.name = 'Name is required';
    if (!form.email.trim()) errors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Invalid email format';
    if (!form.phone_no.trim()) errors.phone_no = 'Phone number is required';
    if (!form.password) errors.password = 'Password is required';
    else if (form.password.length < 6) errors.password = 'Password must be at least 6 characters';
    if (form.farmIds.length === 0) errors.farmIds = 'At least one farm must be assigned';

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
        farmIds: form.farmIds,
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

  const handleFarmToggle = (farmId: string) => {
    setForm((prev) => {
      const farmIds = prev.farmIds.includes(farmId)
        ? prev.farmIds.filter((id) => id !== farmId)
        : [...prev.farmIds, farmId];
      return { ...prev, farmIds };
    });
    if (formErrors.farmIds) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next.farmIds;
        return next;
      });
    }
  };

  const filtered = filter === 'all' ? users : users.filter((u) => u.role === filter);

  if (loading) return <DashboardLayout role="admin" userName={userProfile?.name}><LoadingState /></DashboardLayout>;

  return (
    <DashboardLayout role="admin" userName={userProfile?.name}>
      <div className="mgmt-page">
        <div className="mgmt-page-header">
          <h2>User Management</h2>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
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

        <div className="table-container">
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
            <label>Assigned Farm(s) *</label>
            <div className="farm-checkbox-group">
              {farms.map((farm) => (
                <label key={farm.farmId} className="farm-checkbox">
                  <input
                    type="checkbox"
                    checked={form.farmIds.includes(farm.farmId)}
                    onChange={() => handleFarmToggle(farm.farmId)}
                    disabled={formSubmitting}
                  />
                  <span className="farm-checkbox-label">
                    <span className="td-bold">{farm.farmId}</span>
                    {farm.name && <span style={{ color: '#6b7280', marginLeft: 6 }}>({farm.name})</span>}
                  </span>
                </label>
              ))}
              {farms.length === 0 && (
                <div style={{ color: '#9ca3af', fontSize: 13 }}>Loading farms...</div>
              )}
            </div>
            {formErrors.farmIds && <div className="field-error">{formErrors.farmIds}</div>}
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
