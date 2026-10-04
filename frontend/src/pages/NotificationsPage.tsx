import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '../components/dashboard/DashboardLayout';
import { AlertTriangle, BellRing, Check, CheckCheck, Info, ShieldCheck, Skull, Zap } from 'lucide-react';
import {
  AppNotification,
  subscribeToUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  bootstrapNotificationsFromFarmReports,
  generateMissingReportNotifications,
} from '../services/notificationService';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { subscribeToFarms } from '../services/farmDataService';
import { subscribeToAllDailyReports, subscribeToDailyReportsByFarms } from '../services/reportDataService';
import { subscribeToAllUsers } from '../services/userDataService';
import { getDaysAgo, getIstDate } from '../utils/dateUtils';

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

export function NotificationsPage({ role }: NotificationsPageProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [filter, setFilter] = useState('ALL');
  const [bootstrapping, setBootstrapping] = useState(false);
  const [bootstrapDone, setBootstrapDone] = useState(false);
  const { userProfile, role: authRole } = useAuth();
  const navigate = useNavigate();

  const activeRole = role || authRole || 'supervisor';

  const isLoading = bootstrapping || !bootstrapDone;

  // Subscribe to real-time notifications
  useEffect(() => {
    if (!userProfile?.uid) return;
    const assignedFarmIds = activeRole === 'supervisor' ? userProfile.farmIds : undefined;
    const unsubscribe = subscribeToUserNotifications(activeRole, assignedFarmIds, (notifs) => {
      setNotifications((prev) => {
        if (notifs.length === 0 && prev.length > 0) {
          // Prevent listener from accidentally wiping state if it temporarily evaluates to empty
          return prev;
        }
        const map = new Map(prev.map(n => [n.id, n]));
        notifs.forEach(n => map.set(n.id, n));
        return Array.from(map.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      });
    });
    return () => unsubscribe();
  }, [userProfile, activeRole]);

  // Bootstrap: derive notifications from existing Firestore data when page loads
  // Uses merge:true so existing readBy state is never overwritten
  // The deterministic doc IDs prevent duplicates on repeated loads
  const runBootstrap = useCallback(async () => {
    if (bootstrapDone || bootstrapping || !userProfile?.uid) return;
    setBootstrapping(true);

    try {
      const startDate = getDaysAgo(6); // 7-day window matching Overview default
      const endDate = getIstDate();

      await new Promise<void>((resolve) => {
        const farmMap = new Map<string, { reports: any[]; farmName: string }>();
        let farmsLoaded = false;
        let reportsLoaded = false;
        let usersLoaded = false;
        let farms: any[] = [];
        let allReports: any[] = [];
        let allUsers: any[] = [];

        const assignedFarmIds = activeRole === 'supervisor' ? (userProfile.farmIds || []) : undefined;

        const unsubFarms = subscribeToFarms(assignedFarmIds, (loadedFarms) => {
          farms = loadedFarms.filter((f) => f.active !== false);
          farmsLoaded = true;
          tryCommit();
        });

        const reportCb = (loadedReports: any[]) => {
          allReports = loadedReports;
          reportsLoaded = true;
          tryCommit();
        };

        const unsubUsers = subscribeToAllUsers((loadedUsers) => {
          allUsers = loadedUsers;
          usersLoaded = true;
          tryCommit();
        });

        let reportsUnsub: (() => void) | null = null;
        if (activeRole === 'supervisor' && assignedFarmIds && assignedFarmIds.length > 0) {
          reportsUnsub = subscribeToDailyReportsByFarms(assignedFarmIds, startDate, endDate, reportCb);
        } else if (activeRole !== 'supervisor') {
          reportsUnsub = subscribeToAllDailyReports(startDate, endDate, reportCb);
        } else {
          reportsLoaded = true;
        }

        let committed = false;
        function tryCommit() {
          if (committed || !farmsLoaded || !reportsLoaded || !usersLoaded) return;
          committed = true;
          unsubFarms();
          unsubUsers();
          if (reportsUnsub) reportsUnsub();

          // Build farm → reports map
          farms.forEach((farm) => {
            const farmReports = allReports.filter((r) => r.farmId === farm.farmId);
            farmMap.set(farm.farmId, {
              reports: farmReports,
              farmName: farm.name || farm.farmId,
            });
          });

          const activeFarmers = allUsers.filter((user) =>
            user.active !== false && String(user.role || '').trim().toLowerCase() === 'farmer'
          );

          Promise.all([
            bootstrapNotificationsFromFarmReports(farmMap),
            generateMissingReportNotifications(allReports, farms, activeFarmers),
          ])
            .then(([bootNotifs, missingNotifs]) => {
               setNotifications(prev => {
                  const map = new Map(prev.map(n => [n.id, n]));
                  [...bootNotifs, ...missingNotifs].forEach(n => map.set(n.id, n));
                  return Array.from(map.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
               });
            })
            .catch((err) => console.error('[NotificationsPage] Bootstrap error:', err))
            .finally(() => resolve());
        }

        // Safety timeout: don't block UI forever
        setTimeout(() => {
          if (!committed) {
            committed = true;
            unsubFarms();
            unsubUsers();
            if (reportsUnsub) reportsUnsub();
            resolve();
          }
        }, 15000);
      });
    } catch (err) {
      console.error('[NotificationsPage] Bootstrap failed:', err);
    } finally {
      setBootstrapping(false);
      setBootstrapDone(true);
    }
  }, [userProfile, activeRole, bootstrapDone, bootstrapping]);

  useEffect(() => {
    if (userProfile?.uid) {
      runBootstrap();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.uid]);

  const uid = userProfile?.uid || '';
  const unreadCount = notifications.filter((n) => !(n.readBy || []).includes(uid)).length;
  const criticalCount = notifications.filter((n) => n.priority === 'CRITICAL').length;
  const warningCount = notifications.filter((n) => n.priority === 'WARNING').length;

  const handleMarkAllRead = async () => {
    if (uid) await markAllNotificationsAsRead(notifications, uid);
  };

  const handleMarkRead = async (id: string) => {
    if (uid) await markNotificationAsRead(id, uid);
  };

  const filteredNotifications = notifications.filter((notif) => {
    const isUnread = !(notif.readBy || []).includes(uid);
    if (filter === 'UNREAD') return isUnread;
    if (filter === 'CRITICAL') return notif.priority === 'CRITICAL';
    if (filter === 'WARNING') return notif.priority === 'WARNING';
    if (filter === 'INFO') return notif.priority === 'INFO';
    return true;
  });

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
          <div className="notification-stat-card notification-stat-card--unread">
            <span className="notification-stat-label">Unread</span>
            <strong>{isLoading ? '…' : unreadCount}</strong>
            <span>Needs your attention</span>
          </div>
          <div className="notification-stat-card notification-stat-card--critical">
            <span className="notification-stat-label">Critical</span>
            <strong>{isLoading ? '…' : criticalCount}</strong>
            <span>Immediate action</span>
          </div>
          <div className="notification-stat-card notification-stat-card--warning">
            <span className="notification-stat-label">Warnings</span>
            <strong>{isLoading ? '…' : warningCount}</strong>
            <span>Operational follow-up</span>
          </div>
          <div className="notification-stat-card notification-stat-card--total">
            <span className="notification-stat-label">All alerts</span>
            <strong>{isLoading ? '…' : notifications.length}</strong>
            <span>Notification history</span>
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
            {(['ALL', 'UNREAD', 'CRITICAL', 'WARNING', 'INFO'] as const).map((f) => (
              <button
                key={f}
                className={`notif-filter-btn ${filter === f ? 'notif-filter-btn--active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f === 'ALL' ? 'All' : f === 'UNREAD' ? 'Unread' : f === 'CRITICAL' ? 'Critical' : f === 'WARNING' ? 'Warning' : 'Information'}
                {f === 'ALL' && notifications.length > 0 && (
                  <span className="notif-filter-count">{notifications.length}</span>
                )}
                {f === 'UNREAD' && unreadCount > 0 && (
                  <span className="notif-filter-count notif-filter-count--unread">{unreadCount}</span>
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
          <div className="notif-card-list">
            {filteredNotifications.map((notif) => {
              const isUnread = !(notif.readBy || []).includes(uid);
              const sev = getSeverityConfig(notif.priority);
              const SevIcon = sev.icon;
              return (
                <div
                  key={notif.id}
                  className={`notif-card ${sev.cardClass} ${isUnread ? 'notif-card--unread' : 'notif-card--read'}`}
                >
                  {/* TOP ROW: icon + severity badge + title + unread dot + status pill */}
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
                    <span className={`notif-card-status ${isUnread ? 'notif-card-status--unread' : ''}`}>
                      {isUnread ? 'Unread' : 'Read'}
                    </span>
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


