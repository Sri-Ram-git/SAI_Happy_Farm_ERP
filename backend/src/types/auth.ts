export enum UserRole {
  FARMER = 'farmer',
  SUPERVISOR = 'supervisor',
  OFFICE_STAFF = 'office_staff',
  ADMIN = 'admin',
}

export interface AuthenticatedUser {
  uid: string;
  email: string | null;
  role: UserRole;
  farmIds: string[];
}

export interface AuthContext {
  user: AuthenticatedUser;
  requestId: string;
}
