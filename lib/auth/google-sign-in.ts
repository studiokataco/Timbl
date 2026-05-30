import { GoogleAuthProvider, signInWithPopup, type UserCredential } from "firebase/auth"

import { getClientAuth } from "@/lib/firebase/client"

export function isAuthHostileBrowser(): boolean {
  if (typeof navigator === "undefined") return false
  const ua = navigator.userAgent || ""
  return /FBAN|FBAV|Instagram|Line\/|WhatsApp|Twitter|LinkedInApp/i.test(ua)
}

export async function signInWithGoogleAccount(): Promise<UserCredential> {
  if (isAuthHostileBrowser()) {
    throw new Error(
      "Open this page in Safari or Chrome to sign in. In-app browsers (e.g. WhatsApp) often block Google sign-in.",
    )
  }
  const auth = getClientAuth()
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: "select_account" })
  return signInWithPopup(auth, provider)
}
