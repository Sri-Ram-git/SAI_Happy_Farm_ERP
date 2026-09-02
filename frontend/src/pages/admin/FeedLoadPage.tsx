import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/dashboard/DashboardLayout';
import { LoadingState } from '../../components/dashboard/LoadingState';
import { EmptyState } from '../../components/dashboard/EmptyState';
import { getAllFarms, type FarmDoc } from '../../services/farmDataService';
import { getFeedInventory, addFeedLoad } from '../../services/inventoryService';
import { formatDisplayDate, getIstDate } from '../../utils/dateUtils';

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
  const [selectedFarmId, setSelectedFarmId] = useState('');
  const [feedKg, setFeedKg] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

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
  }, [role, userProfile?.farmIds]);

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
            ? { ...f, currentFeedStockKg: f.currentFeedStockKg + kg, totalFeedLoadedKg: f.totalFeedLoadedKg + kg }
            : f
        )
      );
    } catch (err: any) {
      console.error('[FeedLoadPage] Submit error:', err);
      setError(err.message === 'FEED_INVENTORY_NOT_FOUND'
        ? 'Feed inventory not found for this farm. Initialize it first.'
        : 'Failed to record feed load. Please try again.');
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
          <h3>Current Feed Stock</h3>
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
                {farms.map((farm) => (
                  <tr key={farm.farmId}>
                    <td className="td-bold">{farm.farmId}</td>
                    <td>{farm.name || 'Unnamed'}</td>
                    <td>{farm.currentFeedStockKg.toLocaleString()}</td>
                    <td>{farm.totalFeedLoadedKg.toLocaleString()}</td>
                    <td>{farm.lastTransactionDate ? formatDisplayDate(farm.lastTransactionDate) : '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="section-card">
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
                    {farm.farmId} - {farm.name || 'Unnamed'} (Stock: {farm.currentFeedStockKg} Kg)
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
      </div>
    </DashboardLayout>
  );
}
