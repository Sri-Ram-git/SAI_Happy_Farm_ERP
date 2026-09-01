import { useState, useEffect } from 'react';

const f = (window as any).firebase;

export interface MockProfile {
  uid: string;
  name: string;
  email: string;
  role: string;
  farmIds: string[];
  active: boolean;
}

const MOCK_ADMIN: MockProfile = {
  uid: 'mock-admin-001',
  name: 'Admin User',
  email: 'admin@test.com',
  role: 'admin',
  farmIds: [],
  active: true,
};

const MOCK_SUPERVISOR: MockProfile = {
  uid: 'mock-supervisor-001',
  name: 'Supervisor User',
  email: 'supervisor@test.com',
  role: 'supervisor',
  farmIds: [],
  active: true,
};

export function useMockProfile(role: 'admin' | 'supervisor') {
  const [profile, setProfile] = useState<MockProfile | null>(null);

  useEffect(() => {
    const base = role === 'admin' ? MOCK_ADMIN : MOCK_SUPERVISOR;

    const loadFarmIds = async () => {
      try {
        const db = f.firestore();
        const snap = await db.collection('users').where('role', '==', role).limit(1).get();
        if (!snap.empty) {
          const data = snap.docs[0].data();
          const farmIds = Array.isArray(data.farmIds) ? data.farmIds : Array.isArray(data.farmID) ? data.farmID : [];
          setProfile({ ...base, farmIds });
          return;
        }

        const snap2 = await db.collection('users').where('role', 'in', ['supervisor', 'admin']).get();
        const allFarms: string[] = [];
        snap2.docs.forEach((doc: any) => {
          const d = doc.data();
          const ids = Array.isArray(d.farmIds) ? d.farmIds : Array.isArray(d.farmID) ? d.farmID : [];
          ids.forEach((id: string) => { if (!allFarms.includes(id)) allFarms.push(id); });
        });
        setProfile({ ...base, farmIds: allFarms });
      } catch (err) {
        console.error('[useMockProfile] Error loading farm IDs:', err);
        setProfile(base);
      }
    };

    loadFarmIds();
  }, [role]);

  return profile;
}
