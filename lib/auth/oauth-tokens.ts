import "server-only"

import { createHash, randomBytes, timingSafeEqual } from "node:crypto"
import { getAdminDb } from "@/lib/firebase/admin"
import {
  orgOauthAuthCodesPath,
  orgOauthAccessTokensPath,
  orgOauthRefreshTokensPath,
  orgConsentGrantsPath,
} from "@/lib/firebase/paths"
import type { PublicScope } from "./public-scopes"

const AUTH_CODE_TTL_MS = 10 * 60 * 1000
const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000

function randomToken(prefix: string): string {
  return `${prefix}_${randomBytes(32).toString("base64url")}`
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("base64url")
}

export interface OauthAuthCode {
  id: string
  appId: string
  orgId: string
  subjectUserId: string
  scopes: PublicScope[]
  redirectUri: string
  codeChallenge: string
  codeChallengeMethod: "S256"
  expiresAt: string
  usedAt: string | null
}

export interface OauthAccessToken {
  id: string
  tokenHash: string
  appId: string
  orgId: string
  subjectUserId: string
  scopes: PublicScope[]
  expiresAt: string
  revokedAt: string | null
}

export interface OauthRefreshToken {
  id: string
  tokenHash: string
  appId: string
  orgId: string
  subjectUserId: string
  scopes: PublicScope[]
  expiresAt: string
  revokedAt: string | null
}

export async function createAuthCode(params: {
  appId: string
  orgId: string
  subjectUserId: string
  scopes: PublicScope[]
  redirectUri: string
  codeChallenge: string
}): Promise<string> {
  const code = randomToken("tmbl_ac")
  const db = getAdminDb()
  const ref = db.collection(orgOauthAuthCodesPath(params.orgId)).doc()
  const now = Date.now()
  const doc: OauthAuthCode = {
    id: ref.id,
    appId: params.appId,
    orgId: params.orgId,
    subjectUserId: params.subjectUserId,
    scopes: params.scopes,
    redirectUri: params.redirectUri,
    codeChallenge: params.codeChallenge,
    codeChallengeMethod: "S256",
    expiresAt: new Date(now + AUTH_CODE_TTL_MS).toISOString(),
    usedAt: null,
  }
  await ref.set({ ...doc, _code: code })
  return code
}

export async function exchangeAuthCode(params: {
  orgId: string
  code: string
  codeVerifier: string
  redirectUri: string
}): Promise<{
  accessToken: string
  refreshToken: string
  expiresIn: number
  scopes: PublicScope[]
} | null> {
  const db = getAdminDb()
  const snap = await db
    .collection(orgOauthAuthCodesPath(params.orgId))
    .where("_code", "==", params.code)
    .where("usedAt", "==", null)
    .limit(1)
    .get()

  if (snap.empty) return null

  const codeDoc = snap.docs[0]
  const data = codeDoc.data() as OauthAuthCode & { _code: string }

  if (new Date(data.expiresAt) < new Date()) return null
  if (data.redirectUri !== params.redirectUri) return null

  const expectedChallenge = sha256(params.codeVerifier)
  if (
    !timingSafeEqual(
      Buffer.from(expectedChallenge),
      Buffer.from(data.codeChallenge),
    )
  ) {
    return null
  }

  await codeDoc.ref.update({ usedAt: new Date().toISOString() })

  const [accessToken, refreshToken] = await Promise.all([
    issueToken("access", data, db),
    issueToken("refresh", data, db),
  ])

  await persistConsentGrant(data, db)

  return {
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TOKEN_TTL_MS / 1000,
    scopes: data.scopes,
  }
}

async function issueToken(
  kind: "access" | "refresh",
  data: OauthAuthCode,
  db: ReturnType<typeof getAdminDb>,
): Promise<string> {
  const prefix = kind === "access" ? "tmbl_at" : "tmbl_rt"
  const token = randomToken(prefix)
  const tokenHash = sha256(token)
  const ttl = kind === "access" ? ACCESS_TOKEN_TTL_MS : REFRESH_TOKEN_TTL_MS
  const path =
    kind === "access"
      ? orgOauthAccessTokensPath(data.orgId)
      : orgOauthRefreshTokensPath(data.orgId)

  const ref = db.collection(path).doc()
  await ref.set({
    id: ref.id,
    tokenHash,
    appId: data.appId,
    orgId: data.orgId,
    subjectUserId: data.subjectUserId,
    scopes: data.scopes,
    expiresAt: new Date(Date.now() + ttl).toISOString(),
    revokedAt: null,
  })
  return token
}

async function persistConsentGrant(
  data: OauthAuthCode,
  db: ReturnType<typeof getAdminDb>,
): Promise<void> {
  const grantId = `${data.appId}:${data.subjectUserId}`
  await db.doc(`${orgConsentGrantsPath(data.orgId)}/${grantId}`).set(
    {
      appId: data.appId,
      orgId: data.orgId,
      subjectUserId: data.subjectUserId,
      scopes: data.scopes,
      grantedAt: new Date().toISOString(),
    },
    { merge: true },
  )
}

export async function introspectToken(token: string): Promise<OauthAccessToken | null> {
  const tokenHash = sha256(token)
  const orgId = await orgIdFromTokenHash(tokenHash)
  if (!orgId) return null

  const snap = await getAdminDb()
    .collection(orgOauthAccessTokensPath(orgId))
    .where("tokenHash", "==", tokenHash)
    .limit(1)
    .get()

  if (snap.empty) return null
  const data = snap.docs[0].data() as OauthAccessToken
  if (data.revokedAt || new Date(data.expiresAt) < new Date()) return null
  return data
}

export async function revokeToken(token: string): Promise<void> {
  const tokenHash = sha256(token)
  const db = getAdminDb()

  for (const collection of ["oauthAccessTokens", "oauthRefreshTokens"]) {
    const snap = await db
      .collectionGroup(collection)
      .where("tokenHash", "==", tokenHash)
      .limit(1)
      .get()
    if (!snap.empty) {
      await snap.docs[0].ref.update({ revokedAt: new Date().toISOString() })
    }
  }
}

async function orgIdFromTokenHash(tokenHash: string): Promise<string | null> {
  const snap = await getAdminDb()
    .collectionGroup("oauthAccessTokens")
    .where("tokenHash", "==", tokenHash)
    .limit(1)
    .get()
  if (snap.empty) return null
  return (snap.docs[0].data() as OauthAccessToken).orgId
}
