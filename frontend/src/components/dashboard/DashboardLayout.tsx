import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';

interface DashboardLayoutProps {
  role: 'supervisor' | 'admin';
  userName?: string;
  children: ReactNode;
}

export function DashboardLayout({ role, userName, children }: DashboardLayoutProps) {
  return (
    <div className="mgmt-layout">
      <Sidebar role={role} userName={userName} />
      <div className="mgmt-content">
        {children}
      </div>
    </div>
  );
}
