import * as admin from 'firebase-admin';
import { getFirestore, getAuth } from '../config/firebase';
import { AuditService } from './audit.service';
import { DuplicateError, NotFoundError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';
import { CreateSupervisorInput } from '../validators/supervisor.validator';
import { CreateAdminUserInput } from '../validators/adminUser.validator';

interface UserCreatedResult {
  uid: string;
  email: string;
}

export class UserService {
  private auditService = new AuditService();

  private get db() {
    return getFirestore();
  }

  private get auth() {
    return getAuth();
  }

  async createSupervisor(
    input: CreateSupervisorInput,
    createdByUid: string,
    requestId: string,
  ): Promise<UserCreatedResult> {
    // 1. Check duplicate email & phone
    await this.checkDuplicateEmail(input.email, requestId);
    await this.checkDuplicatePhone(input.phone_no, requestId);

    // 2. Deduplicate and validate assigned farm IDs
    const farmIds = Array.from(new Set(input.farmIds.filter((id) => Boolean(id && id.trim()))));
    if (farmIds.length === 0) {
      throw new ValidationError('At least one valid farm must be assigned to supervisor.');
    }
    await this.validateFarmsExist(farmIds, requestId);

    // 3. Create Firebase Auth user
    let authUser: admin.auth.UserRecord;
    try {
      authUser = await this.auth.createUser({
        email: input.email,
        password: input.password,
        displayName: input.name,
        disabled: false,
      });
      logger.info('Firebase Auth supervisor created', {
        requestId,
        newUserId: authUser.uid,
        email: input.email,
      });
    } catch (err: any) {
      if (err.code === 'auth/email-already-exists') {
        throw new DuplicateError('A user with this email already exists in Firebase Authentication');
      }
      logger.error('Failed to create Firebase Auth user for supervisor', {
        requestId,
        email: input.email,
        errorName: err.name,
        errorCode: err.code,
      });
      throw err;
    }

    // 4. Create Firestore user document
    try {
      const userRef = this.db.collection('users').doc(authUser.uid);
      const userDoc = {
        name: input.name,
        email: input.email,
        phone_no: Number(input.phone_no) || input.phone_no,
        role: 'supervisor',
        farmIds,
        active: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await userRef.set(userDoc);
      logger.info('Firestore supervisor document created', {
        requestId,
        newUserId: authUser.uid,
        role: 'supervisor',
        farmIds,
      });
    } catch (err: any) {
      logger.error('Firestore supervisor user creation failed, attempting Auth cleanup', {
        requestId,
        newUserId: authUser.uid,
        errorName: err.name,
      });

      try {
        await this.auth.deleteUser(authUser.uid);
      } catch (cleanupErr: any) {
        logger.error('Failed to cleanup Auth user after Firestore failure', { requestId, newUserId: authUser.uid });
      }
      throw err;
    }

    // 5. Audit Log
    await this.auditService.log({
      eventType: 'SUPERVISOR_CREATED',
      uid: createdByUid,
      resourceId: authUser.uid,
      requestId,
      metadata: {
        createdUserRole: 'supervisor',
        assignedFarmIds: farmIds,
      },
    });

    return {
      uid: authUser.uid,
      email: input.email,
    };
  }

  async createAdmin(
    input: CreateAdminUserInput,
    createdByUid: string,
    requestId: string,
  ): Promise<UserCreatedResult> {
    // 1. Check duplicate email & phone
    await this.checkDuplicateEmail(input.email, requestId);
    await this.checkDuplicatePhone(input.phone_no, requestId);

    // 2. Create Firebase Auth user
    let authUser: admin.auth.UserRecord;
    try {
      authUser = await this.auth.createUser({
        email: input.email,
        password: input.password,
        displayName: input.name,
        disabled: false,
      });
      logger.info('Firebase Auth admin created', {
        requestId,
        newUserId: authUser.uid,
        email: input.email,
      });
    } catch (err: any) {
      if (err.code === 'auth/email-already-exists') {
        throw new DuplicateError('A user with this email already exists in Firebase Authentication');
      }
      logger.error('Failed to create Firebase Auth user for admin', {
        requestId,
        email: input.email,
        errorName: err.name,
        errorCode: err.code,
      });
      throw err;
    }

    // 3. Create Firestore user document
    try {
      const userRef = this.db.collection('users').doc(authUser.uid);
      const userDoc = {
        name: input.name,
        email: input.email,
        phone_no: Number(input.phone_no) || input.phone_no,
        role: 'admin',
        farmIds: [],
        active: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await userRef.set(userDoc);
      logger.info('Firestore admin document created', {
        requestId,
        newUserId: authUser.uid,
        role: 'admin',
      });
    } catch (err: any) {
      logger.error('Firestore admin user creation failed, attempting Auth cleanup', {
        requestId,
        newUserId: authUser.uid,
        errorName: err.name,
      });

      try {
        await this.auth.deleteUser(authUser.uid);
      } catch (cleanupErr: any) {
        logger.error('Failed to cleanup Auth user after Firestore failure', { requestId, newUserId: authUser.uid });
      }
      throw err;
    }

    // 4. Audit Log
    await this.auditService.log({
      eventType: 'ADMIN_CREATED',
      uid: createdByUid,
      resourceId: authUser.uid,
      requestId,
      metadata: {
        createdUserRole: 'admin',
      },
    });

    return {
      uid: authUser.uid,
      email: input.email,
    };
  }

  async updateSupervisorAllocation(
    supervisorUid: string,
    farmIds: string[],
    updatedByUid: string,
    requestId: string,
  ): Promise<{ uid: string; farmIds: string[] }> {
    const userRef = this.db.collection('users').doc(supervisorUid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      throw new NotFoundError('User');
    }

    const userData = userDoc.data();
    if (userData?.role !== 'supervisor') {
      throw new ValidationError('Only supervisor accounts can have farm allocations modified');
    }

    // Deduplicate and validate farms
    const cleanFarmIds = Array.from(new Set(farmIds.filter((id) => Boolean(id && id.trim()))));
    await this.validateFarmsExist(cleanFarmIds, requestId);

    // Partial update ONLY
    await userRef.update({
      farmIds: cleanFarmIds,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.info('Supervisor farm allocation updated', {
      requestId,
      supervisorUid,
      newFarmIds: cleanFarmIds,
    });

    await this.auditService.log({
      eventType: 'SUPERVISOR_ALLOCATION_UPDATED',
      uid: updatedByUid,
      resourceId: supervisorUid,
      requestId,
      metadata: {
        newFarmIds: cleanFarmIds,
      },
    });

    return {
      uid: supervisorUid,
      farmIds: cleanFarmIds,
    };
  }

  private async validateFarmsExist(farmIds: string[], requestId: string): Promise<void> {
    if (farmIds.length === 0) return;
    for (const fId of farmIds) {
      const doc = await this.db.collection('farms').doc(fId).get();
      if (!doc.exists) {
        logger.warn('Farm validation failed for supervisor assignment', { requestId, farmId: fId });
        throw new ValidationError(`Farm with ID "${fId}" does not exist.`);
      }
    }
  }

  private async checkDuplicatePhone(phone_no: string, requestId: string): Promise<void> {
    const usersRef = this.db.collection('users');
    const snapshotStr = await usersRef.where('phone_no', '==', phone_no).limit(1).get();
    if (!snapshotStr.empty) {
      logger.warn('Phone duplicate check failed (string match)', { requestId, phone_no });
      throw new DuplicateError('This phone number is already associated with an existing user.');
    }

    const phoneNum = Number(phone_no);
    if (!isNaN(phoneNum)) {
      const snapshotNum = await usersRef.where('phone_no', '==', phoneNum).limit(1).get();
      if (!snapshotNum.empty) {
        logger.warn('Phone duplicate check failed (number match)', { requestId, phone_no });
        throw new DuplicateError('This phone number is already associated with an existing user.');
      }
    }
  }

  private async checkDuplicateEmail(email: string, _requestId: string): Promise<void> {
    try {
      const existingUser = await this.auth.getUserByEmail(email);
      if (existingUser) {
        throw new DuplicateError('A user with this email already exists');
      }
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        return;
      }
      if (err instanceof DuplicateError) {
        throw err;
      }
      logger.warn('Email duplicate check failed', {
        requestId: _requestId,
        email,
        errorName: err.name,
      });
    }
  }

  async deleteUserAccount(
    targetUid: string,
    adminUid: string,
    requestId: string,
  ): Promise<{ uid: string; message: string; deletedFarms: string[] }> {
    // 1. Prevent self-deletion
    if (targetUid === adminUid) {
      throw new ValidationError('You cannot delete your own authenticated administrator account.');
    }

    // 2. Fetch target user doc
    const userRef = this.db.collection('users').doc(targetUid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      throw new NotFoundError('Target user does not exist in system');
    }

    const userData = userDoc.data() || {};
    const role = (userData['role'] || '').toLowerCase();
    const userEmail = userData['email'] || '';

    // 3. Last Admin Protection
    if (role === 'admin') {
      const allAdminsSnap = await this.db.collection('users').where('role', '==', 'admin').get();
      const activeAdmins = allAdminsSnap.docs.filter((d) => d.data()['active'] !== false);
      if (activeAdmins.length <= 1) {
        throw new ValidationError('Cannot delete the last remaining active administrator.');
      }
    }

    const deletedFarms: string[] = [];

    // 4. Role-aware Cascade Deletion
    if (role === 'farmer') {
      const rawFarmIds: string[] = Array.isArray(userData['farmIds'])
        ? userData['farmIds']
        : userData['farmId']
        ? [userData['farmId']]
        : [];

      // Check other farmers to verify sole ownership and avoid deleting another farmer's farm
      const otherFarmersSnap = await this.db
        .collection('users')
        .where('role', '==', 'farmer')
        .get();

      for (const farmId of rawFarmIds) {
        if (!farmId || typeof farmId !== 'string') continue;

        const otherOwner = otherFarmersSnap.docs.some((doc) => {
          if (doc.id === targetUid) return false;
          const otherData = doc.data();
          const otherFarms = Array.isArray(otherData['farmIds'])
            ? otherData['farmIds']
            : otherData['farmId']
            ? [otherData['farmId']]
            : [];
          return otherFarms.includes(farmId);
        });

        if (otherOwner) {
          logger.warn('Skipping farm deletion: farm is co-associated with another farmer', {
            requestId,
            farmId,
            targetUid,
          });
          continue;
        }

        const farmRef = this.db.collection('farms').doc(farmId);
        const farmSnap = await farmRef.get();
        if (farmSnap.exists) {
          // A. Delete subcollections of farms/{farmId}: feedTransactions, birdTransactions
          try {
            const feedTxSnap = await farmRef.collection('feedTransactions').get();
            if (!feedTxSnap.empty) {
              const feedBatch = this.db.batch();
              feedTxSnap.docs.forEach((d) => feedBatch.delete(d.ref));
              await feedBatch.commit();
            }
          } catch (feedErr: any) {
            logger.warn('Error deleting feedTransactions subcollection', { farmId, error: feedErr.message });
          }

          try {
            const birdTxSnap = await farmRef.collection('birdTransactions').get();
            if (!birdTxSnap.empty) {
              const birdBatch = this.db.batch();
              birdTxSnap.docs.forEach((d) => birdBatch.delete(d.ref));
              await birdBatch.commit();
            }
          } catch (birdErr: any) {
            logger.warn('Error deleting birdTransactions subcollection', { farmId, error: birdErr.message });
          }

          // B. Delete flocks where farmId == farmId
          try {
            const flocksSnap = await this.db.collection('flocks').where('farmId', '==', farmId).get();
            if (!flocksSnap.empty) {
              const flockBatch = this.db.batch();
              flocksSnap.docs.forEach((d) => flockBatch.delete(d.ref));
              await flockBatch.commit();
            }
          } catch (flockErr: any) {
            logger.warn('Error deleting farm flocks', { farmId, error: flockErr.message });
          }

          // C. Delete dailyReportLocks where farmId == farmId
          try {
            const locksSnap = await this.db.collection('dailyReportLocks').where('farmId', '==', farmId).get();
            if (!locksSnap.empty) {
              const lockBatch = this.db.batch();
              locksSnap.docs.forEach((d) => lockBatch.delete(d.ref));
              await lockBatch.commit();
            }
          } catch (lockErr: any) {
            logger.warn('Error deleting dailyReportLocks', { farmId, error: lockErr.message });
          }

          // D. Delete root dailyReports where farmId == farmId
          try {
            const reportsSnap = await this.db.collection('dailyReports').where('farmId', '==', farmId).get();
            if (!reportsSnap.empty) {
              const reportBatch = this.db.batch();
              reportsSnap.docs.forEach((d) => reportBatch.delete(d.ref));
              await reportBatch.commit();
            }
          } catch (reportErr: any) {
            logger.warn('Error deleting farm dailyReports', { farmId, error: reportErr.message });
          }

          // E. Remove deleted farmId from supervisors assigned to this farm
          try {
            const supervisorsSnap = await this.db.collection('users').where('role', '==', 'supervisor').get();
            for (const sDoc of supervisorsSnap.docs) {
              const sData = sDoc.data();
              const sFarms: string[] = Array.isArray(sData['farmIds']) ? sData['farmIds'] : [];
              if (sFarms.includes(farmId)) {
                await sDoc.ref.update({
                  farmIds: sFarms.filter((id) => id !== farmId),
                  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
              }
            }
          } catch (supErr: any) {
            logger.warn('Error updating supervisor assignments for deleted farm', { farmId, error: supErr.message });
          }

          // F. Delete farm document itself
          await farmRef.delete();
          deletedFarms.push(farmId);
          logger.info('Deleted Farmer owned farm and cascade records', { requestId, farmId, targetUid });
        }
      }

      // Delete farmer's dailyReports/{farmerUid} subcollection dailyLogs and root doc
      try {
        const userDailyLogsSnap = await this.db
          .collection('dailyReports')
          .doc(targetUid)
          .collection('dailyLogs')
          .get();
        if (!userDailyLogsSnap.empty) {
          const logsBatch = this.db.batch();
          userDailyLogsSnap.docs.forEach((d) => logsBatch.delete(d.ref));
          await logsBatch.commit();
        }

        const userDailyReportDoc = this.db.collection('dailyReports').doc(targetUid);
        const userDailyReportSnap = await userDailyReportDoc.get();
        if (userDailyReportSnap.exists) {
          await userDailyReportDoc.delete();
        }
      } catch (userReportsErr: any) {
        logger.warn('Error deleting user dailyReports subcollections', { targetUid, error: userReportsErr.message });
      }
    } else if (role === 'supervisor') {
      logger.info('Supervisor account deletion requested. Retaining all farms.', {
        requestId,
        targetUid,
        assignedFarms: userData['farmIds'],
      });
    } else if (role === 'admin') {
      logger.info('Admin account deletion requested. Retaining all farms.', {
        requestId,
        targetUid,
      });
    }

    // 5. Delete Firestore users document
    await userRef.delete();
    logger.info('Deleted Firestore user document', { requestId, targetUid, role });

    // 6. Delete Firebase Auth user
    try {
      await this.auth.deleteUser(targetUid);
      logger.info('Deleted Firebase Auth user', { requestId, targetUid });
    } catch (authErr: any) {
      if (authErr.code === 'auth/user-not-found') {
        logger.warn('Auth user already missing during deletion', { requestId, targetUid });
      } else {
        logger.error('Failed to delete Firebase Auth user during deletion workflow', {
          requestId,
          targetUid,
          error: authErr.message || authErr,
        });
        throw authErr;
      }
    }

    // 7. Audit log
    await this.auditService.log({
      eventType: 'USER_DELETED',
      uid: adminUid,
      resourceId: targetUid,
      requestId,
      metadata: {
        targetRole: role,
        targetEmail: userEmail,
        deletedFarms,
      },
    });

    return {
      uid: targetUid,
      message: `User ${userEmail || targetUid} (${role}) deleted successfully.`,
      deletedFarms,
    };
  }
}

export const userService = new UserService();
