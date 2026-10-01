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
  });
});
