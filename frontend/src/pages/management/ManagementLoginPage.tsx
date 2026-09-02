import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserByUid } from '../../services/userDataService';
import { normalizeRole } from '../../utils/normalizeRole';
import { useAuth } from '../../context/AuthContext';

const f = (window as any).firebase;

export function ManagementLoginPage() {
  const { isAuthenticated, role, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'supervisor' | 'admin'>('supervisor');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading) return;
    if (isAuthenticated && role === 'admin') {
      navigate('/admin', { replace: true });
    } else if (isAuthenticated && role === 'supervisor') {
      navigate('/supervisor', { replace: true });
    }
  }, [isAuthenticated, role, authLoading, navigate]);

  const handleLogout = async () => {
    await f.auth().signOut();
    window.location.reload();
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await f.auth().signInWithEmailAndPassword(email, password);
      const uid = result.user.uid;
      const profile = await getUserByUid(uid);

      if (!profile) {
        await f.auth().signOut();
        setError('Your account profile is not configured. Please contact the administrator.');
        setLoading(false);
        return;
      }

      if (!profile.active) {
        await f.auth().signOut();
        setError('Your account has been disabled. Please contact the administrator.');
        setLoading(false);
        return;
      }

      const normalizedRole = normalizeRole(profile.role);

      if (normalizedRole === 'farmer') {
        await f.auth().signOut();
        setError('Farmers must use the Farmer Login portal.');
        setLoading(false);
        return;
      }

      const expectedRole = activeTab;
      if (normalizedRole !== expectedRole) {
        await f.auth().signOut();
        const friendly = expectedRole === 'supervisor' ? 'Supervisor' : 'Administrator';
        setError(`This account does not have ${friendly} access.`);
        setLoading(false);
        return;
      }

      navigate(expectedRole === 'admin' ? '/admin' : '/supervisor', { replace: true });
    } catch (err: any) {
      console.error('[ManagementLogin] Error:', err.code);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Email or password is incorrect.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Invalid email address.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many attempts. Please try again later.');
      } else {
        setError('Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="loading-state">
            <div className="spinner" />
            <p>Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="brand">
            <img src="/happy_farm_logo.jpg" alt="SAI Happy Farms" className="brand-logo" />
            <h1>SAI Happy Farms</h1>
            <p>Management Portal</p>
          </div>
          <div className="auth-card" style={{ textAlign: 'center' }}>
            <p style={{ marginBottom: 16, color: '#374151' }}>
              You are already logged in as <strong>{role}</strong>.
            </p>
            <button className="btn btn--primary btn--full" onClick={() => navigate(role === 'admin' ? '/admin' : '/supervisor')}>
              Go to Dashboard
            </button>
            <button className="btn btn--outline btn--full" style={{ marginTop: 10 }} onClick={handleLogout}>
              Logout &amp; Sign In as Different User
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="brand">
          <img src="/happy_farm_logo.jpg" alt="SAI Happy Farms" className="brand-logo" />
          <h1>SAI Happy Farms</h1>
          <p>Management Portal</p>
        </div>

        <div className="role-selector">
          <button
            className={`role-btn ${activeTab === 'supervisor' ? 'role-btn--active' : ''}`}
            onClick={() => { setActiveTab('supervisor'); setError(''); }}
          >
            Supervisor
          </button>
          <button
            className={`role-btn ${activeTab === 'admin' ? 'role-btn--active' : ''}`}
            onClick={() => { setActiveTab('admin'); setError(''); }}
          >
            Admin
          </button>
        </div>

        <div className="auth-card">
          <form onSubmit={handleLogin}>
            <div className="field">
              <label htmlFor="mgmt-email">Email Address</label>
              <input
                id="mgmt-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                disabled={loading}
              />
            </div>
            <div className="field">
              <label htmlFor="mgmt-password">Password</label>
              <div className="password-wrap">
                <input
                  id="mgmt-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <button type="submit" className="btn btn--primary btn--full" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Login'}
            </button>
          </form>

          {error && <div className="alert alert--error" style={{ marginTop: 16 }}>{error}</div>}
        </div>

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: '#6b7280' }}>
          <a href="/login" style={{ color: '#15803d', textDecoration: 'none', fontWeight: 600 }}>
            Farmer Login
          </a>
        </p>
      </div>
    </div>
  );
}
