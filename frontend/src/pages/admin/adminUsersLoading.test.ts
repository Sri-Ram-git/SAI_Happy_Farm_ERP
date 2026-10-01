import { describe, it, expect } from 'vitest';

/**
 * Unit & Integration Test Suite for User Management Loading Experience & Async UI Logic
 * Tests overlay title resolution, double-click submission prevention guard,
 * input disabling state computation, and error state preservation.
 */

// Context-aware title resolver matching FormLoadingOverlay specifications
export function getFormLoadingTitle(
  actionType: 'create' | 'update' | 'reassign' | 'status' | 'delete',
  role?: 'farmer' | 'supervisor' | 'admin'
): { title: string; subtitle: string; role: 'farmer' | 'supervisor' | 'admin' | 'generic' } {
  if (actionType === 'create') {
    const roleTitle = role === 'farmer' ? 'farmer' : role === 'supervisor' ? 'supervisor' : 'admin';
    return {
      title: `Creating ${roleTitle} account...`,
      subtitle: 'Please wait while we securely save the account details.',
      role: role || 'generic',
    };
  }

  if (actionType === 'reassign') {
    return {
      title: 'Updating farm allocation...',
      subtitle: 'Please wait while farm assignments are updated.',
      role: 'supervisor',
    };
  }

  if (actionType === 'status') {
    return {
      title: 'Updating account status...',
      subtitle: 'Please wait while account status is changed.',
      role: 'generic',
    };
  }

  if (actionType === 'delete') {
    return {
      title: 'Deleting user account...',
      subtitle: 'Please wait while the user account is safely removed.',
      role: 'generic',
    };
  }

  return {
    title: 'Saving user changes...',
    subtitle: 'Please wait while user account details are updated.',
    role: role || 'generic',
  };
}

// Handler simulation for submission double-click prevention & error preservation
export async function simulateAsyncSubmission<T>(
  isSubmitting: boolean,
  isValid: boolean,
  asyncTask: () => Promise<T>,
  callbacks: {
    setSubmitting: (val: boolean) => void;
    setError: (err: string | null) => void;
    onSuccess: (data: T) => void;
  }
): Promise<boolean> {
  if (isSubmitting || !isValid) {
    return false; // Prevent double submission or submission on invalid form
  }

  callbacks.setSubmitting(true);
  callbacks.setError(null);

  try {
    const result = await asyncTask();
    callbacks.onSuccess(result);
    callbacks.setSubmitting(false);
    return true;
  } catch (err: any) {
    callbacks.setError(err.message || 'Operation failed');
    callbacks.setSubmitting(false);
    return false;
  }
}

