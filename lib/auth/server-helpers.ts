import { redirect } from "next/navigation"

import { getAdminDb } from "@/lib/firebase/admin"
import { readSessionClaims } from "@/lib/auth/session"
import { DEV_SESSION, type DevOrganisation, type DevUser } from "./dev-session"

/*
 * Single chokepoint for "who is the current user / org" on the server.
 *
 * Two execution paths:
 *
 *   1. Emulator / local dev (NEXT_PUBLIC_USE_EMULATORS=1):
 *      The dev shim returns the SAFE Foundation admin. Admin SDK bypasses
 *      Security Rules; app-layer `organizationId` filtering is the only
 *      isolation guarantee.
 *
 *   2. Production (no emulator env):
 *      Reads the verified Firebase session cookie and returns the
 *      claims-derived identity. Server actions still scope by
 *      `organizationId` explicitly — defense in depth alongside Rules.
 *
 * Server actions and page loaders MUST call these helpers; never read the
 * session cookie directly.
 */

const useDevShim = process.env.NEXT_PUBLIC_USE_EMULATORS === "1"

export async function getCurrentUser(): Promise<DevUser> {
  if (useDevShim) return DEV_SESSION.user
  const claims = await readSessionClaims()
  if (!claims) redirect("/login")
  return {
    id: claims.userId,
    email: claims.email,
    name: claims.email.split("@")[0],
    role: claims.role,
  }
}

export async function getCurrentOrgId(): Promise<string> {
  if (useDevShim) return DEV_SESSION.organisation.id
  const claims = await readSessionClaims()
  if (!claims) redirect("/login")
  return claims.organizationId
}

export async function getCurrentOrganisation(): Promise<DevOrganisation> {
  if (useDevShim) return DEV_SESSION.organisation
  const claims = await readSessionClaims()
  if (!claims) redirect("/login")
  /* Membership doc carries display name + slug for the org. The slug
   * matches the doc id in /organizations. */
  const snap = await getAdminDb()
    .collection("organizations")
    .doc(claims.organizationId)
    .get()
  const data = snap.data() ?? {}
  return {
    id: claims.organizationId,
    slug: (data.slug as string) ?? claims.organizationId,
    name: (data.name as string) ?? claims.organizationId,
  }
}

export function getDb() {
  return getAdminDb()
}

export async function requireRole(allowed: ReadonlyArray<DevUser["role"]>): Promise<DevUser> {
  const user = await getCurrentUser()
  if (!allowed.includes(user.role)) redirect("/login")
  return user
}
