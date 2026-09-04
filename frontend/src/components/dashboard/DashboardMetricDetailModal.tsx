import { useState, useEffect, type ReactNode } from 'react';
import { ChartDataTable, type ChartType } from './ChartDataTable';
import { CalculationDetails } from './CalculationDetails';
import { X, BarChart3, Table, Calculator, Filter, Calendar, Users, AlertTriangle } from 'lucide-react';
import { formatDisplayDate } from '../../utils/dateUtils';
import type { FarmDoc } from '../../services/farmDataService';
import type { UserDoc } from '../../services/userDataService';
import type { ReportDoc } from '../../services/reportDataService';
import type { BirdInventory } from '../../services/inventoryService';

interface DashboardMetricDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  metricType: ChartType;
  title: string;
  subtitle: string;
  
  // Data props
  chartData: any[]; // Time-series array
  days: number;
  farmFilter?: string;
  flockFilter?: string;
  
  // Specific data for new tabs
  activeFarms?: FarmDoc[];
  farmInventories?: Map<string, BirdInventory>;
  reports?: ReportDoc[];
  submissionMatrix?: {
    expected: { date: string; farm: FarmDoc; farmer?: UserDoc }[];
    submitted: { date: string; farm: FarmDoc; farmer?: UserDoc; report: ReportDoc }[];
    missing: { date: string; farm: FarmDoc; farmer?: UserDoc }[];
  };

  standardCurveType?: 'CF_STD' | 'FR_STD';
  onStandardCurveChange?: (type: 'CF_STD' | 'FR_STD') => void;
  renderChartContent: () => ReactNode;
}

type TabType = 'chart' | 'table' | 'formula' | 'submission_summary' | 'submitted_reports' | 'missing_reports' | 'birds_list';

