import * as admin from 'firebase-admin';
import { getFirestore, getAuth } from '../config/firebase';
import { AuditService } from './audit.service';
import { DuplicateError, NotFoundError, ValidationError } from '../utils/errors';
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
    // 1. Check for duplicate farm name in existing farms
    await this.checkDuplicateFarmName(input.farmName, requestId);

    // 2. Check for duplicate email in existing users
    await this.checkDuplicateEmail(input.email, requestId);

    // 2.5 Check for duplicate phone number
    await this.checkDuplicatePhone(input.phone_no, requestId);

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

    // 4. Create Firestore user and farm document using a Transaction to generate safe Farm ID
    let newFarmId = '';
    try {
      await this.db.runTransaction(async (t) => {
        // Read all farms to find max suffix and generate next sequential Farm ID
        const farmsSnapshot = await t.get(this.db.collection('farms'));
        
        let targetPrefix = 'AP';
        let detectedPadding = 0;
        let maxNumber = 0;

        for (const doc of farmsSnapshot.docs) {
          const farmData = doc.data();
          if (farmData['name'] && farmData['name'].toLowerCase() === input.farmName.toLowerCase()) {
            throw new DuplicateError('A farm with this name already exists.');
          }
          
          const id = doc.id;
          const match = id.match(/^([A-Za-z_]+)(\d+)$/);
          if (match) {
            const prefix = match[1] || 'AP';
            const numStr = match[2] || '0';
            const num = parseInt(numStr, 10);
            
            if (num > maxNumber) {
              maxNumber = num;
              targetPrefix = prefix;
              if (numStr.startsWith('0')) {
                detectedPadding = Math.max(detectedPadding, numStr.length);
              }
            }
          }
        }

        const nextNumber = maxNumber > 0 ? maxNumber + 1 : 1;
        let nextNumberStr = nextNumber.toString();
        
        if (detectedPadding > 0) {
          nextNumberStr = nextNumberStr.padStart(detectedPadding, '0');
        }

        newFarmId = `${targetPrefix}${nextNumberStr}`;

        const farmRef = this.db.collection('farms').doc(newFarmId);
        const userRef = this.db.collection('users').doc(authUser.uid);


        const farmDoc = {
          farmId: newFarmId,
          name: input.farmName,
          location: '',
          active: true,
          initialBirdCount: input.initialBirdCount ?? 0,
          currentBirdCount: input.initialBirdCount ?? 0,
          initialFeedKg: input.initialFeedKg ?? 0,
          currentFeedKg: input.initialFeedKg ?? 0,
          totalFeedLoadedKg: input.initialFeedKg ?? 0,
          totalFeedConsumedKg: 0,
          inventoryInitialized: true,
          inventoryInitializedAt: admin.firestore.FieldValue.serverTimestamp(),
          inventoryUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        const userDoc = {
          name: input.name,
          email: input.email,
          phone_no: Number(input.phone_no),
          role: 'farmer',
          farmIds: [newFarmId],
          active: true,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        t.set(farmRef, farmDoc);
        t.set(userRef, userDoc);
      });

      logger.info('Firestore user and farm documents created', {
        requestId,
        newUserId: authUser.uid,
        newFarmId,
        role: 'farmer',
      });
    } catch (err: any) {
      // Transaction or Firestore write failed after Auth creation — attempt cleanup
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
        assignedFarmIds: [newFarmId],
      },
    });

    return {
      uid: authUser.uid,
      email: input.email,
    };
  }

  private async checkDuplicateFarmName(farmName: string, requestId: string): Promise<void> {
    const snapshot = await this.db.collection('farms')
      .where('name', '==', farmName)
      .limit(1)
      .get();
      
    if (!snapshot.empty) {
      logger.warn('Farm name duplicate check failed', { requestId, farmName });
      throw new DuplicateError('A farm with this name already exists.');
    }
  }

  private async checkDuplicatePhone(phone_no: string, requestId: string): Promise<void> {
    const usersRef = this.db.collection('users');
    
    // Check string match
    const snapshotStr = await usersRef.where('phone_no', '==', phone_no).limit(1).get();
    if (!snapshotStr.empty) {
      logger.warn('Phone duplicate check failed (string match)', { requestId, phone_no });
      throw new DuplicateError('This phone number is already associated with an existing user.');
    }

    // Also check number match for backward compatibility
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
    if (!active && targetUid === adminUid) {
      throw new ValidationError('You cannot deactivate your own authenticated administrator account.');
    }

    const userRef = this.db.collection('users').doc(targetUid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      throw new NotFoundError('User');
    }

    const userData = userDoc.data() || {};
    const role = (userData['role'] || '').toLowerCase();

    if (!active && role === 'admin') {
      const allAdminsSnap = await this.db.collection('users').where('role', '==', 'admin').get();
      const activeAdmins = allAdminsSnap.docs.filter((d) => d.data()['active'] !== false);
      if (activeAdmins.length <= 1) {
        throw new ValidationError('Cannot deactivate the last remaining active administrator.');
      }
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
      eventType: active ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
      uid: adminUid,
      resourceId: targetUid,
      requestId,
      metadata: {
        targetRole: role,
        targetEmail: userData['email'] || '',
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
