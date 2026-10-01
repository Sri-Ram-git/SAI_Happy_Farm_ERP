import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/dashboard/DashboardLayout';
import { LoadingState } from '../../components/dashboard/LoadingState';
import { getUserByUid, updateSupervisorAllocation, type UserDoc } from '../../services/userDataService';
import { getAllFarms, type FarmDoc } from '../../services/farmDataService';
import { FarmMultiSelect } from '../../components/common/FarmMultiSelect';
import { FormLoadingOverlay } from '../../components/common/FormLoadingOverlay';

export function AdminEditSupervisorPage() {
  const { userProfile } = useAuth();
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [supervisor, setSupervisor] = useState<UserDoc | null>(null);
  const [farms, setFarms] = useState<FarmDoc[]>([]);
  const [selectedFarmIds, setSelectedFarmIds] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!userId) {
        setGeneralError('Invalid supervisor ID');
        setLoading(false);
        return;
      }

      try {
        const [targetUser, farmList] = await Promise.all([
          getUserByUid(userId),
          getAllFarms(),
        ]);

        if (!targetUser) {
          setGeneralError('Supervisor user not found.');
        } else if (targetUser.role !== 'supervisor') {
          setGeneralError('Selected user is not a supervisor account.');
        } else {
          setSupervisor(targetUser);
          setSelectedFarmIds(targetUser.farmIds || []);
        }

        setFarms(farmList);
      } catch (err) {
        console.error('[AdminEditSupervisor] Load error:', err);
        setGeneralError('Failed to load supervisor details');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [userId]);

  const toggleFarm = (farmId: string) => {
    setSelectedFarmIds((prev) =>
      prev.includes(farmId) ? prev.filter((id) => id !== farmId) : [...prev, farmId]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || !userId || !supervisor) return;

    setSaving(true);
    setGeneralError(null);
    setSuccessMessage(null);

    try {
      await updateSupervisorAllocation(userId, selectedFarmIds);
      setSuccessMessage('Supervisor farm allocation updated successfully.');
      setSaving(false);

      setTimeout(() => {
        navigate('/admin/users');
      }, 1200);
    } catch (err: any) {
      console.error('[AdminEditSupervisor] Save error:', err);
      setSaving(false);
      setGeneralError(err.message || 'Failed to update supervisor farm allocation');
    }
  };

  if (loading) {
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
            <h2>Edit Supervisor Allocation</h2>
            <p style={{ color: '#6b7280', marginTop: 4 }}>Modify farm responsibilities for supervisor</p>
          </div>
          <button className="btn btn--outline" onClick={() => navigate('/admin/users')} disabled={saving}>
            ← Back to Users
          </button>
        </div>

        {generalError && (
          <div className="alert alert--error" style={{ marginBottom: 16 }}>
            {generalError}
          </div>
        )}

        {successMessage && (
          <div className="alert alert--success" style={{ marginBottom: 16 }}>
            {successMessage}
          </div>
        )}

        {supervisor && (
          <div className="section-card" style={{ position: 'relative', padding: 24, borderRadius: 8, backgroundColor: '#ffffff', border: '1px solid #e5e7eb', minHeight: 300 }}>
            {saving && (
              <FormLoadingOverlay
                title="Updating farm allocation..."
                subtitle="Please wait while supervisor farm assignments are saved."
                role="supervisor"
              />
            )}
            <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 13, color: '#6b7280', fontWeight: 500 }}>Supervisor Name</div>
                  <div style={{ fontSize: 16, fontWeight: 600, marginTop: 2 }}>{supervisor.name || 'N/A'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 13, color: '#6b7280', fontWeight: 500 }}>Email Address</div>
                  <div style={{ fontSize: 16, fontWeight: 500, marginTop: 2 }}>{supervisor.email}</div>
                </div>
                <div>
                  <div style={{ fontSize: 13, color: '#6b7280', fontWeight: 500 }}>Role</div>
                  <div style={{ marginTop: 2 }}>
                    <span className="role-badge role-badge--supervisor">{supervisor.role}</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 13, color: '#6b7280', fontWeight: 500 }}>Status</div>
                  <div style={{ marginTop: 2 }}>
                    <span className={`status-badge ${supervisor.active ? 'status-badge--ok' : 'status-badge--warn'}`}>
                      {supervisor.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <form onSubmit={handleSave}>
              <div className="field" style={{ marginBottom: 24 }}>
                <FarmMultiSelect
                  label="Assigned Farms (Check / Uncheck to modify allocation)"
                  farms={farms}
                  selectedFarmIds={selectedFarmIds}
                  onChange={setSelectedFarmIds}
                  disabled={saving}
                />
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                <button type="submit" className="btn btn--primary" disabled={saving}>
                  {saving ? 'Saving Changes...' : 'Save Allocation Changes'}
                </button>
                <button type="button" className="btn btn--outline" onClick={() => navigate('/admin/users')} disabled={saving}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
