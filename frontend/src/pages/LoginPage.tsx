import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getRouteForRole } from '../utils/routeByRole';
import { LoginForm } from '../components/LoginForm';
import { LoadingScreen } from '../components/LoadingScreen';

export function LoginPage() {
  const { role, loading, isAuthenticated, authError } = useAuth();
  const navigate = useNavigate();

  console.log('[LoginPage] RENDER:', { loading, isAuthenticated, role, authError });

  useEffect(() => {
    console.log('[LoginPage] useEffect:', { loading, isAuthenticated, role });
    if (!loading && isAuthenticated && role) {
      const dest = getRouteForRole(role);
      console.log('[LoginPage] NAVIGATING TO:', dest);
      navigate(dest, { replace: true });
    }
  }, [loading, isAuthenticated, role, navigate]);

  if (loading) {
    console.log('[LoginPage] Showing LoadingScreen');
    return <LoadingScreen />;
  }

  if (isAuthenticated && role) {
    console.log('[LoginPage] Authenticated, returning null (will redirect)');
    return null;
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="brand">
          <div className="brand-icon">🌾</div>
          <h1>SAI Happy Farms</h1>
          <p>Farmer Login</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
