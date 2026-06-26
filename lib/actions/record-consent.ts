"use server"

import { LEGAL } from "@/lib/constants/legal"
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin"
import { platformConsentDocPath, type ConsentRecord } from "@/lib/platform/schema"

/**
 * Records the user's acceptance of the Terms and Privacy policy at account
 * creation, keyed to the authenticated identity. Verifies the Firebase ID token
 * so the email and uid cannot be spoofed by the client.
 */
export async function recordAccountConsent(idToken: string): Promise<{ ok: boolean }> {
  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken)
    const email = (decoded.email ?? "").trim().toLowerCase()
    if (!email) return { ok: false }

    const record: ConsentRecord = {
      email,
      uid: decoded.uid,
      acceptedTerms: true,
      acceptedAt: new Date().toISOString(),
      policyVersion: LEGAL.policyVersion,
      context: "account_creation",
    }

    await getAdminDb().doc(platformConsentDocPath(email)).set(record, { merge: true })
    return { ok: true }
  } catch {
    return { ok: false }
  }
}
