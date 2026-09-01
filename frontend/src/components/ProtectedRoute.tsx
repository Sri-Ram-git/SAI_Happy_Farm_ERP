import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getRouteForRole } from '../utils/routeByRole';
import { LoadingScreen } from './LoadingScreen';

interface Props {
  allowedRole: string;
  children: React.ReactNode;
}

export function ProtectedRoute({ allowedRole, children }: Props) {
  const { role, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  console.log('[ProtectedRoute] RENDER:', { path: location.pathname, allowedRole, loading, isAuthenticated, role });

  if (loading) {
    console.log('[ProtectedRoute] → LoadingScreen');
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    console.log('[ProtectedRoute] → REDIRECT TO /login (not authenticated)');
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (role !== allowedRole) {
    const dest = getRouteForRole(role || '');
    console.log('[ProtectedRoute] → REDIRECT TO', dest, '(wrong role:', role, 'needed:', allowedRole, ')');
    return <Navigate to={dest} replace />;
  }

  console.log('[ProtectedRoute] → RENDERING children');
  return <>{children}</>;
}
