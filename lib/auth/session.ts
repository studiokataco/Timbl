import "server-only"
import { cookies } from "next/headers"

import { getAdminAuth } from "@/lib/firebase/admin"

export const SESSION_COOKIE_NAME = "__session"
const SESSION_DURATION_MS = 14 * 24 * 60 * 60 * 1000

export type WorkspaceClaims = {
  organizationId: string
  role: "admin" | "editor" | "contributor"
  userId: string
}

export type SessionAuth = {
  uid: string
  email: string
  workspace: WorkspaceClaims | null
  /* "admin" when the user is on the platform allowlist (control centre).
   * Set by functions/src/setUserClaims.ts on sign-in, or immediately by
   * grantPlatformAdmin. Null for ordinary tenant users. */
  platform: "admin" | null
  /* The platform admin's role: "owner" (full god-mode) or "analyst"
   * (read-only monitoring). Null for non-platform users. */
  platformRole: "owner" | "analyst" | null
}

export async function createSessionFromIdToken(idToken: string): Promise<string> {
  return getAdminAuth().createSessionCookie(idToken, {
    expiresIn: SESSION_DURATION_MS,
  })
}

/* When the app spans subdomains (tenant app + admin control centre), set the
 * session cookie on the registrable parent (e.g. ".example.com") so a login on
 * either host is shared with the other. Unset in single-host / local dev =>
 * host-only cookie, unchanged behaviour. */
function sessionCookieDomain(): string | undefined {
  return process.env.NEXT_PUBLIC_COOKIE_DOMAIN || undefined
}

export async function setSessionCookie(value: string) {
  const store = await cookies()
  store.set(SESSION_COOKIE_NAME, value, {
    maxAge: SESSION_DURATION_MS / 1000,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    domain: sessionCookieDomain(),
  })
}

export async function clearSessionCookie() {
  const store = await cookies()
  const domain = sessionCookieDomain()
  store.set(SESSION_COOKIE_NAME, "", { maxAge: 0, path: "/", domain })
}

export async function readSessionAuth(): Promise<SessionAuth | null> {
  const store = await cookies()
  const cookie = store.get(SESSION_COOKIE_NAME)
  if (!cookie?.value) return null

  try {
    const decoded = await getAdminAuth().verifySessionCookie(cookie.value, true)
    const email = decoded.email ?? ""
    if (!email) return null

    const organizationId = decoded.organizationId as string | undefined
    const role = decoded.role as WorkspaceClaims["role"] | undefined
    const userId = decoded.userId as string | undefined

    const workspace =
      organizationId && role && userId
        ? { organizationId, role, userId }
        : null

    const platform = decoded.platform === "admin" ? "admin" : null
    const platformRole =
      platform === "admin"
        ? decoded.platformRole === "analyst"
          ? "analyst"
          : "owner"
        : null

    return { uid: decoded.uid, email, workspace, platform, platformRole }
  } catch {
    return null
  }
}

/** Full workspace session only - null when signed in but no workspace picked yet. */
export async function readSessionClaims(): Promise<
  (SessionAuth & { workspace: WorkspaceClaims }) | null
> {
  const auth = await readSessionAuth()
  if (!auth?.workspace) return null
  return { ...auth, workspace: auth.workspace }
}
