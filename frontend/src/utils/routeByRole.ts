export const ROLE_ROUTES: Record<string, string> = {
  farmer: '/farmer/form',
  supervisor: '/supervisor',
  admin: '/admin',
};

export function getRouteForRole(role: string): string {
  return ROLE_ROUTES[role] || '/login';
}
