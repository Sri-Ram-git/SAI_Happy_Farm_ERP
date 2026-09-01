import { Link } from 'react-router-dom';

export function UnauthorizedPage() {
  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="brand">
          <div className="brand-icon">🚫</div>
          <h1>Access Denied</h1>
          <p>You do not have permission to view this page.</p>
        </div>
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <Link to="/login" className="btn btn--primary btn--full">
            Go to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
