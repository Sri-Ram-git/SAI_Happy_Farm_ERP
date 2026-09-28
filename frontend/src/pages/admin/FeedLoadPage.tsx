import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/dashboard/DashboardLayout';
import { LoadingState } from '../../components/dashboard/LoadingState';
import { EmptyState } from '../../components/dashboard/EmptyState';
import { getAllFarms, type FarmDoc } from '../../services/farmDataService';
import {
  getFeedInventory,
  addFeedLoad,
  subscribeToFeedLogsByFarm,
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

  // Feed load history state
  const [feedLogs, setFeedLogs] = useState<FeedLogDoc[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [usersMap, setUsersMap] = useState<Record<string, string>>({});

  const farmIdsKey = userProfile?.farmIds ? userProfile.farmIds.slice().sort().join(',') : '';

  // Load farms
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const allFarms = await getAllFarms();
        const farmIds = role === 'supervisor' ? (userProfile?.farmIds ?? []) : allFarms.map((f) => f.farmId);
        const filteredFarms = allFarms.filter((f) => farmIds.includes(f.farmId));

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
      return;
    }

    setLoadingLogs(true);
    const unsubscribe = subscribeToFeedLogsByFarm(selectedFarmId, (logs) => {
      setFeedLogs(logs);
      setLoadingLogs(false);
    });

    return () => {
      unsubscribe();
    };
  }, [selectedFarmId]);

  const selectedFarm = farms.find((f) => f.farmId === selectedFarmId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedFarmId) {
      setError('Please select a farm.');
      return;
    }

    const kg = Number(feedKg);
    if (isNaN(kg) || kg <= 0) {
      setError('Please enter a valid feed quantity in Kg.');
      return;
    }

    setSubmitting(true);
    try {
      await addFeedLoad(selectedFarmId, kg, userProfile!.uid, notes);
      const farmName = farms.find((f) => f.farmId === selectedFarmId)?.name || selectedFarmId;
      setSuccess(`${kg} Kg feed loaded for ${farmName}.`);
      setFeedKg('');
      setNotes('');

      setFarms((prev) =>
        prev.map((f) =>
          f.farmId === selectedFarmId
            ? {
                ...f,
                currentFeedStockKg: f.currentFeedStockKg + kg,
                totalFeedLoadedKg: f.totalFeedLoadedKg + kg,
                lastTransactionDate: getIstDate(),
              }
            : f
        )
      );
    } catch (err: any) {
      console.error('[FeedLoadPage] Submit error:', err);
      setError(
        err.message === 'FEED_INVENTORY_NOT_FOUND'
          ? 'Feed inventory not found for this farm. Initialize it first.'
          : 'Failed to record feed load. Please try again.'
      );
    } finally {
      setSubmitting(false);
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
                      onClick={() => setSelectedFarmId(farm.farmId)}
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
                      <td style={{ fontWeight: 600 }}>{farm.currentFeedStockKg.toLocaleString()} Kg</td>
                      <td>{farm.totalFeedLoadedKg.toLocaleString()} Kg</td>
                      <td>{farm.lastTransactionDate ? formatDisplayDate(farm.lastTransactionDate) : '--'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="section-card" style={{ marginBottom: 24 }}>
          <h3>Add Feed Load</h3>
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Select Farm</label>
              <select
                value={selectedFarmId}
                onChange={(e) => setSelectedFarmId(e.target.value)}
                className="form-select"
              >
                <option value="">-- Choose a farm --</option>
                {farms.map((farm) => (
                  <option key={farm.farmId} value={farm.farmId}>
                    {farm.farmId} - {farm.name || 'Unnamed'} (Stock: {farm.currentFeedStockKg.toLocaleString()} Kg)
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Feed Quantity (Kg)</label>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.1"
                value={feedKg}
                onChange={(e) => setFeedKg(e.target.value)}
                placeholder="e.g. 500"
              />
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

            <button
              type="submit"
              className="btn btn--primary btn--full"
              disabled={submitting}
              style={{ marginTop: 8 }}
            >
              {submitting ? <span className="spinner" /> : 'Record Feed Load'}
            </button>
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
                Current Stock: {selectedFarm.currentFeedStockKg.toLocaleString()} Kg
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
                  </tr>
                </thead>
                <tbody>
                  {feedLogs.map((log) => (
                    <tr key={log.logId}>
                      <td className="td-bold" style={{ whiteSpace: 'nowrap' }}>
                        {formatDisplayDate(log.loadedAt)}
                        <div style={{ fontSize: '12px', color: 'var(--gray-400)', fontWeight: 'normal', marginTop: 2 }}>
                          {formatTime(log.loadedAt)}
                        </div>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
