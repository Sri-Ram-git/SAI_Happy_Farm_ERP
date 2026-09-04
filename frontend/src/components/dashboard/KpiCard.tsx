import type { ReactNode } from 'react';

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  color?: string;
  onClick?: () => void;
  children?: ReactNode;
}

export function KpiCard({ title, value, subtitle, icon, color, onClick, children }: KpiCardProps) {
  return (
    <div className={`kpi-card ${onClick ? 'kpi-card--clickable' : ''}`} onClick={onClick}>
      <div className="kpi-header">
        {icon && <span className="kpi-icon" style={{ color: color || 'var(--green-700)' }}>{icon}</span>}
        <span className="kpi-title">{title}</span>
      </div>
      <div className="kpi-value" style={{ color: color || 'var(--gray-800)' }}>{value}</div>
      {subtitle && <div className="kpi-subtitle">{subtitle}</div>}
      {children}
    </div>
  );
}
