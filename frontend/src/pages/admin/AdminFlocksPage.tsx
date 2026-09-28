import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/dashboard/DashboardLayout';
import { LoadingState } from '../../components/dashboard/LoadingState';
import { EmptyState } from '../../components/dashboard/EmptyState';
import {
  subscribeToAllFlocks,
  createFlock,
  updateFlock,
  calculateFlockAgeWeeks,
  type FlockDoc,
} from '../../services/flockDataService';
import { subscribeToAllFarms, type FarmDoc } from '../../services/farmDataService';
import { getIstDate, formatDisplayDate } from '../../utils/dateUtils';
import {
  Plus,
  Search,
  Filter,
  Layers,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  X,
  ChevronDown,
  ChevronUp,
  Info,
  Check,
} from 'lucide-react';

export function AdminFlocksPage() {
  const { t } = useTranslation();
  const { userProfile } = useAuth();

  const [flocks, setFlocks] = useState<FlockDoc[]>([]);
  const [farms, setFarms] = useState<FarmDoc[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filters
  const [selectedFarmId, setSelectedFarmId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Expandable farm flock history state
  const [expandedFarms, setExpandedFarms] = useState<Record<string, boolean>>({});

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form Fields
  const [formFarmId, setFormFarmId] = useState('');
  const [formFlockName, setFormFlockName] = useState('');
  const [formInitialBirds, setFormInitialBirds] = useState('');
  const [formStartDate, setFormStartDate] = useState(getIstDate());
  const [formBreedType, setFormBreedType] = useState('BV-300');
  const [formProductionCurve, setFormProductionCurve] = useState<'CF_STD' | 'FR_STD'>('CF_STD');
  const [formNotes, setFormNotes] = useState('');

  // Realtime Subscriptions
  useEffect(() => {
    let farmsLoaded = false;
    let flocksLoaded = false;

    const checkLoadingDone = () => {
      if (farmsLoaded && flocksLoaded) {
        setInitialLoading(false);
      }
    };

    const unsubFlocks = subscribeToAllFlocks((f) => {
      setFlocks(f);
      flocksLoaded = true;
      checkLoadingDone();
    });

    const unsubFarms = subscribeToAllFarms((f) => {
      setFarms(f);
      farmsLoaded = true;
      checkLoadingDone();
    });

    return () => {
      unsubFlocks();
      unsubFarms();
    };
  }, []);

  // Map farms and their associated flocks
  const farmMap = useMemo(() => {
    const map = new Map<string, FarmDoc>();
    farms.forEach((farm) => map.set(farm.farmId, farm));
    return map;
  }, [farms]);

  // Group flocks by farmId
  const flocksByFarm = useMemo(() => {
    const map = new Map<string, FlockDoc[]>();
    flocks.forEach((flock) => {
      const list = map.get(flock.farmId) || [];
      list.push(flock);
      map.set(flock.farmId, list);
    });
    return map;
  }, [flocks]);

  // Filtered farms based on selected farm and search query
  const filteredFarms = useMemo(() => {
    return farms.filter((farm) => {
      if (selectedFarmId !== 'all' && farm.farmId !== selectedFarmId) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesFarmName = farm.name?.toLowerCase().includes(q);
        const matchesFarmId = farm.farmId?.toLowerCase().includes(q);
        const farmFlocks = flocksByFarm.get(farm.farmId) || [];
        const matchesFlock = farmFlocks.some((fl) => fl.flockName?.toLowerCase().includes(q));
        return matchesFarmName || matchesFarmId || matchesFlock;
      }
      return true;
    });
  }, [farms, selectedFarmId, searchQuery, flocksByFarm]);

  // Summary Metrics across filtered farms
  const summaryMetrics = useMemo(() => {
    let totalBirds = 0;
    let totalActiveFlocks = 0;

    filteredFarms.forEach((farm) => {
      const currentCount = Number(farm.currentBirdCount ?? 0);
      totalBirds += currentCount;
      const farmFlocks = flocksByFarm.get(farm.farmId) || [];
      const activeCount = farmFlocks.filter((f) => f.status === 'active').length;
      totalActiveFlocks += activeCount;
    });

    return {
      farmCount: filteredFarms.length,
      totalBirds,
      totalActiveFlocks,
    };
  }, [filteredFarms, flocksByFarm]);

  // Helper to handle farm selection change inside the modal
  const handleSelectFarmInModal = (targetFarmId: string) => {
    setFormFarmId(targetFarmId);
    if (!targetFarmId) {
      setFormFlockName('');
      setFormInitialBirds('');
      return;
    }

    const farmFlocks = flocksByFarm.get(targetFarmId) || [];
    const isInitial = farmFlocks.length === 0;
    const targetFarm = farmMap.get(targetFarmId);
    const initialCount = Number(targetFarm?.initialBirdCount ?? targetFarm?.totalBirds ?? 0);
    const currentCount = Number(targetFarm?.currentBirdCount ?? targetFarm?.currentBirds ?? initialCount);

    if (isInitial) {
      setFormFlockName('Flock 1');
      // For initial flock, read authoritative initial bird count directly from the farm record
      const resolvedInitial = initialCount > 0 ? initialCount : currentCount;
      setFormInitialBirds(resolvedInitial > 0 ? String(resolvedInitial) : '');
    } else {
      const batchNum = farmFlocks.length + 1;
      setFormFlockName(`Flock ${batchNum}`);
      setFormInitialBirds(''); // Empty for Admin to enter NEW batch bird count
    }
  };

  // Open Global Add Flock Modal
  const openAddFlockModal = (preselectedFarmId?: string) => {
    const targetFarmId = preselectedFarmId || (farms.length > 0 ? farms[0].farmId : '');
    setFormStartDate(getIstDate());
    setFormBreedType('BV-300');
    setFormProductionCurve('CF_STD');
    setFormNotes('');
    setFormError(null);
    handleSelectFarmInModal(targetFarmId);
    setIsModalOpen(true);
  };

  // Details for currently selected farm in modal form
  const modalTargetFarmFlocks = useMemo(() => {
    if (!formFarmId) return [];
    return flocksByFarm.get(formFarmId) || [];
  }, [formFarmId, flocksByFarm]);

  const isModalInitialFlock = modalTargetFarmFlocks.length === 0;
  const nextBatchNumber = modalTargetFarmFlocks.length + 1;
  const targetFarmDoc = farmMap.get(formFarmId);
  const targetFarmInitialBirds = Number(targetFarmDoc?.initialBirdCount ?? targetFarmDoc?.totalBirds ?? 0);
  const targetFarmCurrentBirds = Number(targetFarmDoc?.currentBirdCount ?? targetFarmDoc?.currentBirds ?? targetFarmInitialBirds);

  // Toggle card history expansion
  const toggleFarmExpansion = (farmId: string) => {
    setExpandedFarms((prev) => ({
      ...prev,
      [farmId]: !prev[farmId],
    }));
  };

  // Handle Form Submission
  const handleSaveFlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setFormError(null);

    if (!formFarmId) {
      setFormError('Please select a farm.');
      return;
    }

    let birdCount: number;
    if (isModalInitialFlock) {
      // Authoritative rule: Initial flock initialBirds comes directly from farm document's initialBirdCount
      birdCount = targetFarmInitialBirds > 0 ? targetFarmInitialBirds : parseInt(formInitialBirds, 10);
      if (isNaN(birdCount) || birdCount <= 0) {
        setFormError('Please enter a valid initial bird count.');
        return;
      }
    } else {
      birdCount = parseInt(formInitialBirds, 10);
      if (isNaN(birdCount) || birdCount <= 0) {
        setFormError('Please enter a valid positive number for new batch bird count.');
        return;
      }
    }

    if (!formStartDate) {
      setFormError('Please select the arrival/start date.');
      return;
    }

    setSubmitting(true);

    try {
      await createFlock({
        farmId: formFarmId,
        flockName: formFlockName.trim() || undefined,
        initialBirds: birdCount,
        startDate: formStartDate,
        breedType: formBreedType.trim() || 'BV-300',
        productionCurve: formProductionCurve,
        notes: formNotes.trim() || undefined,
      });

      setIsModalOpen(false);
      const actionText = isModalInitialFlock
        ? `established initial Flock 1 (${birdCount.toLocaleString()} initial birds, ${targetFarmCurrentBirds.toLocaleString()} current birds)`
        : `added new Flock batch ${formFlockName.trim() || `Flock ${nextBatchNumber}`} (+${birdCount.toLocaleString()} birds)`;

      setSuccessMessage(
        `Successfully ${actionText} for farm ${targetFarmDoc?.name || formFarmId}.`
      );
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      console.error('[AdminFlocksPage] Error creating flock:', err);
      setFormError(err.message || 'Failed to create flock. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle Flock Active / Completed Status
  const handleToggleStatus = async (flock: FlockDoc) => {
    const nextStatus = flock.status === 'active' ? 'completed' : 'active';
    const actionLabel = nextStatus === 'completed' ? 'mark as completed' : 'reactivate';

    if (window.confirm(`Are you sure you want to ${actionLabel} "${flock.flockName}"?`)) {
      try {
        await updateFlock(flock.flockId, { status: nextStatus });
        setSuccessMessage(`Updated status of "${flock.flockName}" to ${nextStatus}.`);
        setTimeout(() => setSuccessMessage(null), 4000);
      } catch (err: any) {
        console.error('Error updating flock status:', err);
        alert('Failed to update flock status: ' + err.message);
      }
    }
  };

  if (initialLoading) {
    return (
      <DashboardLayout role="admin" userName={userProfile?.name}>
        <LoadingState />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin" userName={userProfile?.name}>
      <div className="mgmt-page">
        {/* Feedback Banners */}
        {loadError && (
          <div className="alert alert--error" style={{ marginBottom: 16 }}>
            <AlertTriangle size={18} />
            <span>{loadError}</span>
          </div>
        )}

        {successMessage && (
          <div
            className="alert"
            style={{
              marginBottom: 16,
              background: '#ecfdf5',
              color: '#065f46',
              border: '1px solid #a7f3d0',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 16px',
              borderRadius: '8px',
            }}
          >
            <CheckCircle2 size={18} color="#059669" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Page Header with ONE Global Button */}
        <div className="mgmt-page-header">
          <div>
            <h2>{t('admin.flockManagement')}</h2>
            <p className="welcome-subtitle">Manage bird batches, flock lifecycles, and arrival history across farms</p>
          </div>
          <div className="header-controls">
            <button
              className="btn btn--primary flock-create-btn"
              onClick={() => openAddFlockModal()}
            >
              <Plus size={17} />
              <span>{t('admin.createFlock')}</span>
            </button>
          </div>
        </div>

        {/* Summary Metric Stats Bar */}
        <div className="kpi-grid stats-grid flock-kpi-grid">
          <div className="kpi-card">
            <div className="kpi-title" style={{ marginBottom: '6px' }}>Monitored Farms</div>
            <div className="kpi-value">{summaryMetrics.farmCount}</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-title" style={{ marginBottom: '6px' }}>Active Flocks / Batches</div>
            <div className="kpi-value" style={{ color: '#0284c7' }}>{summaryMetrics.totalActiveFlocks}</div>
          </div>

          <div className="kpi-card flock-kpi-total">
            <div className="flock-kpi-total-inner">
              <div className="kpi-title">TOTAL BIRD POPULATION</div>
              <div className="kpi-value" style={{ color: '#16a34a' }}>
                {summaryMetrics.totalBirds.toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* Filter / Search Bar */}
        <div className="flock-filter-card">
          <div className="flock-filter-row">
            <div className="flock-filter-farm-col">
              <Filter size={15} className="flock-filter-icon" />
              <select
                className="form-input flock-filter-select"
                value={selectedFarmId}
                onChange={(e) => setSelectedFarmId(e.target.value)}
              >
                <option value="all">All Farms ({farms.length})</option>
                {farms.map((farm) => (
                  <option key={farm.farmId} value={farm.farmId}>
                    {farm.farmId} — {farm.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flock-filter-search-col">
              <Search size={15} className="flock-search-icon" />
              <input
                type="text"
                className="form-input flock-filter-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search farm, flock..."
              />
            </div>

            {(selectedFarmId !== 'all' || searchQuery) && (
              <button
                type="button"
                className="btn btn--outline btn--sm flock-filter-reset-btn"
                onClick={() => {
                  setSelectedFarmId('all');
                  setSearchQuery('');
                }}
                title="Reset Filters"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Informational Farm Cards & Scoped Flock History */}
        {filteredFarms.length === 0 ? (
          <EmptyState message="No farms match the selected filter or search." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {filteredFarms.map((farm) => {
              const farmFlocks = flocksByFarm.get(farm.farmId) || [];
              const activeCount = farmFlocks.filter((f) => f.status === 'active').length;
              const currentBirds = Number(farm.currentBirdCount ?? 0);
              const isExpanded = Boolean(expandedFarms[farm.farmId]); // collapsed by default

              return (
                <div
                  key={farm.farmId}
                  style={{
                    background: 'var(--card-bg, #ffffff)',
                    border: '1px solid var(--border-color, #e2e8f0)',
                    borderRadius: '12px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    overflow: 'hidden',
                  }}
                >
                  {/* Farm Header Bar */}
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '16px 20px',
                      background: 'var(--header-bg, #f8fafc)',
                      borderBottom: isExpanded ? '1px solid var(--border-color, #e2e8f0)' : 'none',
                      gap: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: '#e0e7ff',
                          color: '#4338ca',
                          fontWeight: 700,
                          fontSize: '13px',
                          padding: '4px 10px',
                          borderRadius: '6px',
                        }}
                      >
                        {farm.farmId}
                      </span>
                      <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: 'var(--text-primary, #1e293b)' }}>
                        {farm.name}
                      </h3>
                      <span
                        className={`status-badge ${farm.active ? 'status-badge--ok' : 'status-badge--warn'}`}
                        style={{ fontSize: '11px', padding: '2px 8px' }}
                      >
                        {farm.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    {/* Stats & View History Toggle */}
                    <div className="farm-header-stats-wrap">
                      <div className="farm-stats-microstrip">
                        <div className="farm-microstat">
                          <div className="farm-microstat-label">Current Birds</div>
                          <div className="farm-microstat-val" style={{ color: '#16a34a' }}>
                            {currentBirds.toLocaleString()}
                          </div>
                        </div>

                        <div className="farm-microstat">
                          <div className="farm-microstat-label">Active Flocks</div>
                          <div className="farm-microstat-val" style={{ color: '#0284c7' }}>
                            {activeCount}
                          </div>
                        </div>

                        <div className="farm-microstat">
                          <div className="farm-microstat-label">Flock History</div>
                          <div className="farm-microstat-val" style={{ color: '#475569' }}>
                            {farmFlocks.length}
                          </div>
                        </div>
                      </div>

                      <button
                        className="btn btn--outline btn--sm farm-history-toggle-btn"
                        onClick={() => toggleFarmExpansion(farm.farmId)}
                      >
                        <span>{isExpanded ? 'Hide History' : 'View History'}</span>
                        {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </button>
                    </div>
                  </div>

                  {/* Scoped Flock History Table (when expanded) */}
                  {isExpanded && (
                    <div style={{ padding: '16px 20px' }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '12px',
                        }}
                      >
                        <div
                          style={{
                            fontSize: '13px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            color: '#64748b',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <Layers size={15} />
                          <span>Flock History ({farmFlocks.length})</span>
                        </div>
                      </div>

                      {farmFlocks.length === 0 ? (
                        <div
                          style={{
                            padding: '24px',
                            textAlign: 'center',
                            background: '#f8fafc',
                            borderRadius: '8px',
                            border: '1px dashed #cbd5e1',
                          }}
                        >
                          <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
                            No flock records established for this farm yet. Click <strong>&quot;+ Create Flock&quot;</strong> at the top to set up this farm&apos;s initial flock.
                          </p>
                        </div>
                      ) : (
                        <div className="table-responsive">
                          <table className="data-table" style={{ width: '100%', margin: 0 }}>
                            <thead>
                              <tr>
                                <th>Flock Batch</th>
                                <th>Initial Birds</th>
                                <th>Current Birds</th>
                                <th>Arrival Date & Age</th>
                                <th>Breed & Standard</th>
                                <th>Status</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {farmFlocks.map((flock, index) => {
                                const isInitial = flock.isInitialFlock || index === 0;
                                const ageWeeks = flock.currentAgeWeeks || calculateFlockAgeWeeks(flock.startDate);

                                return (
                                  <tr key={flock.flockId}>
                                    <td>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontWeight: 600, color: 'var(--text-primary, #1e293b)' }}>
                                          {flock.flockName}
                                        </span>
                                        {isInitial ? (
                                          <span
                                            style={{
                                              fontSize: '11px',
                                              fontWeight: 600,
                                              padding: '2px 6px',
                                              background: '#dbeafe',
                                              color: '#1d4ed8',
                                              borderRadius: '4px',
                                            }}
                                          >
                                            Initial / Default
                                          </span>
                                        ) : (
                                          <span
                                            style={{
                                              fontSize: '11px',
                                              fontWeight: 600,
                                              padding: '2px 6px',
                                              background: '#f1f5f9',
                                              color: '#475569',
                                              borderRadius: '4px',
                                            }}
                                          >
                                            Batch #{flock.batchNumber || index + 1}
                                          </span>
                                        )}
                                      </div>
                                      {flock.notes && (
                                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                                          {flock.notes}
                                        </div>
                                      )}
                                    </td>
                                    <td className="td-bold">
                                      {flock.initialBirds.toLocaleString()}
                                    </td>
                                    <td style={{ color: flock.currentBirds > 0 ? '#16a34a' : '#94a3b8', fontWeight: 600 }}>
                                      {flock.currentBirds.toLocaleString()}
                                    </td>
                                    <td>
                                      <div>{formatDisplayDate(flock.startDate)}</div>
                                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                                        {ageWeeks} {t('flock.ageWeeks')}
                                      </div>
                                    </td>
                                    <td>
                                      <div>{flock.breedType || 'BV-300'}</div>
                                      <div style={{ fontSize: '11px', color: '#0284c7', fontWeight: 500 }}>
                                        {flock.productionCurve || 'CF_STD'}
                                      </div>
                                    </td>
                                    <td>
                                      <span
                                        className={`status-badge ${
                                          flock.status === 'active' ? 'status-badge--ok' : 'status-badge--warn'
                                        }`}
                                      >
                                        {flock.status === 'active' ? 'Active' : 'Completed'}
                                      </span>
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                      <button
                                        className="btn btn--outline btn--sm"
                                        onClick={() => handleToggleStatus(flock)}
                                        style={{
                                          fontSize: '12px',
                                          padding: '4px 10px',
                                        }}
                                      >
                                        {flock.status === 'active' ? 'Mark Completed' : 'Reactivate'}
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Add / Create Flock Modal */}
        {isModalOpen && (
          <div
            className="chart-modal-backdrop"
            onClick={() => !submitting && setIsModalOpen(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '16px',
            }}
          >
            <div
              className="chart-modal-dialog"
              onClick={(e) => e.stopPropagation()}
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                width: '100%',
                maxWidth: '520px',
                maxHeight: 'calc(100dvh - 24px)',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                overflow: 'hidden',
              }}
            >
              {/* Modal Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 20px',
                  borderBottom: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  flexShrink: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Layers size={20} color="#2563eb" />
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#1e293b' }}>
                    {isModalInitialFlock ? 'Establish Initial Flock' : 'Add New Flock Batch'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => !submitting && setIsModalOpen(false)}
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
              <form onSubmit={handleSaveFlock} style={{ padding: '20px', flex: '1 1 auto', overflowY: 'auto', minHeight: 0 }}>
                {formError && (
                  <div
                    style={{
                      marginBottom: '16px',
                      color: '#b91c1c',
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      padding: '10px 14px',
                      borderRadius: '6px',
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <AlertTriangle size={16} color="#dc2626" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Farm Selector (First Field) */}
                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>
                    Farm *
                  </label>
                  <select
                    className="form-select"
                    value={formFarmId}
                    onChange={(e) => handleSelectFarmInModal(e.target.value)}
                    required
                  >
                    <option value="">Select a farm...</option>
                    {farms.map((farm) => {
                      const currentCount = Number(farm.currentBirdCount ?? 0);
                      const initialCount = Number(farm.initialBirdCount ?? farm.totalBirds ?? 0);
                      const fFlocks = flocksByFarm.get(farm.farmId) || [];
                      const flockStatusText = fFlocks.length === 0
                        ? `No flock setup · ${initialCount.toLocaleString()} init / ${currentCount.toLocaleString()} live`
                        : `${fFlocks.length} flock(s) · ${currentCount.toLocaleString()} live`;
                      return (
                        <option key={farm.farmId} value={farm.farmId}>
                          {farm.farmId} — {farm.name} ({flockStatusText})
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Context banner explaining initial vs batch addition */}
                {formFarmId && (
                  <div
                    style={{
                      marginBottom: '16px',
                      padding: '12px 14px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      lineHeight: '1.45',
                      background: isModalInitialFlock ? '#eff6ff' : '#f0fdf4',
                      border: `1px solid ${isModalInitialFlock ? '#bfdbfe' : '#bbf7d0'}`,
                      color: isModalInitialFlock ? '#1e40af' : '#166534',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                    }}
                  >
                    <Info size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      {isModalInitialFlock ? (
                        <span>
                          <strong>Establish Initial Flock (Flock 1):</strong> This farm has an authoritative initial placement of{' '}
                          <strong>{targetFarmInitialBirds.toLocaleString()} birds</strong> recorded in Firestore (with{' '}
                          <strong>{targetFarmCurrentBirds.toLocaleString()} live birds</strong> currently remaining).
                          Establishing the initial flock will persist <strong>Flock 1</strong> to represent this initial population.
                          The farm&apos;s current bird count will <strong>not</strong> be modified or doubled.
                        </span>
                      ) : (
                        <span>
                          <strong>Add New Batch (Flock {nextBatchNumber}):</strong> Current Farm Population is{' '}
                          <strong>{targetFarmCurrentBirds.toLocaleString()} birds</strong> across {modalTargetFarmFlocks.length} flock batch(es).
                          Entering a new flock batch will add new birds to the farm&apos;s live total while preserving earlier flock history.
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Flock Name */}
                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>
                    Flock Name / Identifier <span style={{ color: '#64748b', fontWeight: 400 }}>(Optional)</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={formFlockName}
                    onChange={(e) => setFormFlockName(e.target.value)}
                    placeholder={isModalInitialFlock ? 'Flock 1 (Default)' : `Flock ${nextBatchNumber}`}
                    style={{ width: '100%', padding: '9px 12px', fontSize: '14px' }}
                  />
                </div>

                {/* Bird Count & Date Added */}
                {isModalInitialFlock ? (
                  <div style={{ marginBottom: '14px' }}>
                    {targetFarmInitialBirds > 0 ? (
                      <div style={{ marginBottom: '14px' }}>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>
                          Bird Counts (Read directly from Farm Record)
                        </label>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '12px',
                            padding: '12px 14px',
                            background: '#f8fafc',
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0',
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>
                              Initial Bird Count
                            </div>
                            <div style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', marginTop: '2px' }}>
                              {targetFarmInitialBirds.toLocaleString()}{' '}
                              <span style={{ fontSize: '12px', fontWeight: 500, color: '#64748b' }}>birds</span>
                            </div>
                            <div style={{ fontSize: '11px', color: '#0284c7', marginTop: '2px' }}>
                              Flock 1 Initial Placement
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>
                              Current Bird Count
                            </div>
                            <div style={{ fontSize: '18px', fontWeight: 700, color: '#16a34a', marginTop: '2px' }}>
                              {targetFarmCurrentBirds.toLocaleString()}{' '}
                              <span style={{ fontSize: '12px', fontWeight: 500, color: '#64748b' }}>birds</span>
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                              Current Live Population
                            </div>
                          </div>
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
                          ✓ Read directly from Firestore farm record. No need to re-type.
                        </div>
                      </div>
                    ) : (
                      <div className="form-group" style={{ marginBottom: '14px' }}>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>
                          Initial Bird Count *
                        </label>
                        <input
                          type="number"
                          className="form-input"
                          value={formInitialBirds}
                          onChange={(e) => setFormInitialBirds(e.target.value)}
                          placeholder="e.g. 2000"
                          min="1"
                          required
                          style={{ width: '100%', padding: '9px 12px', fontSize: '14px' }}
                        />
                      </div>
                    )}

                    <div className="form-group">
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>
                        Flock Placement / Start Date *
                      </label>
                      <input
                        type="date"
                        className="form-input"
                        value={formStartDate}
                        onChange={(e) => setFormStartDate(e.target.value)}
                        required
                        style={{ width: '100%', padding: '9px 12px', fontSize: '14px' }}
                      />
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                    <div className="form-group">
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>
                        New Batch Bird Count *
                      </label>
                      <input
                        type="number"
                        className="form-input"
                        value={formInitialBirds}
                        onChange={(e) => setFormInitialBirds(e.target.value)}
                        placeholder="e.g. 300"
                        min="1"
                        required
                        style={{ width: '100%', padding: '9px 12px', fontSize: '14px' }}
                      />
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                        Farm population will increase from {targetFarmCurrentBirds.toLocaleString()} to{' '}
                        <strong>
                          {(
                            targetFarmCurrentBirds + (parseInt(formInitialBirds, 10) || 0)
                          ).toLocaleString()}{' '}
                          birds
                        </strong>
                      </div>
                    </div>

                    <div className="form-group">
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>
                        Arrival / Start Date *
                      </label>
                      <input
                        type="date"
                        className="form-input"
                        value={formStartDate}
                        onChange={(e) => setFormStartDate(e.target.value)}
                        required
                        style={{ width: '100%', padding: '9px 12px', fontSize: '14px' }}
                      />
                    </div>
                  </div>
                )}

                {/* Breed Type & Production Curve */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                  <div className="form-group">
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>
                      Breed / Type
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={formBreedType}
                      onChange={(e) => setFormBreedType(e.target.value)}
                      placeholder="e.g. BV-300, Cobb"
                      style={{ width: '100%', padding: '9px 12px', fontSize: '14px' }}
                    />
                  </div>

                  <div className="form-group">
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>
                      Production Curve Standard
                    </label>
                    <select
                      className="form-select"
                      value={formProductionCurve}
                      onChange={(e) => setFormProductionCurve(e.target.value as 'CF_STD' | 'FR_STD')}
                    >
                      <option value="CF_STD">Cobb Female (CF STD)</option>
                      <option value="FR_STD">Ross Female (FR STD)</option>
                    </select>
                  </div>
                </div>

                {/* Notes */}
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>
                    Notes / Batch Remarks <span style={{ color: '#64748b', fontWeight: 400 }}>(Optional)</span>
                  </label>
                  <textarea
                    className="form-input"
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="e.g. Initial flock placement, supplier details..."
                    rows={2}
                    style={{ width: '100%', padding: '8px 12px', fontSize: '14px', resize: 'vertical' }}
                  />
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn btn--outline"
                    onClick={() => setIsModalOpen(false)}
                    disabled={submitting}
                    style={{ padding: '9px 18px' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn--primary"
                    disabled={submitting}
                    style={{
                      padding: '9px 22px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontWeight: 600,
                    }}
                  >
                    {submitting ? (
                      <span>Saving Flock...</span>
                    ) : (
                      <>
                        {isModalInitialFlock ? <Check size={16} /> : <Plus size={16} />}
                        <span>{isModalInitialFlock ? 'Establish Initial Flock' : 'Add New Flock Batch'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
