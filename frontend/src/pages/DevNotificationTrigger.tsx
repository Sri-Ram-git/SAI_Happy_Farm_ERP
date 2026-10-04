import { useState } from 'react';
import { bootstrapNotificationsForUser } from '../services/notificationService';
import { useNavigate } from 'react-router-dom';
import { BellRing, CheckCircle2, FlaskConical, ShieldCheck } from 'lucide-react';
import { DashboardLayout } from '../components/dashboard/DashboardLayout';
import { useAuth } from '../context/AuthContext';

export function DevNotificationTrigger() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('');
  const [creating, setCreating] = useState(false);
  const { userProfile, role } = useAuth();
  const activeRole = role === 'admin' ? 'admin' : 'supervisor';

  const triggerNotification = async () => {
    if (!userProfile?.uid) {
      setStatus('Error: Sign in to the management portal before running the scan.');
      return;
    }
    setCreating(true);
    setStatus('');
    try {
      const result = await bootstrapNotificationsForUser(activeRole, userProfile.farmIds);
      setStatus(`Scanned ${result.farmCount} active farms and ${result.reportCount} current reports. Opening Notification Centre…`);
      navigate(`/${activeRole}/notifications`);
    } catch (e: any) {
      setStatus(`Error: ${e?.message || 'Could not scan current farm data.'}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <DashboardLayout role="admin" userName="Development">
      <div className="mgmt-page dev-notification-page">
        <div className="mgmt-page-header">
          <div>
            <div className="notifications-eyebrow"><FlaskConical size={14} /> Developer tools</div>
            <h2>Notification pipeline check</h2>
            <p className="welcome-subtitle">Scan current farm data and verify the real in-app notification journey.</p>
          </div>
          <button type="button" className="btn btn--outline" onClick={() => navigate(-1)}>Back to overview</button>
        </div>

        <section className="dev-notification-hero">
          <div className="dev-notification-hero-icon"><BellRing size={30} /></div>
          <div>
            <span className="dev-notification-kicker">Development-only trigger</span>
            <h3>Run a current-data scan</h3>
            <p>This re-evaluates persisted farm reports using the same rules as the Notification Centre. It never creates a fake alert.</p>
          </div>
          <button type="button" className="btn btn--primary dev-notification-action" onClick={triggerNotification} disabled={creating}>
            <BellRing size={17} /> {creating ? 'Scanning current data…' : 'Scan current data'}
          </button>
        </section>

        <div className="dev-notification-grid">
          <div className="dev-notification-step"><span>1</span><div><strong>Create</strong><small>Explicit button only</small></div></div>
          <div className="dev-notification-step"><span>2</span><div><strong>Observe</strong><small>Bell updates in real time</small></div></div>
          <div className="dev-notification-step"><span>3</span><div><strong>Review</strong><small>Open Notification Centre</small></div></div>
        </div>

        {status && (
          <div className={`dev-notification-status ${status.startsWith('Error') ? 'dev-notification-status--error' : ''}`} role="status">
            {status.startsWith('Error') ? <ShieldCheck size={18} /> : <CheckCircle2 size={18} />}
            <span>{status}</span>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
