import { useState, useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LoadingScreen } from './LoadingScreen';

interface Props {
  allowedRoles: string[];
  children: ReactNode;
}

export function ProtectedManagementRoute({ allowedRoles, children }: Props) {
  const { loading, isAuthenticated, role } = useAuth();
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated || !role) {
      navigate('/management/login', { replace: true });
      return;
    }
    if (!allowedRoles.includes(role)) {
      navigate('/management/login', { replace: true });
      return;
    }
    setChecked(true);
  }, [loading, isAuthenticated, role, navigate, allowedRoles]);

  if (loading) return <LoadingScreen />;
  if (!checked) return null;
  return <>{children}</>;
}
