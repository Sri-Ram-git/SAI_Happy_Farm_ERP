import { auth, db } from '../config/firebase';

export interface UserDoc {
  uid: string;
  email: string;
  role: string;
  farmIds: string[];
  active: boolean;
  name: string;
  createdat?: any;
  createdAt?: any;
}

export async function getUserByUid(uid: string): Promise<UserDoc | null> {
  const doc = await db.collection('users').doc(uid).get();
  if (!doc.exists) return null;
  const data = doc.data();
  const createdat = data.createdat ?? data.createdAt ?? data.created_at ?? null;
  return {
    uid,
    email: data.email ?? '',
    role: data.role ?? '',
    farmIds: Array.isArray(data.farmIds) ? data.farmIds : Array.isArray(data.farmID) ? data.farmID : [],
    active: data.active === true,
    name: data.name ?? data.email ?? '',
    createdat,
    createdAt: createdat,
  };
}

export async function getAllUsers(): Promise<UserDoc[]> {
  const snap = await db.collection('users').get();
  return snap.docs.map((doc: any) => {
    const data = doc.data();
    const createdat = data.createdat ?? data.createdAt ?? data.created_at ?? null;
    return {
      uid: doc.id,
      email: data.email ?? '',
      role: data.role ?? '',
      farmIds: Array.isArray(data.farmIds) ? data.farmIds : Array.isArray(data.farmID) ? data.farmID : [],
      active: data.active === true,
      name: data.name ?? data.email ?? '',
      createdat,
      createdAt: createdat,
    };
  });
}

export async function getUsersByRole(role: string): Promise<UserDoc[]> {
  const snap = await db.collection('users').where('role', '==', role).get();
  return snap.docs.map((doc: any) => {
    const data = doc.data();
    const createdat = data.createdat ?? data.createdAt ?? data.created_at ?? null;
    return {
      uid: doc.id,
      email: data.email ?? '',
      role: data.role ?? '',
      farmIds: Array.isArray(data.farmIds) ? data.farmIds : Array.isArray(data.farmID) ? data.farmID : [],
      active: data.active === true,
      name: data.name ?? data.email ?? '',
      createdat,
      createdAt: createdat,
    };
  });
}

export async function getActiveFarmers(): Promise<UserDoc[]> {
  const snap = await db.collection('users').where('role', '==', 'farmer').where('active', '==', true).get();
  return snap.docs.map((doc: any) => {
    const data = doc.data();
    const createdat = data.createdat ?? data.createdAt ?? data.created_at ?? null;
    return {
      uid: doc.id,
      email: data.email ?? '',
      role: 'farmer',
      farmIds: Array.isArray(data.farmIds) ? data.farmIds : Array.isArray(data.farmID) ? data.farmID : [],
      active: true,
      name: data.name ?? data.email ?? '',
      createdat,
      createdAt: createdat,
    };
  });
}

export async function updateUserStatus(uid: string, active: boolean): Promise<void> {
  const user = auth.currentUser;
  if (user) {
    try {
      const idToken = await user.getIdToken();
      const backendUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      const response = await fetch(`${backendUrl}/api/v1/admin/users/${uid}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ active }),
      });
      if (response.ok) {
        return;
      }
      console.warn('[userDataService] Backend updateUserStatus returned status:', response.status, 'falling back to direct Firestore update');
    } catch (err: any) {
      console.warn('[userDataService] Backend updateUserStatus failed, falling back to direct Firestore update:', err.message || err);
    }
  }
  await db.collection('users').doc(uid).update({ active, updatedAt: new Date().toISOString() });
}

export async function deleteUserAccount(uid: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const idToken = await user.getIdToken();
  const backendUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

  const response = await fetch(`${backendUrl}/api/v1/admin/users/${uid}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMessage = data?.error?.message || data?.message || 'Failed to delete user account';
    throw new Error(errorMessage);
  }
}

export function subscribeToAllUsers(callback: (users: UserDoc[]) => void): () => void {
  return db.collection('users').onSnapshot(
    (snap: any) => {
      const users = snap.docs.map((doc: any) => {
        const data = doc.data();
        return {
          uid: doc.id,
          email: data.email ?? '',
          role: data.role ?? '',
          farmIds: Array.isArray(data.farmIds) ? data.farmIds : Array.isArray(data.farmID) ? data.farmID : [],
          active: data.active === true,
          name: data.name ?? data.email ?? '',
          createdAt: data.createdAt,
        };
      });
      callback(users);
    },
    (err: any) => {
      console.error('[userDataService] subscribeToAllUsers error:', err.message || err);
    },
  );
}

export interface CreateFarmerPayload {
  name: string;
  email: string;
  phone_no: string;
  password: string;
  farmName: string;
  initialBirdCount?: number;
  initialFeedKg?: number;
}

export interface CreateFarmerResult {
  uid: string;
  email: string;
  message: string;
}

export async function createFarmer(payload: CreateFarmerPayload): Promise<CreateFarmerResult> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const idToken = await user.getIdToken();

  const backendUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

  const response = await fetch(`${backendUrl}/api/v1/admin/users/farmer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMessage = data?.error?.message || 'Failed to create farmer';
    const errorFields = data?.error?.fields || {};
    const error: Error & { fields?: Record<string, string> } = new Error(errorMessage);
    error.fields = errorFields;
    throw error;
  }

  return data.data;
}

export interface CreateSupervisorPayload {
  name: string;
  email: string;
  phone_no: string;
  password: string;
  farmIds: string[];
}

export async function createSupervisor(payload: CreateSupervisorPayload): Promise<CreateFarmerResult> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const idToken = await user.getIdToken();
  const backendUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

  const response = await fetch(`${backendUrl}/api/v1/admin/users/supervisor`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMessage = data?.error?.message || 'Failed to create supervisor';
    const errorFields = data?.error?.fields || {};
    const error: Error & { fields?: Record<string, string> } = new Error(errorMessage);
    error.fields = errorFields;
    throw error;
  }

  return data.data;
}

export interface CreateAdminPayload {
  name: string;
  email: string;
  phone_no: string;
  password: string;
}

export async function createAdmin(payload: CreateAdminPayload): Promise<CreateFarmerResult> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const idToken = await user.getIdToken();
  const backendUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

  const response = await fetch(`${backendUrl}/api/v1/admin/users/admin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMessage = data?.error?.message || 'Failed to create admin';
    const errorFields = data?.error?.fields || {};
    const error: Error & { fields?: Record<string, string> } = new Error(errorMessage);
    error.fields = errorFields;
    throw error;
  }

  return data.data;
}

export async function updateSupervisorAllocation(uid: string, farmIds: string[]): Promise<void> {
  const user = auth.currentUser;
  if (user) {
    try {
      const idToken = await user.getIdToken();
      const backendUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      const response = await fetch(`${backendUrl}/api/v1/admin/users/supervisor/${uid}/farms`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ farmIds }),
      });
      if (response.ok) {
        return;
      }
      console.warn('[userDataService] Backend updateSupervisorAllocation returned status:', response.status, 'falling back to direct Firestore update');
    } catch (err: any) {
      console.warn('[userDataService] Backend updateSupervisorAllocation failed, falling back to direct Firestore update:', err.message || err);
    }
  }

  // Firestore direct fallback (partial update ONLY)
  await db.collection('users').doc(uid).update({
    farmIds: Array.from(new Set(farmIds)),
    updatedAt: new Date().toISOString(),
  });
}

