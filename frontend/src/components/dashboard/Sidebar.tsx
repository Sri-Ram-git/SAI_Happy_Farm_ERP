import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { logoutUser } from '../../services/authService';
import {
  LayoutDashboard,
  Home,
  Users,
  Layers,
  BarChart3,
  Trophy,
  ClipboardList,
  Package,
  Sparkles,
  LogOut,
} from 'lucide-react';

interface SidebarProps {
  role: 'supervisor' | 'admin';
  userName?: string;
}

const SUPERVISOR_NAV = [
  { path: '/supervisor', label: 'Overview', icon: LayoutDashboard },
  { path: '/supervisor/farms', label: 'Farms', icon: Home },
  { path: '/supervisor/analytics', label: 'Analytics', icon: BarChart3 },
  { path: '/supervisor/rankings', label: 'Rankings', icon: Trophy },
  { path: '/supervisor/submissions', label: 'Submissions', icon: ClipboardList },
  { path: '/supervisor/feed-load', label: 'Feed Load', icon: Package },
];

const ADMIN_NAV = [
  { path: '/admin', label: 'Overview', icon: LayoutDashboard },
  { path: '/admin/users', label: 'Users', icon: Users },
  { path: '/admin/farms', label: 'Farms', icon: Home },
  { path: '/admin/flocks', label: 'Flocks', icon: Layers },
  { path: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { path: '/admin/submissions', label: 'Submissions', icon: ClipboardList },
  { path: '/admin/feed-load', label: 'Feed Load', icon: Package },
  { path: '/admin/prediction', label: 'Prediction', icon: Sparkles },
];

export function Sidebar({ role, userName }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [loggingOut, setLoggingOut] = useState(false);
  const items = role === 'admin' ? ADMIN_NAV : SUPERVISOR_NAV;

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logoutUser();
    } catch (err) {
      console.error('[Sidebar] Logout error:', err);
    } finally {
      window.location.href = '/management/login';
    }
  };

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src="/happy_farm_logo.jpg" alt="SAI" className="sidebar-logo" />
          <div>
            <div className="sidebar-brand-name">SAI Happy Farms</div>
            <div className="sidebar-brand-role">{role === 'admin' ? 'Admin' : 'Supervisor'}</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                className={`sidebar-link ${isActive ? 'sidebar-link--active' : ''}`}
                onClick={() => navigate(item.path)}
              >
                <Icon size={18} className="sidebar-icon" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          {userName && <div className="sidebar-user">{userName}</div>}
          <button className="sidebar-link sidebar-link--logout" onClick={handleLogout} disabled={loggingOut}>
            <LogOut size={18} className="sidebar-icon" />
            <span>{loggingOut ? 'Signing out...' : 'Logout'}</span>
          </button>
        </div>
      </aside>

      <nav className="mobile-nav">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              className={`mobile-nav-link ${isActive ? 'mobile-nav-link--active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </button>
          );
        })}
        <button className="mobile-nav-link" onClick={handleLogout} disabled={loggingOut}>
          <LogOut size={20} />
          <span>{loggingOut ? 'Exit' : 'Exit'}</span>
        </button>
      </nav>
    </>
  );
}
