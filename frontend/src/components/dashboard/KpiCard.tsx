import type { ComponentType } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ComponentType<{ size?: number; className?: string }>;
  trend?: { value: number; label?: string };
  color?: string;
  onClick?: () => void;
}

function getTrendIcon(value: number) {
  if (value > 0) return <TrendingUp size={14} className="mgmt-kpi-trend-icon mgmt-kpi-trend-icon--up" />;
  if (value < 0) return <TrendingDown size={14} className="mgmt-kpi-trend-icon mgmt-kpi-trend-icon--down" />;
  return <Minus size={14} className="mgmt-kpi-trend-icon mgmt-kpi-trend-icon--neutral" />;
}

function getTrendColor(value: number): string {
  if (value > 0) return 'var(--mgmt-success, #16a34a)';
  if (value < 0) return 'var(--mgmt-danger, #dc2626)';
  return 'var(--mgmt-text-muted, #6b7280)';
}

export function KpiCard({ title, value, subtitle, icon: Icon, trend, color, onClick }: KpiCardProps) {
  return (
    <div
      className={`mgmt-kpi-card ${onClick ? 'mgmt-kpi-card--clickable' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="mgmt-kpi-header">
        {Icon && (
          <div className="mgmt-kpi-icon" style={{ color: color || 'var(--mgmt-primary, #2563eb)' }}>
            <Icon size={22} />
          </div>
        )}
        <span className="mgmt-kpi-title">{title}</span>
      </div>
      <div className="mgmt-kpi-value" style={{ color: color || 'var(--mgmt-text, #111827)' }}>
        {value}
      </div>
      {subtitle && <div className="mgmt-kpi-subtitle">{subtitle}</div>}
      {trend && (
        <div className="mgmt-kpi-trend" style={{ color: getTrendColor(trend.value) }}>
          {getTrendIcon(trend.value)}
          <span className="mgmt-kpi-trend-value">
            {trend.value > 0 ? '+' : ''}{trend.value}%
          </span>
          {trend.label && <span className="mgmt-kpi-trend-label">{trend.label}</span>}
        </div>
      )}
    </div>
  );
}
