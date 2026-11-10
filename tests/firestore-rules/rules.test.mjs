// Firestore Security Rules test suite (emulator only).
//
// Run via:  npm run test:rules
// which wraps:  firebase emulators:exec --only firestore --project demo-happy-farms "node --test tests/firestore-rules/rules.test.mjs"
//
// Safety: the `demo-` project prefix makes the emulator refuse to talk to any real Firebase project,
// so these tests can never touch production data. No external test libraries are needed: requests go
// straight to the emulator REST API using unsigned emulator ID tokens.
//
// Sections:
//   1. Stated security requirements  — must always hold (regressions fail the build).
//   2. SAF-01 report write binding    — cross-farm report writes denied, legitimate flows allowed.
//   3. Known open weaknesses          — `todo` tests asserting the SECURE outcome; they report but do not
//                                        fail the build until the batch named in each todo fixes them.

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const HOST = process.env.FIRESTORE_EMULATOR_HOST;
const PROJECT = process.env.GCLOUD_PROJECT || 'demo-happy-farms';
if (!HOST) {
  throw new Error('FIRESTORE_EMULATOR_HOST is not set. Run this suite through `npm run test:rules`.');
}
if (!PROJECT.startsWith('demo-')) {
  throw new Error(`Refusing to run rules tests against non-demo project "${PROJECT}".`);
}

const DOCS = `http://${HOST}/v1/projects/${PROJECT}/databases/(default)/documents`;

// ---------------------------------------------------------------------------------------------
// Minimal emulator REST helpers
// ---------------------------------------------------------------------------------------------
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function idToken(uid) {
  const now = Math.floor(Date.now() / 1000);
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64({
    iss: `https://securetoken.google.com/${PROJECT}`,
    aud: PROJECT,
    iat: now,
    exp: now + 3600,
    auth_time: now,
    sub: uid,
    user_id: uid,
    firebase: { sign_in_provider: 'password', identities: {} },
  })}.`;
}

function toValue(v) {
  if (v === null) return { nullValue: null };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'object') return { mapValue: { fields: toFields(v) } };
  return { stringValue: String(v) };
}
const toFields = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, toValue(v)]));

/**
 * Perform one Firestore REST call.
 * @param {string} who   uid, or 'owner' to bypass rules (seeding only)
 * @param {'GET'|'PATCH'|'DELETE'} method
 * @param {string} path  document path
 * @param {object} [opts] { data, mask: string[] (field mask => partial update), exists: boolean precondition }
 * @returns {Promise<number>} HTTP status
 */
async function call(who, method, path, opts = {}) {
  const params = new URLSearchParams();
  for (const m of opts.mask ?? []) params.append('updateMask.fieldPaths', m);
  if (opts.exists !== undefined) params.append('currentDocument.exists', String(opts.exists));
  const qs = params.toString();
  const res = await fetch(`${DOCS}/${path}${qs ? `?${qs}` : ''}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${who === 'owner' ? 'owner' : idToken(who)}`,
    },
    body: opts.data ? JSON.stringify({ fields: toFields(opts.data) }) : undefined,
  });
  await res.text();
  return res.status;
}

const seed = (path, data) => call('owner', 'PATCH', path, { data });
/** Create a document that must not exist yet (exercises `allow create`). */
const create = (who, path, data) => call(who, 'PATCH', path, { data, exists: false });
/** Full-document overwrite of an existing document (exercises `allow update`, like set() without merge). */
const overwrite = (who, path, data) => call(who, 'PATCH', path, { data, exists: true });
/** Partial update of an existing document (exercises `allow update`, like update()/set(merge)). */
const patch = (who, path, data) => call(who, 'PATCH', path, { data, mask: Object.keys(data), exists: true });
const read = (who, path) => call(who, 'GET', path);
const remove = (who, path) => call(who, 'DELETE', path);

const ALLOWED = 200;
const DENIED = 403;
const allowed = async (p) => assert.equal(await p, ALLOWED, 'expected the request to be ALLOWED');
const denied = async (p) => assert.equal(await p, DENIED, 'expected the request to be DENIED');

async function resetDatabase() {
  const res = await fetch(`http://${HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, {
    method: 'DELETE',
  });
  assert.ok(res.ok, `emulator reset failed: ${res.status}`);
}

