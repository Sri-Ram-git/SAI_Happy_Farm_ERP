const f = (window as any).firebase;

export interface UserProfile {
  uid: string;
  active: boolean;
  email: string;
  role: string;
  farmIds: string[];
  name?: string;
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  console.log('[UserProfile] LOOKING FOR DOCUMENT: users/' + uid);
  try {
    const snap = await f.firestore().collection('users').doc(uid).get();
    console.log('[UserProfile] DOCUMENT EXISTS:', snap.exists);
    if (!snap.exists) return null;

    const raw = snap.data();
    console.log('[UserProfile] DOCUMENT DATA:', JSON.stringify(raw));

    const isActive = raw.active === true;
    const role = raw.role ?? null;
    const farmIds = Array.isArray(raw.farmIds)
      ? raw.farmIds
      : Array.isArray(raw.farmID)
        ? raw.farmID
        : [];

    const normalized: UserProfile = {
      uid,
      active: isActive,
      email: raw.email ?? '',
      role: role,
      farmIds: farmIds,
      name: raw.name ?? raw.email ?? '',
    };

    console.log('[UserProfile] NORMALIZED:', JSON.stringify(normalized));
    return normalized;
  } catch (err: any) {
    console.error('[UserProfile] FIRESTORE ERROR:', err.code, err.message);
    throw err;
  }
}
