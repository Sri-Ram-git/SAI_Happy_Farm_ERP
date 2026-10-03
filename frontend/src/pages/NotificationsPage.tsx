import { useState, useEffect } from 'react';
import { DashboardLayout } from '../components/dashboard/DashboardLayout';
import { CheckCheck, Eye, Check } from 'lucide-react';
import { AppNotification, subscribeToUserNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '../services/notificationService';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

interface NotificationsPageProps {
  role?: 'admin' | 'supervisor';
}

function getRelativeTime(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'CRITICAL': return 'var(--red-600)';
    case 'WARNING': return 'var(--amber-600)';
    default: return 'var(--blue-500)';
  }
}

export function NotificationsPage({ role }: NotificationsPageProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [filter, setFilter] = useState('ALL');
  const { userProfile, role: authRole } = useAuth();
  const navigate = useNavigate();

  const activeRole = role || authRole || 'supervisor';

  useEffect(() => {
    if (!userProfile?.uid) return;
    const assignedFarmIds = activeRole === 'supervisor' ? userProfile.farmIds : undefined;
    const unsubscribe = subscribeToUserNotifications(activeRole, assignedFarmIds, (notifs) => {
      setNotifications(notifs);
    });
    return () => unsubscribe();
  }, [userProfile, activeRole]);

  const uid = userProfile?.uid || '';

  const handleMarkAllRead = async () => {
    if (uid) {
      await markAllNotificationsAsRead(notifications, uid);
    }
  };

  const handleMarkRead = async (id: string) => {
    if (uid) {
      await markNotificationAsRead(id, uid);
    }
  };

  const filteredNotifications = notifications.filter(notif => {
    const isUnread = !(notif.readBy || []).includes(uid);
    if (filter === 'UNREAD') return isUnread;
    if (filter === 'CRITICAL' || filter === 'WARNING' || filter === 'INFO') return notif.priority === filter;
    return true;
  });

  return (
    <DashboardLayout role={activeRole as any} userName={userProfile?.name}>
      <div className="mgmt-page">
        <div className="mgmt-page-header">
          <div>
            <h2>Notifications</h2>
            <p className="welcome-subtitle">System alerts, farm events and operational updates</p>
          </div>
          
          <div className="mgmt-header-actions">
            <div className="notif-page-filters">
              {['ALL', 'UNREAD', 'CRITICAL', 'WARNING', 'INFO'].map(f => (
                <button 
                  key={f}
                  className={`notif-filter-btn ${filter === f ? 'notif-filter-btn--active' : ''}`}
                  onClick={() => setFilter(f)}
                >
                  {f === 'ALL' ? 'All' : f === 'UNREAD' ? 'Unread' : f === 'CRITICAL' ? 'Critical' : f === 'WARNING' ? 'Warning' : 'Information'}
                </button>
              ))}
              <button className="notif-filter-btn" onClick={handleMarkAllRead}>
                Mark all read
              </button>
            </div>
          </div>
        </div>
        
        {filteredNotifications.length > 0 ? (
          <div className="notif-card-list">
            {filteredNotifications.map(notif => {
              const isUnread = !(notif.readBy || []).includes(uid);
              return (
                <div 
                  key={notif.id} 
                  className={`notif-card ${isUnread ? 'notif-card--unread' : ''}`}
                >
                  <div className="notif-card-header">
                    <div className="notif-card-title-wrap">
                      <div className="notif-priority-dot" style={{ backgroundColor: getPriorityColor(notif.priority) }} />
                      <h4 className="notif-card-title">{notif.title}</h4>
                      {isUnread && <span className="notif-unread-dot" />}
                    </div>
                  </div>
                  
                  {notif.farmName && (
                    <div className="notif-card-farm">Farm {notif.farmName}</div>
                  )}
                  
                  <p className="notif-card-msg">{notif.message}</p>
                  
                  <div className="notif-card-footer">
                    <div className="notif-card-meta">
                      {getRelativeTime(notif.createdAt)}
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
                          View →
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="section-card">
            <div className="notif-empty-state">
              <CheckCheck size={36} className="notif-empty-icon" />
              <p className="notif-empty-title">All caught up!</p>
              <p className="notif-empty-sub">You have no notifications matching this filter.</p>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