// ---------------------------------------------------------------------------------------------
// Fixture: two farms, one supervisor on F1, one farmer per farm, an admin, a deactivated user.
// ---------------------------------------------------------------------------------------------
const D1 = '2026-11-01';
const D2 = '2026-11-02';

async function seedFixture() {
  await seed('users/admin1', { role: 'admin', active: true, farmIds: [] });
  await seed('users/sup1', { role: 'supervisor', active: true, farmIds: ['F1'] });
  await seed('users/farmerA', { role: 'farmer', active: true, farmIds: ['F1'], createdAt: '2026-01-01' });
  await seed('users/farmerB', { role: 'farmer', active: true, farmIds: ['F2'], createdAt: '2026-01-01' });
  await seed('users/farmerAB', { role: 'farmer', active: true, farmIds: ['F1', 'F2'], createdAt: '2026-01-01' });
  await seed('users/inactiveA', { role: 'farmer', active: false, farmIds: ['F1'] });

  await seed('farms/F1', { name: 'Farm 1', currentFeedKg: 100, currentBirdCount: 1000 });
  await seed('farms/F2', { name: 'Farm 2', currentFeedKg: 100, currentBirdCount: 1000 });

  await seed('dailyReports/farmerA', { userId: 'farmerA', farmId: 'F1', lastSubmissionDate: D1 });
  await seed(`dailyReports/farmerA/dailyLogs/${D1}`, { farmId: 'F1', userId: 'farmerA', submittedBy: 'farmerA', submissionVersion: 1, eggsProduced: 800 });
  await seed(`dailyReports/farmerA/dailyLogs/${D1}/revisions/v1`, { farmId: 'F1', userId: 'farmerA', eggsProduced: 700 });
  await seed('dailyReports/farmerB', { userId: 'farmerB', farmId: 'F2', lastSubmissionDate: D1 });
  await seed(`dailyReports/farmerB/dailyLogs/${D1}`, { farmId: 'F2', userId: 'farmerB', submittedBy: 'farmerB', submissionVersion: 1, eggsProduced: 900 });
  // Historical-import record placed on farmer A's path by an admin.
  await seed(`dailyReports/farmerA/dailyLogs/${D2}`, { farmId: 'F1', userId: 'farmerA', submittedBy: 'admin1', submissionMethod: 'HISTORICAL_IMPORT', submissionVersion: 1 });
  // Legacy record with no farmId.
  await seed('dailyReports/farmerA/dailyLogs/2026-10-01', { userId: 'farmerA', eggsProduced: 10 });

  await seed('logs/F1/feedLogs/L_admin', { createdByUid: 'admin1', recordedBy: 'admin1', farmId: 'F1', quantityKg: 50 });
  await seed('logs/F1/feedLogs/L_sup', { createdByUid: 'sup1', recordedBy: 'sup1', farmId: 'F1', quantityKg: 50 });
  await seed('farms/F1/feedTransactions/T1', { farmId: 'F1', type: 'FEED_LOAD', feedKg: 50 });
  await seed('notifications/N_open', { farmId: 'F1', resolved: false, createdAt: '2026-11-01', readBy: [] });
  await seed('notifications/N_done', { farmId: 'F1', resolved: true, resolvedBy: 'admin1', createdAt: '2026-11-01', readBy: [] });
  await seed('auditLogs/a1', { userId: 'farmerA', action: 'REPORT_SUBMITTED' });
}

beforeEach(async () => {
  await resetDatabase();
  await seedFixture();
});

