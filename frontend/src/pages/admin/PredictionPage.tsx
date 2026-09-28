import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/dashboard/DashboardLayout';
import { subscribeToAllFarms, type FarmDoc } from '../../services/farmDataService';
import { generatePredictions, type DailyDataPoint, type PredictionResult } from '../../services/predictionService';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Area, AreaChart,
} from 'recharts';
import { useDailyReportsByFarms } from '../../hooks/useDailyReports';
import { getIstDate, getDaysAgo } from '../../utils/dateUtils';

export function PredictionPage() {
  const { t } = useTranslation();
  const { userProfile } = useAuth();
  const [farms, setFarms] = useState<FarmDoc[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState('');
  const [forecastDays, setForecastDays] = useState(14);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [historicalData, setHistoricalData] = useState<DailyDataPoint[]>([]);

  // Dynamically load farms from Firebase
  useEffect(() => {
    const unsub = subscribeToAllFarms((f) => setFarms(f));
    return () => unsub();
  }, []);

  // Filter farms respecting authorization logic
  const accessibleFarms = useMemo(() => {
    if (userProfile?.role === 'admin') {
      return farms;
    }
    const assigned = new Set(userProfile?.farmIds || []);
    return farms.filter((f) => assigned.has(f.farmId));
  }, [farms, userProfile]);

  const selectedFarm = accessibleFarms.find((f) => f.farmId === selectedFarmId);

  // Authoritative current bird count from existing farm data
  const currentBirdCount = Number(selectedFarm?.currentBirdCount ?? selectedFarm?.currentBirds ?? 0);
  const hasValidBirdCount = selectedFarm !== undefined && currentBirdCount > 0;

  // Load historical production reports strictly scoped to selected farm
  const startDate = getDaysAgo(60);
  const { reports, loading: reportsLoading } = useDailyReportsByFarms(
    selectedFarmId ? [selectedFarmId] : [],
    startDate,
    getIstDate()
  );

  useEffect(() => {
    if (!selectedFarmId || !selectedFarm) {
      setHistoricalData([]);
      setResult(null);
      return;
    }

    const data: DailyDataPoint[] = reports
      .filter((r) => r.farmId === selectedFarmId) // strict farm isolation
      .map((r) => {
        const birdCount = r.birdCount || r.closingBirdCount || 0;
        const eggsProduced = r.eggsProduced || 0;
        return {
          date: r.submissionDate,
          eggsProduced,
          birdCount,
          productionPct: birdCount > 0 ? parseFloat(((eggsProduced / birdCount) * 100).toFixed(1)) : 0,
        };
      })
      .filter((d) => d.birdCount > 0)
      .sort((a, b) => a.date.localeCompare(b.date)); // chronological order

    setHistoricalData(data);
  }, [reports, selectedFarmId, selectedFarm]);

  const handleGenerate = () => {
    if (!selectedFarm || !hasValidBirdCount || historicalData.length === 0) return;
    setLoading(true);

    const predResult = generatePredictions({
      historicalData,
      currentBirds: currentBirdCount,
      forecastDays,
    });

    setResult(predResult);
    setLoading(false);
  };

  // Prepare chart data combining historical actuals + predictions
  const chartData = useMemo(() => {
    if (!result) return [];
    const combined: any[] = [];

    // Historical data points
    historicalData.forEach((d) => {
      combined.push({
        date: d.date.slice(5),
        actual: d.productionPct,
        predicted: null,
        upper: null,
        lower: null,
      });
    });

    // Prediction data points
    result.predictions.forEach((p) => {
      combined.push({
        date: p.date.slice(5),
        actual: null,
        predicted: p.predictedPct,
        upper: p.upperPct,
        lower: p.lowerPct,
      });
    });

    return combined;
  }, [result, historicalData]);

  return (
    <DashboardLayout role="admin" userName={userProfile?.name}>
      <div className="page-header">
        <h1>{t('prediction.title')}</h1>
      </div>

      {/* Prediction Controls */}
      <div className="prediction-controls" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem', alignItems: 'flex-end' }}>
        <div className="form-group" style={{ flex: 1, minWidth: '220px' }}>
          <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 600, color: 'var(--gray-700, #334155)', marginBottom: '6px' }}>
            {t('prediction.selectFarm') || 'Select Farm'}
          </label>
          <select
            id="farm-select"
            value={selectedFarmId}
            onChange={(e) => {
              setSelectedFarmId(e.target.value);
              setResult(null);
            }}
            className="form-select"
          >
            <option value="">{t('prediction.selectFarm') || 'Select Farm'}</option>
            {accessibleFarms.map((farm) => (
              <option key={farm.farmId} value={farm.farmId}>
                {farm.name} ({farm.farmId})
              </option>
            ))}
          </select>
        </div>

        <div className="form-group" style={{ flex: 1, minWidth: '180px' }}>
          <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 600, color: 'var(--gray-700, #334155)', marginBottom: '6px' }}>
            {t('prediction.selectPeriod')}
          </label>
          <select
            id="period-select"
            value={forecastDays}
            onChange={(e) => {
              setForecastDays(Number(e.target.value));
              setResult(null);
            }}
            className="form-select"
          >
            <option value={7}>{t('prediction.next7Days')}</option>
            <option value={14}>{t('prediction.next14Days')}</option>
            <option value={21}>{t('prediction.next21Days')}</option>
            <option value={30}>{t('prediction.next30Days')}</option>
          </select>
        </div>

        <div className="form-group" style={{ minWidth: '180px' }}>
          <button
            className="btn btn--primary"
            style={{ height: '44px', minHeight: '44px', width: '100%' }}
            onClick={handleGenerate}
            disabled={!selectedFarmId || !hasValidBirdCount || historicalData.length === 0 || loading || reportsLoading}
          >
            {loading ? t('common.loading') : t('prediction.generateForecast')}
          </button>
        </div>
      </div>

      {/* Selected Farm Information Card */}
      {selectedFarm && (
        <div
          className="section-card"
          style={{
            padding: '16px 20px',
            marginBottom: '1.5rem',
            background: 'var(--white, #ffffff)',
            border: '1px solid var(--gray-200, #e2e8f0)',
            borderRadius: '12px',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--gray-500, #64748b)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>
                Farm
              </div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--gray-900, #0f172a)' }}>
                {selectedFarm.name} ({selectedFarm.farmId})
              </div>
            </div>

            <div>
              <div style={{ fontSize: '12px', color: 'var(--gray-500, #64748b)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>
                {t('prediction.currentBirdPopulation') || 'Current Bird Population'}
              </div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: hasValidBirdCount ? 'var(--green-700, #059669)' : 'var(--red-600, #dc2626)' }}>
                {hasValidBirdCount ? currentBirdCount.toLocaleString() : 'Unavailable'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '12px', color: 'var(--gray-500, #64748b)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>
                {t('prediction.selectPeriod') || 'Prediction Period'}
              </div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--green-800, #047857)' }}>
                Next {forecastDays} Days
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty / Validation States */}
      {!selectedFarmId && (
        <div className="empty-state" style={{ padding: '3rem 2rem', textAlign: 'center', color: '#888' }}>
          <p>{t('prediction.noFarmSelected') || 'Please select a farm to generate predictions.'}</p>
        </div>
      )}

      {selectedFarmId && !hasValidBirdCount && (
        <div className="alert alert--error" style={{ marginBottom: '1.5rem' }}>
          {t('prediction.birdCountUnavailable') || 'Current bird count is unavailable for this farm.'}
        </div>
      )}

      {selectedFarmId && hasValidBirdCount && !reportsLoading && historicalData.length === 0 && (
        <div className="empty-state" style={{ padding: '3rem 2rem', textAlign: 'center', color: '#888' }}>
          <p>{t('prediction.insufficientHistoricalData') || 'Insufficient historical data to generate a reliable forecast for this farm.'}</p>
        </div>
      )}

      {/* Forecast Output */}
      {result && (
        <>
          {/* Data Quality Banner */}
          {result.dataQuality !== 'reliable' && (
            <div className="alert alert--warning" style={{ marginBottom: '1rem' }}>
              ⚠️ {result.dataQuality === 'insufficient'
                ? (t('prediction.insufficientHistoricalData') || 'Insufficient historical data to generate a reliable forecast for this farm.')
                : t('prediction.preliminaryForecast')}
            </div>
          )}

          {/* KPI Summary Cards */}
          <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
            <div className="kpi-card">
              <div className="kpi-card-label">{t('prediction.currentProduction')}</div>
              <div className="kpi-card-value">{result.lastActualPct}%</div>
            </div>
            {result.predictions.length > 0 && (
              <>
                <div className="kpi-card">
                  <div className="kpi-card-label">{t('prediction.predictedProduction')}</div>
                  <div className="kpi-card-value">
                    {(result.predictions.reduce((s, p) => s + p.predictedPct, 0) / result.predictions.length).toFixed(1)}%
                  </div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-card-label">{t('prediction.expectedEggs')}</div>
                  <div className="kpi-card-value">
                    {result.predictions.reduce((s, p) => s + p.predictedEggs, 0).toLocaleString()}
                  </div>
                </div>
              </>
            )}
            {result.accuracy && (
              <div className="kpi-card">
                <div className="kpi-card-label">{t('prediction.accuracy')}</div>
                <div className="kpi-card-value" style={{ fontSize: '0.85rem' }}>
                  MAE: {result.accuracy.mae} | MAPE: {result.accuracy.mape}%
                </div>
              </div>
            )}
          </div>

          {/* Chart */}
          <div className="section-card chart-card" style={{ marginBottom: '1.5rem', background: '#ffffff', padding: '20px', borderRadius: '12px' }}>
            <h3 style={{ marginBottom: '16px' }}>{t('charts.actualVsPredicted')}</h3>
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="upper" stroke="none" fill="#e3f2fd" fillOpacity={0.5} name={t('charts.upper') || 'Upper Bound'} />
                <Area type="monotone" dataKey="lower" stroke="none" fill="#fff" fillOpacity={1} name={t('charts.lower') || 'Lower Bound'} />
                <Line type="monotone" dataKey="actual" stroke="#1976d2" strokeWidth={2} dot={{ r: 3 }} name={t('charts.actual') || 'Actual %'} connectNulls={false} />
                <Line type="monotone" dataKey="predicted" stroke="#e91e63" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} name={t('charts.predicted') || 'Predicted %'} connectNulls={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Prediction Table */}
          <div className="section-card table-card" style={{ background: '#ffffff', padding: '20px', borderRadius: '12px' }}>
            <h3 style={{ marginBottom: '16px' }}>{t('prediction.predictionRange')}</h3>
            <div className="table-container" style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th>{t('common.date')}</th>
                    <th>{t('prediction.predictedPct')}</th>
                    <th>{t('prediction.predictedEggs')}</th>
                    <th>{t('prediction.expectedBirds')}</th>
                    <th>{t('charts.lower') || 'Lower'} %</th>
                    <th>{t('charts.upper') || 'Upper'} %</th>
                  </tr>
                </thead>
                <tbody>
                  {result.predictions.map((p, i) => (
                    <tr key={i}>
                      <td>{p.date}</td>
                      <td style={{ fontWeight: 600, color: 'var(--green-700, #059669)' }}>
                        {p.predictedPct}%
                      </td>
                      <td style={{ fontWeight: 600 }}>{p.predictedEggs.toLocaleString()}</td>
                      <td>{p.expectedBirds.toLocaleString()}</td>
                      <td style={{ color: 'var(--gray-500, #64748b)' }}>{p.lowerPct}%</td>
                      <td style={{ color: 'var(--gray-500, #64748b)' }}>{p.upperPct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
