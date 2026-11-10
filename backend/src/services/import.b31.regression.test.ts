import { describe, it, expect, vi, beforeEach } from 'vitest';

// B3.1 regression tests: historical import HTTP 500 (undefined written to Firestore, worksheets
// stripped by validation, data committed before the batch record) and missing audit entries for
// whole-batch reverts. A strict in-memory Firestore fake rejects `undefined` exactly like the real
// SDK does, which the existing vi.fn() mocks never did.

vi.mock('../config/firebase', () => ({ getFirestore: vi.fn(), getAuth: vi.fn(), initializeFirebase: vi.fn() }));
vi.mock('../config/environment', () => ({
  getEnv: vi.fn().mockReturnValue({
    FIREBASE_PROJECT_ID: 'test-project', PORT: 3000, NODE_ENV: 'test', ALLOWED_ORIGINS: '*',
    RATE_LIMIT_WINDOW_MS: 900000, RATE_LIMIT_MAX_REQUESTS: 100, LOG_LEVEL: 'error',
  }),
}));

import { getFirestore } from '../config/firebase';
import { importService } from './import.service';
import { auditService } from './audit.service';
import { ExecuteImportSchema } from '../validators/import.validator';
import { stripUndefined } from '../utils/firestoreData';
import { AuthenticatedUser, UserRole } from '../types/auth';
import { InternalError } from '../utils/errors';

// ------------------------------------------------------------------------------------------------
// Strict fake Firestore
// ------------------------------------------------------------------------------------------------
type Data = Record<string, any>;
type Op = { kind: 'create' | 'set' | 'update' | 'delete' | 'add' | 'batch-commit'; path: string };

function assertNoUndefined(value: unknown, field = ''): void {
  if (value === undefined) {
    throw new Error(`Value for argument "data" is not a valid Firestore document. Cannot use "undefined" as a Firestore value (found in field "${field}").`);
  }
  if (Array.isArray(value)) value.forEach((v, i) => assertNoUndefined(v, `${field}.\`${i}\``));
  else if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    for (const [k, v] of Object.entries(value)) assertNoUndefined(v, field ? `${field}.${k}` : k);
  }
}

class FakeFirestore {
  store = new Map<string, Data>();
  ops: Op[] = [];
  failOn: ((op: Op) => boolean) | null = null;
  private seq = 0;

  private apply(op: Op, fn: () => void) {
    if (this.failOn?.(op)) throw new Error(`Injected failure on ${op.kind} ${op.path}`);
    fn();
    this.ops.push(op);
  }
  private setNested(target: Data, dotted: string, v: unknown) {
    const parts = dotted.split('.'); let cur = target;
    for (const p of parts.slice(0, -1)) { cur[p] = cur[p] && typeof cur[p] === 'object' ? cur[p] : {}; cur = cur[p]; }
    cur[parts[parts.length - 1]!] = v;
  }
  newId() { return `auto_${++this.seq}`; }