// ---------------------------------------------------------------------------------------------
// 1. Stated security requirements (must always hold)
// ---------------------------------------------------------------------------------------------
describe('Stated requirements', () => {
  test('users cannot change their own role', () => denied(patch('farmerA', 'users/farmerA', { role: 'admin' })));
  test('users cannot change their own farmIds', () => denied(patch('farmerA', 'users/farmerA', { farmIds: ['F1', 'F2'] })));
  test('users cannot reactivate themselves', () => denied(patch('inactiveA', 'users/inactiveA', { active: true })));
  test('farmer cannot read another farm', () => denied(read('farmerA', 'farms/F2')));
  test('farmer cannot read another farmer profile', () => denied(read('farmerA', 'users/farmerB')));
  test('deactivated user cannot read own farm', () => denied(read('inactiveA', 'farms/F1')));

  test('Feed Load: supervisor cannot edit a load created by someone else', () =>
    denied(patch('sup1', 'logs/F1/feedLogs/L_admin', { quantityKg: 1 })));
  test('Feed Load: supervisor cannot delete a load created by someone else', () =>
    denied(remove('sup1', 'logs/F1/feedLogs/L_admin')));
  test('Feed Load: admin cannot edit a load created by someone else', () =>
    denied(patch('admin1', 'logs/F1/feedLogs/L_sup', { quantityKg: 1 })));
  test('Feed Load: admin cannot delete a load created by someone else', () =>
    denied(remove('admin1', 'logs/F1/feedLogs/L_sup')));
  test('Feed Load: creator (supervisor) can edit own load', () =>
    allowed(patch('sup1', 'logs/F1/feedLogs/L_sup', { quantityKg: 60 })));
  test('Feed Load: farmers cannot create loads', () =>
    denied(create('farmerA', 'logs/F1/feedLogs/L_new', { createdByUid: 'farmerA', recordedBy: 'farmerA', farmId: 'F1' })));
  test('Feed Load: farmers cannot delete loads', () => denied(remove('farmerA', 'logs/F1/feedLogs/L_sup')));

  test('feed transactions are append-only for supervisors (no update)', () =>
    denied(patch('sup1', 'farms/F1/feedTransactions/T1', { feedKg: 1 })));
  test('feed transactions are append-only for supervisors (no delete)', () =>
    denied(remove('sup1', 'farms/F1/feedTransactions/T1')));

  test('notifications cannot be deleted, even by admin', () => denied(remove('admin1', 'notifications/N_open')));
  test('supervisor cannot resolve a notification', () =>
    denied(patch('sup1', 'notifications/N_open', { resolved: true, resolvedBy: 'sup1' })));
  test('admin cannot reopen a resolved notification', () =>
    denied(patch('admin1', 'notifications/N_done', { resolved: false })));
});

// ---------------------------------------------------------------------------------------------
// 2. SAF-01 — daily report write binding
// ---------------------------------------------------------------------------------------------
describe('SAF-01 report write binding: legitimate flows stay allowed', () => {
  test('farmer creates the parent report doc for own farm', async () => {
    await seed('users/farmerC', { role: 'farmer', active: true, farmIds: ['F1'] });
    await allowed(create('farmerC', 'dailyReports/farmerC', { userId: 'farmerC', farmId: 'F1', lastSubmissionDate: D2 }));
  });
  test('farmer updates the parent report doc (merge)', () =>
    allowed(patch('farmerA', 'dailyReports/farmerA', { farmId: 'F1', lastSubmissionDate: D2 })));
  test('farmer submits a new daily log for own farm (version 1)', () =>
    allowed(create('farmerA', 'dailyReports/farmerA/dailyLogs/2026-11-03', { farmId: 'F1', userId: 'farmerA', submissionVersion: 1 })));
  test('farmer corrects own daily log (version 2, same farm)', () =>
    allowed(patch('farmerA', `dailyReports/farmerA/dailyLogs/${D1}`, { farmId: 'F1', submissionVersion: 2, status: 'corrected' })));
  test('farmer archives version 1 into revisions/v1 (create)', () =>
    allowed(create('farmerA', `dailyReports/farmerA/dailyLogs/${D2}/revisions/v1`, { farmId: 'F1', userId: 'farmerA' })));
  test('farmer re-archives revisions/imported_v1 (overwrite, same farm)', async () => {
    await seed(`dailyReports/farmerA/dailyLogs/${D2}/revisions/imported_v1`, { farmId: 'F1', userId: 'farmerA' });
    await allowed(overwrite('farmerA', `dailyReports/farmerA/dailyLogs/${D2}/revisions/imported_v1`, { farmId: 'F1', userId: 'farmerA', archivedReason: 'X' }));
  });
  test('farmer submits over an admin-imported record on own path', () =>
    allowed(overwrite('farmerA', `dailyReports/farmerA/dailyLogs/${D2}`, { farmId: 'F1', userId: 'farmerA', submittedBy: 'farmerA', submissionMethod: 'DIGITAL_FORM', submissionVersion: 1 })));
  test('farmer updates a legacy log that has no farmId (sets own farm)', () =>
    allowed(patch('farmerA', 'dailyReports/farmerA/dailyLogs/2026-10-01', { farmId: 'F1', eggsProduced: 11 })));
  test('multi-farm farmer can point the parent doc at another assigned farm', () =>
    allowed(create('farmerAB', 'dailyReports/farmerAB', { userId: 'farmerAB', farmId: 'F2' })));
  test('admin writes a daily log on any user path (client-side historical import)', () =>
    allowed(create('admin1', 'dailyReports/farmerB/dailyLogs/2026-11-05', { farmId: 'F2', userId: 'farmerB', submissionMethod: 'HISTORICAL_IMPORT' })));
  test('admin corrects a daily log on any user path', () =>
    allowed(patch('admin1', `dailyReports/farmerB/dailyLogs/${D1}`, { eggsProduced: 901 })));
  test('reads unchanged: supervisor reads assigned-farm report', () =>
    allowed(read('sup1', `dailyReports/farmerA/dailyLogs/${D1}`)));
  test('reads unchanged: farmer reads own report', () => allowed(read('farmerA', `dailyReports/farmerA/dailyLogs/${D1}`)));
});

