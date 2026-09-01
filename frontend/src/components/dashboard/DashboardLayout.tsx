import { useState, useEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Sun, Moon } from 'lucide-react';

interface DashboardLayoutProps {
  role: 'supervisor' | 'admin';
  userName?: string;
  children: ReactNode;
}

const PAGE_TITLES: Record<string, string> = {
  '/': 'Overview',
  '/supervisor': 'Overview',
  '/admin': 'Overview',
  '/supervisor/farms': 'Farm Performance',
  '/admin/farms': 'Farm Performance',
  '/admin/users': 'User Management',
  '/supervisor/analytics': 'Analytics',
  '/admin/analytics': 'Analytics',
  '/supervisor/rankings': 'Rankings',
  '/supervisor/submissions': 'Submission Monitor',
  '/admin/submissions': 'Submission Monitor',
};

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.includes('/farms/')) return 'Farm Detail';
  return 'Overview';
}

const DATE_OPTIONS = [
  { days: 1, label: 'Today' },
  { days: 7, label: '7D' },
  { days: 30, label: '30D' },
];

export function DashboardLayout({ role, userName, children }: DashboardLayoutProps) {
  const location = useLocation();
  const pageTitle = getPageTitle(location.pathname);

  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('mgmt-dark-mode') === 'true';
  });

  const [activeDays, setActiveDays] = useState(30);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('mgmt-dark-mode', String(darkMode));
  }, [darkMode]);

  return (
    <div className="mgmt-layout">
      <Sidebar role={role} userName={userName} />
      <div className="mgmt-main">
        <header className="mgmt-header">
          <div className="mgmt-header-left">
            <h1 className="mgmt-header-title">{pageTitle}</h1>
            <div className="mgmt-date-pills">
              {DATE_OPTIONS.map((opt) => (
                <button
                  key={opt.days}
                  className={`mgmt-date-pill ${activeDays === opt.days ? 'mgmt-date-pill--active' : ''}`}
                  onClick={() => setActiveDays(opt.days)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mgmt-header-right">
            <span className="mgmt-header-user">{userName || 'User'}</span>
            <button
              className="mgmt-dark-toggle"
              onClick={() => setDarkMode(!darkMode)}
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>
        <main className="mgmt-content">
          {children}
        </main>
      </div>
    </div>
  );
}
