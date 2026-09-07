import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/dashboard/DashboardLayout';
import { Sidebar } from '../../components/dashboard/Sidebar';
import { LanguageSelector } from '../../components/LanguageSelector';
import { subscribeToAllFlocks, type FlockDoc } from '../../services/flockDataService';
import { subscribeToAllFarms, type FarmDoc } from '../../services/farmDataService';
import { generatePredictions, type DailyDataPoint, type PredictionResult } from '../../services/predictionService';
import { getProductionCurve } from '../../data/productionCurves';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Area, AreaChart,
} from 'recharts';
import { useDailyReportsByFarms } from '../../hooks/useDailyReports';
import { getIstDate, getDaysAgo } from '../../utils/dateUtils';

export function PredictionPage() {
  const { t } = useTranslation();
  const { userProfile } = useAuth();
  const [flocks, setFlocks] = useState<FlockDoc[]>([]);
  const [farms, setFarms] = useState<FarmDoc[]>([]);
  const [selectedFlockId, setSelectedFlockId] = useState('');
  const [forecastDays, setForecastDays] = useState(14);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [historicalData, setHistoricalData] = useState<any[]>([]);

  useEffect(() => {
    const unsub1 = subscribeToAllFlocks((f) => setFlocks(f.filter((fl) => fl.status === 'active')));
    const unsub2 = subscribeToAllFarms((f) => setFarms(f));
    return () => { unsub1(); unsub2(); };
  }, []);

  const selectedFlock = flocks.find((fl) => fl.flockId === selectedFlockId);
  
  // Load historical data using hooks
  const startDate = getDaysAgo(60);
  const { reports, loading: reportsLoading } = useDailyReportsByFarms(
    selectedFlock ? [selectedFlock.farmId] : [],
    startDate,
    getIstDate()
  );

  useEffect(() => {
    if (!selectedFlockId || !selectedFlock) {
      setHistoricalData([]);
      setResult(null);
      return;
    }

    const data: DailyDataPoint[] = reports
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
      .sort((a, b) => a.date.localeCompare(b.date)); // ensure chronological order
      
    setHistoricalData(data);
  }, [reports, selectedFlockId, selectedFlock]);

  const handleGenerate = () => {
    if (!selectedFlock || historicalData.length === 0) return;
    setLoading(true);

    const targetFarm = farms.find(f => f.farmId === selectedFlock.farmId);
    const liveBirdCount = targetFarm?.currentBirdCount ?? selectedFlock.currentBirds;

    const predResult = generatePredictions({
      historicalData,
      currentBirds: liveBirdCount,
      flockStartDate: selectedFlock.startDate,
      curveType: selectedFlock.productionCurve,
      forecastDays,
    });

    setResult(predResult);
    setLoading(false);
  };

  // Prepare chart data combining historical + predictions
  const chartData = (() => {
    if (!result) return [];
    const combined: any[] = [];

    // Historical data points
    historicalData.forEach((d) => {
      combined.push({
        date: d.date.slice(5),
        actual: d.productionPct,
        predicted: null,
        standard: null,
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
        standard: p.standardPct,
        upper: p.upperPct,
        lower: p.lowerPct,
      });
    });

    return combined;
  })();

  const farmName = (farmId: string) => farms.find((f) => f.farmId === farmId)?.name || farmId;

  return (
    <>
      <DashboardLayout role="admin">
        <div className="page-header">
          <h1>{t('prediction.title')}</h1>
          <LanguageSelector />
        </div>

        <div className="prediction-controls" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
            <label>{t('prediction.selectFlock')}</label>
            <select
              value={selectedFlockId}
              onChange={(e) => setSelectedFlockId(e.target.value)}
              className="form-input"
            >
              <option value="">{t('prediction.selectFlock')}</option>
              {flocks.map((fl) => (
                <option key={fl.flockId} value={fl.flockId}>
                  {fl.flockName} ({farmName(fl.farmId)}) - {t('flock.ageWeeks')}: {fl.currentAgeWeeks}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
            <label>{t('prediction.selectPeriod')}</label>
            <select
              value={forecastDays}
              onChange={(e) => setForecastDays(Number(e.target.value))}
              className="form-input"
            >
              <option value={7}>{t('prediction.next7Days')}</option>
              <option value={14}>{t('prediction.next14Days')}</option>
              <option value={21}>{t('prediction.next21Days')}</option>
              <option value={30}>{t('prediction.next30Days')}</option>
            </select>
          </div>

          <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              className="btn btn-primary"
              onClick={handleGenerate}
              disabled={!selectedFlockId || historicalData.length === 0 || loading}
            >
              {loading ? t('common.loading') : t('prediction.generateForecast')}
            </button>
          </div>
        </div>

        {!selectedFlockId && (
          <div className="empty-state" style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>
            <p>{t('prediction.noFlockSelected')}</p>
          </div>
        )}

        {selectedFlockId && historicalData.length === 0 && (
          <div className="empty-state" style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>
            <p>{t('prediction.insufficientData')}</p>
          </div>
        )}

        {result && (
          <>
            {/* Data Quality Banner */}
            {result.dataQuality !== 'reliable' && (
              <div className="alert alert-warning" style={{
                padding: '0.75rem 1rem',
                background: '#fff3cd',
                border: '1px solid #ffc107',
                borderRadius: '8px',
                marginBottom: '1rem',
                color: '#856404',
              }}>
                ⚠️ {result.dataQuality === 'insufficient'
                  ? t('prediction.insufficientData')
                  : t('prediction.preliminaryForecast')}
              </div>
            )}

            {/* KPI Summary Cards */}
            <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div className="kpi-card">
                <div className="kpi-card-label">{t('prediction.currentProduction')}</div>
                <div className="kpi-card-value">{result.lastActualPct}%</div>
              </div>
              {result.predictions.length > 0 && (
                <>
                  <div className="kpi-card">
                    <div className="kpi-card-label">{t('prediction.predictedProduction')}</div>
                    <div className="kpi-card-value">{result.predictions[result.predictions.length - 1].predictedPct}%</div>
                  </div>
                  <div className="kpi-card">
                    <div className="kpi-card-label">{t('prediction.standardProduction')}</div>
                    <div className="kpi-card-value">{result.predictions[0].standardPct}%</div>
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
            <div className="chart-card">
              <h3>{t('charts.actualVsPredicted')}</h3>
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="upper" stroke="none" fill="#e3f2fd" fillOpacity={0.5} name={t('charts.upper')} />
                  <Area type="monotone" dataKey="lower" stroke="none" fill="#fff" fillOpacity={1} name={t('charts.lower')} />
                  <Line type="monotone" dataKey="actual" stroke="#1976d2" strokeWidth={2} dot={{ r: 3 }} name={t('charts.actual')} connectNulls={false} />
                  <Line type="monotone" dataKey="predicted" stroke="#e91e63" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} name={t('charts.predicted')} connectNulls={false} />
                  <Line type="monotone" dataKey="standard" stroke="#4caf50" strokeWidth={1.5} strokeDasharray="8 4" dot={false} name={t('charts.standard')} connectNulls={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Prediction Table */}
            <div className="table-card">
              <h3>{t('prediction.predictionRange')}</h3>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th>{t('common.date')}</th>
                    <th>{t('flock.ageWeeks')}</th>
                    <th>{t('prediction.predictedPct')}</th>
                    <th>{t('prediction.predictedEggs')}</th>
                    <th>{t('prediction.expectedBirds')}</th>
                    <th>{t('prediction.standardProduction')}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.predictions.map((p, i) => (
                    <tr key={i}>
                      <td>{p.date}</td>
                      <td>{p.ageWeeks}</td>
                      <td style={{ color: p.predictedPct > p.standardPct ? '#4caf50' : '#f44336' }}>
                        {p.predictedPct}%
                      </td>
                      <td>{p.predictedEggs.toLocaleString()}</td>
                      <td>{p.expectedBirds.toLocaleString()}</td>
                      <td>{p.standardPct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </DashboardLayout>
    </>
  );
}
