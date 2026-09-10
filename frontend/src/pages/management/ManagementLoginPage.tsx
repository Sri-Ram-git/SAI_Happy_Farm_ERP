import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserByUid } from '../../services/userDataService';
import { normalizeRole } from '../../utils/normalizeRole';

const f = (window as any).firebase;

export function ManagementLoginPage() {
  const [activeTab, setActiveTab] = useState<'supervisor' | 'admin'>('supervisor');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await f.auth().signInWithEmailAndPassword(email, password);
      const uid = result.user.uid;

      let profile;
      try {
        profile = await getUserByUid(uid);
      } catch (fsErr: any) {
        console.error('[ManagementLogin] Firestore read error:', fsErr);
        await f.auth().signOut();
        setError('Could not load your profile. Please try again.');
        setLoading(false);
        return;
      }

      if (!profile) {
        await f.auth().signOut();
        setError('No profile found for this account. Contact the administrator.');
        setLoading(false);
        return;
      }

      if (!profile.active) {
        await f.auth().signOut();
        setError('This account is disabled. Contact the administrator.');
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
        setError(`This account is not a ${friendly}.`);
        setLoading(false);
        return;
      }

      navigate(expectedRole === 'admin' ? '/admin' : '/supervisor', { replace: true });
    } catch (err: any) {
      console.error('[ManagementLogin] Auth error:', err.code, err.message);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Email or password is incorrect.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Invalid email address.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many attempts. Try again later.');
      } else {
        setError('Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogout = async () => {
    try {
      await f.auth().signOut();
    } catch (_) {}
    window.location.reload();
  };

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
            onClick={() => { setActiveTab('supervisor'); setError(''); setShowPassword(false); }}
          >
            Supervisor
          </button>
          <button
            className={`role-btn ${activeTab === 'admin' ? 'role-btn--active' : ''}`}
            onClick={() => { setActiveTab('admin'); setError(''); setShowPassword(false); }}
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
                autoComplete="email"
              />
            </div>
            <div className="field">
              <label htmlFor="mgmt-password">Password</label>
              <div className="password-wrap">
                <input
                  id="mgmt-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                  disabled={loading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="pw-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn--primary btn--full" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Login'}
            </button>
          </form>

          {error && <div className="alert alert--error" style={{ marginTop: 16 }}>{error}</div>}

          <p style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: '#9ca3af' }}>
            <button type="button" onClick={handleQuickLogout} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', textDecoration: 'underline', fontSize: 12, padding: 0 }}>
              Stuck? Clear session
            </button>
          </p>
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
