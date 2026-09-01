import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { logoutUser } from '../../services/authService';
import {
  LayoutDashboard,
  Users,
  TreePine,
  BarChart3,
  Trophy,
  ClipboardList,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface SidebarProps {
  role: 'supervisor' | 'admin';
  userName?: string;
}

const SUPERVISOR_NAV = [
  { path: '/supervisor', label: 'Overview', icon: LayoutDashboard },
  { path: '/supervisor/farms', label: 'Farms', icon: TreePine },
  { path: '/supervisor/analytics', label: 'Analytics', icon: BarChart3 },
  { path: '/supervisor/rankings', label: 'Rankings', icon: Trophy },
  { path: '/supervisor/submissions', label: 'Submissions', icon: ClipboardList },
];

const ADMIN_NAV = [
  { path: '/admin', label: 'Overview', icon: LayoutDashboard },
  { path: '/admin/users', label: 'Users', icon: Users },
  { path: '/admin/farms', label: 'Farms', icon: TreePine },
  { path: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { path: '/admin/submissions', label: 'Submissions', icon: ClipboardList },
];

export function Sidebar({ role, userName }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const items = role === 'admin' ? ADMIN_NAV : SUPERVISOR_NAV;
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={`mgmt-sidebar ${collapsed ? 'mgmt-sidebar--collapsed' : ''}`}>
      <div className="mgmt-sidebar-header">
        <img src="/happy_farm_logo.jpg" alt="SAI" className="mgmt-sidebar-logo" />
        {!collapsed && (
          <div className="mgmt-sidebar-brand">
            <div className="mgmt-sidebar-brand-name">SAI Happy Farms</div>
            <div className="mgmt-sidebar-brand-subtitle">Management Portal</div>
          </div>
        )}
      </div>

      <nav className="mgmt-sidebar-nav">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              className={`mgmt-sidebar-link ${isActive ? 'mgmt-sidebar-link--active' : ''}`}
              onClick={() => navigate(item.path)}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={20} />
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      <div className="mgmt-sidebar-footer">
        <div className="mgmt-sidebar-profile">
          <div className="mgmt-sidebar-avatar">
            {userName ? userName.charAt(0).toUpperCase() : 'U'}
          </div>
          {!collapsed && (
            <div className="mgmt-sidebar-profile-info">
              <div className="mgmt-sidebar-user-name">{userName || 'User'}</div>
              <span className={`mgmt-sidebar-role-badge mgmt-sidebar-role-badge--${role}`}>
                {role === 'admin' ? 'Admin' : 'Supervisor'}
              </span>
            </div>
          )}
        </div>

        <button
          className="mgmt-sidebar-link mgmt-sidebar-link--logout"
          onClick={() => {
            logoutUser();
            navigate('/management/login');
          }}
          title={collapsed ? 'Logout' : undefined}
        >
          <LogOut size={20} />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>

      <button
        className="mgmt-sidebar-toggle"
        onClick={() => setCollapsed(!collapsed)}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </button>
    </aside>
  );
}
