import { useState, type FormEvent } from 'react';
import { loginUser } from '../services/authService';
import { useAuth } from '../context/AuthContext';
import { getFriendlyError } from '../utils/firebaseErrors';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { authError, clearAuthError } = useAuth();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError('');
    clearAuthError();
    setSubmitting(true);

    try {
      console.log('[LoginForm] Signing in...');
      await loginUser(email, password);
      console.log('[LoginForm] Auth success — AuthContext will handle profile + redirect');
    } catch (err: any) {
      console.error('[LoginForm] Auth failed:', err.code);
      setLoginError(getFriendlyError(err.code || 'unknown'));
    } finally {
      setSubmitting(false);
    }
  };

  const displayError = loginError || authError;

  return (
    <div className="auth-card">
      <div className="auth-card-header">
        <h2>Welcome Back</h2>
        <p>Sign in to submit today's report</p>
      </div>
      <form onSubmit={handleSubmit} className="auth-form">
        <div className="field">
          <label htmlFor="email">Email Address</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
            disabled={submitting}
          />
        </div>

        <div className="field">
          <label htmlFor="password">Password</label>
          <div className="password-wrap">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              autoComplete="current-password"
              disabled={submitting}
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

        <div className="auth-card-footer-info">
          <span className="forgot-link">Forgot Password?</span>
          <span className="contact-admin">Contact Farm Admin</span>
        </div>

        <button
          type="submit"
          className="btn btn--primary btn--full btn--login"
          disabled={submitting}
        >
          {submitting ? <span className="spinner" /> : 'SIGN IN'}
        </button>

        {displayError && <div className="alert alert--error" style={{ marginTop: '16px' }}>{displayError}</div>}
      </form>
    </div>
  );
}