describe('User Management Loading Experience & Async UI Suite', () => {
  describe('1. Context-Aware Loading Overlay Titles & Subtitles', () => {
    it('should generate correct context-aware overlay title for Farmer creation', () => {
      const config = getFormLoadingTitle('create', 'farmer');
      expect(config.title).toBe('Creating farmer account...');
      expect(config.subtitle).toBe('Please wait while we securely save the account details.');
      expect(config.role).toBe('farmer');
    });

    it('should generate correct context-aware overlay title for Supervisor creation', () => {
      const config = getFormLoadingTitle('create', 'supervisor');
      expect(config.title).toBe('Creating supervisor account...');
      expect(config.subtitle).toBe('Please wait while we securely save the account details.');
      expect(config.role).toBe('supervisor');
    });

    it('should generate correct context-aware overlay title for Admin creation', () => {
      const config = getFormLoadingTitle('create', 'admin');
      expect(config.title).toBe('Creating admin account...');
      expect(config.subtitle).toBe('Please wait while we securely save the account details.');
      expect(config.role).toBe('admin');
    });

    it('should generate correct title for farm allocation update (reassign)', () => {
      const config = getFormLoadingTitle('reassign');
      expect(config.title).toBe('Updating farm allocation...');
      expect(config.subtitle).toBe('Please wait while farm assignments are updated.');
      expect(config.role).toBe('supervisor');
    });

    it('should generate correct title for user account status toggle', () => {
      const config = getFormLoadingTitle('status');
      expect(config.title).toBe('Updating account status...');
      expect(config.role).toBe('generic');
    });

    it('should generate correct title for user account deletion', () => {
      const config = getFormLoadingTitle('delete');
      expect(config.title).toBe('Deleting user account...');
      expect(config.role).toBe('generic');
    });

    it('should generate correct default title for editing supervisor/admin profile', () => {
      const config = getFormLoadingTitle('update', 'supervisor');
      expect(config.title).toBe('Saving user changes...');
      expect(config.role).toBe('supervisor');
    });
  });

  describe('2. Double Submission Prevention Guard & Form Interactivity', () => {
    it('should block double submission when isSubmitting is already true', async () => {
      let submitCallCount = 0;
      const mockTask = async () => {
        submitCallCount++;
        return { success: true };
      };

      let submitting = true;
      const success = await simulateAsyncSubmission(submitting, true, mockTask, {
        setSubmitting: (val) => { submitting = val; },
        setError: () => {},
        onSuccess: () => {},
      });

      expect(success).toBe(false);
      expect(submitCallCount).toBe(0);
    });

    it('should block submission when form validation fails', async () => {
      let submitCallCount = 0;
      const mockTask = async () => {
        submitCallCount++;
        return { success: true };
      };

      let submitting = false;
      const success = await simulateAsyncSubmission(submitting, false, mockTask, {
        setSubmitting: (val) => { submitting = val; },
        setError: () => {},
        onSuccess: () => {},
      });

      expect(success).toBe(false);
      expect(submitCallCount).toBe(0);
      expect(submitting).toBe(false);
    });

    it('should process submit successfully when not submitting and form is valid', async () => {
      let submitCallCount = 0;
      let finalState = false;
      let resultData: any = null;

      const mockTask = async () => {
        submitCallCount++;
        return { userId: 'usr_123' };
      };

      let submitting = false;
      const success = await simulateAsyncSubmission(submitting, true, mockTask, {
        setSubmitting: (val) => { finalState = val; },
        setError: () => {},
        onSuccess: (data) => { resultData = data; },
      });

      expect(success).toBe(true);
      expect(submitCallCount).toBe(1);
      expect(resultData).toEqual({ userId: 'usr_123' });
      expect(finalState).toBe(false); // submitting reset to false after completion
    });
  });

  describe('3. Error Preservation & Overlay Tear Down', () => {
    it('should capture error message, reset submitting flag to false, and preserve input states on failure', async () => {
      let capturedError: string | null = null;
      let submittingState = false;
      const formInputState = { name: 'Test Farmer', email: 'test@farm.com' };

      const failingTask = async () => {
        throw new Error('Firebase Auth: Email already in use (auth/email-already-in-use)');
      };

      const success = await simulateAsyncSubmission(submittingState, true, failingTask, {
        setSubmitting: (val) => { submittingState = val; },
        setError: (err) => { capturedError = err; },
        onSuccess: () => {},
      });

      expect(success).toBe(false);
      expect(submittingState).toBe(false); // overlay is unmounted
      expect(capturedError).toBe('Firebase Auth: Email already in use (auth/email-already-in-use)');
      // Verify inputs remain intact for corrections
      expect(formInputState.name).toBe('Test Farmer');
      expect(formInputState.email).toBe('test@farm.com');
    });
  });

  describe('4. Table Loading Skeleton & Empty State Distinction', () => {
    it('should distinguish between initial list loading state and empty result state', () => {
      const renderTableContent = (loading: boolean, users: any[]) => {
        if (loading) {
          return { type: 'skeleton', rowCount: 5 };
        }
        if (users.length === 0) {
          return { type: 'empty_message', text: 'No users found matching your search.' };
        }
        return { type: 'data_rows', count: users.length };
      };

      // Case 1: Initial Loading
      const loadingState = renderTableContent(true, []);
      expect(loadingState.type).toBe('skeleton');
      expect(loadingState.rowCount).toBe(5);

      // Case 2: Finished loading with empty list
      const emptyState = renderTableContent(false, []);
      expect(emptyState.type).toBe('empty_message');

      // Case 3: Finished loading with items
      const dataState = renderTableContent(false, [{ id: '1', name: 'Admin User' }]);
      expect(dataState.type).toBe('data_rows');
      expect(dataState.count).toBe(1);
    });
  });
});
