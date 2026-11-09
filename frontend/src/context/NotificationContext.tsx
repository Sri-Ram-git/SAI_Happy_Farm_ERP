import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
  type ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import {
  AppNotification,
  subscribeToUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  resolveNotification as resolveNotificationService,
  bootstrapNotificationsForUser,
} from '../services/notificationService';

export interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  activeCount: number;
  resolvedCount: number;
  readCount: number;
  loading: boolean;
  error: string | null;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  resolveNotification: (notificationId: string, resolutionNotes?: string) => Promise<void>;
  refreshBootstrap: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function useNotifications(): NotificationContextType {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { userProfile, role: authRole, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const bootstrappedSessionKeyRef = useRef<string | null>(null);

  const activeRole = useMemo(() => {
    const rawRole = (userProfile?.role || authRole || '').trim().toLowerCase();
    return rawRole === 'admin' ? 'admin' : rawRole === 'supervisor' ? 'supervisor' : null;
  }, [userProfile?.role, authRole]);

  // Stabilize supervisor farmIds array to prevent unnecessary re-subscriptions
  const supervisorFarmIdsKey = useMemo(() => {
    if (activeRole !== 'supervisor' || !Array.isArray(userProfile?.farmIds)) return '';
    return Array.from(new Set(userProfile.farmIds.filter(Boolean))).sort().join(',');
  }, [activeRole, userProfile?.farmIds]);

  const assignedFarmIds = useMemo(() => {
    if (activeRole !== 'supervisor') return undefined;
    return supervisorFarmIdsKey ? supervisorFarmIdsKey.split(',') : [];
  }, [activeRole, supervisorFarmIdsKey]);

  useEffect(() => {
    // Only management roles (admin, supervisor) subscribe to in-app notifications
    if (!isAuthenticated || !userProfile?.uid || !activeRole) {
      setNotifications([]);
      setLoading(false);
      setError(null);
      bootstrappedSessionKeyRef.current = null;
      return;
    }

    // Reset notifications immediately upon account/role switch to prevent stale alert leakage
    setNotifications([]);
    setLoading(true);
    setError(null);

    // Initial background bootstrap to ensure any qualifying operational/compliance
    // alerts already present in persisted farm reports are synchronized to Firestore.
    const sessionKey = `${userProfile.uid}_${activeRole}_${supervisorFarmIdsKey}`;
    if (bootstrappedSessionKeyRef.current !== sessionKey) {
      bootstrappedSessionKeyRef.current = sessionKey;
      bootstrapNotificationsForUser(activeRole, assignedFarmIds).catch((err) => {
        console.warn('[NotificationProvider] Background bootstrap caught:', err);
      });
    }

    // Single shared authoritative Firestore real-time listener
    const unsubscribe = subscribeToUserNotifications(
      activeRole,
      assignedFarmIds,
      (incoming) => {
        setNotifications(incoming);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('[NotificationProvider] Listener error:', err);
        setError(err?.message || 'Notification subscription encountered an error');
        setLoading(false);
      },
    );

    return () => {
      unsubscribe();
    };
  }, [isAuthenticated, userProfile?.uid, activeRole, supervisorFarmIdsKey, assignedFarmIds]);

  const uid = userProfile?.uid || '';

  const unreadCount = useMemo(() => {
    if (!uid) return 0;
    return notifications.filter((n) => !(n.readBy || []).includes(uid)).length;
  }, [notifications, uid]);

  const criticalCount = useMemo(() => {
    return notifications.filter((n) => n.priority === 'CRITICAL').length;
  }, [notifications]);

  const warningCount = useMemo(() => {
    return notifications.filter((n) => n.priority === 'WARNING').length;
  }, [notifications]);

  const infoCount = useMemo(() => {
    return notifications.filter((n) => n.priority === 'INFO').length;
  }, [notifications]);

  const activeCount = useMemo(() => {
    return notifications.filter((n) => !n.resolved).length;
  }, [notifications]);

  const resolvedCount = useMemo(() => {
    return notifications.filter((n) => Boolean(n.resolved)).length;
  }, [notifications]);

  const readCount = useMemo(() => {
    if (!uid) return 0;
    return notifications.filter((n) => (n.readBy || []).includes(uid)).length;
  }, [notifications, uid]);

  const markAsRead = useCallback(
    async (notificationId: string) => {
      if (!uid) return;
      // Optimistic state update for instant UI feedback in both Overview and Notification Centre
      setNotifications((prev) =>
        prev.map((n) => {
          if (n.id === notificationId && !(n.readBy || []).includes(uid)) {
            return { ...n, readBy: [...(n.readBy || []), uid] };
          }
          return n;
        }),
      );
      try {
        await markNotificationAsRead(notificationId, uid);
      } catch (err) {
        console.error('[NotificationProvider] markNotificationAsRead failed:', err);
      }
    },
    [uid],
  );

  const markAllAsRead = useCallback(async () => {
    if (!uid) return;
    const unread = notifications.filter((n) => !(n.readBy || []).includes(uid));
    if (unread.length === 0) return;

    // Optimistic state update for instant UI feedback
    setNotifications((prev) =>
      prev.map((n) => {
        if (!(n.readBy || []).includes(uid)) {
          return { ...n, readBy: [...(n.readBy || []), uid] };
        }
        return n;
      }),
    );
    try {
      await markAllNotificationsAsRead(notifications, uid);
    } catch (err) {
      console.error('[NotificationProvider] markAllNotificationsAsRead failed:', err);
    }
  }, [uid, notifications]);

  const resolveNotification = useCallback(
    async (notificationId: string, resolutionNotes?: string) => {
      if (!uid) {
        throw new Error('[NotificationProvider] User must be authenticated to resolve notifications');
      }

      // Check if already resolved in local state
      const targetNotif = notifications.find((n) => n.id === notificationId);
      if (targetNotif?.resolved) {
        throw new Error(`[NotificationProvider] Notification "${notificationId}" is already resolved`);
      }

      const now = new Date().toISOString();
      // Provenance: Use trusted profile source if available; otherwise retain UID as authoritative (do not invent identity)
      const trustedProfileName = userProfile?.name?.trim() || null;
      const resolverDisplayName = trustedProfileName || uid;

      // Optimistic state update for instant UI feedback across all views
      setNotifications((prev) =>
        prev.map((n) => {
          if (n.id === notificationId) {
            return {
              ...n,
              resolved: true,
              resolvedAt: now,
              resolvedBy: uid,
              resolvedByName: resolverDisplayName,
              resolutionNotes: resolutionNotes && resolutionNotes.trim() ? resolutionNotes.trim() : null,
              readBy: (n.readBy || []).includes(uid) ? n.readBy : [...(n.readBy || []), uid],
            };
          }
          return n;
        }),
      );

      try {
        await resolveNotificationService(
          notificationId,
          { uid, name: resolverDisplayName },
          resolutionNotes,
        );
      } catch (err: any) {
        console.error('[NotificationProvider] resolveNotification failed:', err);
        setError(err?.message || 'Failed to resolve notification');
        throw err;
      }
    },
    [uid, userProfile?.name],
  );

  const refreshBootstrap = useCallback(async () => {
    if (!activeRole) return;
    setLoading(true);
    try {
      await bootstrapNotificationsForUser(activeRole, assignedFarmIds);
    } catch (err: any) {
      setError(err?.message || 'Failed to refresh notifications');
    } finally {
      setLoading(false);
    }
  }, [activeRole, assignedFarmIds]);

  const value = useMemo<NotificationContextType>(
    () => ({
      notifications,
      unreadCount,
      criticalCount,
      warningCount,
      infoCount,
      activeCount,
      resolvedCount,
      readCount,
      loading,
      error,
      markAsRead,
      markAllAsRead,
      resolveNotification,
      refreshBootstrap,
    }),
    [
      notifications,
      unreadCount,
      criticalCount,
      warningCount,
      infoCount,
      activeCount,
      resolvedCount,
      readCount,
      loading,
      error,
      markAsRead,
      markAllAsRead,
      resolveNotification,
      refreshBootstrap,
    ],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}
