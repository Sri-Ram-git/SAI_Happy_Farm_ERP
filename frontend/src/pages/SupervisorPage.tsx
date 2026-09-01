import { useAuth } from '../context/AuthContext';
import { logoutUser } from '../services/authService';

export function SupervisorPage() {
  const { userProfile } = useAuth();

  const handleLogout = async () => {
    await logoutUser();
  };

  return (
    <div className="dashboard-page">
      <header className="dash-header">
        <div className="dash-header-left">
          <span className="dash-logo">🌾</span>
          <div>
            <h1>SAI Happy Farms</h1>
            <p className="dash-subtitle">Supervisor Portal</p>
          </div>
        </div>
        <button className="btn btn--outline" onClick={handleLogout}>
          Logout
        </button>
      </header>
      <main className="dash-main">
        <div className="dash-welcome">
          <p>Welcome, <strong>{userProfile?.name || 'Supervisor'}</strong></p>
          <p className="text-muted">You are successfully authenticated.</p>
        </div>
        <div className="placeholder-card">
          <h2>Supervisor Dashboard</h2>
          <p className="text-muted">Coming Next</p>
        </div>
      </main>
    </div>
  );
}
