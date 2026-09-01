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
  const db = f.firestore();
  await db.collection('users').doc(uid).update({ active });
}
