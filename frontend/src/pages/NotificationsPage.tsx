import { useState } from 'react';
import { DashboardLayout } from '../components/dashboard/DashboardLayout';
import { AlertTriangle, BellRing, Check, CheckCheck, CheckCircle, Info, ShieldCheck, Skull, Zap } from 'lucide-react';
import { AppNotification } from '../services/notificationService';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { useNavigate } from 'react-router-dom';

interface NotificationsPageProps {
  role?: 'admin' | 'supervisor';
}

function formatTimestamp(isoDate: string): string {
  if (!isoDate || isoDate === new Date(0).toISOString()) return '—';
  try {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return '—';
    const parts = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).formatToParts(d);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.day} ${values.month} ${values.year} • ${values.hour}:${values.minute} ${(values.dayPeriod || '').toUpperCase()}`;
  } catch {
    return '—';
  }
}

function getSeverityConfig(priority: string) {
  switch (priority) {
    case 'CRITICAL':
      return {
        icon: Skull,
        badgeClass: 'notif-severity-badge--critical',
        cardClass: 'notif-card--critical',
        iconClass: 'notif-card-icon--critical',
        label: 'CRITICAL',
      };
    case 'WARNING':
      return {
        icon: AlertTriangle,
        badgeClass: 'notif-severity-badge--warning',
        cardClass: 'notif-card--warning',
        iconClass: 'notif-card-icon--warning',
        label: 'WARNING',
      };
    default:
      return {
        icon: Info,
        badgeClass: 'notif-severity-badge--info',
        cardClass: 'notif-card--info',
        iconClass: 'notif-card-icon--info',
        label: 'INFORMATION',
      };
  }
}

/** Derive a source label for the card footer */
function getSourceLabel(notif: AppNotification): string {
  if (notif.source === 'bootstrap') return 'Operational scan';
  if (notif.source === 'missing_report_check') return 'Compliance check';
  if (notif.source === 'feed_inventory') return 'Feed inventory';
  if (notif.source === 'dev_test') return 'Dev test';
  return 'Daily report';
}

const PAGE_SIZE = 25;

export function NotificationsPage({ role }: NotificationsPageProps) {
  const [filter, setFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionNotesInput, setResolutionNotesInput] = useState<string>('');
  const [isSubmittingResolution, setIsSubmittingResolution] = useState<boolean>(false);

  const { userProfile, role: authRole } = useAuth();
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    criticalCount,
    warningCount,
    activeCount,
    resolvedCount,
    readCount,
    loading: isLoading,
    markAsRead,
    markAllAsRead,
    resolveNotification,
  } = useNotifications();

  const activeRole = role || authRole || 'supervisor';
  const uid = userProfile?.uid || '';

  const handleMarkAllRead = async () => {
    await markAllAsRead();
  };

  const handleMarkRead = async (id: string) => {
    await markAsRead(id);
  };

  const handleConfirmResolve = async (id: string) => {
    setIsSubmittingResolution(true);
    try {
      await resolveNotification(id, resolutionNotesInput);
      setResolvingId(null);
      setResolutionNotesInput('');
    } catch (err) {
      console.error('[NotificationsPage] Resolve error:', err);
    } finally {
      setIsSubmittingResolution(false);
    }
  };

  const filteredNotifications = notifications.filter((notif) => {
    const isUnread = !(notif.readBy || []).includes(uid);
    const isResolved = Boolean(notif.resolved);
    if (filter === 'ACTIVE') return !isResolved;
    if (filter === 'UNREAD') return isUnread;
    if (filter === 'READ') return !isUnread;
    if (filter === 'RESOLVED') return isResolved;
    if (filter === 'CRITICAL') return notif.priority === 'CRITICAL';
    if (filter === 'WARNING') return notif.priority === 'WARNING';
    if (filter === 'INFO') return notif.priority === 'INFO';
    return true;
  });

  const totalPages = Math.ceil(filteredNotifications.length / PAGE_SIZE) || 1;
  const paginatedNotifications = filteredNotifications.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  return (
    <DashboardLayout role={activeRole as any} userName={userProfile?.name}>
      <div className="mgmt-page">
        {/* HERO */}
        <section className="notifications-hero">
          <div className="notifications-hero-copy">
            <div className="notifications-eyebrow"><BellRing size={14} /> Operations command centre</div>
            <h2>Notifications</h2>
            <p>Stay ahead of farm events, operational risks and daily report alerts.</p>
          </div>
          <div className="notifications-hero-icon"><BellRing size={30} /></div>
        </section>

        {/* SUMMARY STATS */}
        <section className="notification-stat-grid" aria-label="Notification summary">
          <div className="notification-stat-card notification-stat-card--total">
            <span className="notification-stat-label">All alerts</span>
            <strong>{isLoading ? '…' : notifications.length}</strong>
            <span>Notification history</span>
          </div>
          <div className="notification-stat-card notification-stat-card--active">
            <span className="notification-stat-label">Active</span>
            <strong>{isLoading ? '…' : activeCount}</strong>
            <span>Pending resolution</span>
          </div>
          <div className="notification-stat-card notification-stat-card--unread">
            <span className="notification-stat-label">Unread</span>
            <strong>{isLoading ? '…' : unreadCount}</strong>
            <span>Needs your review</span>
          </div>
          <div className="notification-stat-card notification-stat-card--resolved">
            <span className="notification-stat-label">Resolved</span>
            <strong>{isLoading ? '…' : resolvedCount}</strong>
            <span>Addressed in history</span>
          </div>
          <div className="notification-stat-card notification-stat-card--critical">
            <span className="notification-stat-label">Critical</span>
            <strong>{isLoading ? '…' : criticalCount}</strong>
            <span>Immediate action</span>
          </div>
        </section>

        {/* TOOLBAR + FILTERS */}
        <section className="notification-toolbar">
          <div>
            <span className="notification-toolbar-title">Alert history</span>
            <span className="notification-toolbar-subtitle">
              {isLoading ? 'Scanning farm data…' : 'Real-time updates from your authorised farms'}
            </span>
          </div>
          <div className="notif-page-filters">
            {[
              { key: 'ALL', label: 'All', count: notifications.length },
              { key: 'ACTIVE', label: 'Active', count: activeCount },
              { key: 'UNREAD', label: 'Unread', count: unreadCount },
              { key: 'READ', label: 'Read', count: readCount },
              { key: 'RESOLVED', label: 'Resolved', count: resolvedCount },
              { key: 'CRITICAL', label: 'Critical', count: criticalCount },
              { key: 'WARNING', label: 'Warning', count: warningCount },
            ].map(({ key, label, count }) => (
              <button
                key={key}
                className={`notif-filter-btn ${filter === key ? 'notif-filter-btn--active' : ''}`}
                onClick={() => {
                  setFilter(key);
                  setCurrentPage(1);
                }}
              >
                {label}
                {count > 0 && (
                  <span className={`notif-filter-count ${key === 'UNREAD' ? 'notif-filter-count--unread' : ''}`}>
                    {count}
                  </span>
                )}
              </button>
            ))}
            <button
              className="notif-mark-all-btn"
              onClick={handleMarkAllRead}
              disabled={unreadCount === 0}
            >
              <CheckCheck size={15} /> Mark all read
            </button>
            {import.meta.env.DEV && (
              <button
                className="notif-mark-all-btn"
                onClick={() => navigate('/dev/trigger-notification')}
              >
                <BellRing size={15} /> Run current-data scan
              </button>
            )}
          </div>
        </section>

        {/* NOTIFICATION CARDS */}
        {filteredNotifications.length > 0 ? (
          <>
            <div className="notif-card-list">
              {paginatedNotifications.map((notif) => {
                const isUnread = !(notif.readBy || []).includes(uid);
              const isResolved = Boolean(notif.resolved);
              const sev = getSeverityConfig(notif.priority);
              const SevIcon = sev.icon;
              return (
                <div
                  key={notif.id}
                  className={`notif-card ${sev.cardClass} ${isUnread ? 'notif-card--unread' : 'notif-card--read'} ${isResolved ? 'notif-card--resolved' : ''}`}
                >
                  {/* TOP ROW: icon + severity badge + title + unread dot + status pills */}
                  <div className="notif-card-header">
                    <div className="notif-card-title-wrap">
                      <div className={`notif-card-icon ${sev.iconClass}`}>
                        <SevIcon size={17} />
                      </div>
                      <div className="notif-card-title-block">
                        <div className="notif-card-header-row">
                          <span className={`notif-severity-badge ${sev.badgeClass}`}>
                            {notif.priority === 'CRITICAL' ? <Zap size={10} /> : notif.priority === 'WARNING' ? <AlertTriangle size={10} /> : <Info size={10} />}
                            {sev.label}
                          </span>
                          {isUnread && <span className="notif-unread-dot" title="Unread" />}
                        </div>
                        <h4 className="notif-card-title">{notif.title}</h4>
                      </div>
                    </div>
                    <div className="notif-card-statuses">
                      <span className={`notif-card-status ${isUnread ? 'notif-card-status--unread' : 'notif-card-status--read'}`}>
                        {isUnread ? 'Unread' : 'Read'}
                      </span>
                      <span className={`notif-card-status ${isResolved ? 'notif-card-status--resolved' : 'notif-card-status--active'}`}>
                        {isResolved ? '✓ Resolved' : '● Active'}
                      </span>
                    </div>
                  </div>

                  {/* FARM IDENTITY */}
                  {notif.farmId && (
                    <div className="notif-card-farm-row">
                      <span className="notif-card-farm-label">Farm</span>
                      <strong className="notif-card-farm-id">{notif.farmId}</strong>
                      {notif.farmName && notif.farmName !== notif.farmId && (
                        <>
                          <span className="notif-card-meta-dot">•</span>
                          <span className="notif-card-farm-label">Farm Name</span>
                          <strong className="notif-card-farm-name">{notif.farmName}</strong>
                        </>
                      )}
                    </div>
                  )}

                  {/* MESSAGE BODY */}
                  <p className="notif-card-msg">{notif.message}</p>

                  {/* RESOLUTION DETAILS (when resolved) */}
                  {isResolved && (
                    <div className="notif-resolved-box">
                      <div className="notif-resolved-header">
                        <CheckCheck size={14} />
                        <span>
                          <strong>Resolved</strong> by {notif.resolvedByName || notif.resolvedBy || 'Administrator'} • {formatTimestamp(notif.resolvedAt || '')}
                        </span>
                      </div>
                      {notif.resolutionNotes && (
                        <div className="notif-resolved-notes">
                          "{notif.resolutionNotes}"
                        </div>
                      )}
                    </div>
                  )}

                  {/* INLINE RESOLUTION FORM (when Admin is resolving) */}
                  {!isResolved && activeRole === 'admin' && resolvingId === notif.id && (
                    <div className="notif-resolve-form">
                      <input
                        type="text"
                        className="form-input form-input--sm notif-resolve-input"
                        placeholder="Optional resolution notes (e.g. inspected shed, treatment administered)..."
                        value={resolutionNotesInput}
                        onChange={(e) => setResolutionNotesInput(e.target.value)}
                        autoFocus
                      />
                      <div className="notif-resolve-buttons">
                        <button
                          className="btn btn--primary btn--sm"
                          onClick={() => handleConfirmResolve(notif.id)}
                          disabled={isSubmittingResolution}
                        >
                          <Check size={13} /> {isSubmittingResolution ? 'Resolving…' : 'Confirm Resolve'}
                        </button>
                        <button
                          className="btn btn--outline btn--sm"
                          onClick={() => {
                            setResolvingId(null);
                            setResolutionNotesInput('');
                          }}
                          disabled={isSubmittingResolution}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* FOOTER: timestamp + source + actions */}
                  <div className="notif-card-footer">
                    <div className="notif-card-meta">
                      <span className="notif-card-timestamp">{formatTimestamp(notif.createdAt)}</span>
                      <span className="notif-card-meta-dot">•</span>
                      <span className="notif-card-source">{getSourceLabel(notif)}</span>
                    </div>
                    <div className="notif-card-actions">
                      {isUnread && (
                        <button
                          className="btn btn--outline btn--sm"
                          onClick={() => handleMarkRead(notif.id)}
                        >
                          <Check size={14} /> Mark Read
                        </button>
                      )}
                      {!isResolved && activeRole === 'admin' && resolvingId !== notif.id && (
                        <button
                          className="btn btn--outline btn--sm notif-resolve-btn"
                          onClick={() => {
                            setResolvingId(notif.id);
                            setResolutionNotesInput('');
                          }}
                        >
                          <CheckCircle size={14} /> Resolve Alert
                        </button>
                      )}
                      {notif.farmId && (
                        <button
                          className="btn btn--primary btn--sm"
                          onClick={() => navigate(`/${activeRole}/farms/${notif.farmId}`)}
                        >
                          View farm →
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredNotifications.length > PAGE_SIZE && (
            <div
              className="notif-pagination-bar"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '1.25rem',
                padding: '0.75rem 1rem',
                background: '#ffffff',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
              }}
            >
              <span style={{ fontSize: '0.875rem', color: '#64748b' }}>
                Showing {(currentPage - 1) * PAGE_SIZE + 1}–
                {Math.min(currentPage * PAGE_SIZE, filteredNotifications.length)} of {filteredNotifications.length} alerts
              </span>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn--outline btn--sm"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#334155', minWidth: '4.5rem', textAlign: 'center' }}>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  className="btn btn--outline btn--sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
        ) : (
          <div className="notification-empty-panel">
            <div className="notification-empty-icon">
              {isLoading ? <BellRing size={34} className="notif-scanning-anim" /> : <ShieldCheck size={34} />}
            </div>
            <div>
              <p className="notif-empty-title">
                {isLoading ? 'Scanning farm data…' : 'All clear for this view'}
              </p>
              <p className="notif-empty-sub">
                {isLoading ? 'Evaluating operational conditions from recent farm reports.'
                  : 'You have no notifications matching this filter. New operational alerts will appear here automatically.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
