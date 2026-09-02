import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { logoutUser } from '../../services/authService';

interface SidebarProps {
  role: 'supervisor' | 'admin';
  userName?: string;
}

const SUPERVISOR_NAV = [
  { path: '/supervisor', label: 'Overview', icon: '&#9632;' },
  { path: '/supervisor/farms', label: 'Farms', icon: '&#9635;' },
  { path: '/supervisor/analytics', label: 'Analytics', icon: '&#9650;' },
  { path: '/supervisor/rankings', label: 'Rankings', icon: '&#9733;' },
  { path: '/supervisor/submissions', label: 'Submissions', icon: '&#9776;' },
  { path: '/supervisor/feed-load', label: 'Feed Load', icon: '&#127838;' },
];

const ADMIN_NAV = [
  { path: '/admin', label: 'Overview', icon: '&#9632;' },
  { path: '/admin/users', label: 'Users', icon: '&#9787;' },
  { path: '/admin/farms', label: 'Farms', icon: '&#9635;' },
  { path: '/admin/analytics', label: 'Analytics', icon: '&#9650;' },
  { path: '/admin/submissions', label: 'Submissions', icon: '&#9776;' },
  { path: '/admin/feed-load', label: 'Feed Load', icon: '&#127838;' },
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
          {items.map((item) => (
            <button
              key={item.path}
              className={`sidebar-link ${location.pathname === item.path ? 'sidebar-link--active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              <span dangerouslySetInnerHTML={{ __html: item.icon }} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          {userName && <div className="sidebar-user">{userName}</div>}
          <button className="sidebar-link sidebar-link--logout" onClick={handleLogout} disabled={loggingOut}>
            {loggingOut ? 'Signing out...' : 'Logout'}
          </button>
        </div>
      </aside>

      <nav className="mobile-nav">
        {items.map((item) => (
          <button
            key={item.path}
            className={`mobile-nav-link ${location.pathname === item.path ? 'mobile-nav-link--active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            <span dangerouslySetInnerHTML={{ __html: item.icon }} />
            <span>{item.label}</span>
          </button>
        ))}
        <button className="mobile-nav-link" onClick={handleLogout} disabled={loggingOut}>
          <span>&#10140;</span>
          <span>{loggingOut ? 'Signing out...' : 'Exit'}</span>
        </button>
      </nav>
    </>
  );
}