  docRef(path: string): any {
    const db = this;
    return {
      path, id: path.split('/').pop(),
      collection: (name: string) => db.collRef(`${path}/${name}`),
      get: async () => snap(path, db.store.get(path)),
      create: async (data: Data) => {
        assertNoUndefined(data);
        if (db.store.has(path)) throw Object.assign(new Error(`6 ALREADY_EXISTS: ${path}`), { code: 6 });
        db.apply({ kind: 'create', path }, () => db.store.set(path, structuredClone(data)));
      },
      set: async (data: Data, opts?: { merge?: boolean }) => {
        assertNoUndefined(data);
        db.apply({ kind: 'set', path }, () => db.store.set(path, opts?.merge ? { ...(db.store.get(path) || {}), ...structuredClone(data) } : structuredClone(data)));
      },
      update: async (data: Data) => {
        assertNoUndefined(data);
        if (!db.store.has(path)) throw new Error(`5 NOT_FOUND: ${path}`);
        db.apply({ kind: 'update', path }, () => { const cur = db.store.get(path)!; for (const [k, v] of Object.entries(structuredClone(data))) db.setNested(cur, k, v); });
      },
    };
  }
  collRef(path: string): any {
    const db = this;
    const query = (filters: Array<[string, unknown]>) => ({
      where: (f: string, _op: string, v: unknown) => query([...filters, [f, v]]),
      orderBy: () => query(filters),
      limit: () => query(filters),
      get: async () => {
        const docs = [...db.store.entries()]
          .filter(([p]) => p.startsWith(`${path}/`) && !p.slice(path.length + 1).includes('/'))
          .filter(([, d]) => filters.every(([f, v]) => d[f] === v))
          .map(([p, d]) => snap(p, d));
        return { docs, empty: docs.length === 0, size: docs.length };
      },
    });
    return {
      ...query([]),
      doc: (id?: string) => db.docRef(`${path}/${id ?? db.newId()}`),
      add: async (data: Data) => {
        assertNoUndefined(data);
        const p = `${path}/${db.newId()}`;
        db.apply({ kind: 'add', path: p }, () => db.store.set(p, structuredClone(data)));
        return { id: p.split('/').pop() };
      },
    };
  }
  collection(name: string) { return this.collRef(name); }
  doc(path: string) { return this.docRef(path); }
  collectionGroup(name: string) {
    const db = this;
    const query = (filters: Array<[string, unknown]>) => ({
      where: (f: string, _op: string, v: unknown) => query([...filters, [f, v]]),
      get: async () => {
        const docs = [...db.store.entries()]
          .filter(([p]) => { const s = p.split('/'); return s.length >= 2 && s[s.length - 2] === name; })
          .filter(([, d]) => filters.every(([f, v]) => d[f] === v))
          .map(([p, d]) => snap(p, d));
        return { docs, empty: docs.length === 0, size: docs.length };
      },
    });
    return query([]);
  }
  batch() {
    const db = this; const queued: Array<() => void> = [];
    return {
      set: (ref: any, data: Data, opts?: { merge?: boolean }) => {
        assertNoUndefined(data); // the real WriteBatch validates when the write is added
        queued.push(() => db.store.set(ref.path, opts?.merge ? { ...(db.store.get(ref.path) || {}), ...structuredClone(data) } : structuredClone(data)));
      },
      update: (ref: any, data: Data) => {
        assertNoUndefined(data);
        queued.push(() => { const cur = db.store.get(ref.path) || {}; for (const [k, v] of Object.entries(structuredClone(data))) db.setNested(cur, k, v); db.store.set(ref.path, cur); });
      },
      delete: (ref: any) => { queued.push(() => db.store.delete(ref.path)); },
      commit: async () => { db.apply({ kind: 'batch-commit', path: `${queued.length} writes` }, () => queued.forEach((fn) => fn())); },
    };
  }
  docsUnder(prefix: string) { return [...this.store.keys()].filter((p) => p.startsWith(prefix)); }
}
function snap(path: string, data: Data | undefined) {
  return { id: path.split('/').pop(), ref: { path }, exists: data !== undefined, data: () => (data ? structuredClone(data) : undefined) };
}

// ------------------------------------------------------------------------------------------------
const admin: AuthenticatedUser = { uid: 'admin1', email: 'admin1@example.com', role: UserRole.ADMIN, farmIds: [] };
const SHEET = 'synthetic.xlsx [Farm F1]';
const dailyRecord = (date: string, row: number) => ({
  recordType: 'DAILY_REPORT' as const, farmId: 'F1', submissionDate: date, birdCount: 1000, feedKg: 100,
  mortality: 0, culling: 0, eggsProduced: 800, sourceFile: SHEET, sourceRow: row,
});
const frontendPayload = (extra: Record<string, unknown> = {}) => ({
  batchId: 'B31_TEST', conflictAction: 'skip', sourceFiles: ['synthetic.xlsx'],
  records: [dailyRecord('2026-10-01', 2), dailyRecord('2026-10-02', 3), { recordType: 'FEED_LOAD', farmId: 'F1', submissionDate: '2026-10-02', feedLoadQuantityKg: 250, sourceFile: SHEET, sourceRow: 4 }],
  worksheets: [{ worksheetKey: SHEET, fileName: 'synthetic.xlsx', sheetName: 'Farm F1', farmId: 'F1', preservedAvg: 81.5, preservedAvgByDate: { '2026-10-01': 81.5 } }],
  ...extra,
});
/** What the route actually hands the service: the Zod-parsed body. */
const validated = (body: unknown) => {
  const r = ExecuteImportSchema.safeParse(body);
  if (!r.success) throw new Error(JSON.stringify(r.error.issues));
  return r.data as any;
};

let db: FakeFirestore;
beforeEach(() => {
  db = new FakeFirestore();
  (getFirestore as any).mockReturnValue(db);
  db.store.set('users/admin1', { role: 'admin', active: true, farmIds: [] });
  db.store.set('users/farmerA', { role: 'farmer', active: true, farmIds: ['F1'] });
  db.store.set('farms/F1', { farmId: 'F1', name: 'Synthetic Farm', currentBirdCount: 1000, currentFeedKg: 500 });
});

