const f = (window as any).firebase;

export interface UserDoc {
  uid: string;
  email: string;
  role: string;
  farmIds: string[];
  active: boolean;
  name: string;
  createdAt?: string;
}

export async function getUserByUid(uid: string): Promise<UserDoc | null> {
  const db = f.firestore();
  const doc = await db.collection('users').doc(uid).get();
  if (!doc.exists) return null;
  const data = doc.data();
  return {
    uid,
    email: data.email ?? '',
    role: data.role ?? '',
    farmIds: Array.isArray(data.farmIds) ? data.farmIds : Array.isArray(data.farmID) ? data.farmID : [],
    active: data.active === true,
    name: data.name ?? data.email ?? '',
    createdAt: data.createdAt,
  };
}

export async function getAllUsers(): Promise<UserDoc[]> {
  const db = f.firestore();
  const snap = await db.collection('users').get();
  return snap.docs.map((doc: any) => {
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
}

export async function getUsersByRole(role: string): Promise<UserDoc[]> {
  const db = f.firestore();
  const snap = await db.collection('users').where('role', '==', role).get();
  return snap.docs.map((doc: any) => {
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
}

export async function getActiveFarmers(): Promise<UserDoc[]> {
  const db = f.firestore();
  const snap = await db.collection('users').where('role', '==', 'farmer').where('active', '==', true).get();
  return snap.docs.map((doc: any) => {
    const data = doc.data();
    return {
      uid: doc.id,
      email: data.email ?? '',
      role: 'farmer',
      farmIds: Array.isArray(data.farmIds) ? data.farmIds : Array.isArray(data.farmID) ? data.farmID : [],
      active: true,
      name: data.name ?? data.email ?? '',
      createdAt: data.createdAt,
    };
  });
}

export async function updateUserStatus(uid: string, active: boolean): Promise<void> {
  const user = f.auth().currentUser;
  if (user) {
    try {
      const idToken = await user.getIdToken();
      const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
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
  const db = f.firestore();
  await db.collection('users').doc(uid).update({ active, updatedAt: new Date().toISOString() });
}

export function subscribeToAllUsers(callback: (users: UserDoc[]) => void): () => void {
  const db = f.firestore();
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
  const user = f.auth().currentUser;
  if (!user) throw new Error('Not authenticated');

  const idToken = await user.getIdToken();

  const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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
