import type { ChartType } from './ChartDataTable';
import { HelpCircle, Calculator, Database, Filter, Layers } from 'lucide-react';

interface CalculationDetailsProps {
  chartType: ChartType;
  standardCurveType?: 'CF_STD' | 'FR_STD';
}

export function CalculationDetails({ chartType, standardCurveType = 'CF_STD' }: CalculationDetailsProps) {
  const getFormulaInfo = () => {
    switch (chartType) {
      case 'production':
        return {
          title: 'Egg Production Rate % & Standard Target Variance',
          formula: 'Production Rate % = (Total Eggs Produced ÷ Opening Bird Count) × 100',
          dataSource: 'Daily farmer report (eggsProduced) & active flock opening bird count (openingBirdCount)',
          standardInfo: `Compared against ${standardCurveType.replace('_', ' ')} standard breeder production curve interpolated by flock age in weeks.`,
          units: 'Percentage (%)',
          aggregation: 'Average across reporting farms on each date in period.',
        };

      case 'mortality':
        return {
          title: 'Daily Mortality & Culling Tracking',
          formula: 'Mortality Rate % = (Daily Mortality Count ÷ Opening Bird Count) × 100',
          dataSource: 'Daily farmer report (mortality, culling, openingBirdCount)',
          standardInfo: 'Recommended operational target is ≤ 0.1% daily mortality (or ≤ 2.0% cumulative period mortality).',
          units: 'Bird Count & Percentage (%)',
          aggregation: 'Total daily count sum & average mortality percentage.',
        };

      case 'feed':
        return {
          title: 'Feed Consumption & Per-Bird Intake',
          formula: 'Feed / Bird (g/day) = (Total Feed Kg × 1000) ÷ Opening Bird Count',
          dataSource: 'Daily farmer report (feedKg) & opening bird population (openingBirdCount)',
          standardInfo: 'Estimated FCR (Feed Conversion Ratio) = Total Feed Kg ÷ (Total Eggs ÷ 12). Target: ~1.4 - 1.6 Kg/Dozen.',
          units: 'Kilograms (Kg) & Grams per Bird (g/bird/day)',
          aggregation: 'Daily total feed sum & per-bird intake average.',
        };

      case 'eggQuality':
        return {
          title: 'Egg Weight & Selection Quality',
          formula: 'Selection Egg % = (Selection Eggs ÷ Total Eggs Produced) × 100',
          dataSource: 'Daily farmer report egg weight sampling (eggWeight.min, max, avg) & selection eggs (selectionEggs)',
          standardInfo: 'Selection eggs represent grade-A hatchable/marketable eggs. Target: ≥ 85%.',
          units: 'Grams (g) & Percentage (%)',
          aggregation: 'Average weight sampling & selection percentage rate.',
        };

      case 'bodyWeight':
        return {
          title: 'Flock Body Weight Progression',
          formula: 'Avg Body Weight = Sum of sampled bird weights ÷ Sample count',
          dataSource: 'Weekly/Daily body weight sampling entries (bodyWeight.min, max, avg)',
          standardInfo: 'Monitors flock uniformity and growth curve target weight by age week.',
          units: 'Grams (g)',
          aggregation: 'Average weight across sampled birds.',
        };

      case 'temperature':
        return {
          title: 'Environmental Temperature Monitoring',
          formula: 'Avg Temp = Sum of temperature readings ÷ Report count',
          dataSource: 'Daily ambient temperature log (temperature, tempMin, tempMax)',
          standardInfo: 'Comfort band for laying hens is 18°C – 30°C. Temps > 34°C induce heat stress.',
          units: 'Degrees Celsius (°C)',
          aggregation: 'Daily min, max, and average temperature.',
        };

      case 'submission':
        return {
          title: 'Daily Report Submission Compliance Timeline',
          formula: 'Expected = Active Entities × Dates\nSubmitted = Unique actual dailyLogs documents found\nMissing = Expected - Submitted',
          dataSource: 'Firestore data layer via collectionGroup("dailyLogs")',
          standardInfo: 'Data Source: Firestore\nReport Source: dailyReports/{userId}/dailyLogs/{date}',
          units: 'Report Count & Percentage (%)',
          aggregation: 'Daily submitted vs missing count out of active farms.',
        };

      default:
        return {
          title: 'Metric Calculation',
          formula: 'Standard mathematical aggregation',
          dataSource: 'Firestore daily reports',
          standardInfo: 'Approved operational standards',
          units: 'Standard units',
          aggregation: 'Daily average',
        };
    }
  };

  const info = getFormulaInfo();

  return (
    <div className="calculation-details" style={{ background: '#f8fafc', padding: 20, borderRadius: 12, border: '1px solid #e2e8f0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Calculator size={20} style={{ color: '#059669' }} />
        <h4 style={{ margin: 0, fontSize: 16, color: '#0f172a', fontWeight: 700 }}>{info.title}</h4>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        <div style={{ background: '#ffffff', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>
            <Calculator size={14} style={{ color: '#10b981' }} />
            <span>Mathematical Formula</span>
          </div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#0f172a', background: '#f1f5f9', padding: '8px 10px', borderRadius: 6, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
            {info.formula}
          </p>
        </div>

        <div style={{ background: '#ffffff', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>
            <Database size={14} style={{ color: '#0284c7' }} />
            <span>Firestore Source Fields</span>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: '#334155', lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
            {info.dataSource}
          </p>
        </div>

        <div style={{ background: '#ffffff', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>
            <Filter size={14} style={{ color: '#d97706' }} />
            <span>Aggregation & Units</span>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: '#334155', lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
            <strong>Units:</strong> {info.units}<br />
            <strong>Aggregation:</strong> {info.aggregation}
          </p>
        </div>

        <div style={{ background: '#ffffff', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>
            <HelpCircle size={14} style={{ color: '#8b5cf6' }} />
            <span>Operational Target / Benchmark</span>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: '#334155', lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
            {info.standardInfo}
          </p>
        </div>
      </div>
    </div>
  );
}
