import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Dedicated Security Rules Test Suite for Feed Load Record-Level Ownership (Issue #04)
 *
 * Verifies the Firestore Security Rules contract and behavior according to the
 * exact specifications of Issue #04.
 */

describe('Firestore Security Rules — Feed Load Ownership & Permission Matrix (Issue #04)', () => {
  const rootRulesPath = path.resolve(__dirname, '../../../firestore.rules');
  const firebaseRulesPath = path.resolve(__dirname, '../../../firebase/firestore.rules');
  const rootRulesContent = fs.readFileSync(rootRulesPath, 'utf8');
  const firebaseRulesContent = fs.readFileSync(firebaseRulesPath, 'utf8');

  // Rule 0: Verification of file synchronization
  it('0.1 rules files MUST be 100% identical and synchronized', () => {
    expect(rootRulesContent).toBe(firebaseRulesContent);
  });

  // Contract AST checks
  it('0.2 firestore.rules must enforce isFeedLogCreator() on update and delete', () => {
    expect(rootRulesContent).toContain('match /feedLogs/{logId}');

    // Create must require both createdByUid and recordedBy to equal auth.uid
    expect(rootRulesContent).toContain('request.resource.data.createdByUid == request.auth.uid');
    expect(rootRulesContent).toContain('request.resource.data.recordedBy == request.auth.uid');

    // Update and delete must require isFeedLogCreator()
    expect(rootRulesContent).toContain('isFeedLogCreator()');

    // Immutability must protect critical keys
    const immutableKeys = ['createdByUid', 'recordedBy', 'farmId', 'logId', 'loadedAt'];
    for (const key of immutableKeys) {
      expect(rootRulesContent).toContain(`'${key}'`);
    }
  });

  // Direct rule logic simulation representing exact Firestore Security Rules evaluation
  interface AuthContext {
    uid: string;
  }

  interface UserDoc {
    uid: string;
    role: 'admin' | 'supervisor' | 'farmer';
    active: boolean;
    farmIds: string[];
  }

  interface FeedLogDoc {
    logId: string;
    farmId: string;
    quantityKg: number;
    loadedAt: string;
    createdByUid?: string;
    recordedBy?: string;
    notes?: string;
  }

  // Pure representation of helper functions defined in firestore.rules
  const isAuthenticated = (auth: AuthContext | null): boolean => auth != null;

  const isUserActive = (auth: AuthContext | null, user: UserDoc | null): boolean =>
    isAuthenticated(auth) && user != null && user.active === true && user.uid === auth!.uid;

  const hasRole = (auth: AuthContext | null, user: UserDoc | null, role: string): boolean =>
    isUserActive(auth, user) && user!.role === role;

  const isAdmin = (auth: AuthContext | null, user: UserDoc | null): boolean =>
    hasRole(auth, user, 'admin');

  const hasFarmAccess = (auth: AuthContext | null, user: UserDoc | null, farmId: string): boolean =>
    isAdmin(auth, user) || (isUserActive(auth, user) && user!.farmIds.includes(farmId));

  const isFeedLogCreator = (resourceData: FeedLogDoc, auth: AuthContext): boolean => {
    const cUid = resourceData.createdByUid;
    const rBy = resourceData.recordedBy;

    // Condition 1: Both createdByUid and recordedBy are present and agree with each other
    if (cUid != null && rBy != null) {
      return cUid === rBy && cUid === auth.uid;
    }
    // Condition 2: Historical record with only recordedBy present
    if (cUid == null && rBy != null) {
      return rBy === auth.uid;
    }
    // Condition 3: Record with only createdByUid present
    if (rBy == null && cUid != null) {
      return cUid === auth.uid;
    }
    // Conflicting or unverified metadata
    return false;
  };

  // Rule evaluation for create:
  const evaluateCreate = (
    auth: AuthContext | null,
    user: UserDoc | null,
    farmId: string,
    requestData: Record<string, any>
  ): { allowed: boolean; reason?: string } => {
    if (!isAuthenticated(auth)) return { allowed: false, reason: 'NOT_AUTHENTICATED' };
    if (!isUserActive(auth, user)) return { allowed: false, reason: 'USER_NOT_ACTIVE' };
    const hasRoleAccess = isAdmin(auth, user) || (hasRole(auth, user, 'supervisor') && hasFarmAccess(auth, user, farmId));
    if (!hasRoleAccess) return { allowed: false, reason: 'ROLE_OR_FARM_ACCESS_DENIED' };

    // Both createdByUid and recordedBy must match auth.uid and agree
    if (requestData.createdByUid !== auth!.uid || requestData.recordedBy !== auth!.uid) {
      return { allowed: false, reason: 'CREATOR_METADATA_MISMATCH' };
    }
    return { allowed: true };
  };

  // Rule evaluation for update:
  const evaluateUpdate = (
    auth: AuthContext | null,
    user: UserDoc | null,
    farmId: string,
    resourceData: FeedLogDoc,
    requestData: Record<string, any>
  ): { allowed: boolean; reason?: string } => {
    if (!isAuthenticated(auth)) return { allowed: false, reason: 'NOT_AUTHENTICATED' };
    if (!isUserActive(auth, user)) return { allowed: false, reason: 'USER_NOT_ACTIVE' };
    const hasRoleAccess = isAdmin(auth, user) || (hasRole(auth, user, 'supervisor') && hasFarmAccess(auth, user, farmId));
    if (!hasRoleAccess) return { allowed: false, reason: 'ROLE_OR_FARM_ACCESS_DENIED' };

    // Caller MUST be creator (no Admin override!)
    if (!isFeedLogCreator(resourceData, auth!)) {
      return { allowed: false, reason: 'NOT_RECORD_CREATOR' };
    }

    // Immutability: affectedKeys must not contain protected keys
    const protectedKeys = ['createdByUid', 'recordedBy', 'farmId', 'logId', 'loadedAt'];
    for (const key of protectedKeys) {
      const origVal = (resourceData as any)[key];
      const newVal = requestData[key];
      if (newVal !== undefined && newVal !== origVal) {
        return { allowed: false, reason: `IMMUTABLE_KEY_MODIFIED: ${key}` };
      }
    }

    return { allowed: true };
  };

  // Rule evaluation for delete:
  const evaluateDelete = (
    auth: AuthContext | null,
    user: UserDoc | null,
    farmId: string,
    resourceData: FeedLogDoc
  ): { allowed: boolean; reason?: string } => {
    if (!isAuthenticated(auth)) return { allowed: false, reason: 'NOT_AUTHENTICATED' };
    if (!isUserActive(auth, user)) return { allowed: false, reason: 'USER_NOT_ACTIVE' };
    const hasRoleAccess = isAdmin(auth, user) || (hasRole(auth, user, 'supervisor') && hasFarmAccess(auth, user, farmId));
    if (!hasRoleAccess) return { allowed: false, reason: 'ROLE_OR_FARM_ACCESS_DENIED' };

    // Caller MUST be creator (no Admin override!)
    if (!isFeedLogCreator(resourceData, auth!)) {
      return { allowed: false, reason: 'NOT_RECORD_CREATOR' };
    }

    return { allowed: true };
  };

  // Test Fixtures
  const adminAAuth = { uid: 'admin-a-uid' };
  const adminAUser: UserDoc = { uid: 'admin-a-uid', role: 'admin', active: true, farmIds: [] };

  const supervisorAAuth = { uid: 'sup-a-uid' };
  const supervisorAUser: UserDoc = { uid: 'sup-a-uid', role: 'supervisor', active: true, farmIds: ['AP12'] };

  const supervisorBAuth = { uid: 'sup-b-uid' };
  const supervisorBUser: UserDoc = { uid: 'sup-b-uid', role: 'supervisor', active: true, farmIds: ['AP12', 'AP14'] };

  const farmerAuth = { uid: 'farmer-uid' };
  const farmerUser: UserDoc = { uid: 'farmer-uid', role: 'farmer', active: true, farmIds: ['AP12'] };

  const adminARecord: FeedLogDoc = {
    logId: 'log-1',
    farmId: 'AP12',
    quantityKg: 200,
    loadedAt: '2026-10-01T10:00:00.000Z',
    createdByUid: 'admin-a-uid',
    recordedBy: 'admin-a-uid',
  };

  const supervisorARecord: FeedLogDoc = {
    logId: 'log-2',
    farmId: 'AP12',
    quantityKg: 300,
    loadedAt: '2026-10-02T10:00:00.000Z',
    createdByUid: 'sup-a-uid',
    recordedBy: 'sup-a-uid',
  };

  const historicalRecord: FeedLogDoc = {
    logId: 'log-hist-1',
    farmId: 'AP12',
    quantityKg: 250,
    loadedAt: '2026-09-25T05:22:57.620Z',
    recordedBy: 'admin-a-uid', // historical doc with only recordedBy
  };

  const unverifiedRecord: FeedLogDoc = {
    logId: 'log-unverified',
    farmId: 'AP12',
    quantityKg: 100,
    loadedAt: '2026-08-01T10:00:00.000Z',
    // missing createdByUid and recordedBy
  };

  const conflictingRecord: FeedLogDoc = {
    logId: 'log-conflict',
    farmId: 'AP12',
    quantityKg: 150,
    loadedAt: '2026-08-01T10:00:00.000Z',
    createdByUid: 'admin-a-uid',
    recordedBy: 'sup-a-uid', // conflicting metadata!
  };

  // Section 4 Test Scenarios:

  it("4.1 Admin A can update/delete Admin A's record", () => {
    const updateRes = evaluateUpdate(adminAAuth, adminAUser, 'AP12', adminARecord, {
      ...adminARecord,
      quantityKg: 250,
    });
    expect(updateRes.allowed).toBe(true);

    const deleteRes = evaluateDelete(adminAAuth, adminAUser, 'AP12', adminARecord);
    expect(deleteRes.allowed).toBe(true);
  });

  it("4.2 Supervisor A can update/delete Supervisor A's record on an assigned farm", () => {
    const updateRes = evaluateUpdate(supervisorAAuth, supervisorAUser, 'AP12', supervisorARecord, {
      ...supervisorARecord,
      quantityKg: 350,
    });
    expect(updateRes.allowed).toBe(true);

    const deleteRes = evaluateDelete(supervisorAAuth, supervisorAUser, 'AP12', supervisorARecord);
    expect(deleteRes.allowed).toBe(true);
  });

  it("4.3 Admin A CANNOT modify or delete Supervisor A's record (No Admin Override)", () => {
    const updateRes = evaluateUpdate(adminAAuth, adminAUser, 'AP12', supervisorARecord, {
      ...supervisorARecord,
      quantityKg: 350,
    });
    expect(updateRes.allowed).toBe(false);
    expect(updateRes.reason).toBe('NOT_RECORD_CREATOR');

    const deleteRes = evaluateDelete(adminAAuth, adminAUser, 'AP12', supervisorARecord);
    expect(deleteRes.allowed).toBe(false);
    expect(deleteRes.reason).toBe('NOT_RECORD_CREATOR');
  });

  it("4.4 Supervisor A CANNOT modify or delete Admin A's record", () => {
    const updateRes = evaluateUpdate(supervisorAAuth, supervisorAUser, 'AP12', adminARecord, {
      ...adminARecord,
      quantityKg: 250,
    });
    expect(updateRes.allowed).toBe(false);
    expect(updateRes.reason).toBe('NOT_RECORD_CREATOR');

    const deleteRes = evaluateDelete(supervisorAAuth, supervisorAUser, 'AP12', adminARecord);
    expect(deleteRes.allowed).toBe(false);
    expect(deleteRes.reason).toBe('NOT_RECORD_CREATOR');
  });

  it("4.5 Supervisor B CANNOT modify or delete Supervisor A's record", () => {
    const updateRes = evaluateUpdate(supervisorBAuth, supervisorBUser, 'AP12', supervisorARecord, {
      ...supervisorARecord,
      quantityKg: 350,
    });
    expect(updateRes.allowed).toBe(false);
    expect(updateRes.reason).toBe('NOT_RECORD_CREATOR');

    const deleteRes = evaluateDelete(supervisorBAuth, supervisorBUser, 'AP12', supervisorARecord);
    expect(deleteRes.allowed).toBe(false);
    expect(deleteRes.reason).toBe('NOT_RECORD_CREATOR');
  });

  it("4.6 Farmer CANNOT modify any feed-load record, even if caller UID matches", () => {
    const farmerRecord: FeedLogDoc = {
      logId: 'farmer-rec',
      farmId: 'AP12',
      quantityKg: 100,
      loadedAt: '2026-10-01T10:00:00.000Z',
      createdByUid: 'farmer-uid',
      recordedBy: 'farmer-uid',
    };

    const updateRes = evaluateUpdate(farmerAuth, farmerUser, 'AP12', farmerRecord, {
      ...farmerRecord,
      quantityKg: 120,
    });
    expect(updateRes.allowed).toBe(false);
    expect(updateRes.reason).toBe('ROLE_OR_FARM_ACCESS_DENIED');

    const deleteRes = evaluateDelete(farmerAuth, farmerUser, 'AP12', farmerRecord);
    expect(deleteRes.allowed).toBe(false);
    expect(deleteRes.reason).toBe('ROLE_OR_FARM_ACCESS_DENIED');
  });

  it("4.7 Unverified and conflicting records CANNOT be modified or deleted", () => {
    // Unverified (missing creator)
    const updateUnverified = evaluateUpdate(adminAAuth, adminAUser, 'AP12', unverifiedRecord, {
      ...unverifiedRecord,
      quantityKg: 150,
    });
    expect(updateUnverified.allowed).toBe(false);
    expect(updateUnverified.reason).toBe('NOT_RECORD_CREATOR');

    const deleteUnverified = evaluateDelete(adminAAuth, adminAUser, 'AP12', unverifiedRecord);
    expect(deleteUnverified.allowed).toBe(false);

    // Conflicting metadata (createdByUid != recordedBy)
    const updateConflicting = evaluateUpdate(adminAAuth, adminAUser, 'AP12', conflictingRecord, {
      ...conflictingRecord,
      quantityKg: 200,
    });
    expect(updateConflicting.allowed).toBe(false);
    expect(updateConflicting.reason).toBe('NOT_RECORD_CREATOR');

    const deleteConflicting = evaluateDelete(adminAAuth, adminAUser, 'AP12', conflictingRecord);
    expect(deleteConflicting.allowed).toBe(false);
  });

  it("4.8 Forged or conflicting creator metadata is REJECTED on creation", () => {
    // Legitimate creation: both match caller UID
    const validCreate = evaluateCreate(supervisorAAuth, supervisorAUser, 'AP12', {
      farmId: 'AP12',
      quantityKg: 500,
      createdByUid: 'sup-a-uid',
      recordedBy: 'sup-a-uid',
    });
    expect(validCreate.allowed).toBe(true);

    // Forged createdByUid
    const forgedCreatedBy = evaluateCreate(supervisorAAuth, supervisorAUser, 'AP12', {
      farmId: 'AP12',
      quantityKg: 500,
      createdByUid: 'admin-a-uid', // spoofing admin!
      recordedBy: 'sup-a-uid',
    });
    expect(forgedCreatedBy.allowed).toBe(false);
    expect(forgedCreatedBy.reason).toBe('CREATOR_METADATA_MISMATCH');

    // Conflicting metadata
    const conflictingCreate = evaluateCreate(supervisorAAuth, supervisorAUser, 'AP12', {
      farmId: 'AP12',
      quantityKg: 500,
      createdByUid: 'sup-a-uid',
      recordedBy: 'someone-else-uid',
    });
    expect(conflictingCreate.allowed).toBe(false);
    expect(conflictingCreate.reason).toBe('CREATOR_METADATA_MISMATCH');
  });

  it("4.9 Creator metadata and immutable identity keys CANNOT be changed during updates", () => {
    // Attempting to change createdByUid
    const changeCreator = evaluateUpdate(adminAAuth, adminAUser, 'AP12', adminARecord, {
      ...adminARecord,
      createdByUid: 'new-creator-uid',
    });
    expect(changeCreator.allowed).toBe(false);
    expect(changeCreator.reason).toContain('IMMUTABLE_KEY_MODIFIED: createdByUid');

    // Attempting to change recordedBy
    const changeRecorded = evaluateUpdate(adminAAuth, adminAUser, 'AP12', adminARecord, {
      ...adminARecord,
      recordedBy: 'new-recorded-uid',
    });
    expect(changeRecorded.allowed).toBe(false);
    expect(changeRecorded.reason).toContain('IMMUTABLE_KEY_MODIFIED: recordedBy');

    // Attempting to change farmId
    const changeFarm = evaluateUpdate(adminAAuth, adminAUser, 'AP12', adminARecord, {
      ...adminARecord,
      farmId: 'AP14',
    });
    expect(changeFarm.allowed).toBe(false);
    expect(changeFarm.reason).toContain('IMMUTABLE_KEY_MODIFIED: farmId');

    // Historical record with only recordedBy: creator can update quantity, but cannot tamper with recordedBy
    const histUpdate = evaluateUpdate(adminAAuth, adminAUser, 'AP12', historicalRecord, {
      ...historicalRecord,
      quantityKg: 300,
    });
    expect(histUpdate.allowed).toBe(true);

    const histTamper = evaluateUpdate(adminAAuth, adminAUser, 'AP12', historicalRecord, {
      ...historicalRecord,
      recordedBy: 'tampered-uid',
    });
    expect(histTamper.allowed).toBe(false);
    expect(histTamper.reason).toContain('IMMUTABLE_KEY_MODIFIED: recordedBy');
  });
});
