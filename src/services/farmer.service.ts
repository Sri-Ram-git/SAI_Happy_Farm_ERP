import * as admin from 'firebase-admin';
import { getFirestore, getAuth } from '../config/firebase';
import { AuditService } from './audit.service';
import { DuplicateError, NotFoundError } from '../utils/errors';
import { logger } from '../utils/logger';
import { CreateFarmerInput } from '../validators/farmer.validator';

interface CreatedFarmer {
  uid: string;
  email: string;
}

export class FarmerService {
  private auditService = new AuditService();

  private get db() {
    return getFirestore();
  }

  private get auth() {
    return getAuth();
  }

  async createFarmer(
    input: CreateFarmerInput,
    createdByUid: string,
    requestId: string,
  ): Promise<CreatedFarmer> {
    // 1. Validate assigned farms exist
    await this.validateFarmsExist(input.farmIds, requestId);

    // 2. Check for duplicate email in existing users
    await this.checkDuplicateEmail(input.email, requestId);

    // 3. Create Firebase Auth user
    let authUser: admin.auth.UserRecord;
    try {
      authUser = await this.auth.createUser({
        email: input.email,
        password: input.password,
        displayName: input.name,
        phoneNumber: undefined,
        disabled: false,
      });
      logger.info('Firebase Auth user created', {
        requestId,
        newUserId: authUser.uid,
        email: input.email,
      });
    } catch (err: any) {
      if (err.code === 'auth/email-already-exists') {
        throw new DuplicateError('A user with this email already exists in Firebase Authentication');
      }
      logger.error('Failed to create Firebase Auth user', {
        requestId,
        email: input.email,
        errorName: err.name,
        errorCode: err.code,
      });
      throw err;
    }

    // 4. Create Firestore user document
    try {
      const now = new Date().toISOString();
      const userDoc = {
        name: input.name,
        email: input.email,
        phone_no: input.phone_no,
        role: 'farmer',
        farmIds: input.farmIds,
        active: true,
        createdAt: now,
        updatedAt: now,
      };

      await this.db.collection('users').doc(authUser.uid).set(userDoc);

      logger.info('Firestore user document created', {
        requestId,
        newUserId: authUser.uid,
        role: 'farmer',
      });
    } catch (err: any) {
      // Firestore write failed after Auth creation — attempt cleanup
      logger.error('Firestore user creation failed, attempting Auth cleanup', {
        requestId,
        newUserId: authUser.uid,
        errorName: err.name,
      });

      try {
        await this.auth.deleteUser(authUser.uid);
        logger.info('Firebase Auth user deleted (cleanup)', {
          requestId,
          newUserId: authUser.uid,
        });
      } catch (cleanupErr: any) {
        logger.error('Failed to cleanup Firebase Auth user after Firestore failure', {
          requestId,
          newUserId: authUser.uid,
          errorName: cleanupErr.name,
        });
      }

      throw err;
    }

    // 5. Audit log
    await this.auditService.log({
      eventType: 'USER_CREATED',
      uid: createdByUid,
      resourceId: authUser.uid,
      requestId,
      metadata: {
        createdUserRole: 'farmer',
        assignedFarmIds: input.farmIds,
      },
    });

    return {
      uid: authUser.uid,
      email: input.email,
    };
  }

  private async validateFarmsExist(farmIds: string[], _requestId: string): Promise<void> {
    const farmDocs = await Promise.all(
      farmIds.map((farmId) => this.db.collection('farms').doc(farmId).get()),
    );

    const missingFarms = farmIds.filter((_farmId, i) => !farmDocs[i]!.exists);

    if (missingFarms.length > 0) {
      throw new NotFoundError(`Farm(s) not found: ${missingFarms.join(', ')}`);
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
        // Email not found — good, no duplicate
        return;
      }
      if (err instanceof DuplicateError) {
        throw err;
      }
      // Other errors — log but don't block (best-effort check)
      logger.warn('Email duplicate check failed', {
        requestId: _requestId,
        email,
        errorName: err.name,
        errorCode: err.code,
      });
    }
  }

  async updateUserStatus(
    targetUid: string,
    active: boolean,
    adminUid: string,
    requestId: string,
  ): Promise<{ uid: string; active: boolean }> {
    const userRef = this.db.collection('users').doc(targetUid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      throw new NotFoundError('User');
    }

    const now = new Date().toISOString();
    await userRef.update({
      active,
      updatedAt: now,
    });

    if (!active) {
      try {
        await this.auth.revokeRefreshTokens(targetUid);
        logger.info('Revoked refresh tokens for deactivated user', {
          requestId,
          targetUid,
        });
      } catch (authErr: any) {
        logger.warn('Failed to revoke refresh tokens for user', {
          requestId,
          targetUid,
          errorName: authErr.name,
          errorMessage: authErr.message,
        });
      }
    }

    await this.auditService.log({
      eventType: 'USER_STATUS_UPDATED',
      uid: adminUid,
      resourceId: targetUid,
      requestId,
      metadata: {
        newStatus: active ? 'active' : 'inactive',
      },
    });

    return {
      uid: targetUid,
      active,
    };
  }

  async getAllUsers(requestId: string): Promise<any[]> {
    try {
      const snap = await this.db.collection('users').get();
      return snap.docs.map((doc) => ({
        uid: doc.id,
        ...doc.data(),
      }));
    } catch (err: any) {
      logger.error('Failed to fetch all users', {
        requestId,
        errorName: err.name,
        errorMessage: err.message,
      });
      throw err;
    }
  }
}

export const farmerService = new FarmerService();
