import type { ReactNode } from 'react';

interface Props {
  allowedRoles: string[];
  children: ReactNode;
}

export function ProtectedManagementRoute({ children }: Props) {
  return <>{children}</>;
}
