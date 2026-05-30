import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { getAdminDb } from "@/lib/firebase/admin"
import { readSessionClaims } from "@/lib/auth/session"
import {
  DEV_ORG_COOKIE,
  getDevSession,
  normalizeDevOrgMode,
  type DevOrganisation,
  type DevSession,
  type DevUser,
} from "./dev-session"

/*
 * Single chokepoint for "who is the current user / org" on the server.
 *
 * Two execution paths:
 *
 *   1. Emulator / local dev (NEXT_PUBLIC_USE_EMULATORS=1):
 *      The dev shim returns the demo workspace admin. Admin SDK bypasses
 *      Security Rules; app-layer `organizationId` filtering is the only
 *      isolation guarantee.
 *
 *   2. Production (no emulator env):
 *      Reads the verified Firebase session cookie and returns the
 *      claims-derived identity. Server actions still scope by
 *      `organizationId` explicitly - defense in depth alongside Rules.
 *
 * Server actions and page loaders MUST call these helpers; never read the
 * session cookie directly.
 */

const useDevShim = process.env.NEXT_PUBLIC_USE_EMULATORS === "1"

/* Resolve the active dev session from the DEV_ORG_COOKIE (SAFE demo vs
 * wizard-built tenant). Only meaningful under the emulator shim. */
async function resolveDevSession(): Promise<DevSession> {
  const store = await cookies()
  return getDevSession(normalizeDevOrgMode(store.get(DEV_ORG_COOKIE)?.value))
}

export async function getCurrentUser(): Promise<DevUser> {
  if (useDevShim) return (await resolveDevSession()).user
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
  if (useDevShim) return (await resolveDevSession()).organisation.id
  const claims = await readSessionClaims()
  if (!claims) redirect("/login")
  return claims.organizationId
}

export async function getCurrentOrganisation(): Promise<DevOrganisation> {
  if (useDevShim) return (await resolveDevSession()).organisation
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
