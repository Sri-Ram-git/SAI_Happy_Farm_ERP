import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/dashboard/DashboardLayout';
import { LoadingState } from '../../components/dashboard/LoadingState';
import { EmptyState } from '../../components/dashboard/EmptyState';
import {
  getAllUsers,
  updateUserStatus,
  deleteUserAccount,
  updateSupervisorAllocation,
  type UserDoc,
} from '../../services/userDataService';
import { getAllFarms, type FarmDoc } from '../../services/farmDataService';
import {
  Pencil,
  Trash2,
  UserX,
  CheckCircle,
  AlertTriangle,
  X,
  ShieldAlert,
  Layers,
  Search,
  Check,
} from 'lucide-react';

export function AdminUsersPage() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [filter, setFilter] = useState('all');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Portal Dropdown menu state with trigger bounding box
  const [activeMenu, setActiveMenu] = useState<{ user: UserDoc; rect: DOMRect } | null>(null);

  // Reassign Farms state
  const [reassignModalUser, setReassignModalUser] = useState<UserDoc | null>(null);
  const [reassignFarmIds, setReassignFarmIds] = useState<string[]>([]);
  const [reassignSearch, setReassignSearch] = useState('');
  const [reassignLoading, setReassignLoading] = useState(false);
  const [reassignError, setReassignError] = useState<string | null>(null);
  const [allFarms, setAllFarms] = useState<FarmDoc[]>([]);
  const [farmsLoading, setFarmsLoading] = useState(false);

  // Two-step Delete state
  const [deleteModalUser, setDeleteModalUser] = useState<UserDoc | null>(null);
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Two-step Deactivate state
  const [deactivateModalUser, setDeactivateModalUser] = useState<UserDoc | null>(null);
  const [deactivateStep, setDeactivateStep] = useState<1 | 2>(1);
  const [deactivateInput, setDeactivateInput] = useState('');
  const [deactivateLoading, setDeactivateLoading] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const usrs = await getAllUsers();
      setUsers(usrs);
    } catch (err: any) {
      console.error('[AdminUsers] Load error:', err);
      setFeedback({ type: 'error', message: 'Failed to load users from database.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Close open dropdown on click outside, window resize, or any container scrolling
  useEffect(() => {
    if (!activeMenu) return;

    const handleClose = () => setActiveMenu(null);

    // capture: true catches scroll events on table-container as well as window
    window.addEventListener('scroll', handleClose, true);
    window.addEventListener('resize', handleClose);
    window.addEventListener('click', handleClose);

    return () => {
      window.removeEventListener('scroll', handleClose, true);
      window.removeEventListener('resize', handleClose);
      window.removeEventListener('click', handleClose);
    };
  }, [activeMenu]);

  // Keyboard accessibility: Escape key closes menu and modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveMenu(null);
        if (!deleteLoading) closeDeleteModal();
        if (!deactivateLoading) closeDeactivateModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteLoading, deactivateLoading]);

  // Modal safety resets
  const closeDeleteModal = () => {
    if (deleteLoading) return;
    setDeleteModalUser(null);
    setDeleteStep(1);
    setDeleteInput('');
    setDeleteError(null);
    setDeleteLoading(false);
  };

  const closeDeactivateModal = () => {
    if (deactivateLoading) return;
    setDeactivateModalUser(null);
    setDeactivateStep(1);
    setDeactivateInput('');
    setDeactivateError(null);
    setDeactivateLoading(false);
  };

  const handleToggleMenu = (e: React.MouseEvent<HTMLButtonElement>, user: UserDoc) => {
    e.stopPropagation();
    if (activeMenu?.user.uid === user.uid) {
      setActiveMenu(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      setActiveMenu({ user, rect });
    }
  };

  const startDelete = (user: UserDoc) => {
    setActiveMenu(null);
    setDeleteModalUser(user);
    setDeleteStep(1);
    setDeleteInput('');
    setDeleteError(null);
    setDeleteLoading(false);
  };

  const startDeactivate = (user: UserDoc) => {
    setActiveMenu(null);
    setDeactivateModalUser(user);
    setDeactivateStep(1);
    setDeactivateInput('');
    setDeactivateError(null);
    setDeactivateLoading(false);
  };

  const startReassignFarms = async (user: UserDoc) => {
    setActiveMenu(null);
    setReassignModalUser(user);
    setReassignFarmIds(Array.isArray(user.farmIds) ? [...user.farmIds] : []);
    setReassignSearch('');
    setReassignError(null);
    setFarmsLoading(true);
    try {
      const frms = await getAllFarms();
      setAllFarms(frms);
    } catch (err: any) {
      console.error('[AdminUsers] Load farms error:', err);
      setReassignError('Failed to load farms from database.');
    } finally {
      setFarmsLoading(false);
    }
  };

  const closeReassignModal = () => {
    if (reassignLoading) return;
    setReassignModalUser(null);
    setReassignFarmIds([]);
    setReassignSearch('');
    setReassignError(null);
  };

  const toggleFarmSelection = (farmId: string) => {
    setReassignFarmIds((prev) =>
      prev.includes(farmId) ? prev.filter((id) => id !== farmId) : [...prev, farmId],
    );
  };

  const handleSaveFarmAssignment = async () => {
    if (!reassignModalUser || reassignLoading) return;
    setReassignLoading(true);
    setReassignError(null);
    try {
      await updateSupervisorAllocation(reassignModalUser.uid, reassignFarmIds);
      const targetName = reassignModalUser.name || reassignModalUser.email;
      closeReassignModal();
      setFeedback({
        type: 'success',
        message: `Farm assignment for "${targetName}" updated successfully.`,
      });
      await loadUsers();
    } catch (err: any) {
      console.error('[AdminUsers] Reassign farms error:', err);
      setReassignError(err.message || 'Failed to update farm assignment.');
      setReassignLoading(false);
    }
  };

  const handleActivate = async (user: UserDoc) => {
    setActiveMenu(null);
    setFeedback(null);
    try {
      await updateUserStatus(user.uid, true);
      setFeedback({ type: 'success', message: `User "${user.email}" activated successfully.` });
      await loadUsers();
    } catch (err: any) {
      console.error('[AdminUsers] Activate error:', err);
      setFeedback({ type: 'error', message: err.message || 'Failed to activate user.' });
    }
  };

  const handleConfirmDeactivate = async () => {
    if (!deactivateModalUser || deactivateInput !== 'DEACTIVATE' || deactivateLoading) return;
    setDeactivateLoading(true);
    setDeactivateError(null);
    try {
      await updateUserStatus(deactivateModalUser.uid, false);
      const targetEmail = deactivateModalUser.email;
      closeDeactivateModal();
      setFeedback({ type: 'success', message: `User "${targetEmail}" deactivated successfully.` });
      await loadUsers();
    } catch (err: any) {
      console.error('[AdminUsers] Deactivate error:', err);
      setDeactivateError(err.message || 'Failed to deactivate user.');
      setDeactivateLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteModalUser || deleteInput !== 'DELETE' || deleteLoading) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await deleteUserAccount(deleteModalUser.uid);
      const deletedEmail = deleteModalUser.email;
      closeDeleteModal();
      setFeedback({ type: 'success', message: `User "${deletedEmail}" permanently deleted.` });
      await loadUsers();
    } catch (err: any) {
      console.error('[AdminUsers] Delete error:', err);
      setDeleteError(err.message || 'Failed to delete user account.');
      setDeleteLoading(false);
    }
  };

  const getDeleteWarning = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'farmer':
        return 'This will permanently delete the Farmer account and any farm(s) actually owned by this Farmer according to the existing farm ownership relationship.';
      case 'supervisor':
        return 'This will permanently delete the Supervisor account and remove their farm assignments. The farms themselves will NOT be deleted.';
      case 'admin':
        return 'This will permanently delete the Admin account. No farms will be deleted.';
      default:
        return 'This will permanently delete this user account. This action cannot be undone.';
    }
  };

  const filtered = filter === 'all' ? users : users.filter((u) => u.role === filter);

  if (loading) {
    return (
      <DashboardLayout role="admin" userName={userProfile?.name}>
        <LoadingState />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin" userName={userProfile?.name}>
      <div className="mgmt-page">
        <div className="mgmt-page-header">
          <h2>User Management</h2>
          <div className="header-controls" style={{ flexWrap: 'wrap', gap: 8 }}>
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
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                className="btn btn--primary"
                onClick={() => navigate('/admin/users/create-farmer')}
              >
                + Create Farmer
              </button>
              <button
                className="btn btn--supervisor"
                onClick={() => navigate('/admin/users/create-supervisor')}
              >
                + Create Supervisor
              </button>
              <button
                className="btn btn--admin"
                onClick={() => navigate('/admin/users/create-admin')}
              >
                + Create Admin
              </button>
            </div>
          </div>
        </div>

        {feedback && (
          <div
            className={`alert ${feedback.type === 'success' ? 'alert--success' : 'alert--error'}`}
            style={{
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderRadius: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {feedback.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
              <span>{feedback.message}</span>
            </div>
            <button
              onClick={() => setFeedback(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
            >
              <X size={16} />
            </button>
          </div>
        )}

        <div className="table-container table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Farms</th>
                <th>Status</th>
                <th style={{ width: '80px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const isMenuOpen = activeMenu?.user.uid === u.uid;

                return (
                  <tr key={u.uid}>
                    <td className="td-bold">{u.name}</td>
                    <td>{u.email}</td>
                    <td>
                      <span className={`role-badge role-badge--${u.role}`}>{u.role}</span>
                    </td>
                    <td>{u.farmIds.join(', ') || '--'}</td>
                    <td>
                      <span
                        className={`status-badge ${u.active ? 'status-badge--ok' : 'status-badge--warn'}`}
                      >
                        {u.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        aria-haspopup="menu"
                        aria-expanded={isMenuOpen}
                        aria-label={`Manage user actions for ${u.name || u.email}`}
                        title={`Manage user actions for ${u.name || u.email}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '6px',
                          backgroundColor: 'transparent',
                          border: 'none',
                          outline: 'none',
                          color: isMenuOpen ? '#10b981' : '#1e293b',
                          cursor: 'pointer',
                          borderRadius: '4px',
                          transition: 'color 0.15s ease, transform 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = '#10b981';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = isMenuOpen ? '#10b981' : '#1e293b';
                        }}
                        onClick={(e) => handleToggleMenu(e, u)}
                      >
                        <Pencil size={21} strokeWidth={2.2} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && <EmptyState message="No users found." />}

        {/* CLIPPING-SAFE ACTION POPOVER (PORTAL TO DOCUMENT BODY) */}
        {activeMenu &&
          typeof document !== 'undefined' &&
          createPortal(
            (() => {
              const { user: u, rect } = activeMenu;
              const isCurrentAdmin = u.uid === userProfile?.uid;
              const isSupervisor = u.role === 'supervisor';
              const menuWidth = 184;
              const menuHeight = isCurrentAdmin ? 60 : isSupervisor ? 144 : 105;
              const spaceBelow = window.innerHeight - rect.bottom;
              const openUpward = spaceBelow < menuHeight + 16;

              const top = openUpward ? Math.max(8, rect.top - menuHeight - 4) : rect.bottom + 4;
              const left = Math.max(
                12,
                Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 12),
              );

              return (
                <div
                  role="menu"
                  aria-orientation="vertical"
                  style={{
                    position: 'fixed',
                    top: `${top}px`,
                    left: `${left}px`,
                    width: `${menuWidth}px`,
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    boxShadow:
                      '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.08)',
                    zIndex: 9999,
                    overflow: 'hidden',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    style={{
                      padding: '8px 14px 6px',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#64748b',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      borderBottom: '1px solid #f1f5f9',
                      backgroundColor: '#f8fafc',
                    }}
                  >
                    {isSupervisor ? 'Manage Supervisor' : 'Manage User'}
                  </div>

                  <div style={{ padding: '4px 0' }}>
                    {isSupervisor && (
                      <>
                        <button
                          type="button"
                          role="menuitem"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            width: '100%',
                            textAlign: 'left',
                            padding: '8px 14px',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '13.5px',
                            color: '#2563eb',
                            fontWeight: 500,
                            transition: 'background-color 0.15s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#eff6ff';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                          onClick={() => startReassignFarms(u)}
                        >
                          <Layers size={15} /> Reassign Farms
                        </button>
                        <div
                          style={{
                            height: '1px',
                            backgroundColor: '#f1f5f9',
                            margin: '4px 0',
                          }}
                        />
                      </>
                    )}

                    {u.active ? (
                      <button
                        type="button"
                        role="menuitem"
                        disabled={isCurrentAdmin}
                        title={isCurrentAdmin ? 'Cannot deactivate your own account' : undefined}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          width: '100%',
                          textAlign: 'left',
                          padding: '8px 14px',
                          background: 'none',
                          border: 'none',
                          cursor: isCurrentAdmin ? 'not-allowed' : 'pointer',
                          opacity: isCurrentAdmin ? 0.4 : 1,
                          fontSize: '13.5px',
                          color: '#b45309',
                          fontWeight: 500,
                          transition: 'background-color 0.15s',
                        }}
                        onMouseEnter={(e) => {
                          if (!isCurrentAdmin) e.currentTarget.style.backgroundColor = '#fef3c7';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                        onClick={() => startDeactivate(u)}
                      >
                        <UserX size={15} /> Deactivate User
                      </button>
                    ) : (
                      <button
                        type="button"
                        role="menuitem"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          width: '100%',
                          textAlign: 'left',
                          padding: '8px 14px',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '13.5px',
                          color: '#16a34a',
                          fontWeight: 500,
                          transition: 'background-color 0.15s',
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.backgroundColor = '#f0fdf4')
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.backgroundColor = 'transparent')
                        }
                        onClick={() => handleActivate(u)}
                      >
                        <CheckCircle size={15} /> Activate User
                      </button>
                    )}

                    {!isCurrentAdmin && (
                      <>
                        <div
                          style={{
                            height: '1px',
                            backgroundColor: '#f1f5f9',
                            margin: '4px 0',
                          }}
                        />
                        <button
                          type="button"
                          role="menuitem"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            width: '100%',
                            textAlign: 'left',
                            padding: '8px 14px',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '13.5px',
                            color: '#dc2626',
                            fontWeight: 600,
                            transition: 'background-color 0.15s',
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.backgroundColor = '#fee2e2')
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.backgroundColor = 'transparent')
                          }
                          onClick={() => startDelete(u)}
                        >
                          <Trash2 size={15} /> Delete User
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })(),
            document.body,
          )}

        {/* TWO-STEP DELETE CONFIRMATION MODAL */}
        {deleteModalUser && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(3px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10000,
              padding: '16px',
            }}
            onClick={closeDeleteModal}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                maxWidth: '500px',
                width: '100%',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                border: '1px solid #fee2e2',
                overflow: 'hidden',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {deleteStep === 1 ? (
                /* STEP 1: Warning Modal */
                <div style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: '#fee2e2',
                        color: '#dc2626',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Trash2 size={22} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '18px', color: '#111827' }}>
                        Delete User Permanently?
                      </h3>
                      <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#6b7280' }}>
                        Step 1 of 2 — Review account deletion
                      </p>
                    </div>
                  </div>

                  <p style={{ fontSize: '14px', color: '#374151', margin: '0 0 12px' }}>
                    You are about to permanently delete:
                  </p>

                  <div
                    style={{
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '12px 16px',
                      marginBottom: 16,
                      fontSize: '13.5px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ color: '#64748b' }}>Name:</span>
                      <strong style={{ color: '#0f172a' }}>{deleteModalUser.name}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ color: '#64748b' }}>Email:</span>
                      <strong style={{ color: '#0f172a' }}>{deleteModalUser.email}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Role:</span>
                      <strong style={{ textTransform: 'capitalize', color: '#0f172a' }}>
                        {deleteModalUser.role}
                      </strong>
                    </div>
                  </div>

                  <div
                    style={{
                      backgroundColor: '#fff1f2',
                      border: '1px solid #fecdd3',
                      borderRadius: '8px',
                      padding: '12px 14px',
                      marginBottom: 16,
                      display: 'flex',
                      gap: 10,
                    }}
                  >
                    <AlertTriangle size={18} color="#e11d48" style={{ flexShrink: 0, marginTop: 2 }} />
                    <div style={{ fontSize: '13px', color: '#9f1239', lineHeight: 1.45 }}>
                      <p style={{ margin: '0 0 6px', fontWeight: 600 }}>This action cannot be undone.</p>
                      <p style={{ margin: 0 }}>{getDeleteWarning(deleteModalUser.role)}</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn--outline" onClick={closeDeleteModal}>
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn--danger"
                      onClick={() => setDeleteStep(2)}
                    >
                      Continue
                    </button>
                  </div>
                </div>
              ) : (
                /* STEP 2: Explicit Verification Modal */
                <div style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: '#fee2e2',
                        color: '#dc2626',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <ShieldAlert size={22} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '18px', color: '#111827' }}>
                        Confirm Permanent Deletion
                      </h3>
                      <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#6b7280' }}>
                        Step 2 of 2 — Explicit verification required
                      </p>
                    </div>
                  </div>

                  {deleteError && (
                    <div
                      style={{
                        backgroundColor: '#fff1f2',
                        border: '1px solid #fecdd3',
                        color: '#9f1239',
                        padding: '10px 14px',
                        borderRadius: '6px',
                        marginBottom: 16,
                        fontSize: '13px',
                      }}
                    >
                      {deleteError}
                    </div>
                  )}

                  <p style={{ fontSize: '13.5px', color: '#374151', margin: '0 0 8px' }}>
                    You are permanently deleting:{' '}
                    <strong style={{ color: '#0f172a' }}>{deleteModalUser.email}</strong>
                  </p>

                  <p style={{ fontSize: '13px', color: '#dc2626', margin: '0 0 16px', fontWeight: 500 }}>
                    This action is permanent. All associated authentication and database records will be
                    erased according to the schema rules.
                  </p>

                  <div style={{ marginBottom: 20 }}>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#374151',
                        marginBottom: 6,
                      }}
                    >
                      This action is permanent. To confirm, type <span style={{ color: '#dc2626', fontFamily: 'monospace' }}>DELETE</span>:
                    </label>
                    <input
                      type="text"
                      disabled={deleteLoading}
                      value={deleteInput}
                      onChange={(e) => setDeleteInput(e.target.value)}
                      placeholder="DELETE"
                      autoFocus
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1.5px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '14px',
                        outline: 'none',
                        fontFamily: 'monospace',
                        letterSpacing: '1px',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="btn btn--outline"
                      disabled={deleteLoading}
                      onClick={closeDeleteModal}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn--danger"
                      disabled={deleteInput !== 'DELETE' || deleteLoading}
                      onClick={handleConfirmDelete}
                    >
                      {deleteLoading ? 'Deleting...' : 'Permanently Delete User'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TWO-STEP DEACTIVATE CONFIRMATION MODAL */}
        {deactivateModalUser && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(3px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10000,
              padding: '16px',
            }}
            onClick={closeDeactivateModal}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                maxWidth: '480px',
                width: '100%',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                border: '1px solid #e2e8f0',
                overflow: 'hidden',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {deactivateStep === 1 ? (
                /* STEP 1: Warning Modal */
                <div style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: '#fef3c7',
                        color: '#d97706',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <UserX size={22} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '18px', color: '#111827' }}>Deactivate User?</h3>
                      <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#6b7280' }}>
                        Step 1 of 2 — Review deactivation
                      </p>
                    </div>
                  </div>

                  <p style={{ fontSize: '14px', color: '#374151', margin: '0 0 12px' }}>
                    You are about to deactivate:
                  </p>

                  <div
                    style={{
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '12px 16px',
                      marginBottom: 16,
                      fontSize: '13.5px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ color: '#64748b' }}>Name:</span>
                      <strong style={{ color: '#0f172a' }}>{deactivateModalUser.name}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ color: '#64748b' }}>Email:</span>
                      <strong style={{ color: '#0f172a' }}>{deactivateModalUser.email}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Role:</span>
                      <strong style={{ textTransform: 'capitalize', color: '#0f172a' }}>
                        {deactivateModalUser.role}
                      </strong>
                    </div>
                  </div>

                  <div
                    style={{
                      backgroundColor: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      borderRadius: '8px',
                      padding: '12px 14px',
                      marginBottom: 16,
                      fontSize: '13px',
                      color: '#166534',
                      lineHeight: 1.45,
                    }}
                  >
                    <p style={{ margin: '0 0 4px', fontWeight: 600 }}>
                      The account will be disabled.
                    </p>
                    <p style={{ margin: 0 }}>No user or farm data will be deleted.</p>
                  </div>

                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn--outline" onClick={closeDeactivateModal}>
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={() => setDeactivateStep(2)}
                    >
                      Continue
                    </button>
                  </div>
                </div>
              ) : (
                /* STEP 2: Explicit Verification Modal */
                <div style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: '#fef3c7',
                        color: '#d97706',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <UserX size={22} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '18px', color: '#111827' }}>Confirm Deactivation</h3>
                      <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#6b7280' }}>
                        Step 2 of 2 — Explicit verification required
                      </p>
                    </div>
                  </div>

                  {deactivateError && (
                    <div
                      style={{
                        backgroundColor: '#fff1f2',
                        border: '1px solid #fecdd3',
                        color: '#9f1239',
                        padding: '10px 14px',
                        borderRadius: '6px',
                        marginBottom: 16,
                        fontSize: '13px',
                      }}
                    >
                      {deactivateError}
                    </div>
                  )}

                  <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 16px' }}>
                    This will disable the user&apos;s active status. No user or farm data will be deleted.
                  </p>

                  <div style={{ marginBottom: 20 }}>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#374151',
                        marginBottom: 6,
                      }}
                    >
                      To confirm this action, type <span style={{ color: '#d97706', fontFamily: 'monospace' }}>DEACTIVATE</span>:
                    </label>
                    <input
                      type="text"
                      disabled={deactivateLoading}
                      value={deactivateInput}
                      onChange={(e) => setDeactivateInput(e.target.value)}
                      placeholder="DEACTIVATE"
                      autoFocus
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1.5px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '14px',
                        outline: 'none',
                        fontFamily: 'monospace',
                        letterSpacing: '1px',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="btn btn--outline"
                      disabled={deactivateLoading}
                      onClick={closeDeactivateModal}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn--primary"
                      disabled={deactivateInput !== 'DEACTIVATE' || deactivateLoading}
                      onClick={handleConfirmDeactivate}
                    >
                      {deactivateLoading ? 'Deactivating...' : 'Deactivate User'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* REASSIGN FARMS MODAL FOR SUPERVISOR */}
        {reassignModalUser && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(3px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10000,
              padding: '16px',
            }}
            onClick={closeReassignModal}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                maxWidth: '540px',
                width: '100%',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                border: '1px solid #e2e8f0',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                maxHeight: '90vh',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 20px',
                  borderBottom: '1px solid #e2e8f0',
                  backgroundColor: '#f8fafc',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      backgroundColor: '#eff6ff',
                      color: '#2563eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Layers size={20} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '18px', color: '#111827', fontWeight: 600 }}>
                      Reassign Farms
                    </h3>
                    <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#64748b' }}>
                      {reassignModalUser.name || reassignModalUser.email} ({reassignModalUser.email})
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeReassignModal}
                  disabled={reassignLoading}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: '4px',
                  }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body */}
              <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
                {reassignError && (
                  <div
                    style={{
                      backgroundColor: '#fff1f2',
                      border: '1px solid #fecdd3',
                      color: '#9f1239',
                      padding: '10px 14px',
                      borderRadius: '6px',
                      marginBottom: 16,
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <AlertTriangle size={16} color="#dc2626" />
                    <span>{reassignError}</span>
                  </div>
                )}

                <p style={{ fontSize: '13.5px', color: '#475569', margin: '0 0 14px', lineHeight: 1.4 }}>
                  Select the farms this Supervisor should be responsible for. Reassigning farms does not modify or delete the farms themselves.
                </p>

                {/* Search Farms Input */}
                <div style={{ position: 'relative', marginBottom: 12 }}>
                  <Search
                    size={16}
                    color="#94a3b8"
                    style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
                  />
                  <input
                    type="text"
                    value={reassignSearch}
                    onChange={(e) => setReassignSearch(e.target.value)}
                    placeholder="Search farms by ID or name..."
                    style={{
                      width: '100%',
                      padding: '9px 12px 9px 36px',
                      border: '1.5px solid #cbd5e1',
                      borderRadius: '6px',
                      fontSize: '13.5px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* Multi-Select Farm List Container */}
                <div
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    maxHeight: '240px',
                    overflowY: 'auto',
                    backgroundColor: '#ffffff',
                  }}
                >
                  {farmsLoading ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '13.5px' }}>
                      Loading farms...
                    </div>
                  ) : (
                    (() => {
                      const filteredFarmsList = allFarms.filter((f) => {
                        if (!reassignSearch.trim()) return true;
                        const q = reassignSearch.toLowerCase().trim();
                        return (
                          f.farmId?.toLowerCase().includes(q) ||
                          f.name?.toLowerCase().includes(q) ||
                          f.location?.toLowerCase().includes(q)
                        );
                      });

                      if (filteredFarmsList.length === 0) {
                        return (
                          <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '13.5px' }}>
                            {allFarms.length === 0 ? 'No farms found in database.' : 'No farms match your search.'}
                          </div>
                        );
                      }

                      return (
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          {filteredFarmsList.map((farm) => {
                            const isSelected = reassignFarmIds.includes(farm.farmId);
                            return (
                              <div
                                key={farm.farmId}
                                onClick={() => toggleFarmSelection(farm.farmId)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  padding: '10px 14px',
                                  borderBottom: '1px solid #f1f5f9',
                                  cursor: 'pointer',
                                  backgroundColor: isSelected ? '#eff6ff' : 'transparent',
                                  transition: 'background-color 0.15s',
                                }}
                                onMouseEnter={(e) => {
                                  if (!isSelected) e.currentTarget.style.backgroundColor = '#f8fafc';
                                }}
                                onMouseLeave={(e) => {
                                  if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {}} // Handled by container click
                                  style={{
                                    marginRight: 12,
                                    width: '16px',
                                    height: '16px',
                                    cursor: 'pointer',
                                    accentColor: '#2563eb',
                                  }}
                                />
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                                  <span
                                    style={{
                                      fontSize: '12px',
                                      fontWeight: 700,
                                      padding: '2px 8px',
                                      borderRadius: '4px',
                                      backgroundColor: isSelected ? '#dbeafe' : '#f1f5f9',
                                      color: isSelected ? '#1e40af' : '#475569',
                                    }}
                                  >
                                    {farm.farmId}
                                  </span>
                                  <span style={{ fontSize: '14px', fontWeight: 500, color: '#1e293b' }}>
                                    {farm.name || farm.farmId}
                                  </span>
                                  {farm.location && (
                                    <span style={{ fontSize: '12px', color: '#64748b', marginLeft: 'auto' }}>
                                      {farm.location}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()
                  )}
                </div>

                {/* Selected Farms Summary Count */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: 10,
                    fontSize: '13px',
                    color: '#64748b',
                  }}
                >
                  <span>
                    Selected: <strong style={{ color: '#2563eb' }}>{reassignFarmIds.length}</strong> farm{reassignFarmIds.length === 1 ? '' : 's'}
                  </span>
                  {reassignFarmIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setReassignFarmIds([])}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#64748b',
                        fontSize: '12px',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        padding: 0,
                      }}
                    >
                      Clear Selection
                    </button>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  justifyContent: 'flex-end',
                  padding: '14px 20px',
                  borderTop: '1px solid #e2e8f0',
                  backgroundColor: '#f8fafc',
                }}
              >
                <button
                  type="button"
                  className="btn btn--outline"
                  disabled={reassignLoading}
                  onClick={closeReassignModal}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={reassignLoading}
                  onClick={handleSaveFarmAssignment}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    fontWeight: 600,
                  }}
                >
                  {reassignLoading ? 'Saving...' : 'Save Farm Assignment'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
