export function getFriendlyError(code: string): string {
  switch (code) {
    case 'auth/user-not-found':
      return 'No account found with this email.';
    case 'auth/wrong-password':
      return 'Wrong password.';
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
    default:
      return `Error: ${code}`;
  }
}
