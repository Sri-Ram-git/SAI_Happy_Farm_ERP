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
  Menu,
  X,
  MoreHorizontal,
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
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const items = role === 'admin' ? ADMIN_NAV : SUPERVISOR_NAV;

  // Primary 4 tabs for bottom navigation bar
  const primaryBottomTabs = items.slice(0, 4);

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

  const handleNavigate = (path: string) => {
    setMobileDrawerOpen(false);
    navigate(path);
  };

  return (
    <>
      {/* Desktop & Tablet Sidebar */}
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

      {/* Mobile Top Header Bar */}
      <header className="mobile-app-header">
        <div className="mobile-brand-left">
          <img src="/happy_farm_logo.jpg" alt="SAI Happy Farms" className="mobile-brand-logo" />
          <div className="mobile-brand-info">
            <span className="mobile-brand-title">SAI Happy Farms</span>
            <span className="mobile-brand-badge">{role === 'admin' ? 'Admin Portal' : 'Supervisor Portal'}</span>
          </div>
        </div>
        <button
          type="button"
          className="mobile-menu-trigger"
          onClick={() => setMobileDrawerOpen(!mobileDrawerOpen)}
          aria-label="Toggle menu"
        >
          {mobileDrawerOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {/* Mobile Slide-Up Drawer Menu */}
      {mobileDrawerOpen && (
        <div className="mobile-drawer-overlay" onClick={() => setMobileDrawerOpen(false)}>
          <div className="mobile-drawer-card" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-drawer-header">
              <div className="mobile-drawer-user-info">
                <span className="mobile-drawer-user-name">{userName || (role === 'admin' ? 'Admin' : 'Supervisor')}</span>
                <span className="mobile-drawer-user-role">{role === 'admin' ? 'System Administrator' : 'Farm Supervisor'}</span>
              </div>
              <button
                type="button"
                className="mobile-drawer-close"
                onClick={() => setMobileDrawerOpen(false)}
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
            </div>

            <nav className="mobile-drawer-nav">
              {items.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <button
                    key={item.path}
                    className={`mobile-drawer-link ${isActive ? 'mobile-drawer-link--active' : ''}`}
                    onClick={() => handleNavigate(item.path)}
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="mobile-drawer-footer">
              <button className="mobile-drawer-logout-btn" onClick={handleLogout} disabled={loggingOut}>
                <LogOut size={18} />
                <span>{loggingOut ? 'Signing out...' : 'Sign Out'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Quick-Nav Bar (4 Primary Tabs + More) */}
      <nav className="mobile-nav">
        {primaryBottomTabs.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              className={`mobile-nav-link ${isActive ? 'mobile-nav-link--active' : ''}`}
              onClick={() => handleNavigate(item.path)}
            >
              <Icon size={19} />
              <span>{item.label}</span>
            </button>
          );
        })}

        <button
          type="button"
          className={`mobile-nav-link ${mobileDrawerOpen ? 'mobile-nav-link--active' : ''}`}
          onClick={() => setMobileDrawerOpen(!mobileDrawerOpen)}
        >
          <MoreHorizontal size={19} />
          <span>More</span>
        </button>
      </nav>
    </>
  );
}

