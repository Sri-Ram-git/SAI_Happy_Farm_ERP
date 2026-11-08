import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/dashboard/DashboardLayout';
import { LoadingState } from '../../components/dashboard/LoadingState';
import { EmptyState } from '../../components/dashboard/EmptyState';
import { AlertTriangle, X } from 'lucide-react';
import { getAllFarms, getFarmsByIds, type FarmDoc } from '../../services/farmDataService';
import {
  getFeedInventory,
  addFeedLoad,
  updateFeedLoad,
  deleteFeedLoad,
  subscribeToFeedLogsByFarm,
  isValidFeedQuantityInput,
  validateFeedQuantity,
  type FeedLogDoc,
} from '../../services/inventoryService';
import { getAllUsers } from '../../services/userDataService';
import { formatDisplayDate, formatTime, getIstDate } from '../../utils/dateUtils';

interface FarmWithFeed extends FarmDoc {
  currentFeedStockKg: number;
  totalFeedLoadedKg: number;
  lastTransactionDate: string;
}

export function FeedLoadPage() {
  const { userProfile } = useAuth();
  const role = userProfile?.role === 'admin' ? 'admin' : 'supervisor';
  const [farms, setFarms] = useState<FarmWithFeed[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFarmId, setSelectedFarmIdState] = useState<string>(() => {
    try {
      return sessionStorage.getItem('sai_feed_load_selected_farm') || '';
    } catch {
      return '';
    }
  });

  const setSelectedFarmId = (farmId: string) => {
    setSelectedFarmIdState(farmId);
    try {
      if (farmId) {
        sessionStorage.setItem('sai_feed_load_selected_farm', farmId);
      } else {
        sessionStorage.removeItem('sai_feed_load_selected_farm');
      }
    } catch {}
  };

  const [feedKg, setFeedKg] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Edit and Delete state
  const [editingLog, setEditingLog] = useState<FeedLogDoc | null>(null);
  const [logToDelete, setLogToDelete] = useState<FeedLogDoc | null>(null);
  const [deleting, setDeleting] = useState(false);
  const formSectionRef = useRef<HTMLDivElement>(null);

  // Feed load history state
  const [feedLogs, setFeedLogs] = useState<FeedLogDoc[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [errorLogs, setErrorLogs] = useState<string | null>(null);
  const [historyRetryKey, setHistoryRetryKey] = useState(0);
  const [usersMap, setUsersMap] = useState<Record<string, string>>({});

  const farmIdsKey = userProfile?.farmIds ? userProfile.farmIds.slice().sort().join(',') : '';

  // Load farms
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const assignedIds = userProfile?.farmIds ?? [];
        const filteredFarms = role === 'supervisor'
          ? (assignedIds.length > 0 ? await getFarmsByIds(assignedIds) : [])
          : await getAllFarms();

        const farmsWithFeed = await Promise.all(
          filteredFarms.map(async (farm) => {
            const feedInv = await getFeedInventory(farm.farmId);
            return {
              ...farm,
              currentFeedStockKg: feedInv?.currentFeedStockKg ?? 0,
              totalFeedLoadedKg: feedInv?.totalFeedLoadedKg ?? 0,
              lastTransactionDate: feedInv?.lastTransactionDate ?? '',
            };
          })
        );

        if (mounted) setFarms(farmsWithFeed);
      } catch (err) {
        console.error('[FeedLoadPage] Load error:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [role, farmIdsKey]);

  // Clean up selected farm if it no longer exists after farms are loaded
  useEffect(() => {
    if (!loading && farms.length > 0 && selectedFarmId) {
      const exists = farms.some((f) => f.farmId === selectedFarmId);
      if (!exists) {
        setSelectedFarmId('');
      }
    }
  }, [loading, farms, selectedFarmId]);

  // Load user name lookup map
  useEffect(() => {
    getAllUsers()
      .then((users) => {
        const map: Record<string, string> = {};
        users.forEach((u) => {
          map[u.uid] = u.name || u.email;
        });
        setUsersMap(map);
      })
      .catch((err) => {
        console.warn('[FeedLoadPage] Failed to fetch users map:', err);
      });
  }, []);

  // Subscribe to feed load history for selected farm
  useEffect(() => {
    if (!selectedFarmId) {
      setFeedLogs([]);
      setLoadingLogs(false);
      setErrorLogs(null);
      return;
    }

    setLoadingLogs(true);
    setErrorLogs(null);
    const unsubscribe = subscribeToFeedLogsByFarm(
      selectedFarmId,
      (logs) => {
        setFeedLogs(logs);
        setLoadingLogs(false);
        setErrorLogs(null);
      },
      (err) => {
        console.error('[FeedLoadPage] subscribeToFeedLogsByFarm error:', err);
        setLoadingLogs(false);
        setErrorLogs('Unable to load feed load history. Please try again or check network access.');
      }
    );

    return () => {
      unsubscribe();
    };
  }, [selectedFarmId, historyRetryKey]);

  const selectedFarm = farms.find((f) => f.farmId === selectedFarmId);

  // Input restriction handlers: allow max 7 digits before decimal and 2 decimal places (max 9,999,999.99)
  const handleFeedInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (isValidFeedQuantityInput(val)) {
      setFeedKg(val);
      if (error) setError('');
    }
  };

  const handleFeedPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text');
    const input = e.currentTarget;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const prospective = input.value.slice(0, start) + pasted + input.value.slice(end);
    if (!isValidFeedQuantityInput(prospective)) {
      e.preventDefault();
    }
  };

  const handleFeedKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (['e', 'E', '+', '-'].includes(e.key)) {
      e.preventDefault();
    }
  };

  const handleStartEdit = (log: FeedLogDoc) => {
    setError('');
    setSuccess('');
    setEditingLog(log);
    setFeedKg(String(log.quantityKg));
    setNotes(log.notes || '');
    formSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingLog(null);
    setFeedKg('');
    setNotes('');
    setError('');
  };

  const handleRequestDelete = (log: FeedLogDoc) => {
    setError('');
    setSuccess('');
    setLogToDelete(log);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedFarmId) {
      setError('Please select a farm.');
      return;
    }

    const currentStock = selectedFarm?.currentFeedStockKg ?? 0;
    const oldQty = editingLog ? editingLog.quantityKg : 0;
    const stockBaseline = editingLog ? (currentStock - oldQty) : currentStock;

    const validation = validateFeedQuantity(feedKg, stockBaseline);
    if (!validation.valid || validation.quantity === undefined) {
      setError(validation.error || 'Please enter a valid feed quantity in Kg.');
      return;
    }

    if (notes.trim().length > 500) {
      setError('Notes cannot exceed 500 characters.');
      return;
    }

    const kg = validation.quantity;

    setSubmitting(true);
    try {
      if (editingLog) {
        // Edit mode
        const result = await updateFeedLoad(
          selectedFarmId,
          editingLog.logId,
          kg,
          notes,
          userProfile!.uid,
          role,
          userProfile?.farmIds,
        );

        const farmName = selectedFarm?.name || selectedFarmId;
        const diff = kg - oldQty;
        setSuccess(`Feed load updated to ${kg} Kg for ${farmName}. New stock: ${result.newStockKg.toLocaleString()} Kg.`);
        setEditingLog(null);
        setFeedKg('');
        setNotes('');

        setFarms((prev) =>
          prev.map((f) =>
            f.farmId === selectedFarmId
              ? {
                  ...f,
                  currentFeedStockKg: result.newStockKg,
                  totalFeedLoadedKg: Math.max(0, Number((f.totalFeedLoadedKg + diff).toFixed(2))),
                  lastTransactionDate: getIstDate(),
                }
              : f
          )
        );
      } else {
        // Add mode
        await addFeedLoad(
          selectedFarmId,
          kg,
          userProfile!.uid,
          notes,
          role,
          userProfile?.farmIds,
        );
        const farmName = selectedFarm?.name || selectedFarmId;
        const newStock = Number((currentStock + kg).toFixed(2));
        setSuccess(`${kg} Kg feed loaded for ${farmName}.`);
        setFeedKg('');
        setNotes('');

        setFarms((prev) =>
          prev.map((f) =>
            f.farmId === selectedFarmId
              ? {
                  ...f,
                  currentFeedStockKg: newStock,
                  totalFeedLoadedKg: Number((f.totalFeedLoadedKg + kg).toFixed(2)),
                  lastTransactionDate: getIstDate(),
                }
              : f
          )
        );
      }
    } catch (err: any) {
      console.error('[FeedLoadPage] Submit error:', err);
      const msg = err?.message || '';
      if (msg === 'RESULTING_STOCK_EXCEEDS_LIMIT') {
        setError('Resulting feed stock cannot exceed 9,999,999.99 Kg.');
      } else if (msg === 'INSUFFICIENT_STOCK_FOR_UPDATE') {
        setError('Cannot reduce feed quantity: farm stock would fall below zero.');
      } else if (msg === 'FEED_QUANTITY_EXCEEDS_LIMIT') {
        setError('Feed quantity cannot exceed 9,999,999.99 Kg.');
      } else if (msg === 'PERMISSION_DENIED') {
        setError('You do not have permission to perform this action.');
      } else if (msg === 'FEED_INVENTORY_NOT_FOUND') {
        setError('Feed inventory not found for this farm. Initialize it first.');
      } else {
        setError(editingLog ? 'Failed to update feed load record. Please try again.' : 'Failed to record feed load. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!logToDelete || !selectedFarmId) return;

    setDeleting(true);
    setError('');
    setSuccess('');

    try {
      const result = await deleteFeedLoad(
        selectedFarmId,
        logToDelete.logId,
        userProfile!.uid,
        role,
        userProfile?.farmIds,
      );

      const deletedQty = logToDelete.quantityKg;
      setSuccess(`Feed load record of ${deletedQty} Kg deleted. Farm stock reconciled to ${result.newStockKg.toLocaleString()} Kg.`);

      setFarms((prev) =>
        prev.map((f) =>
          f.farmId === selectedFarmId
            ? {
                ...f,
                currentFeedStockKg: result.newStockKg,
                totalFeedLoadedKg: Math.max(0, Number((f.totalFeedLoadedKg - deletedQty).toFixed(2))),
              }
            : f
        )
      );

      if (editingLog && editingLog.logId === logToDelete.logId) {
        handleCancelEdit();
      }

      setLogToDelete(null);
    } catch (err: any) {
      console.error('[FeedLoadPage] Delete error:', err);
      const msg = err?.message || '';
      if (msg === 'INSUFFICIENT_STOCK_FOR_DELETION') {
        setError('Cannot delete this feed load: doing so would reduce farm stock below zero. Feed has already been consumed.');
      } else if (msg === 'PERMISSION_DENIED') {
        setError('You do not have permission to delete this record.');
      } else {
        setError('Failed to delete feed load record. Please try again.');
      }
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <DashboardLayout role={role} userName={userProfile?.name}><LoadingState /></DashboardLayout>;
  if (farms.length === 0) return <DashboardLayout role={role} userName={userProfile?.name}><EmptyState message="No farms available." /></DashboardLayout>;

  return (
    <DashboardLayout role={role} userName={userProfile?.name}>
      <div className="mgmt-page">
        <div className="mgmt-page-header">
          <h2>Record Feed Load</h2>
        </div>

        {success && <div className="alert alert--success" style={{ marginBottom: 16 }}>{success}</div>}
        {error && <div className="alert alert--error" style={{ marginBottom: 16 }}>{error}</div>}

        <div className="section-card" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Current Feed Stock</h3>
            <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>Click any row to select farm</span>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Farm ID</th>
                  <th>Farm Name</th>
                  <th>Current Stock (Kg)</th>
                  <th>Total Loaded (Kg)</th>
                  <th>Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {farms.map((farm) => {
                  const isSelected = selectedFarmId === farm.farmId;
                  return (
                    <tr
                      key={farm.farmId}
                      onClick={() => {
                        setSelectedFarmId(farm.farmId);
                        if (editingLog && editingLog.farmId !== farm.farmId) {
                          handleCancelEdit();
                        }
                      }}
                      style={{
                        cursor: 'pointer',
                        backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.08)' : undefined,
                        transition: 'background-color 150ms ease',
                      }}
                      title="Click to view history & record feed"
                    >
                      <td className="td-bold">
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          {farm.farmId}
                          {isSelected && (
                            <span style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              backgroundColor: 'var(--green-600)',
                              display: 'inline-block',
                            }} />
                          )}
                        </span>
                      </td>
                      <td>{farm.name || 'Unnamed'}</td>
                      <td
                        style={{
                          fontWeight: 600,
                          maxWidth: 160,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={`${farm.currentFeedStockKg.toLocaleString()} Kg`}
                      >
                        {farm.currentFeedStockKg.toLocaleString(undefined, { maximumFractionDigits: 2 })} Kg
                      </td>
                      <td
                        style={{
                          maxWidth: 160,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={`${farm.totalFeedLoadedKg.toLocaleString()} Kg`}
                      >
                        {farm.totalFeedLoadedKg.toLocaleString(undefined, { maximumFractionDigits: 2 })} Kg
                      </td>
                      <td>{farm.lastTransactionDate ? formatDisplayDate(farm.lastTransactionDate) : '--'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div ref={formSectionRef} className="section-card" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>{editingLog ? 'Edit Feed Load' : 'Add Feed Load'}</h3>
            {editingLog && (
              <button
                type="button"
                className="btn btn--outline btn--sm"
                onClick={handleCancelEdit}
                disabled={submitting}
              >
                Cancel Edit
              </button>
            )}
          </div>

          {editingLog && (
            <div style={{
              padding: '8px 12px',
              marginBottom: 16,
              background: '#eff6ff',
              borderRadius: 8,
              border: '1px solid #bfdbfe',
              fontSize: '13px',
              color: '#1e40af',
            }}>
              Editing entry from <strong>{formatDisplayDate(editingLog.loadedAt)}</strong> ({editingLog.quantityKg.toLocaleString()} Kg). Adjust quantity or notes below.
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Select Farm</label>
              <select
                value={selectedFarmId}
                onChange={(e) => {
                  setSelectedFarmId(e.target.value);
                  if (editingLog) handleCancelEdit();
                }}
                className="form-select"
                disabled={editingLog !== null}
              >
                <option value="">-- Choose a farm --</option>
                {farms.map((farm) => (
                  <option key={farm.farmId} value={farm.farmId}>
                    {farm.farmId} - {farm.name || 'Unnamed'} (Stock: {farm.currentFeedStockKg.toLocaleString(undefined, { maximumFractionDigits: 2 })} Kg)
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Feed Quantity (Kg)</label>
              <input
                type="text"
                inputMode="decimal"
                maxLength={10}
                className={error && (error.includes('feed') || error.includes('Kg') || error.includes('limit')) ? 'input--error' : ''}
                value={feedKg}
                onChange={handleFeedInputChange}
                onPaste={handleFeedPaste}
                onKeyDown={handleFeedKeyDown}
                placeholder="e.g. 500 (max 9,999,999.99)"
              />
              <span style={{ fontSize: '11.5px', color: 'var(--gray-500)', marginTop: 4, display: 'block' }}>
                Maximum 7 digits before decimal and 2 decimal places (up to 9,999,999.99 Kg).
              </span>
            </div>

            <div className="field">
              <label>Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Supplier, batch number, etc."
                rows={2}
                maxLength={500}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button
                type="submit"
                className="btn btn--primary btn--full"
                disabled={submitting}
              >
                {submitting ? <span className="spinner" /> : (editingLog ? 'Save Changes' : 'Record Feed Load')}
              </button>
              {editingLog && (
                <button
                  type="button"
                  className="btn btn--outline"
                  onClick={handleCancelEdit}
                  disabled={submitting}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        {/* FEED LOAD HISTORY SECTION */}
        <div className="section-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0 }}>Feed Load History</h3>
              {selectedFarm && (
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--gray-500)' }}>
                  Showing history for <strong>{selectedFarm.name || selectedFarm.farmId}</strong> ({selectedFarm.farmId})
                </p>
              )}
            </div>
            {selectedFarm && (
              <span style={{
                fontSize: '12.5px',
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: '6px',
                background: 'rgba(16, 185, 129, 0.1)',
                color: 'var(--green-700)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
              }}>
                Current Stock: {selectedFarm.currentFeedStockKg.toLocaleString(undefined, { maximumFractionDigits: 2 })} Kg
              </span>
            )}
          </div>

          {!selectedFarmId ? (
            <div style={{
              padding: '36px 16px',
              textAlign: 'center',
              background: 'var(--gray-50)',
              borderRadius: 10,
              border: '1px dashed var(--gray-300)',
              color: 'var(--gray-500)',
            }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>Select a farm to view feed load history</p>
              <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: 'var(--gray-400)' }}>
                Choose a farm from the form above or click any row in the Current Feed Stock table.
              </p>
            </div>
          ) : loadingLogs ? (
            <div style={{ padding: '36px 0', textAlign: 'center' }}>
              <span className="spinner" />
              <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: 'var(--gray-500)' }}>Loading history...</p>
            </div>
          ) : errorLogs ? (
            <div style={{
              padding: '24px 16px',
              textAlign: 'center',
              background: '#fef2f2',
              borderRadius: 10,
              border: '1px solid #fecaca',
              color: '#991b1b',
            }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: '14px' }}>
                {errorLogs}
              </p>
              <button
                type="button"
                className="btn btn--outline btn--sm"
                style={{ marginTop: 12 }}
                onClick={() => setHistoryRetryKey((k) => k + 1)}
              >
                Retry
              </button>
            </div>
          ) : feedLogs.length === 0 ? (
            <div style={{
              padding: '36px 16px',
              textAlign: 'center',
              background: 'var(--gray-50)',
              borderRadius: 10,
              border: '1px solid var(--gray-200)',
              color: 'var(--gray-500)',
            }}>
              <p style={{ margin: 0, fontWeight: 500, fontSize: '14px' }}>
                No feed load history recorded for this farm.
              </p>
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>Feed Added (Kg)</th>
                    <th>Stock After Load (Kg)</th>
                    <th>Recorded By / Notes</th>
                    <th style={{ textAlign: 'center', width: 140 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {feedLogs.map((log) => (
                    <tr key={log.logId}>
                      <td className="td-bold" style={{ whiteSpace: 'nowrap' }}>
                        {formatDisplayDate(log.loadedAt) || '--'}
                        {typeof log.loadedAt === 'string' && log.loadedAt.includes('T') && (
                          <div style={{ fontSize: '12px', color: 'var(--gray-400)', fontWeight: 'normal', marginTop: 2 }}>
                            {formatTime(log.loadedAt)}
                          </div>
                        )}
                      </td>
                      <td>
                        <span style={{
                          display: 'inline-block',
                          padding: '3px 8px',
                          fontSize: '13px',
                          fontWeight: 700,
                          borderRadius: '6px',
                          background: '#ecfdf5',
                          color: '#065f46',
                          border: '1px solid #a7f3d0',
                        }}>
                          +{log.quantityKg.toLocaleString()} Kg
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {typeof log.newStockKg === 'number' ? `${log.newStockKg.toLocaleString()} Kg` : '--'}
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>
                          {log.notes || <span style={{ color: 'var(--gray-400)' }}>--</span>}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--gray-500)', marginTop: 2 }}>
                          By: {usersMap[log.recordedBy] || log.recordedBy || 'Admin'}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <button
                            type="button"
                            className="btn btn--outline btn--sm"
                            style={{ padding: '4px 10px', fontSize: '12px' }}
                            onClick={() => handleStartEdit(log)}
                            disabled={submitting || deleting}
                            title="Edit this record"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn--danger btn--sm"
                            style={{ padding: '4px 10px', fontSize: '12px' }}
                            onClick={() => handleRequestDelete(log)}
                            disabled={submitting || deleting}
                            title="Delete this record"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* DELETE CONFIRMATION MODAL */}
        {logToDelete && (
          <div
            className="farmer-modal-overlay"
            onClick={() => {
              if (!deleting) setLogToDelete(null);
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-modal-title"
          >
            <div className="farmer-modal-card" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="farmer-modal-close"
                onClick={() => setLogToDelete(null)}
                disabled={deleting}
                aria-label="Close"
              >
                <X size={18} />
              </button>

              <div
                className="farmer-modal-icon-badge"
                style={{ background: '#fef2f2', color: '#dc2626', borderColor: '#fecaca' }}
              >
                <AlertTriangle size={26} strokeWidth={2.5} />
              </div>

              <h3 id="delete-modal-title" className="farmer-modal-title">
                Delete Feed Load Record?
              </h3>

              <p className="farmer-modal-desc" style={{ color: '#475569', lineHeight: 1.5, marginBottom: 16 }}>
                Are you sure you want to delete this feed load record? This will deduct{' '}
                <strong>{logToDelete.quantityKg.toLocaleString()} Kg</strong> from the farm's current stock.
              </p>

              <div className="farmer-modal-tiles" style={{ marginBottom: 16 }}>
                <div className="farmer-modal-tile">
                  <span className="farmer-modal-tile-label">Farm</span>
                  <span className="farmer-modal-tile-value">
                    {selectedFarm?.name || selectedFarmId} ({selectedFarmId})
                  </span>
                </div>
                <div className="farmer-modal-tile">
                  <span className="farmer-modal-tile-label">Record Date & Time</span>
                  <span className="farmer-modal-tile-value">
                    {formatDisplayDate(logToDelete.loadedAt) || '--'}
                    {typeof logToDelete.loadedAt === 'string' && logToDelete.loadedAt.includes('T') ? ` at ${formatTime(logToDelete.loadedAt)}` : ''}
                  </span>
                </div>
                <div className="farmer-modal-tile">
                  <span className="farmer-modal-tile-label">Current Feed Stock</span>
                  <span className="farmer-modal-tile-value">
                    {(selectedFarm?.currentFeedStockKg ?? 0).toLocaleString()} Kg
                  </span>
                </div>
                <div className="farmer-modal-tile">
                  <span className="farmer-modal-tile-label">Stock After Deletion</span>
                  <span className="farmer-modal-tile-value" style={{
                    color: (selectedFarm?.currentFeedStockKg ?? 0) < logToDelete.quantityKg ? '#dc2626' : undefined,
                  }}>
                    {Math.max(0, (selectedFarm?.currentFeedStockKg ?? 0) - logToDelete.quantityKg).toLocaleString()} Kg
                  </span>
                </div>
              </div>

              {(selectedFarm?.currentFeedStockKg ?? 0) < logToDelete.quantityKg && (
                <div style={{
                  padding: '8px 12px',
                  marginBottom: 16,
                  background: '#fef2f2',
                  borderRadius: 8,
                  border: '1px solid #fecaca',
                  fontSize: '13px',
                  color: '#991b1b',
                  textAlign: 'left',
                }}>
                  Cannot delete: Current stock is less than the quantity to deduct. Feed has already been consumed.
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                <button
                  type="button"
                  className="btn btn--outline btn--full"
                  onClick={() => setLogToDelete(null)}
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn--danger btn--full"
                  onClick={handleConfirmDelete}
                  disabled={deleting || (selectedFarm?.currentFeedStockKg ?? 0) < logToDelete.quantityKg}
                >
                  {deleting ? <span className="spinner" /> : 'Yes, Delete Record'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
