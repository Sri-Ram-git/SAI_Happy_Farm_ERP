const f = (window as any).firebase;

export async function loginUser(email: string, password: string) {
  console.log('[AuthService] signInWithEmailAndPassword starting for:', email);
  const result = await f.auth().signInWithEmailAndPassword(email, password);
  console.log('[AuthService] signInWithEmailAndPassword RESOLVED');
  console.log('[AuthService] result.user.uid:', result.user.uid);
  console.log('[AuthService] result.user.email:', result.user.email);
  console.log('[AuthService] auth.currentUser:', f.auth().currentUser?.uid);
  return result;
}

export async function logoutUser() {
  console.log('[AuthService] Signing out');
  return f.auth().signOut();
}