export function DashboardMetricDetailModal({
  isOpen,
  onClose,
  metricType,
  title,
  subtitle,
  chartData,
  days,
  farmFilter,
  flockFilter,
  activeFarms = [],
  farmInventories = new Map(),
  reports = [],
  submissionMatrix,
  standardCurveType,
  onStandardCurveChange,
  renderChartContent,
}: DashboardMetricDetailModalProps) {
  // Default to summary for submission, table for birds, chart for others
  const [activeTab, setActiveTab] = useState<TabType>('chart');

  useEffect(() => {
    if (isOpen) {
      if (metricType === 'submission') setActiveTab('submission_summary');
      else if (metricType === 'birds') setActiveTab('birds_list');
      else setActiveTab('chart');
    }
  }, [isOpen, metricType]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const farmLabel = farmFilter ? `Farm ${farmFilter}` : 'All Authorized Farms';
  const flockLabel = flockFilter ? `Flock ${flockFilter}` : 'All Flocks';
  const rangeLabel = days === 1 ? 'Today' : `Last ${days} Days`;

  return (
    <div className="chart-modal-backdrop" onClick={onClose} style={{ zIndex: 9999 }}>
      <div className="chart-modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '1100px', width: '95%' }}>
        {/* MODAL HEADER */}
        <div className="chart-modal-header">
          <div>
            <h3 className="chart-modal-title">{title}</h3>
            <p className="chart-modal-sub">{subtitle}</p>
          </div>
          <button className="chart-modal-close" onClick={onClose} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        {/* ACTIVE FILTERS & CONTROLS TOOLBAR */}
        <div className="chart-modal-toolbar">
          <div className="chart-modal-filters">
            <span className="chart-modal-filter-chip">
              <Calendar size={13} />
              <span>{rangeLabel}</span>
            </span>
            <span className="chart-modal-filter-chip">
              <Filter size={13} />
              <span>{farmLabel}</span>
            </span>
            <span className="chart-modal-filter-chip">
              <Filter size={13} />
              <span>{flockLabel}</span>
            </span>
          </div>

          {/* TAB SEGMENTED CONTROL */}
          <div className="chart-modal-tabs" style={{ overflowX: 'auto', whiteSpace: 'nowrap', paddingBottom: '2px' }}>
            {metricType !== 'birds' && metricType !== 'submission' && (
              <button className={`chart-modal-tab ${activeTab === 'chart' ? 'chart-modal-tab--active' : ''}`} onClick={() => setActiveTab('chart')}>
                <BarChart3 size={15} /> <span>Chart View</span>
              </button>
            )}
            
            {metricType === 'submission' && (
              <>
                <button className={`chart-modal-tab ${activeTab === 'submission_summary' ? 'chart-modal-tab--active' : ''}`} onClick={() => setActiveTab('submission_summary')}>
                  <BarChart3 size={15} /> <span>Submission Summary</span>
                </button>
                <button className={`chart-modal-tab ${activeTab === 'submitted_reports' ? 'chart-modal-tab--active' : ''}`} onClick={() => setActiveTab('submitted_reports')}>
                  <Table size={15} /> <span>Submitted ({submissionMatrix?.submitted.length || 0})</span>
                </button>
                <button className={`chart-modal-tab ${activeTab === 'missing_reports' ? 'chart-modal-tab--active' : ''}`} onClick={() => setActiveTab('missing_reports')}>
                  <AlertTriangle size={15} /> <span>Missing ({submissionMatrix?.missing.length || 0})</span>
                </button>
              </>
            )}

            {metricType === 'birds' && (
              <button className={`chart-modal-tab ${activeTab === 'birds_list' ? 'chart-modal-tab--active' : ''}`} onClick={() => setActiveTab('birds_list')}>
                <Users size={15} /> <span>Population Breakdown ({activeFarms.length} Farms)</span>
              </button>
            )}

            {metricType !== 'birds' && metricType !== 'submission' && (
              <button className={`chart-modal-tab ${activeTab === 'table' ? 'chart-modal-tab--active' : ''}`} onClick={() => setActiveTab('table')}>
                <Table size={15} /> <span>Data Table ({chartData.length})</span>
              </button>
            )}

            <button className={`chart-modal-tab ${activeTab === 'formula' ? 'chart-modal-tab--active' : ''}`} onClick={() => setActiveTab('formula')}>
              <Calculator size={15} /> <span>Calculation & Source</span>
            </button>
          </div>
        </div>

        {/* MODAL BODY */}
        <div className="chart-modal-body" style={{ minHeight: '400px', maxHeight: '65vh', overflowY: 'auto' }}>
          
          {(activeTab === 'chart' || activeTab === 'submission_summary') && (
            <div className="chart-expanded-wrapper">
              {metricType === 'production' && onStandardCurveChange && standardCurveType && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                  <select
                    className="form-input form-input--sm"
                    value={standardCurveType}
                    onChange={(e) => onStandardCurveChange(e.target.value as any)}
                    style={{ width: 170 }}
                  >
                    <option value="CF_STD">CF STD (Cobb Target)</option>
                    <option value="FR_STD">FR STD (Ross Target)</option>
                  </select>
                </div>
              )}
              {metricType === 'submission' && submissionMatrix && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
                  <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Expected Reports</div>
                    <div style={{ fontSize: '32px', color: '#0f172a', fontWeight: 700 }}>{submissionMatrix.expected.length}</div>
                  </div>
                  <div style={{ background: '#f0fdf4', padding: '16px', borderRadius: '8px', border: '1px solid #bbf7d0', textAlign: 'center' }}>
                    <div style={{ fontSize: '13px', color: '#166534', fontWeight: 600, textTransform: 'uppercase' }}>Submitted Reports</div>
                    <div style={{ fontSize: '32px', color: '#15803d', fontWeight: 700 }}>{submissionMatrix.submitted.length}</div>
                  </div>
                  <div style={{ background: '#fef2f2', padding: '16px', borderRadius: '8px', border: '1px solid #fecaca', textAlign: 'center' }}>
                    <div style={{ fontSize: '13px', color: '#991b1b', fontWeight: 600, textTransform: 'uppercase' }}>Missing Reports</div>
                    <div style={{ fontSize: '32px', color: '#dc2626', fontWeight: 700 }}>{submissionMatrix.missing.length}</div>
                  </div>
                </div>
              )}
              {renderChartContent()}
            </div>
          )}

          {activeTab === 'table' && metricType !== 'birds' && metricType !== 'submission' && (
            <div className="chart-table-wrapper">
              <ChartDataTable chartType={metricType} chartData={chartData} farmFilter={farmFilter} flockFilter={flockFilter} />
            </div>
          )}

          {activeTab === 'submitted_reports' && submissionMatrix && (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Expected Date</th>
                    <th>Farmer Name</th>
                    <th>Farmer ID</th>
                    <th>Farm Name</th>
                    <th>Farm ID</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {submissionMatrix.submitted.map((s, idx) => (
                    <tr key={idx}>
                      <td className="td-bold">{formatDisplayDate(s.date)}</td>
                      <td>{s.farmer?.name || s.report.submittedBy || '--'}</td>
                      <td style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>{s.farmer?.uid || s.report.userId || '--'}</td>
                      <td>{s.farm.name || '--'}</td>
                      <td className="td-bold">{s.farm.farmId}</td>
                      <td><span className="ent-status-tag" style={{ background: '#dcfce7', color: '#15803d' }}>Submitted</span></td>
                    </tr>
                  ))}
                  {submissionMatrix.submitted.length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 30, color: '#64748b' }}>No submitted reports found for this period.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'missing_reports' && submissionMatrix && (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Expected Date</th>
                    <th>Farmer Name</th>
                    <th>Farmer ID</th>
                    <th>Farm Name</th>
                    <th>Farm ID</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {submissionMatrix.missing.map((m, idx) => (
                    <tr key={idx}>
                      <td className="td-bold">{formatDisplayDate(m.date)}</td>
                      <td>{m.farmer?.name || '--'}</td>
                      <td style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>{m.farmer?.uid || '--'}</td>
                      <td>{m.farm.name || '--'}</td>
                      <td className="td-bold">{m.farm.farmId}</td>
                      <td><span className="ent-status-tag" style={{ background: '#fef2f2', color: '#dc2626' }}>Missing</span></td>
                    </tr>
                  ))}
                  {submissionMatrix.missing.length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 30, color: '#64748b' }}>No missing reports! 100% submission compliance.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'birds_list' && (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Farm ID</th>
                    <th>Farm Name</th>
                    <th>Current Bird Count</th>
                    <th>Last Report Date</th>
                  </tr>
                </thead>
                <tbody>
                  {activeFarms.map((f) => {
                    const inv = farmInventories.get(f.farmId);
                    const lastRep = reports.filter(r => r.farmId === f.farmId).pop();
                    const liveBirds = inv?.currentBirdCount ?? lastRep?.closingBirdCount ?? (f as any).currentBirds ?? 0;
                    return (
                      <tr key={f.farmId}>
                        <td className="td-bold">{f.farmId}</td>
                        <td>{f.name || '--'}</td>
                        <td style={{ fontWeight: 600, color: '#0f172a' }}>{liveBirds.toLocaleString()}</td>
                        <td>{lastRep ? formatDisplayDate(lastRep.submissionDate) : 'No reports'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'formula' && (
            <div className="chart-formula-wrapper">
              <CalculationDetails chartType={metricType} standardCurveType={standardCurveType} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