describe('SAF-01 report write binding: cross-farm writes are denied', () => {
  test('R3: farmer cannot file a report on own path tagged with another farm', () =>
    denied(create('farmerA', 'dailyReports/farmerA/dailyLogs/2026-11-03', { farmId: 'F2', eggsProduced: 5 })));
  test('R5: farmer cannot overwrite another farmer\'s report by re-tagging farmId', () =>
    denied(patch('farmerA', `dailyReports/farmerB/dailyLogs/${D1}`, { farmId: 'F1', eggsProduced: 0 })));
  test('R6: supervisor cannot overwrite an unassigned farm\'s report by re-tagging farmId', () =>
    denied(patch('sup1', `dailyReports/farmerB/dailyLogs/${D1}`, { farmId: 'F1', eggsProduced: 1 })));
  test('supervisor cannot write into a farmer\'s report path even for an assigned farm', () =>
    denied(patch('sup1', `dailyReports/farmerA/dailyLogs/${D1}`, { farmId: 'F1', eggsProduced: 1 })));
  test('farmer cannot create reports under another user\'s path for own farm', () =>
    denied(create('farmerA', 'dailyReports/farmerB/dailyLogs/2026-11-09', { farmId: 'F1', eggsProduced: 1 })));
  test('farmer cannot create a parent report doc for another user', () =>
    denied(create('farmerA', 'dailyReports/farmerX', { userId: 'farmerX', farmId: 'F1' })));
  test('farmer cannot create a root-level report with an arbitrary id', () =>
    denied(create('farmerA', 'dailyReports/some-report-id', { farmId: 'F1' })));
  test('multi-farm farmer cannot move an existing daily log to another farm', () =>
    seed('dailyReports/farmerAB/dailyLogs/2026-11-01', { farmId: 'F1', userId: 'farmerAB' })
      .then(() => denied(patch('farmerAB', 'dailyReports/farmerAB/dailyLogs/2026-11-01', { farmId: 'F2' }))));
  test('multi-farm farmer cannot move an existing revision to another farm', () =>
    seed('dailyReports/farmerAB/dailyLogs/2026-11-01/revisions/v1', { farmId: 'F1', userId: 'farmerAB' })
      .then(() => denied(patch('farmerAB', 'dailyReports/farmerAB/dailyLogs/2026-11-01/revisions/v1', { farmId: 'F2' }))));
  test('farmer cannot write revisions tagged with another farm', () =>
    denied(create('farmerA', `dailyReports/farmerA/dailyLogs/${D1}/revisions/v9`, { farmId: 'F2' })));
  test('farmer cannot write revisions under another farmer\'s report', () =>
    denied(create('farmerA', `dailyReports/farmerB/dailyLogs/${D1}/revisions/v1`, { farmId: 'F1' })));
  test('deactivated farmer cannot write to own report path', () =>
    denied(create('inactiveA', 'dailyReports/inactiveA/dailyLogs/2026-11-03', { farmId: 'F1' })));
  test('farmer cannot write a daily log without a farmId', () =>
    denied(create('farmerA', 'dailyReports/farmerA/dailyLogs/2026-11-04', { eggsProduced: 1 })));
  test('reads unchanged: supervisor cannot read unassigned-farm report', () =>
    denied(read('sup1', `dailyReports/farmerB/dailyLogs/${D1}`)));
});

