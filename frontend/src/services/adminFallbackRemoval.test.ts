import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// B3 / SAF-04: admin operations must go through the backend only. Any Firestore write from
// these code paths would bypass last-admin, self-deactivation, role, token-revocation and
// audit-log controls, so every Firestore entry point below is a spy that must never be called.
const fb = vi.hoisted(() => {
  const update = vi.fn();
  const set = vi.fn();
  const del = vi.fn();
  const get = vi.fn();
  const commit = vi.fn();
  const docRef: any = { update, set, delete: del, get };
  const collection = vi.fn(() => ({ doc: vi.fn(() => docRef) }));
  const batch = vi.fn(() => ({ update, set, delete: del, commit }));
  return {
    spies: { update, set, del, get, commit, collection, batch },
    db: { collection, batch, runTransaction: vi.fn() },
    auth: { currentUser: null as any },
  };
});

vi.mock('../config/firebase', () => ({ db: fb.db, auth: fb.auth }));

import { updateUserStatus, updateSupervisorAllocation } from './userDataService';
import { executeRevertImportBatch } from './historicalImportService';

const fetchMock = vi.fn();

function backendError(status: number, message: string, code = 'VALIDATION_ERROR') {
  return { ok: false, status, json: async () => ({ success: false, error: { code, message } }) };
}
function backendOk(data: unknown) {
  return { ok: true, status: 200, json: async () => ({ success: true, data }) };
}
const networkFailure = () => Promise.reject(new TypeError('Failed to fetch'));

function expectNoFirestoreAccess() {
  for (const spy of Object.values(fb.spies)) expect(spy).not.toHaveBeenCalled();
  expect(fb.db.runTransaction).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  for (const spy of Object.values(fb.spies)) spy.mockClear();
  fb.db.runTransaction.mockClear();
  fb.auth.currentUser = { uid: 'admin1', email: 'admin1@example.com', getIdToken: vi.fn(async () => 'id-token') };
});
afterEach(() => vi.unstubAllGlobals());

describe('updateUserStatus: backend only (F1)', () => {
  it('last-admin refusal surfaces the backend message and writes nothing', async () => {
    fetchMock.mockResolvedValue(backendError(400, 'Cannot deactivate the last remaining active administrator.'));
    await expect(updateUserStatus('admin2', false)).rejects.toThrow('Cannot deactivate the last remaining active administrator.');
    expectNoFirestoreAccess();
  });

  it('self-deactivation refusal surfaces the backend message and writes nothing', async () => {
    fetchMock.mockResolvedValue(backendError(400, 'You cannot deactivate your own authenticated administrator account.'));
    await expect(updateUserStatus('admin1', false)).rejects.toThrow('You cannot deactivate your own authenticated administrator account.');
    expectNoFirestoreAccess();
  });

  it.each([
    [401, 'Invalid or expired token', 'UNAUTHORIZED'],
    [403, 'Insufficient permissions', 'FORBIDDEN'],
    [404, 'User not found', 'NOT_FOUND'],
    [500, 'An unexpected error occurred', 'INTERNAL_ERROR'],
  ])('HTTP %i is surfaced and writes nothing', async (status, message, code) => {
    fetchMock.mockResolvedValue(backendError(status, message, code));
    await expect(updateUserStatus('farmerA', false)).rejects.toThrow(message);
    expectNoFirestoreAccess();
  });

  it('non-JSON error body falls back to a generic message and writes nothing', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502, json: async () => { throw new SyntaxError('bad json'); } });
    await expect(updateUserStatus('farmerA', true)).rejects.toThrow('Failed to update user status');
    expectNoFirestoreAccess();
  });

  it('network failure gives a clear error and writes nothing', async () => {
    fetchMock.mockImplementation(networkFailure);
    await expect(updateUserStatus('farmerA', false)).rejects.toThrow(/Could not reach the server/);
    expectNoFirestoreAccess();
  });

  it('not signed in: throws without calling the backend or Firestore', async () => {
    fb.auth.currentUser = null;
    await expect(updateUserStatus('farmerA', false)).rejects.toThrow('Not authenticated');
    expect(fetchMock).not.toHaveBeenCalled();
    expectNoFirestoreAccess();
  });

  it('success: sends the unchanged API request and writes nothing client-side', async () => {
    fetchMock.mockResolvedValue(backendOk({ uid: 'farmerA', active: false }));
    await expect(updateUserStatus('farmerA', false)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/v1\/admin\/users\/farmerA\/status$/);
    expect(init.method).toBe('PATCH');
    expect(init.headers.Authorization).toBe('Bearer id-token');
    expect(JSON.parse(init.body)).toEqual({ active: false });
    expectNoFirestoreAccess();
  });
});