describe('B3.1 validation: worksheet metadata reaches the service', () => {
  it('keeps worksheets and preservedAvgByDate from the frontend payload', () => {
    const out = validated(frontendPayload());
    expect(out.worksheets).toEqual([{ worksheetKey: SHEET, fileName: 'synthetic.xlsx', sheetName: 'Farm F1', farmId: 'F1', preservedAvg: 81.5, preservedAvgByDate: { '2026-10-01': 81.5 } }]);
  });
  it('still accepts payloads without worksheets', () => {
    const { worksheets: _w, ...rest } = frontendPayload();
    expect(validated(rest).worksheets).toBeUndefined();
  });
  it('rejects non-numeric preserved averages', () => {
    const bad = frontendPayload({ worksheets: [{ worksheetKey: SHEET, preservedAvgByDate: { '2026-10-01': 'x' } }] });
    expect(ExecuteImportSchema.safeParse(bad).success).toBe(false);
  });
});

describe('B3.1 executeImport against a strict Firestore', () => {
  it('worksheet WITHOUT preserved averages: succeeds (was HTTP 500) and stores null, not undefined', async () => {
    const body = frontendPayload({ worksheets: [{ worksheetKey: SHEET, fileName: 'synthetic.xlsx', sheetName: 'Farm F1', farmId: 'F1' }] });
    const res = await importService.executeImport(validated(body), admin, 'req-1');
    expect(res.status).toBe('COMPLETED');
    const batch = db.store.get('importBatches/B31_TEST')!;
    expect(batch.status).toBe('COMPLETED');
    expect(batch.worksheets[0].preservedAvgByDate).toBeNull();
    expect(batch.manifest).toHaveLength(3);
  });

  it('payload with no worksheets at all: succeeds', async () => {
    const { worksheets: _w, ...rest } = frontendPayload();
    const res = await importService.executeImport(validated(rest), admin, 'req-2');
    expect(res.status).toBe('COMPLETED');
    expect(db.store.get('importBatches/B31_TEST')!.worksheets[0].preservedAvgByDate).toBeNull();
  });

  it('frontend-shaped payload: preserved AVG reaches the batch and the farm document is actually committed', async () => {
    await importService.executeImport(validated(frontendPayload()), admin, 'req-3');
    expect(db.store.get('importBatches/B31_TEST')!.worksheets[0]).toMatchObject({ preservedAvg: 81.5, preservedAvgByDate: { '2026-10-01': 81.5 } });
    expect(db.store.get('farms/F1')).toMatchObject({ preservedAvg: 81.5, preservedAvgByDate: { '2026-10-01': 81.5 }, currentFeedKg: 500 });
  });

  it('preserved AVG for a farm that does not exist never creates a stray farm document', async () => {
    const body = frontendPayload({ worksheets: [{ worksheetKey: SHEET, farmId: 'GHOST', preservedAvg: 70 }] });
    await importService.executeImport(validated(body), admin, 'req-4');
    expect(db.store.has('farms/GHOST')).toBe(false);
  });

  it('writes and audits HISTORICAL_IMPORT for a successful import', async () => {
    await importService.executeImport(validated(frontendPayload()), admin, 'req-5');
    const audits = db.docsUnder('auditLogs/').map((p) => db.store.get(p)!);
    expect(audits.some((a) => a.eventType === 'HISTORICAL_IMPORT' && a.resourceId === 'B31_TEST')).toBe(true);
  });

  it('creates the batch record BEFORE any imported data is committed', async () => {
    await importService.executeImport(validated(frontendPayload()), admin, 'req-6');
    const firstCreate = db.ops.findIndex((o) => o.kind === 'create' && o.path === 'importBatches/B31_TEST');
    const firstCommit = db.ops.findIndex((o) => o.kind === 'batch-commit');
    expect(firstCreate).toBeGreaterThanOrEqual(0);
    expect(firstCreate).toBeLessThan(firstCommit);
  });

  it('dry run writes nothing, including no batch record', async () => {
    const res = await importService.executeImport(validated(frontendPayload({ dryRun: true })), admin, 'req-7');
    expect(res.isDryRun).toBe(true);
    expect(db.ops).toEqual([]);
  });

  it('failure after data was committed: batch is kept as FAILED with its manifest and can be reverted', async () => {
    db.failOn = (op) => op.kind === 'set' && op.path === 'importBatches/B31_TEST'; // final batch record write fails
    await expect(importService.executeImport(validated(frontendPayload()), admin, 'req-8')).rejects.toBeInstanceOf(InternalError);
    db.failOn = null;

    const batch = db.store.get('importBatches/B31_TEST')!;
    expect(batch.status).toBe('FAILED');
    expect(batch.failureReason).toMatch(/Injected failure/);
    expect(batch.manifest).toHaveLength(3);
    expect(db.docsUnder('dailyReports/farmerA/dailyLogs/')).toHaveLength(2);
    const audits = db.docsUnder('auditLogs/').map((p) => db.store.get(p)!);
    expect(audits.some((a) => a.eventType === 'HISTORICAL_IMPORT_FAILED' && a.resourceId === 'B31_TEST')).toBe(true);

    const rev = await importService.revertImportBatch('B31_TEST', { confirmationBatchId: 'B31_TEST' }, admin, 'req-8r');
    expect(rev.status).toBe('REVERTED');
    expect(db.docsUnder('dailyReports/farmerA/dailyLogs/')).toHaveLength(0);
    expect(db.docsUnder('dailyReportLocks/')).toHaveLength(0);
    expect(db.docsUnder('logs/F1/feedLogs/')).toHaveLength(0);
    expect(db.docsUnder('farms/F1/feedTransactions/')).toHaveLength(0);
  });

  it('reusing an existing batch ID is refused before any data is written, and the existing batch is untouched', async () => {
    db.store.set('importBatches/B31_TEST', { batchId: 'B31_TEST', status: 'COMPLETED', revertStatus: 'NOT_REVERTED', manifest: [{ keep: true }] });
    await expect(importService.executeImport(validated(frontendPayload()), admin, 'req-9')).rejects.toBeInstanceOf(InternalError);
    expect(db.ops.filter((o) => o.kind === 'batch-commit')).toHaveLength(0);
    expect(db.store.get('importBatches/B31_TEST')).toEqual({ batchId: 'B31_TEST', status: 'COMPLETED', revertStatus: 'NOT_REVERTED', manifest: [{ keep: true }] });
  });
});

