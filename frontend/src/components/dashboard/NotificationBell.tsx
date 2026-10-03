import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { AppNotification, markNotificationAsRead, markAllNotificationsAsRead, subscribeToUserNotifications } from '../../services/notificationService';
import { useAuth } from '../../context/AuthContext';

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

interface NotificationBellProps {
  role?: 'admin' | 'supervisor';
}

export function NotificationBell({ role }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { userProfile, role: authRole } = useAuth();
  
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
  const unreadCount = notifications.filter(n => !(n.readBy || []).includes(uid)).length;

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
      setIsOpen(false);
    }
  }, []);

  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') setIsOpen(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, handleClickOutside, handleEscape]);

  const handleMarkAllRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (uid) {
      await markAllNotificationsAsRead(notifications, uid);
    }
  };

  const handleNotificationClick = async (notif: AppNotification) => {
    const isUnread = !(notif.readBy || []).includes(uid);
    if (isUnread && uid) {
      await markNotificationAsRead(notif.id, uid);
    }
    setIsOpen(false);
    navigate(`/${activeRole}/notifications`);
  };

  return (
    <div className="notif-bell-wrap" ref={dropdownRef}>
      <button 
        className="notif-bell-btn" 
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="notif-bell-badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notif-dropdown">
          <div className="notif-dropdown-header">
            <span className="notif-header-title">Notifications</span>
            {unreadCount > 0 && (
              <button 
                className="notif-mark-btn" 
                onClick={handleMarkAllRead}
              >
                Mark all read
              </button>
            )}
          </div>
          
          <div className="notif-dropdown-body">
            {notifications.length === 0 ? (
              <div className="notif-empty-state">
                <Bell size={28} className="notif-empty-icon" />
                <p className="notif-empty-title">You're all caught up</p>
                <p className="notif-empty-sub">No new notifications right now.</p>
              </div>
            ) : (
              notifications.slice(0, 5).map(notif => {
                const isUnread = !(notif.readBy || []).includes(uid);
                return (
                  <div 
                    key={notif.id} 
                    className={`notif-item ${isUnread ? 'notif-item--unread' : ''}`}
                    onClick={() => handleNotificationClick(notif)}
                  >
                    <div 
                      className="notif-priority-dot" 
                      style={{ backgroundColor: getPriorityColor(notif.priority) }} 
                    />
                    <div className="notif-item-content">
                      <div className="notif-item-title-row">
                        <span className="notif-item-title">{notif.title}</span>
                      </div>
                      {notif.farmName && (
                        <div className="notif-item-farm">Farm {notif.farmName}</div>
                      )}
                      <div className="notif-item-meta">
                        {getRelativeTime(notif.createdAt)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          
          <div className="notif-dropdown-footer">
            <button 
              className="notif-view-all-btn"
              onClick={() => {
                setIsOpen(false);
                navigate(`/${activeRole}/notifications`);
              }}
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
