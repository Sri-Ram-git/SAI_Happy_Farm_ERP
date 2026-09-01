import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useMockProfile } from '../../utils/useMockProfile';
import { DashboardLayout } from '../../components/dashboard/DashboardLayout';
import { LoadingState } from '../../components/dashboard/LoadingState';
import { getAllUsers, updateUserStatus, type UserDoc } from '../../services/userDataService';
import {
  Users,
  Search,
  UserCheck,
  UserX,
  Shield,
  ShieldCheck,
  Briefcase,
} from 'lucide-react';

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

  const roleBadgeClass = (role: string) => {
    if (role === 'admin') return 'mgmt-badge--primary';
    if (role === 'supervisor') return 'mgmt-badge--info';
    return 'mgmt-badge--neutral';
  };

  const roleIcon = (role: string) => {
    if (role === 'admin') return ShieldCheck;
    if (role === 'supervisor') return Briefcase;
    return Users;
  };

  return (
    <DashboardLayout role="admin" userName={profile?.name}>
      <div className="mgmt-page">
        <div className="mgmt-page-header">
          <div className="mgmt-page-header__title-group">
            <h2 className="mgmt-page-header__title">User Management</h2>
            <p className="mgmt-page-header__description">{users.length} total users across all roles</p>
          </div>
        </div>

        <div className="mgmt-filters">
          {['all', 'farmer', 'supervisor', 'admin'].map((r) => {
            const Icon = roleIcon(r);
            return (
              <button
                key={r}
                className={`mgmt-btn mgmt-btn--sm ${filter === r ? 'mgmt-btn--primary' : 'mgmt-btn--secondary'}`}
                onClick={() => setFilter(r)}
              >
                <Icon size={14} />
                {r === 'all' ? 'All' : r.charAt(0).toUpperCase() + r.slice(1)}
                <span className="mgmt-badge mgmt-badge--neutral" style={{ marginLeft: 4 }}>
                  {r === 'all' ? users.length : users.filter((u) => u.role === r).length}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mgmt-table-container">
          <table className="mgmt-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Farms</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.uid}>
                  <td style={{ fontWeight: 600 }}>{u.name}</td>
                  <td>{u.email}</td>
                  <td>
                    <span className={`mgmt-badge ${roleBadgeClass(u.role)}`}>
                      <span className="mgmt-badge__dot" />
                      {u.role}
                    </span>
                  </td>
                  <td>{u.farmIds.join(', ') || '--'}</td>
                  <td>
                    <span className={`mgmt-badge ${u.active ? 'mgmt-badge--success' : 'mgmt-badge--warning'}`}>
                      <span className="mgmt-badge__dot" />
                      {u.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="mgmt-table__cell--actions">
                    <button
                      className={`mgmt-btn mgmt-btn--sm ${u.active ? 'mgmt-btn--danger' : 'mgmt-btn--primary'}`}
                      disabled={actionLoading === u.uid || u.uid === profile?.uid}
                      onClick={() => handleToggleStatus(u.uid, u.active)}
                    >
                      {actionLoading === u.uid ? '...' : u.active ? <><UserX size={14} /> Deactivate</> : <><UserCheck size={14} /> Activate</>}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="mgmt-empty-state">
            <div className="mgmt-empty-state__icon"><Users size={24} /></div>
            <div className="mgmt-empty-state__title">No Users Found</div>
            <div className="mgmt-empty-state__description">No users match the current filter.</div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
