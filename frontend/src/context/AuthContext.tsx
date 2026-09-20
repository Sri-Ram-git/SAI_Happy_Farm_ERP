import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react';
import { getUserProfile, type UserProfile } from '../services/userService';
import { normalizeRole } from '../utils/normalizeRole';
import { getFirebaseAuth } from '../config/firebase';

interface AuthContextValue {
  firebaseUser: any;
  userProfile: UserProfile | null;
  role: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  authError: string | null;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  firebaseUser: null,
  userProfile: null,
  role: null,
  loading: true,
  isAuthenticated: false,
  authError: null,
  clearAuthError: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const authInstance = getFirebaseAuth();
    if (!authInstance) {
      console.warn('[AuthContext] Firebase Auth not available yet. Retrying initialization...');
      setLoading(false);
      return;
    }

    const safeSignOut = async () => {
      const a = getFirebaseAuth();
      if (a && typeof a.signOut === 'function') {
        try { await a.signOut(); } catch {}
      }
    };

    const unsubscribe = authInstance.onAuthStateChanged(async (user: any) => {
      if (!mountedRef.current) return;

      if (!user) {
        setFirebaseUser(null);
        setUserProfile(null);
        setLoading(false);
        return;
      }

      setFirebaseUser(user);
      setAuthError(null);

      try {
        const profile = await getUserProfile(user.uid);

        if (!mountedRef.current) return;

        if (!profile) {
          await safeSignOut();
          setFirebaseUser(null);
          setUserProfile(null);
          setAuthError('User profile not found. Please contact the administrator.');
          setLoading(false);
          return;
        }

        if (profile.active !== true) {
          await safeSignOut();
          setFirebaseUser(null);
          setUserProfile(null);
          setAuthError('Account is disabled. Please contact the administrator.');
          setLoading(false);
          return;
        }

        if (!profile.role) {
          await safeSignOut();
          setFirebaseUser(null);
          setUserProfile(null);
          setAuthError('User role is not configured.');
          setLoading(false);
          return;
        }

        const normalizedRole = normalizeRole(profile.role);

        if (!normalizedRole) {
          await safeSignOut();
          setFirebaseUser(null);
          setUserProfile(null);
          setAuthError('User role is not configured.');
          setLoading(false);
          return;
        }

        if (normalizedRole === 'farmer' && profile.farmIds.length === 0) {
          await safeSignOut();
          setFirebaseUser(null);
          setUserProfile(null);
          setAuthError('No farm access assigned to this account.');
          setLoading(false);
          return;
        }

        setUserProfile(profile);
        setLoading(false);

      } catch (err: any) {
        console.error('[Auth] Profile fetch error:', err.code, err.message);
        if (!mountedRef.current) return;
        await safeSignOut();
        setFirebaseUser(null);
        setUserProfile(null);
        setAuthError('Failed to load profile. Please try again.');
        setLoading(false);
      }
    });

    return () => {
      mountedRef.current = false;
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  const clearAuthError = () => setAuthError(null);

  const normalizedRole = normalizeRole(userProfile?.role);
  const isAuth = !!firebaseUser && !!userProfile && userProfile.active === true && !!normalizedRole;

  const value: AuthContextValue = {
    firebaseUser,
    userProfile,
    role: normalizedRole,
    loading,
    isAuthenticated: isAuth,
    authError,
    clearAuthError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
