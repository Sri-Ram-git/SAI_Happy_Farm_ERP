import { useState, useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LoadingScreen } from './LoadingScreen';

interface Props {
  allowedRoles: string[];
  children: ReactNode;
}

export function ProtectedManagementRoute({ allowedRoles, children }: Props) {
  return <>{children}</>;
}
