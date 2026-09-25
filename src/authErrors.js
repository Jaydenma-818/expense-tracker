const MESSAGES = {
  'auth/invalid-email': 'That email address looks invalid.',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/user-not-found': 'Incorrect email or password.',
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/email-already-in-use': 'That email is already registered.',
  'auth/weak-password': 'Password should be at least 6 characters.',
  'auth/missing-password': 'Enter a password.',
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
  'auth/popup-closed-by-user': 'Sign-in was cancelled.',
  'auth/network-request-failed': 'Network error. Check your connection and try again.',
}

export function friendlyAuthError(err) {
  return MESSAGES[err?.code] || 'Something went wrong. Please try again.'
}
