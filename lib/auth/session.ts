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
}

export async function createSessionFromIdToken(idToken: string): Promise<string> {
  return getAdminAuth().createSessionCookie(idToken, {
    expiresIn: SESSION_DURATION_MS,
  })
}

export async function setSessionCookie(value: string) {
  const store = await cookies()
  store.set(SESSION_COOKIE_NAME, value, {
    maxAge: SESSION_DURATION_MS / 1000,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  })
}

export async function clearSessionCookie() {
  const store = await cookies()
  store.delete(SESSION_COOKIE_NAME)
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

    return { uid: decoded.uid, email, workspace }
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
