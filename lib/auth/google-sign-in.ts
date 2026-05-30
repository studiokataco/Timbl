import {
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
  type UserCredential,
} from "firebase/auth"

import { getClientAuth } from "@/lib/firebase/client"

const useEmulators = process.env.NEXT_PUBLIC_USE_EMULATORS === "1"

export function isAuthHostileBrowser(): boolean {
  if (typeof navigator === "undefined") return false
  const ua = navigator.userAgent || ""
  return /FBAN|FBAV|Instagram|Line\/|WhatsApp|Twitter|LinkedInApp/i.test(ua)
}

async function signInWithGoogleEmulator(): Promise<UserCredential> {
  const auth = getClientAuth()
  const email = "admin@safefoundation.dev"
  const credential = GoogleAuthProvider.credential(
    JSON.stringify({
      sub: "emulator-safe-admin",
      email,
      email_verified: true,
      name: "SAFE Admin",
    }),
  )
  return signInWithCredential(auth, credential)
}

export async function signInWithGoogleAccount(): Promise<UserCredential> {
  if (isAuthHostileBrowser()) {
    throw new Error(
      "Open this page in Safari or Chrome to sign in. In-app browsers (e.g. WhatsApp) often block Google sign-in.",
    )
  }
  if (useEmulators) {
    return signInWithGoogleEmulator()
  }
  if (process.env.NEXT_PUBLIC_FIREBASE_API_KEY === "demo-api-key") {
    throw new Error(
      "Google sign-in needs real Firebase keys or the emulator. Run pnpm dev (not dev:cloud) for local auth.",
    )
  }
  const auth = getClientAuth()
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: "select_account" })
  return signInWithPopup(auth, provider)
}
