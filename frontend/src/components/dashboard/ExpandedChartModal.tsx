import { useState, useEffect, type ReactNode } from 'react';
import { ChartDataTable, type ChartType } from './ChartDataTable';
import { CalculationDetails } from './CalculationDetails';
import { X, BarChart3, Table, Calculator, Filter, Calendar } from 'lucide-react';

interface ExpandedChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  chartType: ChartType;
  chartTitle: string;
  chartSub: string;
  chartData: any[];
  days: number;
  farmFilter?: string;
  flockFilter?: string;
  standardCurveType?: 'CF_STD' | 'FR_STD';
  onStandardCurveChange?: (type: 'CF_STD' | 'FR_STD') => void;
  renderChartContent: () => ReactNode;
}

type TabType = 'chart' | 'table' | 'formula';

export function ExpandedChartModal({
  isOpen,
  onClose,
  chartType,
  chartTitle,
  chartSub,
  chartData,
  days,
  farmFilter,
  flockFilter,
  standardCurveType,
  onStandardCurveChange,
  renderChartContent,
}: ExpandedChartModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('chart');

  // Handle ESC key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const farmLabel = farmFilter ? `Farm ${farmFilter}` : 'All Authorized Farms';
  const flockLabel = flockFilter ? `Flock ${flockFilter}` : 'All Flocks';
  const rangeLabel = days === 1 ? 'Today' : `Last ${days} Days`;

  return (
    <div className="chart-modal-backdrop" onClick={onClose}>
      <div className="chart-modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* MODAL HEADER */}
        <div className="chart-modal-header">
          <div>
            <h3 className="chart-modal-title">{chartTitle}</h3>
            <p className="chart-modal-sub">{chartSub}</p>
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
          <div className="chart-modal-tabs">
            <button
              className={`chart-modal-tab ${activeTab === 'chart' ? 'chart-modal-tab--active' : ''}`}
              onClick={() => setActiveTab('chart')}
            >
              <BarChart3 size={15} />
              <span>Chart View</span>
            </button>

            <button
              className={`chart-modal-tab ${activeTab === 'table' ? 'chart-modal-tab--active' : ''}`}
              onClick={() => setActiveTab('table')}
            >
              <Table size={15} />
              <span>Data Table ({chartData.length})</span>
            </button>

            <button
              className={`chart-modal-tab ${activeTab === 'formula' ? 'chart-modal-tab--active' : ''}`}
              onClick={() => setActiveTab('formula')}
            >
              <Calculator size={15} />
              <span>How Calculated</span>
            </button>
          </div>
        </div>

        {/* MODAL BODY */}
        <div className="chart-modal-body">
          {activeTab === 'chart' && (
            <div className="chart-expanded-wrapper">
              {chartType === 'production' && onStandardCurveChange && standardCurveType && (
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
              {renderChartContent()}
            </div>
          )}

          {activeTab === 'table' && (
            <div className="chart-table-wrapper">
              <ChartDataTable
                chartType={chartType}
                chartData={chartData}
                farmFilter={farmFilter}
                flockFilter={flockFilter}
              />
            </div>
          )}

          {activeTab === 'formula' && (
            <div className="chart-formula-wrapper">
              <CalculationDetails chartType={chartType} standardCurveType={standardCurveType} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
