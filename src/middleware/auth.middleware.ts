import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';
import { AuthenticatedUser } from '../types/auth';
import { AuthenticationError } from '../utils/errors';
import { getFirestore } from '../config/firebase';
import { UserRecord } from '../types/reports';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      requestId?: string;
    }
  }
}

export async function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('Missing or malformed authorization header');
    }

    const idToken = authHeader.split('Bearer ')[1];
    if (!idToken) {
      throw new AuthenticationError('Missing ID token');
    }

    const decodedToken = await admin.auth().verifyIdToken(idToken, true);

    const db = getFirestore();
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();

    if (!userDoc.exists) {
      throw new AuthenticationError('User not found in system');
    }

    const userData = userDoc.data() as UserRecord;

    if (!userData.active) {
      throw new AuthenticationError('User account is deactivated');
    }

    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email ?? null,
      role: userData.role,
      farmIds: userData.farmIds ?? [],
    };

    next();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      next(error);
      return;
    }

    if (error instanceof Error && error.message.includes('auth/argument-error')) {
      next(new AuthenticationError('Invalid ID token'));
      return;
    }

    if (error instanceof Error && error.message.includes('auth/id-token-expired')) {
      next(new AuthenticationError('Token has expired'));
      return;
    }

    if (error instanceof Error && error.message.includes('auth/id-token-revoked')) {
      next(new AuthenticationError('Token has been revoked'));
      return;
    }

    next(new AuthenticationError('Authentication failed'));
  }
}
