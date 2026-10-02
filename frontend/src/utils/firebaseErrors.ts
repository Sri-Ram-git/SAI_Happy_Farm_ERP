export function getFriendlyError(code: string): string {
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Invalid email or password.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Try again later.';
    case 'auth/network-request-failed':
      return 'No internet connection.';
    case 'auth/user-disabled':
      return 'This account is disabled.';
    case 'auth/invalid-email':
      return 'Invalid email address.';
    case 'auth/popup-closed-by-user':
      return 'Sign in was cancelled.';
    case 'auth/requires-recent-login':
      return 'Please log in again to continue.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}
