const f = (window as any).firebase;

export async function loginUser(email: string, password: string) {
  console.log('[AuthService] signInWithEmailAndPassword for:', email);
  const result = await f.auth().signInWithEmailAndPassword(email, password);
  console.log('[AuthService] Auth success, uid:', result.user.uid);
  return result;
}

export async function logoutUser() {
  console.log('[AuthService] Signing out');
  return f.auth().signOut();
}
