import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/dashboard/DashboardLayout';
import { Sidebar } from '../../components/dashboard/Sidebar';
import { LanguageSelector } from '../../components/LanguageSelector';
import { subscribeToAllFlocks, createFlock, updateFlock, type FlockDoc } from '../../services/flockDataService';
import { subscribeToAllFarms, type FarmDoc } from '../../services/farmDataService';

export function AdminFlocksPage() {
  const { t } = useTranslation();
  const { userProfile } = useAuth();
  const [flocks, setFlocks] = useState<FlockDoc[]>([]);
  const [farms, setFarms] = useState<FarmDoc[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [newFlock, setNewFlock] = useState({
    farmId: '',
    flockName: '',
    initialBirds: '',
    startDate: '',
    breedType: '',
    productionCurve: 'CF_STD' as 'CF_STD' | 'FR_STD',
  });

  useEffect(() => {
    const unsub1 = subscribeToAllFlocks((f) => setFlocks(f));
    const unsub2 = subscribeToAllFarms((f) => setFarms(f));
    return () => { unsub1(); unsub2(); };
  }, []);

  const handleCreateFlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!newFlock.farmId || !newFlock.flockName || !newFlock.initialBirds || !newFlock.startDate || !newFlock.breedType) {
        throw new Error(t('validation.required'));
      }
      
      const birds = parseInt(newFlock.initialBirds, 10);
      if (isNaN(birds) || birds <= 0) {
        throw new Error(t('validation.invalidWholeNumber'));
      }

      await createFlock({
        ...newFlock,
        initialBirds: birds,
      });

      setIsCreateModalOpen(false);
      setNewFlock({
        farmId: '',
        flockName: '',
        initialBirds: '',
        startDate: '',
        breedType: '',
        productionCurve: 'CF_STD',
      });
    } catch (err: any) {
      setError(err.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const toggleFlockStatus = async (flockId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'active' ? 'completed' : 'active';
      await updateFlock(flockId, { status: newStatus });
    } catch (err: any) {
      console.error('Error toggling status', err);
      alert(t('common.error') + ': ' + err.message);
    }
  };

  const getFarmName = (farmId: string) => farms.find(f => f.farmId === farmId)?.name || farmId;

  return (
    <>
      <DashboardLayout role="admin" userName={userProfile?.name}>
        <div className="mgmt-page-header">
          <div>
            <h2>{t('admin.flockManagement')}</h2>
            <p className="welcome-subtitle">{t('admin.allFlocks')}</p>
          </div>
          <div className="header-controls">
            <LanguageSelector />
            <button className="btn btn--primary" onClick={() => setIsCreateModalOpen(true)}>
              {t('admin.createFlock')}
            </button>
          </div>
        </div>

        <div className="table-card table-responsive">
          {flocks.length === 0 ? (
            <div className="empty-state">{t('admin.noFlocksFound')}</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('flock.flockName')}</th>
                  <th>{t('flock.farm')}</th>
                  <th>{t('flock.initialBirds')}</th>
                  <th>{t('flock.currentBirds')}</th>
                  <th>{t('flock.startDate')} (Age)</th>
                  <th>{t('flock.breedType')} / Curve</th>
                  <th>{t('admin.status')}</th>
                  <th>{t('admin.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {flocks.map(flock => (
                  <tr key={flock.flockId}>
                    <td className="td-bold">{flock.flockName}</td>
                    <td>{getFarmName(flock.farmId)}</td>
                    <td>{flock.initialBirds.toLocaleString()}</td>
                    <td>{flock.currentBirds.toLocaleString()}</td>
                    <td>
                      {flock.startDate}
                      <br/>
                      <small style={{ color: '#888' }}>{flock.currentAgeWeeks} {t('flock.ageWeeks')}</small>
                    </td>
                    <td>
                      {flock.breedType}
                      <br/>
                      <small style={{ color: '#1976d2' }}>{flock.productionCurve}</small>
                    </td>
                    <td>
                      <span className={`status-badge ${flock.status === 'active' ? 'status-badge--ok' : 'status-badge--warn'}`}>
                        {flock.status === 'active' ? t('flock.active') : t('flock.completed')}
                      </span>
                    </td>
                    <td>
                      <button 
                        className="btn btn--sm" 
                        onClick={() => toggleFlockStatus(flock.flockId, flock.status)}
                      >
                        {flock.status === 'active' ? t('admin.deactivate') : t('admin.activate')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Create Flock Modal */}
        {isCreateModalOpen && (
          <div className="chart-modal-backdrop" onClick={() => setIsCreateModalOpen(false)}>
            <div className="chart-modal-dialog" onClick={(e) => e.stopPropagation()} style={{ padding: '1.5rem', maxWidth: '500px' }}>
              <h2>{t('flock.create')}</h2>
              
              {error && <div className="alert alert-error" style={{ marginBottom: '1rem', color: '#d32f2f', background: '#ffebee', padding: '0.75rem', borderRadius: '4px' }}>{error}</div>}
              
              <form onSubmit={handleCreateFlock} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label>{t('flock.flockName')}</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newFlock.flockName}
                    onChange={e => setNewFlock({...newFlock, flockName: e.target.value})}
                    placeholder="e.g. Batch A - 2024"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>{t('flock.farm')}</label>
                  <select 
                    className="form-input"
                    value={newFlock.farmId}
                    onChange={e => setNewFlock({...newFlock, farmId: e.target.value})}
                    required
                  >
                    <option value="">{t('common.filterByFarm')}</option>
                    {farms.map(f => (
                      <option key={f.farmId} value={f.farmId}>{f.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>{t('flock.initialBirds')}</label>
                  <input
                    type="number"
                    className="form-input"
                    value={newFlock.initialBirds}
                    onChange={e => setNewFlock({...newFlock, initialBirds: e.target.value})}
                    min="1"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>{t('flock.startDate')}</label>
                  <input
                    type="date"
                    className="form-input"
                    value={newFlock.startDate}
                    onChange={e => setNewFlock({...newFlock, startDate: e.target.value})}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>{t('flock.breedType')}</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newFlock.breedType}
                    onChange={e => setNewFlock({...newFlock, breedType: e.target.value})}
                    placeholder="e.g. Cobb, Ross"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>{t('admin.productionCurve')}</label>
                  <select 
                    className="form-input"
                    value={newFlock.productionCurve}
                    onChange={e => setNewFlock({...newFlock, productionCurve: e.target.value as any})}
                    required
                  >
                    <option value="CF_STD">Cobb Female Standard (CF STD)</option>
                    <option value="FR_STD">Ross Female Standard (FR STD)</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setIsCreateModalOpen(false)} style={{ flex: 1 }}>
                    {t('common.cancel')}
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 1 }}>
                    {loading ? t('common.loading') : t('common.save')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </DashboardLayout>
    </>
  );
}
