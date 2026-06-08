import "server-only"

import { cookies } from "next/headers"

import { getAdminDb } from "@/lib/firebase/admin"
import { readPlatformActor } from "@/lib/auth/platform-guard"
import {
  impersonationSessionSchema,
  platformImpersonationDocPath,
  type ImpersonationSession,
} from "@/lib/platform/schema"

/*
 * Impersonation plumbing. A platform admin "becomes" a tenant user without
 * touching their own Firebase claims (which would lose `platform` and isn't
 * instantly revocable). Instead an opaque cookie points at a server-side
 * session record; getCurrentOrgId/getCurrentUser consult it first.
 *
 * The cookie is set on the registrable parent domain so it is shared between
 * the admin host (admin.<domain>) and the tenant app host (<domain>) - the
 * admin starts impersonation on one and lands in the app on the other.
 */

export const IMPERSONATION_COOKIE = "__impersonate"
const THIRTY_MIN_SECONDS = 30 * 60

/* admin.example.com -> example.com ; admin.localhost:3000 -> localhost. */
export function impersonationCookieDomain(): string | undefined {
  const adminHost = process.env.NEXT_PUBLIC_ADMIN_HOST
  if (!adminHost) return undefined
  const hostname = adminHost.split(":")[0]
  const parent = hostname.startsWith("admin.")
    ? hostname.slice("admin.".length)
    : hostname
  return parent || undefined
}

export async function setImpersonationCookie(id: string): Promise<void> {
  const store = await cookies()
  store.set(IMPERSONATION_COOKIE, id, {
    maxAge: THIRTY_MIN_SECONDS,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    domain: impersonationCookieDomain(),
  })
}

export async function clearImpersonationCookie(): Promise<void> {
  const store = await cookies()
  store.set(IMPERSONATION_COOKIE, "", {
    maxAge: 0,
    path: "/",
    domain: impersonationCookieDomain(),
  })
}

export async function readImpersonationId(): Promise<string | null> {
  const store = await cookies()
  return store.get(IMPERSONATION_COOKIE)?.value ?? null
}

export async function loadImpersonationRecord(
  id: string,
): Promise<ImpersonationSession | null> {
  const snap = await getAdminDb().doc(platformImpersonationDocPath(id)).get()
  if (!snap.exists) return null
  const parsed = impersonationSessionSchema.safeParse({ ...snap.data(), id })
  return parsed.success ? parsed.data : null
}

function isActive(rec: ImpersonationSession): boolean {
  if (rec.revoked) return false
  const exp = Date.parse(rec.expiresAt)
  return !Number.isNaN(exp) && exp > Date.now()
}

/*
 * The active impersonation for this request, or null. Honored ONLY if the
 * real caller is still a platform admin (readPlatformActor) - so revoking
 * platform access instantly kills any impersonation too.
 */
export async function resolveImpersonation(): Promise<ImpersonationSession | null> {
  const id = await readImpersonationId()
  if (!id) return null
  const actor = await readPlatformActor()
  if (!actor) return null
  const rec = await loadImpersonationRecord(id)
  if (!rec || !isActive(rec)) return null
  return rec
}
