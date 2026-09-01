import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useMockProfile } from '../../utils/useMockProfile';
import { DashboardLayout } from '../../components/dashboard/DashboardLayout';
import { LoadingState } from '../../components/dashboard/LoadingState';
import { EmptyState } from '../../components/dashboard/EmptyState';
import { getAllUsers, updateUserStatus, type UserDoc } from '../../services/userDataService';

export function AdminUsersPage() {
  const { userProfile } = useAuth();
  const mockProfile = useMockProfile('admin');
  const profile = userProfile || mockProfile;
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [filter, setFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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

  const filtered = filter === 'all' ? users : users.filter((u) => u.role === filter);

  if (loading) return <DashboardLayout role="admin" userName={profile?.name}><LoadingState /></DashboardLayout>;

  return (
    <DashboardLayout role="admin" userName={profile?.name}>
      <div className="mgmt-page">
        <div className="mgmt-page-header">
          <h2>User Management</h2>
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
                      disabled={actionLoading === u.uid || u.uid === profile?.uid}
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
    </DashboardLayout>
  );
}
