import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getRouteForRole } from '../utils/routeByRole';
import { LoginForm } from '../components/LoginForm';
import { LoadingScreen } from '../components/LoadingScreen';

export function LoginPage() {
  const { role, loading, isAuthenticated, authError } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && isAuthenticated && role) {
      navigate(getRouteForRole(role), { replace: true });
    }
  }, [loading, isAuthenticated, role, navigate]);

  if (loading) return <LoadingScreen />;
  if (isAuthenticated && role) return null;

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="brand">
          <img src="/happy_farm_logo.jpg" alt="SAI Happy Farms" className="brand-logo" />
          <h1>SAI Happy Farms</h1>
          <p className="brand-subtitle">Daily Poultry Farm Report</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
