import "server-only"

import { createHash } from "node:crypto"

import type { Post } from "@/lib/schemas/post"
import type { SocialAccount } from "@/lib/schemas/socialAccount"
import { CHANNEL_RULES, validatePost } from "../rules"
import { encrypt, decrypt } from "../crypto"
import { signState } from "../state"
import {
  expiresAtIso,
  loadOauthApp,
  redirectUri,
  type OauthAppCredentials,
} from "../oauth"
import type { Publisher, PublishResult } from "../types"

const AUTH_URL = "https://twitter.com/i/oauth2/authorize"
const TOKEN_URL = "https://api.twitter.com/2/oauth2/token"
const ME_URL = "https://api.twitter.com/2/users/me"
const TWEETS_URL = "https://api.twitter.com/2/tweets"
const SCOPES = ["tweet.read", "tweet.write", "users.read", "offline.access"]

type TokenResponse = {
  access_token: string
  expires_in?: number
  refresh_token?: string
  scope?: string
}

/* PKCE without server-side storage: the verifier is deterministically
 * derived from the signed state + client_id, so the callback recomputes
 * it without needing a per-request store. Confidential clients (which we
 * are - X gives us a client secret) MUST use S256; "plain" is rejected. */
function verifierFromState(state: string, clientId: string): string {
  return createHash("sha256").update(`${state}:${clientId}`).digest("hex")
}

function challengeFromVerifier(verifier: string): string {
  return createHash("sha256")
    .update(verifier)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

function basicAuth(app: OauthAppCredentials): string {
  return Buffer.from(`${app.clientId}:${app.clientSecret}`).toString("base64")
}

async function exchange(
  body: Record<string, string>,
  app: OauthAppCredentials,
): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth(app)}`,
    },
    body: new URLSearchParams({ ...body, client_id: app.clientId }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    throw new Error(
      `x token exchange failed (${res.status}): ${detail.slice(0, 220)}`,
    )
  }
  return (await res.json()) as TokenResponse
}

export const xPublisher: Publisher = {
  key: "x",
  rules: CHANNEL_RULES.x,

  async connect(orgId, brandId) {
    const app = await loadOauthApp(orgId, "x")
    const state = signState(orgId, brandId)
    const verifier = verifierFromState(state, app.clientId)
    const url = `${AUTH_URL}?${new URLSearchParams({
      response_type: "code",
      client_id: app.clientId,
      redirect_uri: redirectUri("x"),
      scope: SCOPES.join(" "),
      state,
      code_challenge: challengeFromVerifier(verifier),
      code_challenge_method: "S256",
    })}`
    return { url, state }
  },

  async callback(orgId, code, state) {
    const app = await loadOauthApp(orgId, "x")
    const token = await exchange(
      {
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri("x"),
        code_verifier: verifierFromState(state, app.clientId),
      },
      app,
    )
    const me = await fetch(ME_URL, {
      headers: { Authorization: `Bearer ${token.access_token}` },
    })
    if (!me.ok) throw new Error(`x users/me failed: ${me.status}`)
    const profile = (await me.json()) as { data: { id: string; name?: string; username?: string } }
    const now = new Date().toISOString()
    return {
      id: `x:${profile.data.id}`,
      organizationId: orgId,
      channel: "x",
      displayName: profile.data.username ? `@${profile.data.username}` : profile.data.name ?? "X account",
      externalId: profile.data.id,
      accessTokenEnc: encrypt(token.access_token),
      refreshTokenEnc: token.refresh_token ? encrypt(token.refresh_token) : undefined,
      expiresAt: expiresAtIso(token.expires_in),
      scopes: token.scope?.split(" ") ?? SCOPES,
      status: "active",
      createdAt: now,
      updatedAt: now,
    }
  },

  async refresh(account) {
    if (!account.refreshTokenEnc) return account
    const app = await loadOauthApp(account.organizationId, "x")
    const token = await exchange(
      {
        grant_type: "refresh_token",
        refresh_token: decrypt(account.refreshTokenEnc),
      },
      app,
    )
    return {
      ...account,
      accessTokenEnc: encrypt(token.access_token),
      refreshTokenEnc: token.refresh_token ? encrypt(token.refresh_token) : account.refreshTokenEnc,
      expiresAt: expiresAtIso(token.expires_in) ?? account.expiresAt,
      status: "active",
      updatedAt: new Date().toISOString(),
    }
  },

  validate(post) {
    return validatePost("x", post)
  },

  async publish(account: SocialAccount, post: Post): Promise<PublishResult> {
    const valid = validatePost("x", post)
    if (!valid.ok) return { kind: "bad_body", reason: valid.reason }

    const text = [post.blurb ?? "", (post.hashtags ?? []).map((h) => `#${h}`).join(" ")]
      .filter(Boolean)
      .join(" ")
      .trim()

    const res = await fetch(TWEETS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${decrypt(account.accessTokenEnc)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    })

    if (res.ok) {
      const json = (await res.json()) as { data?: { id?: string } }
      const id = json.data?.id ?? `x:${Date.now()}`
      return { kind: "ok", externalId: id, url: `https://x.com/i/web/status/${id}` }
    }
    if (res.status === 401 || res.status === 403) {
      return { kind: "needs_reauth", reason: `x auth rejected (${res.status})` }
    }
    if (res.status === 429 || res.status >= 500) {
      return { kind: "retry", reason: `x transient error (${res.status})` }
    }
    const detail = await res.text().catch(() => "")
    return { kind: "bad_body", reason: `x rejected (${res.status}) ${detail.slice(0, 120)}` }
  },
}
