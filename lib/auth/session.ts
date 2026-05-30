import "server-only"
import { cookies } from "next/headers"

import { getAdminAuth } from "@/lib/firebase/admin"

/*
 * Server-only session-cookie helpers. The cookie is signed by Firebase Auth
 * via `createSessionCookie`, set on `/auth/callback` after a successful
 * Google sign-in, and verified on every server-side identity read in
 * `lib/auth/server-helpers.ts`.
 *
 * Middleware (Edge runtime) only checks cookie presence - full verification
 * happens here, in Node, where firebase-admin is available.
 */

export const SESSION_COOKIE_NAME = "__session"
const SESSION_DURATION_MS = 14 * 24 * 60 * 60 * 1000

type Claims = {
  uid: string
  email: string
  organizationId: string
  role: "admin" | "editor" | "contributor"
  userId: string
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

export async function readSessionClaims(): Promise<Claims | null> {
  const store = await cookies()
  const cookie = store.get(SESSION_COOKIE_NAME)
  if (!cookie?.value) return null

  try {
    const decoded = await getAdminAuth().verifySessionCookie(cookie.value, true)
    const organizationId = decoded.organizationId as string | undefined
    const role = decoded.role as Claims["role"] | undefined
    const userId = decoded.userId as string | undefined
    if (!organizationId || !role || !userId) return null
    return {
      uid: decoded.uid,
      email: decoded.email ?? "",
      organizationId,
      role,
      userId,
    }
  } catch {
    return null
  }
}
