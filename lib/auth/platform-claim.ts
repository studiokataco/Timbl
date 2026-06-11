import "server-only"

import { getAdminDb } from "@/lib/firebase/admin"
import { emailSlug, platformAdminDocPath } from "@/lib/platform/schema"

/*
 * The allowlist at platform/state/admins/{emailSlug} is the source of truth
 * for platform access. Every setCustomUserClaims call that writes workspace
 * claims MUST spread this in - a plain workspace-claims object silently
 * strips platform/platformRole from the user record, and any session cookie
 * minted afterwards locks the admin out of the control centre for the
 * cookie's 14-day life. Mirrors resolvePlatformClaim in
 * functions/src/setUserClaims.ts.
 */
export async function resolvePlatformClaim(
  email: string,
): Promise<{ platform?: "admin"; platformRole?: "owner" | "analyst" }> {
  try {
    const snap = await getAdminDb().doc(platformAdminDocPath(emailSlug(email))).get()
    if (!snap.exists) return {}
    const role = snap.get("role") === "analyst" ? "analyst" : "owner"
    return { platform: "admin", platformRole: role }
  } catch {
    return {}
  }
}
