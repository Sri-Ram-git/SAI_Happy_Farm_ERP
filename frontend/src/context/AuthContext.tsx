import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react';
import { getUserProfile, type UserProfile } from '../services/userService';

const f = (window as any).firebase;

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

    const unsubscribe = f.auth().onAuthStateChanged(async (user: any) => {
      console.log('[Auth] onAuthStateChanged:', user ? user.uid : null);

      if (!mountedRef.current) return;

      if (!user) {
        console.log('[Auth] No user → clearing');
        setFirebaseUser(null);
        setUserProfile(null);
        setLoading(false);
        return;
      }

      setFirebaseUser(user);
      setAuthError(null);
      console.log('[Auth] Firebase user:', user.uid, user.email);

      try {
        const profile = await getUserProfile(user.uid);
        console.log('[Auth] Profile returned:', profile);

        if (!mountedRef.current) return;

        if (!profile) {
          console.log('[Auth] FAIL: profile not found');
          await f.auth().signOut();
          setFirebaseUser(null);
          setUserProfile(null);
          setAuthError('User profile not found. Please contact the administrator.');
          setLoading(false);
          return;
        }

        if (profile.active !== true) {
          console.log('[Auth] FAIL: active !== true, value:', profile.active);
          await f.auth().signOut();
          setFirebaseUser(null);
          setUserProfile(null);
          setAuthError('Account is disabled.');
          setLoading(false);
          return;
        }

        if (!profile.role) {
          console.log('[Auth] FAIL: role is missing');
          await f.auth().signOut();
          setFirebaseUser(null);
          setUserProfile(null);
          setAuthError('User role is not configured.');
          setLoading(false);
          return;
        }

        if (profile.role !== 'farmer') {
          console.log('[Auth] FAIL: role is', profile.role, ', expected farmer');
          await f.auth().signOut();
          setFirebaseUser(null);
          setUserProfile(null);
          setAuthError('This account does not have access to the Farmer portal. Role: "' + profile.role + '"');
          setLoading(false);
          return;
        }

        if (profile.farmIds.length === 0) {
          console.log('[Auth] FAIL: no farmIds');
          await f.auth().signOut();
          setFirebaseUser(null);
          setUserProfile(null);
          setAuthError('No farm access assigned to this account.');
          setLoading(false);
          return;
        }

        console.log('[Auth] SUCCESS: setting authenticated profile');
        setUserProfile(profile);
        setLoading(false);

      } catch (err: any) {
        console.error('[Auth] Profile fetch error:', err.code, err.message);
        if (!mountedRef.current) return;
        await f.auth().signOut();
        setFirebaseUser(null);
        setUserProfile(null);
        setAuthError('Failed to load profile: ' + (err.code || err.message));
        setLoading(false);
      }
    });

    return () => {
      mountedRef.current = false;
      unsubscribe();
    };
  }, []);

  const clearAuthError = () => setAuthError(null);

  const isAuth = !!firebaseUser && !!userProfile && userProfile.active === true && userProfile.role === 'farmer' && userProfile.farmIds.length > 0;

  const value: AuthContextValue = {
    firebaseUser,
    userProfile,
    role: userProfile?.role ?? null,
    loading,
    isAuthenticated: isAuth,
    authError,
    clearAuthError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