describe('updateSupervisorAllocation: backend only (F2)', () => {
  it('"Only supervisor accounts" refusal is surfaced and writes nothing', async () => {
    fetchMock.mockResolvedValue(backendError(400, 'Only supervisor accounts can have farm allocations modified'));
    await expect(updateSupervisorAllocation('farmerA', ['F1', 'F2'])).rejects.toThrow('Only supervisor accounts can have farm allocations modified');
    expectNoFirestoreAccess();
  });

  it('unknown-farm refusal is surfaced and writes nothing', async () => {
    fetchMock.mockResolvedValue(backendError(400, 'Farm with ID "NOPE" does not exist.'));
    await expect(updateSupervisorAllocation('sup1', ['NOPE'])).rejects.toThrow('Farm with ID "NOPE" does not exist.');
    expectNoFirestoreAccess();
  });

  it('server error is surfaced and writes nothing', async () => {
    fetchMock.mockResolvedValue(backendError(500, 'An unexpected error occurred', 'INTERNAL_ERROR'));
    await expect(updateSupervisorAllocation('sup1', ['F1'])).rejects.toThrow('An unexpected error occurred');
    expectNoFirestoreAccess();
  });

  it('network failure gives a clear error and writes nothing', async () => {
    fetchMock.mockImplementation(networkFailure);
    await expect(updateSupervisorAllocation('sup1', ['F1'])).rejects.toThrow(/Could not reach the server/);
    expectNoFirestoreAccess();
  });

  it('not signed in: throws without calling the backend or Firestore', async () => {
    fb.auth.currentUser = null;
    await expect(updateSupervisorAllocation('sup1', ['F1'])).rejects.toThrow('Not authenticated');
    expect(fetchMock).not.toHaveBeenCalled();
    expectNoFirestoreAccess();
  });

  it('success: sends the unchanged API request and writes nothing client-side', async () => {
    fetchMock.mockResolvedValue(backendOk({ uid: 'sup1', farmIds: ['F1', 'F2'] }));
    await expect(updateSupervisorAllocation('sup1', ['F1', 'F2'])).resolves.toBeUndefined();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/v1\/admin\/users\/supervisor\/sup1\/farms$/);
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ farmIds: ['F1', 'F2'] });
    expectNoFirestoreAccess();
  });
});

describe('executeRevertImportBatch: backend only (F3)', () => {
  it('network failure: no client-side revert, clear "outcome unknown" error', async () => {
    fetchMock.mockImplementation(networkFailure);
    await expect(executeRevertImportBatch('B1', 'B1')).rejects.toThrow(/Could not reach the server, so the revert outcome is unknown/);
    expectNoFirestoreAccess();
  });

  it('backend refusal surfaces error.message from the standard error envelope', async () => {
    fetchMock.mockResolvedValue(backendError(400, 'This batch has already been reverted'));
    await expect(executeRevertImportBatch('B1', 'B1')).rejects.toThrow('This batch has already been reverted');
    expectNoFirestoreAccess();
  });

  it('server error with an unreadable body falls back to the status message', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503, json: async () => { throw new SyntaxError('bad json'); } });
    await expect(executeRevertImportBatch('B1', 'B1')).rejects.toThrow('Revert failed with status 503');
    expectNoFirestoreAccess();
  });

  it('confirmation mismatch is refused before any request or write', async () => {
    await expect(executeRevertImportBatch('B1', 'B2')).rejects.toThrow("Confirmation batch ID mismatch. Expected 'B1'.");
    expect(fetchMock).not.toHaveBeenCalled();
    expectNoFirestoreAccess();
  });

  it('not signed in: throws without calling the backend or Firestore', async () => {
    fb.auth.currentUser = null;
    await expect(executeRevertImportBatch('B1', 'B1')).rejects.toThrow('Not authenticated');
    expect(fetchMock).not.toHaveBeenCalled();
    expectNoFirestoreAccess();
  });

  it('success: returns the backend result with the unchanged request body', async () => {
    const result = { revertOperationId: 'rev_1', batchId: 'B1', status: 'REVERTED', deletedCount: 3 };
    fetchMock.mockResolvedValue(backendOk(result));
    await expect(executeRevertImportBatch('B1', 'B1', 'Sheet1')).resolves.toEqual(result);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/v1\/admin\/import\/batches\/B1\/revert$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ confirmationBatchId: 'B1', worksheetKey: 'Sheet1' });
    expectNoFirestoreAccess();
  });
});
