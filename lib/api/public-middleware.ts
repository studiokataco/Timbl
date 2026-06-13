import "server-only"

import { getAdminDb } from "@/lib/firebase/admin"
import { verifyApiKey } from "@/lib/publishing/crypto"
import { introspectToken } from "@/lib/auth/oauth-tokens"
import { requireScope, type PublicScope } from "@/lib/auth/public-scopes"
import type { PublicApp } from "@/lib/schemas/publicApp"

export interface PublicCaller {
  orgId: string
  appId: string
  subjectUserId: string | null
  scopes: PublicScope[]
  rateTier: "free" | "agency" | "operator"
}

type AuthResult = { caller: PublicCaller } | { error: string; status: number }

export async function resolvePublicCaller(
  authorization: string | null,
): Promise<AuthResult> {
  if (!authorization?.startsWith("Bearer ")) {
    return { error: "missing_token", status: 401 }
  }
  const token = authorization.slice(7)

  if (token.startsWith("tmbl_pk_")) {
    return resolveApiKey(token)
  }
  if (token.startsWith("tmbl_at_")) {
    return resolveOauthToken(token)
  }
  return { error: "invalid_token", status: 401 }
}

async function resolveApiKey(key: string): Promise<AuthResult> {
  const prefix = key.slice(0, 14)
  const db = getAdminDb()

  const snap = await db
    .collectionGroup("publicApps")
    .where("keyPrefix", "==", prefix)
    .limit(1)
    .get()

  if (snap.empty) return { error: "invalid_token", status: 401 }

  const app = snap.docs[0].data() as PublicApp
  if (app.revokedAt) return { error: "invalid_token", status: 401 }
  const valid = await verifyApiKey(key, app.keyHash)
  if (!valid) return { error: "invalid_token", status: 401 }

  return {
    caller: {
      orgId: app.organizationId,
      appId: app.id,
      subjectUserId: null,
      scopes: app.scopes,
      rateTier: app.rateTier ?? "free",
    },
  }
}

async function resolveOauthToken(token: string): Promise<AuthResult> {
  const tokenDoc = await introspectToken(token)
  if (!tokenDoc) return { error: "invalid_token", status: 401 }
  return {
    caller: {
      orgId: tokenDoc.orgId,
      appId: tokenDoc.appId,
      subjectUserId: tokenDoc.subjectUserId,
      scopes: tokenDoc.scopes,
      rateTier: "free",
    },
  }
}

export function authResponse(error: string, status: number) {
  return Response.json(
    { error: { code: error, message: error.replace(/_/g, " ") } },
    { status },
  )
}

export function scopeCheck(
  caller: PublicCaller,
  required: PublicScope,
): Response | null {
  try {
    requireScope(caller.scopes, required)
    return null
  } catch {
    return authResponse("insufficient_scope", 403)
  }
}

export function apiError(code: string, status: number, details?: string) {
  return Response.json(
    { error: { code, message: code.replace(/_/g, " "), details } },
    { status },
  )
}