// ---------------------------------------------------------------------------------------------
// 3. Known open weaknesses from the 2026-11-10 audit (secure outcome asserted; tracked as todo)
// ---------------------------------------------------------------------------------------------
describe('Known open weaknesses (todo until fixed)', () => {
  const todo = (id, batch, name, fn) => test(`${id}: ${name}`, { todo: `${batch} (security/PRODUCTION_SECURITY_AUDIT_2026-11-10.md)` }, fn);

  todo('R1', 'SAF-02 / B5', 'farmer cannot set own farm stock to arbitrary values', () =>
    denied(patch('farmerA', 'farms/F1', { currentFeedKg: 999999, currentBirdCount: 1 })));
  todo('R2', 'SAF-02 / B5', 'supervisor cannot rename a farm', () => denied(patch('sup1', 'farms/F1', { name: 'Renamed' })));
  // Found in the B1+B2 review: attribution fields on the owner's own path are not bound to the owner.
  // A record whose submittedBy differs from its owner is treated as an import by submitReport,
  // which would let a farmer bypass the one-correction limit. Revisions must stay exempt, because
  // archiving copies the importer's submittedBy.
  todo('R16', 'SAF-02 / B5', 'farmer cannot attribute own daily log to another submitter', () =>
    denied(create('farmerA', 'dailyReports/farmerA/dailyLogs/2026-11-06', { farmId: 'F1', userId: 'farmerA', submittedBy: 'admin1' })));
  todo('R4', 'SAF-02 / B5', 'farmer cannot back-date a report outside the allowed window', () =>
    denied(create('farmerA', 'dailyReports/farmerA/dailyLogs/2025-01-01', { farmId: 'F1', eggsProduced: 5 })));
  todo('R7', 'SAF-09 / B4', 'farmer cannot rewrite an archived revision', () =>
    denied(patch('farmerA', `dailyReports/farmerA/dailyLogs/${D1}/revisions/v1`, { eggsProduced: 1 })));
  todo('R8', 'SAF-08 / B9', 'supervisor cannot read a farmer profile on an unassigned farm', () =>
    denied(read('sup1', 'users/farmerB')));
  todo('R9', 'SAF-09 / B4', 'admin cannot edit an audit log entry', () =>
    denied(patch('admin1', 'auditLogs/a1', { action: 'TAMPERED' })));
  todo('R10', 'SAF-09 / B4', 'deactivated user cannot create audit log entries', () =>
    denied(create('inactiveA', 'auditLogs/fake1', { userId: 'inactiveA', action: 'X' })));
  todo('R12', 'SAF-13 / B4', 'supervisor cannot create a notification already resolved by an admin', () =>
    denied(create('sup1', 'notifications/N_fake', { farmId: 'F1', source: 'bootstrap', targetRoles: ['admin'], channels: ['IN_APP'], priority: 'INFO', resolved: true, resolvedBy: 'admin1', createdAt: 'x' })));
  todo('R13', 'SAF-18 / B4', 'users cannot add unexpected fields to their own profile', () =>
    denied(patch('farmerA', 'users/farmerA', { farmId: 'F2' })));
  todo('R14', 'SAF-02 / B5', 'farmer cannot rewrite the weekly lock document', () =>
    denied(create('farmerA', 'dailyReportLocks/weekly_F1_W5', { farmId: 'F1', bodyWeight: 1 })));
  todo('R15', 'SAF-02 / B5', 'farmer cannot append a fake FEED_LOAD transaction', () =>
    denied(create('farmerA', 'farms/F1/feedTransactions/fake1', { farmId: 'F1', type: 'FEED_LOAD', feedKg: 5000 })));
});
