const f = (window as any).firebase;

export async function loginUser(email: string, password: string) {
  console.log('[AuthService] signInWithEmailAndPassword for:', email);
  const result = await f.auth().signInWithEmailAndPassword(email, password);
  console.log('[AuthService] Auth success, uid:', result.user.uid);
  return result;
}

export async function sendPhoneOtp(phoneNumber: string, recaptchaVerifier: any) {
  console.log('[AuthService] Sending OTP to:', phoneNumber);
  const confirmationResult = await f.auth().signInWithPhoneNumber(phoneNumber, recaptchaVerifier);
  console.log('[AuthService] OTP sent');
  return confirmationResult;
}

export async function confirmPhoneOtp(confirmationResult: any, code: string) {
  console.log('[AuthService] Confirming OTP');
  const result = await confirmationResult.confirm(code);
  console.log('[AuthService] Phone auth success, uid:', result.user.uid);
  return result;
}

export async function logoutUser() {
  console.log('[AuthService] Signing out');
  return f.auth().signOut();
}
