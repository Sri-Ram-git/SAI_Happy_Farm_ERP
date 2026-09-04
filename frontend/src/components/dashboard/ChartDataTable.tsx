import { formatDisplayDate } from '../../utils/dateUtils';

export type ChartType = 'production' | 'mortality' | 'feed' | 'eggQuality' | 'bodyWeight' | 'temperature' | 'submission' | 'birds';

interface ChartDataTableProps {
  chartType: ChartType;
  chartData: any[];
  farmFilter?: string;
  flockFilter?: string;
}

export function ChartDataTable({ chartType, chartData, farmFilter, flockFilter }: ChartDataTableProps) {
  if (!chartData || chartData.length === 0) {
    return <div className="text-muted" style={{ padding: 20, textAlign: 'center' }}>No data available for the selected period.</div>;
  }

  const farmLabel = farmFilter ? `Farm ${farmFilter}` : 'All Farms';
  const flockLabel = flockFilter ? `Flock ${flockFilter}` : 'All Flocks';

  switch (chartType) {
    case 'production':
      return (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Farm Scope</th>
                <th>Flock Scope</th>
                <th>Actual Production %</th>
                <th>Standard Target %</th>
                <th>Target Variance</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((d) => {
                const variance = d.production !== null && d.standardProduction !== null
                  ? Number((d.production - d.standardProduction).toFixed(1))
                  : null;
                return (
                  <tr key={d.fullDate}>
                    <td className="td-bold">{formatDisplayDate(d.fullDate)}</td>
                    <td>{farmLabel}</td>
                    <td>{flockLabel}</td>
                    <td style={{ fontWeight: 600, color: d.production !== null && d.production >= 70 ? '#15803d' : '#d97706' }}>
                      {d.production !== null ? `${d.production}%` : 'No Data'}
                    </td>
                    <td style={{ color: '#64748b' }}>{d.standardProduction !== null ? `${d.standardProduction}%` : '--'}</td>
                    <td>
                      {variance !== null ? (
                        <span style={{ color: variance >= 0 ? '#15803d' : '#dc2626', fontWeight: 600 }}>
                          {variance >= 0 ? `+${variance}%` : `${variance}%`}
                        </span>
                      ) : '--'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );

    case 'mortality':
      return (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Farm Scope</th>
                <th>Flock Scope</th>
                <th>Mortality Count</th>
                <th>Culling Count</th>
                <th>Mortality Rate %</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((d) => (
                <tr key={d.fullDate}>
                  <td className="td-bold">{formatDisplayDate(d.fullDate)}</td>
                  <td>{farmLabel}</td>
                  <td>{flockLabel}</td>
                  <td style={{ color: '#dc2626', fontWeight: 600 }}>{d.mortalityCount?.toLocaleString() ?? 0}</td>
                  <td style={{ color: '#d97706' }}>{d.cullingCount?.toLocaleString() ?? 0}</td>
                  <td style={{ fontWeight: 600, color: d.mortality !== null && d.mortality > 2.0 ? '#dc2626' : '#15803d' }}>
                    {d.mortality !== null ? `${d.mortality}%` : 'No Data'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case 'feed':
      return (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Farm Scope</th>
                <th>Flock Scope</th>
                <th>Total Feed (Kg)</th>
                <th>Feed / Bird (g/day)</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((d) => (
                <tr key={d.fullDate}>
                  <td className="td-bold">{formatDisplayDate(d.fullDate)}</td>
                  <td>{farmLabel}</td>
                  <td>{flockLabel}</td>
                  <td style={{ fontWeight: 600, color: '#d97706' }}>{d.feedKg !== null ? `${d.feedKg.toLocaleString()} Kg` : '--'}</td>
                  <td>{d.feedPerBirdG !== null ? `${d.feedPerBirdG.toFixed(0)} g` : 'No Data'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case 'eggQuality':
      return (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Avg Egg Weight (g)</th>
                <th>Min Egg Weight (g)</th>
                <th>Max Egg Weight (g)</th>
                <th>Selection Quality %</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((d) => (
                <tr key={d.fullDate}>
                  <td className="td-bold">{formatDisplayDate(d.fullDate)}</td>
                  <td style={{ fontWeight: 600, color: '#0284c7' }}>{d.eggWtAvg !== null ? `${d.eggWtAvg.toFixed(1)} g` : 'No Data'}</td>
                  <td>{d.eggWtMin !== null ? `${d.eggWtMin.toFixed(1)} g` : '--'}</td>
                  <td>{d.eggWtMax !== null ? `${d.eggWtMax.toFixed(1)} g` : '--'}</td>
                  <td style={{ fontWeight: 600, color: d.selectionPct !== null && d.selectionPct >= 80 ? '#15803d' : '#d97706' }}>
                    {d.selectionPct !== null ? `${d.selectionPct}%` : '--'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case 'bodyWeight':
      return (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Avg Body Weight (g)</th>
                <th>Min Body Weight (g)</th>
                <th>Max Body Weight (g)</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((d) => (
                <tr key={d.fullDate}>
                  <td className="td-bold">{formatDisplayDate(d.fullDate)}</td>
                  <td style={{ fontWeight: 600, color: '#8b5cf6' }}>{d.bodyWtAvg !== null ? `${d.bodyWtAvg.toFixed(0)} g` : 'No Data'}</td>
                  <td>{d.bodyWtMin !== null ? `${d.bodyWtMin.toFixed(0)} g` : '--'}</td>
                  <td>{d.bodyWtMax !== null ? `${d.bodyWtMax.toFixed(0)} g` : '--'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case 'temperature':
      return (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Avg Temperature (°C)</th>
                <th>Max Temperature (°C)</th>
                <th>Comfort Status</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((d) => {
                const temp = d.tempAvg;
                let status = 'Comfortable';
                let color = '#15803d';

                if (temp !== null) {
                  if (temp > 34) {
                    status = 'Extreme Heat';
                    color = '#dc2626';
                  } else if (temp > 30) {
                    status = 'Warm Spikes';
                    color = '#d97706';
                  } else if (temp < 18) {
                    status = 'Cold Drop';
                    color = '#0284c7';
                  }
                }

                return (
                  <tr key={d.fullDate}>
                    <td className="td-bold">{formatDisplayDate(d.fullDate)}</td>
                    <td style={{ fontWeight: 600 }}>{d.tempAvg !== null ? `${d.tempAvg.toFixed(1)}°C` : 'No Data'}</td>
                    <td>{d.tempMax !== null ? `${d.tempMax.toFixed(1)}°C` : '--'}</td>
                    <td>
                      <span className="ent-status-tag" style={{ background: `${color}15`, color, border: `1px solid ${color}40` }}>
                        {temp !== null ? status : 'No Data'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );

    case 'submission':
      return (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Expected Submissions</th>
                <th>Submitted Reports</th>
                <th>Missing Reports</th>
                <th>Compliance %</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((d) => {
                const total = d.submitted + d.missing;
                const pct = total > 0 ? Math.round((d.submitted / total) * 100) : 0;
                return (
                  <tr key={d.fullDate}>
                    <td className="td-bold">{formatDisplayDate(d.fullDate)}</td>
                    <td>{total}</td>
                    <td style={{ fontWeight: 600, color: '#15803d' }}>{d.submitted}</td>
                    <td style={{ color: d.missing > 0 ? '#dc2626' : '#64748b' }}>{d.missing}</td>
                    <td>
                      <span className="ent-status-tag" style={{ background: pct >= 80 ? '#dcfce7' : '#fffbeb', color: pct >= 80 ? '#15803d' : '#d97706' }}>
                        {pct}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );

    default:
      return null;
  }
}
