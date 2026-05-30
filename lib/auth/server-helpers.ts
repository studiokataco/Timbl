import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { getAdminDb } from "@/lib/firebase/admin"
import { orgPath } from "@/lib/firebase/paths"
import { readSessionAuth, readSessionClaims } from "@/lib/auth/session"
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
  const auth = await readSessionAuth()
  if (!auth) redirect("/")
  if (!auth.workspace) redirect("/workspaces")
  return {
    id: auth.workspace.userId,
    email: auth.email,
    name: auth.email.split("@")[0],
    role: auth.workspace.role,
  }
}

export async function getCurrentOrgId(): Promise<string> {
  if (useDevShim) return (await resolveDevSession()).organisation.id
  const auth = await readSessionAuth()
  if (!auth) redirect("/")
  if (!auth.workspace) redirect("/workspaces")
  return auth.workspace.organizationId
}

export async function getCurrentOrganisation(): Promise<DevOrganisation> {
  let orgId: string
  let fallback: DevOrganisation
  if (useDevShim) {
    fallback = (await resolveDevSession()).organisation
    orgId = fallback.id
  } else {
    const auth = await readSessionAuth()
    if (!auth?.workspace) redirect("/workspaces")
    orgId = auth.workspace.organizationId
    fallback = {
      id: orgId,
      slug: orgId,
      name: orgId,
    }
  }

  const snap = await getAdminDb().doc(orgPath(orgId)).get()
  const data = snap.data() ?? {}
  const name = (data.name as string | undefined)?.trim()
  return {
    id: orgId,
    slug: (data.slug as string) ?? fallback.slug,
    name: name || fallback.name,
  }
}

export function getDb() {
  return getAdminDb()
}

export async function requireRole(allowed: ReadonlyArray<DevUser["role"]>): Promise<DevUser> {
  const user = await getCurrentUser()
  if (!allowed.includes(user.role)) redirect("/")
  return user
}
