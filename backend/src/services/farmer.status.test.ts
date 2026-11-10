import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FarmerService } from './farmer.service';
import { NotFoundError, ValidationError } from '../utils/errors';

// B3 / SAF-04: the client fallback is gone, so these backend guards are now the only path for
// user status changes. Pin their behaviour.
vi.mock('../config/firebase', () => ({
  getFirestore: vi.fn(),
  getAuth: vi.fn(),
  initializeFirebase: vi.fn(),
}));

vi.mock('../config/environment', () => ({
  getEnv: vi.fn().mockReturnValue({
    FIREBASE_PROJECT_ID: 'test-project',
    PORT: 3000,
    NODE_ENV: 'test',
    ALLOWED_ORIGINS: '*',
    RATE_LIMIT_WINDOW_MS: 900000,
    RATE_LIMIT_MAX_REQUESTS: 100,
    LOG_LEVEL: 'info',
  }),
}));

import { getFirestore, getAuth } from '../config/firebase';

type UserRow = { role: string; active?: boolean; email?: string };

function setup(users: Record<string, UserRow>) {
  const userUpdate = vi.fn().mockResolvedValue(undefined);
  const auditAdd = vi.fn().mockResolvedValue({ id: 'audit-1' });
  const revokeRefreshTokens = vi.fn().mockResolvedValue(undefined);

  const usersColl = {
    doc: vi.fn((uid: string) => ({
      get: vi.fn().mockResolvedValue({ exists: uid in users, data: () => users[uid] }),
      update: userUpdate,
    })),
    where: vi.fn((field: string, _op: string, value: string) => ({
      get: vi.fn().mockResolvedValue({
        docs: Object.entries(users)
          .filter(([, u]) => (u as any)[field] === value)
          .map(([id, u]) => ({ id, data: () => u })),
      }),
    })),
  };
  const db = {
    collection: vi.fn((name: string) => {
      if (name === 'users') return usersColl;
      if (name === 'auditLogs') return { add: auditAdd };
      throw new Error(`unexpected collection ${name}`);
    }),
  };
  (getFirestore as any).mockReturnValue(db);
  (getAuth as any).mockReturnValue({ revokeRefreshTokens });
  return { userUpdate, auditAdd, revokeRefreshTokens };
}

describe('FarmerService.updateUserStatus guards', () => {
  let service: FarmerService;
  beforeEach(() => {
    vi.clearAllMocks();
    service = new FarmerService();
  });

  it('refuses self-deactivation and makes no write, revocation or audit entry', async () => {
    const m = setup({ admin1: { role: 'admin', active: true }, admin2: { role: 'admin', active: true } });
    await expect(service.updateUserStatus('admin1', false, 'admin1', 'req-1')).rejects.toThrow(
      new ValidationError('You cannot deactivate your own authenticated administrator account.'),
    );
    expect(m.userUpdate).not.toHaveBeenCalled();
    expect(m.revokeRefreshTokens).not.toHaveBeenCalled();
    expect(m.auditAdd).not.toHaveBeenCalled();
  });

  it('refuses to deactivate the last active administrator', async () => {
    const m = setup({
      admin1: { role: 'admin', active: true },
      admin2: { role: 'admin', active: false },
      sup1: { role: 'supervisor', active: true },
    });
    // Caller is a different (already-authenticated) admin record; only admin1 counts as active.
    await expect(service.updateUserStatus('admin1', false, 'adminCaller', 'req-2')).rejects.toThrow(
      'Cannot deactivate the last remaining active administrator.',
    );
    expect(m.userUpdate).not.toHaveBeenCalled();
    expect(m.revokeRefreshTokens).not.toHaveBeenCalled();
    expect(m.auditAdd).not.toHaveBeenCalled();
  });

  it('allows deactivating an admin when another active admin exists, revokes tokens and audits', async () => {
    const m = setup({ admin1: { role: 'admin', active: true }, admin2: { role: 'admin', active: true, email: 'a2@example.com' } });
    await expect(service.updateUserStatus('admin2', false, 'admin1', 'req-3')).resolves.toEqual({ uid: 'admin2', active: false });
    expect(m.userUpdate).toHaveBeenCalledWith(expect.objectContaining({ active: false }));
    expect(m.revokeRefreshTokens).toHaveBeenCalledWith('admin2');
    expect(m.auditAdd).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'USER_DEACTIVATED', uid: 'admin1', resourceId: 'admin2', requestId: 'req-3' }),
    );
  });

  it('deactivating a farmer revokes tokens and writes USER_DEACTIVATED', async () => {
    const m = setup({ farmerA: { role: 'farmer', active: true } });
    await service.updateUserStatus('farmerA', false, 'admin1', 'req-4');
    expect(m.userUpdate).toHaveBeenCalledWith(expect.objectContaining({ active: false }));
    expect(m.revokeRefreshTokens).toHaveBeenCalledWith('farmerA');
    expect(m.auditAdd).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'USER_DEACTIVATED', resourceId: 'farmerA' }));
  });

  it('activation does not revoke tokens and writes USER_ACTIVATED', async () => {
    const m = setup({ farmerA: { role: 'farmer', active: false } });
    await expect(service.updateUserStatus('farmerA', true, 'admin1', 'req-5')).resolves.toEqual({ uid: 'farmerA', active: true });
    expect(m.userUpdate).toHaveBeenCalledWith(expect.objectContaining({ active: true }));
    expect(m.revokeRefreshTokens).not.toHaveBeenCalled();
    expect(m.auditAdd).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'USER_ACTIVATED', resourceId: 'farmerA' }));
  });

  it('an admin may re-activate themselves (only self-deactivation is blocked)', async () => {
    const m = setup({ admin1: { role: 'admin', active: true } });
    await expect(service.updateUserStatus('admin1', true, 'admin1', 'req-6')).resolves.toEqual({ uid: 'admin1', active: true });
    expect(m.revokeRefreshTokens).not.toHaveBeenCalled();
  });

  it('unknown user is a NotFoundError with no write', async () => {
    const m = setup({});
    await expect(service.updateUserStatus('ghost', false, 'admin1', 'req-7')).rejects.toBeInstanceOf(NotFoundError);
    expect(m.userUpdate).not.toHaveBeenCalled();
    expect(m.auditAdd).not.toHaveBeenCalled();
  });
});
