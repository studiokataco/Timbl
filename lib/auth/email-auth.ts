import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  updateProfile,
  type UserCredential,
} from "firebase/auth"

import { getClientAuth } from "@/lib/firebase/client"

export function mapFirebaseAuthError(code: string): string {
  switch (code) {
    case "auth/email-already-in-use":
      return "An account with this email already exists. Sign in instead."
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Email or password is incorrect."
    case "auth/weak-password":
      return "Password must be at least 8 characters."
    case "auth/too-many-requests":
      return "Too many attempts. Try again later."
    case "auth/invalid-email":
      return "Enter a valid email address."
    default:
      return "Authentication failed. Try again."
  }
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<UserCredential> {
  const auth = getClientAuth()
  return signInWithEmailAndPassword(auth, email, password)
}

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string,
): Promise<UserCredential> {
  const auth = getClientAuth()
  const cred = await createUserWithEmailAndPassword(auth, email, password)
  if (displayName.trim()) {
    await updateProfile(cred.user, { displayName: displayName.trim() })
  }
  return cred
}

export async function sendPasswordReset(email: string): Promise<void> {
  const auth = getClientAuth()
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/login`
      : "/login"
  await sendPasswordResetEmail(auth, email, { url })
}
