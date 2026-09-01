import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getRouteForRole } from '../utils/routeByRole';
import { LoginForm } from '../components/LoginForm';
import { PhoneLoginForm } from '../components/PhoneLoginForm';
import { LoadingScreen } from '../components/LoadingScreen';

export function LoginPage() {
  const { role, loading, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [loginMethod, setLoginMethod] = useState<'email' | 'phone'>('email');

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
          <p>Farmer Login</p>
        </div>

        <div className="auth-tabs">
          <button
            className={`auth-tab ${loginMethod === 'email' ? 'auth-tab--active' : ''}`}
            onClick={() => setLoginMethod('email')}
          >
            Email
          </button>
          <button
            className={`auth-tab ${loginMethod === 'phone' ? 'auth-tab--active' : ''}`}
            onClick={() => setLoginMethod('phone')}
          >
            Phone OTP
          </button>
        </div>

        {loginMethod === 'email' ? <LoginForm /> : <PhoneLoginForm />}
      </div>
    </div>
  );
}
