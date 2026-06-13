import "server-only"

import { getAdminDb } from "@/lib/firebase/admin"
import { normalizeEmail } from "@/lib/auth/membership"
import {
  platformSignupRequestsPath,
  signupRequestSchema,
} from "@/lib/platform/schema"

export type ApprovedBetaInvite = {
  email: string
  name: string
  orgId: string | null
}

export async function getApprovedBetaInvite(
  email: string,
): Promise<ApprovedBetaInvite | null> {
  const norm = normalizeEmail(email)
  const snap = await getAdminDb()
    .collection(platformSignupRequestsPath)
    .where("email", "==", norm)
    .limit(5)
    .get()
  for (const doc of snap.docs) {
    const parsed = signupRequestSchema.safeParse({ ...doc.data(), id: doc.id })
    if (parsed.success && parsed.data.status === "approved") {
      return {
        email: parsed.data.email,
        name: parsed.data.name,
        orgId: parsed.data.orgId ?? null,
      }
    }
  }
  return null
}
