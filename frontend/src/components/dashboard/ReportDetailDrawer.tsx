import { DetailDrawer } from './DetailDrawer';
import {
  MessageSquare,
  Calendar,
  User,
  Building2,
  Activity,
  Package,
  Thermometer,
  Egg,
  CheckCircle2,
  Clock,
  Layers,
  AlertTriangle,
} from 'lucide-react';
import { formatDisplayDate, formatTime } from '../../utils/dateUtils';
import type { ReportDoc } from '../../services/reportDataService';
import type { FarmDoc } from '../../services/farmDataService';
import type { UserDoc } from '../../services/userDataService';
import {
  calcProductionRate,
  calcMortalityRate,
  calcFeedPerBird,
  getEligibleBirdCount,
} from '../../utils/kpiCalculations';
import { KPI_THRESHOLDS } from '../../config/kpiThresholds';

export interface ReportDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  report: ReportDoc | null;
  farm?: FarmDoc | null;
  farmer?: UserDoc | null;
  role?: 'admin' | 'supervisor';
}

export function ReportDetailDrawer({
  open,
  onClose,
  report,
  farm,
  farmer,
}: ReportDetailDrawerProps) {
  if (!report) return null;

  const eligibleBirds = getEligibleBirdCount(report);
  const closingBirds = report.closingBirdCount || report.birdCount || eligibleBirds;
  const prodRate = eligibleBirds > 0 ? calcProductionRate(report.eggsProduced ?? 0, eligibleBirds) : 0;
  const mortRate = eligibleBirds > 0 ? calcMortalityRate(report.mortality ?? 0, eligibleBirds) : 0;
  const feedPerBird = eligibleBirds > 0 ? calcFeedPerBird(report.feedKg ?? 0, eligibleBirds) : 0;
  const isCriticalMort =
    mortRate >= (KPI_THRESHOLDS.mortalityRateCritical ?? 10) ||
    (eligibleBirds > 0 && (report.mortality ?? 0) >= eligibleBirds);

  const farmDisplay = farm?.name
    ? `${farm.farmId} — ${farm.name}`
    : report.farmId
    ? `Farm ${report.farmId}`
    : 'Unknown Farm';

  const farmerDisplay = farmer?.name || report.submittedBy || 'Assigned Farmer';
  const remarksText = (report.remarks || '').trim();
  const hasRemarks = remarksText.length > 0;

  return (
    <DetailDrawer
      open={open}
      title={`Daily Report — ${formatDisplayDate(report.submissionDate)}`}
      onClose={onClose}
    >
      <div className="report-detail-drawer-content">
        {/* 1. CONTEXT CARD (FARMER, FARM, DATE) */}
        <div className="report-detail-header-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span
              className={`status-badge ${report.status === 'corrected' ? 'status-badge--warn' : 'status-badge--ok'}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <CheckCircle2 size={12} />
              <span>
                {report.submissionVersion && report.submissionVersion > 1
                  ? `Version ${report.submissionVersion} (Corrected)`
                  : 'Submitted (Version 1)'}
              </span>
            </span>
            <span style={{ fontSize: 12, color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Clock size={12} />
              <span>{report.createdAt ? formatTime(report.createdAt) : '--'}</span>
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Building2 size={16} style={{ color: '#059669', flexShrink: 0 }} />
              <div>
                <span style={{ fontSize: 12, color: '#64748b' }}>Farm: </span>
                <strong style={{ fontSize: 14, color: '#0f172a' }}>{farmDisplay}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <User size={16} style={{ color: '#0284c7', flexShrink: 0 }} />
              <div>
                <span style={{ fontSize: 12, color: '#64748b' }}>Farmer: </span>
                <strong style={{ fontSize: 14, color: '#0f172a' }}>{farmerDisplay}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Calendar size={16} style={{ color: '#d97706', flexShrink: 0 }} />
              <div>
                <span style={{ fontSize: 12, color: '#64748b' }}>Report Date: </span>
                <strong style={{ fontSize: 14, color: '#0f172a' }}>
                  {formatDisplayDate(report.submissionDate)}
                </strong>
                {report.weekLabel && (
                  <span style={{ fontSize: 12, color: '#64748b', marginLeft: 6 }}>
                    (Week {report.weekLabel})
                  </span>
                )}
              </div>
            </div>

            {report.flockId && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Layers size={16} style={{ color: '#8b5cf6', flexShrink: 0 }} />
                <div>
                  <span style={{ fontSize: 12, color: '#64748b' }}>Flock ID: </span>
                  <span style={{ fontSize: 13, color: '#334155', fontFamily: 'monospace' }}>
                    {report.flockId}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 2. DEDICATED FARMER REMARKS SECTION */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <MessageSquare size={16} style={{ color: '#059669' }} />
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Farmer Remarks
            </h4>
          </div>

          <div
            className="report-remarks-card"
            style={{
              background: hasRemarks ? '#f8fafc' : '#f1f5f9',
              border: hasRemarks ? '1px solid #cbd5e1' : '1px dashed #cbd5e1',
              borderRadius: 8,
              padding: '14px 16px',
            }}
          >
            {hasRemarks ? (
              <div
                className="report-remarks-text"
                style={{
                  whiteSpace: 'pre-wrap',
                  overflowWrap: 'anywhere',
                  wordBreak: 'break-word',
                  fontSize: 14,
                  lineHeight: '1.6',
                  color: '#1e293b',
                }}
              >
                {report.remarks}
              </div>
            ) : (
              <div
                className="report-remarks-empty"
                style={{
                  fontStyle: 'italic',
                  color: '#94a3b8',
                  fontSize: 14,
                }}
              >
                No remarks provided
              </div>
            )}
          </div>
        </div>

        {/* 3. OPERATIONAL PERFORMANCE METRICS */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Activity size={16} style={{ color: '#0284c7' }} />
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Daily Metrics Summary
            </h4>
          </div>

          <div className="report-detail-metrics-grid">
            <div className="report-metric-tile">
              <span className="report-metric-tile-label">Live Birds</span>
              <span className="report-metric-tile-val">{closingBirds.toLocaleString()}</span>
              {report.openingBirdCount && report.openingBirdCount > 0 ? (
                <span className="report-metric-tile-sub">Opening: {report.openingBirdCount.toLocaleString()}</span>
              ) : null}
            </div>

            <div className="report-metric-tile">
              <span className="report-metric-tile-label">Egg Production</span>
              <span className="report-metric-tile-val">{prodRate}%</span>
              <span className="report-metric-tile-sub">
                {(report.eggsProduced ?? 0).toLocaleString()} total eggs
              </span>
            </div>

            <div className="report-metric-tile">
              <span className="report-metric-tile-label">Mortality</span>
              <span
                className="report-metric-tile-val"
                style={{ color: isCriticalMort ? '#dc2626' : '#1e293b' }}
              >
                {report.mortality ?? 0} ({mortRate}%)
              </span>
              <span className="report-metric-tile-sub">
                Culling: {report.culling ?? 0}
              </span>
            </div>

            <div className="report-metric-tile">
              <span className="report-metric-tile-label">Feed Usage</span>
              <span className="report-metric-tile-val">{report.feedKg ?? 0} kg</span>
              <span className="report-metric-tile-sub">{feedPerBird} g / bird</span>
            </div>
          </div>
        </div>

        {/* 4. DETAILED BREAKDOWNS */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Egg size={16} style={{ color: '#d97706' }} />
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Eggs & Environment Details
            </h4>
          </div>

          <div className="detail-list">
            <div className="detail-item">
              <span className="detail-item-label">Selection / Saleable Eggs</span>
              <span className="detail-item-value">{(report.selectionEggs ?? 0).toLocaleString()}</span>
            </div>
            <div className="detail-item">
              <span className="detail-item-label">Damaged Eggs</span>
              <span className="detail-item-value">{report.damagedEggs ?? 0}</span>
            </div>
            <div className="detail-item">
              <span className="detail-item-label">Floor Eggs</span>
              <span className="detail-item-value">{report.floorEggs ?? 0}</span>
            </div>
            <div className="detail-item">
              <span className="detail-item-label">Temperature</span>
              <span className="detail-item-value">
                {report.temperature ?? '--'}°C
                {report.tempMin != null && report.tempMax != null && (
                  <span style={{ fontSize: 12, color: '#64748b', fontWeight: 400, marginLeft: 6 }}>
                    (Min: {report.tempMin}°C, Max: {report.tempMax}°C)
                  </span>
                )}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-item-label">Average Egg Weight</span>
              <span className="detail-item-value">
                {report.eggWeight?.avg ? `${report.eggWeight.avg}g` : '--'}
                {report.eggWeight?.min && report.eggWeight?.max ? (
                  <span style={{ fontSize: 12, color: '#64748b', fontWeight: 400, marginLeft: 6 }}>
                    ({report.eggWeight.min}g - {report.eggWeight.max}g)
                  </span>
                ) : null}
              </span>
            </div>
            {report.bodyWeight && report.bodyWeight.avg > 0 && (
              <div className="detail-item">
                <span className="detail-item-label">Sampled Body Weight</span>
                <span className="detail-item-value">
                  {report.bodyWeight.avg}g
                  <span style={{ fontSize: 12, color: '#64748b', fontWeight: 400, marginLeft: 6 }}>
                    ({report.bodyWeight.min}g - {report.bodyWeight.max}g)
                  </span>
                </span>
              </div>
            )}
            {report.ammoniaPpm != null && (
              <div className="detail-item">
                <span className="detail-item-label">Ammonia Level</span>
                <span className="detail-item-value">{report.ammoniaPpm} PPM</span>
              </div>
            )}
          </div>
        </div>

        {/* 5. AUDIT & SUBMISSION METADATA */}
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }}>
            <div>Method: {report.submissionMethod || 'DIGITAL_FORM'}</div>
            {report.rawFirestorePath && (
              <div style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                Source: {report.rawFirestorePath}
              </div>
            )}
          </div>
        </div>
      </div>
    </DetailDrawer>
  );
}
