import { describe, it, expect } from 'vitest';
import { getFriendlyError } from '../../../frontend/src/utils/firebaseErrors';

describe('SEC-06: Authentication Error Enumeration Security Tests', () => {
  it('should return identical generic message for auth/user-not-found, auth/wrong-password, and auth/invalid-credential', () => {
    const notFoundMsg = getFriendlyError('auth/user-not-found');
    const wrongPasswordMsg = getFriendlyError('auth/wrong-password');
    const invalidCredentialMsg = getFriendlyError('auth/invalid-credential');

    expect(notFoundMsg).toBe('Invalid email or password.');
    expect(wrongPasswordMsg).toBe('Invalid email or password.');
    expect(invalidCredentialMsg).toBe('Invalid email or password.');

    // Ensure they are indistinguishable
    expect(notFoundMsg).toBe(wrongPasswordMsg);
    expect(wrongPasswordMsg).toBe(invalidCredentialMsg);
  });

  it('should still provide helpful messages for rate limiting and network failures without leaking user existence', () => {
    expect(getFriendlyError('auth/too-many-requests')).toBe('Too many failed attempts. Try again later.');
    expect(getFriendlyError('auth/network-request-failed')).toBe('No internet connection.');
    expect(getFriendlyError('auth/invalid-email')).toBe('Invalid email address.');
    expect(getFriendlyError('auth/user-disabled')).toBe('This account is disabled.');
    expect(getFriendlyError('auth/popup-closed-by-user')).toBe('Sign in was cancelled.');
    expect(getFriendlyError('auth/requires-recent-login')).toBe('Please log in again to continue.');
  });

  it('SEC-20: should return a safe generic fallback for unmapped or unexpected error codes without leaking internal details', () => {
    const unmappedCodes = [
      'auth/internal-error',
      'auth/operation-not-allowed',
      'auth/project-not-found',
      'firestore/permission-denied',
      'unknown-error-code-123',
      '',
    ];

    for (const code of unmappedCodes) {
      const result = getFriendlyError(code);
      expect(result).toBe('An unexpected error occurred. Please try again.');
      // Must not leak the code name or structure
      if (code) {
        expect(result).not.toContain(code);
      }
      expect(result).not.toContain('Error:');
    }
  });
});