describe('B3.1 revert audit entries', () => {
  async function importThenRevert(worksheetKey?: string) {
    await importService.executeImport(validated(frontendPayload()), admin, 'req-imp');
    const before = new Set(db.docsUnder('auditLogs/'));
    const res = await importService.revertImportBatch('B31_TEST', { confirmationBatchId: 'B31_TEST', ...(worksheetKey ? { worksheetKey } : {}) }, admin, 'req-rev');
    const added = db.docsUnder('auditLogs/').filter((p) => !before.has(p)).map((p) => db.store.get(p)!);
    return { res, added };
  }

  it('whole-batch revert writes HISTORICAL_IMPORT_REVERT with worksheetStatus null (was silently dropped)', async () => {
    const { res, added } = await importThenRevert();
    expect(res.status).toBe('REVERTED');
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ eventType: 'HISTORICAL_IMPORT_REVERT', uid: 'admin1', resourceId: 'B31_TEST' });
    expect(added[0]!.metadata.worksheetStatus).toBeNull();
  });

  it('worksheet revert still writes HISTORICAL_IMPORT_WORKSHEET_REVERT', async () => {
    const { added } = await importThenRevert(SHEET);
    expect(added.map((a) => a.eventType)).toEqual(['HISTORICAL_IMPORT_WORKSHEET_REVERT']);
    expect(added[0]!.metadata.worksheetStatus).toBe('REVERTED');
  });
});

describe('B3.1 audit service and stripUndefined', () => {
  it('auditService.log records an entry even when metadata contains undefined', async () => {
    await auditService.log({ eventType: 'X', uid: 'admin1', requestId: 'r', metadata: { a: 1, b: undefined, nested: { c: undefined, d: [1, undefined] } } });
    const [p] = db.docsUnder('auditLogs/');
    expect(db.store.get(p!)!.metadata).toEqual({ a: 1, nested: { d: [1, null] } });
  });

  it('stripUndefined omits undefined properties, nulls undefined array items, and leaves class instances alone', () => {
    class Stamp { constructor(public s: number) {} }
    const ts = new Stamp(5);
    const out = stripUndefined({ a: undefined, b: null, c: [undefined, { d: undefined, e: 1 }], ts });
    expect(out).toEqual({ b: null, c: [null, { e: 1 }], ts });
    expect(out.ts).toBe(ts);
  });
});
