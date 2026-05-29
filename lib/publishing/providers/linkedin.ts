import "server-only"

import type { Post } from "@/lib/schemas/post"
import type { SocialAccount } from "@/lib/schemas/socialAccount"
import { CHANNEL_RULES, validatePost } from "../rules"
import { encrypt, decrypt } from "../crypto"
import { signState } from "../state"
import { appBaseUrl, expiresAtIso, redirectUri, requireEnv } from "../oauth"
import type { Publisher, PublishResult } from "../types"

const AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization"
const TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken"
const USERINFO_URL = "https://api.linkedin.com/v2/userinfo"
const POSTS_URL = "https://api.linkedin.com/rest/posts"
const SCOPES = ["openid", "profile", "w_member_social"]
const API_VERSION = "202401"

type TokenResponse = {
  access_token: string
  expires_in?: number
  refresh_token?: string
  scope?: string
}

async function exchange(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  })
  if (!res.ok) throw new Error(`linkedin token exchange failed: ${res.status}`)
  return (await res.json()) as TokenResponse
}

export const linkedinPublisher: Publisher = {
  key: "linkedin",
  rules: CHANNEL_RULES.linkedin,

  async connect(orgId) {
    const state = signState(orgId)
    const url = `${AUTH_URL}?${new URLSearchParams({
      response_type: "code",
      client_id: requireEnv("LINKEDIN_CLIENT_ID"),
      redirect_uri: redirectUri("linkedin"),
      state,
      scope: SCOPES.join(" "),
    })}`
    return { url, state }
  },

  async callback(orgId, code) {
    const token = await exchange({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri("linkedin"),
      client_id: requireEnv("LINKEDIN_CLIENT_ID"),
      client_secret: requireEnv("LINKEDIN_CLIENT_SECRET"),
    })
    const me = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${token.access_token}` },
    })
    if (!me.ok) throw new Error(`linkedin userinfo failed: ${me.status}`)
    const profile = (await me.json()) as { sub: string; name?: string }
    const now = new Date().toISOString()
    return {
      id: `linkedin:${profile.sub}`,
      organizationId: orgId,
      channel: "linkedin",
      displayName: profile.name ?? "LinkedIn member",
      externalId: profile.sub,
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
    const token = await exchange({
      grant_type: "refresh_token",
      refresh_token: decrypt(account.refreshTokenEnc),
      client_id: requireEnv("LINKEDIN_CLIENT_ID"),
      client_secret: requireEnv("LINKEDIN_CLIENT_SECRET"),
    })
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
    return validatePost("linkedin", post)
  },

  async publish(account: SocialAccount, post: Post): Promise<PublishResult> {
    const valid = validatePost("linkedin", post)
    if (!valid.ok) return { kind: "bad_body", reason: valid.reason }

    const commentary = [post.blurb ?? "", (post.hashtags ?? []).map((h) => `#${h}`).join(" ")]
      .filter(Boolean)
      .join("\n\n")

    const res = await fetch(POSTS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${decrypt(account.accessTokenEnc)}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
        "LinkedIn-Version": API_VERSION,
      },
      body: JSON.stringify({
        author: `urn:li:person:${account.externalId}`,
        commentary,
        visibility: "PUBLIC",
        distribution: {
          feedDistribution: "MAIN_FEED",
          targetEntities: [],
          thirdPartyDistributionChannels: [],
        },
        lifecycleState: "PUBLISHED",
        isReshareDisabledByAuthor: false,
      }),
    })

    if (res.ok) {
      const externalId = res.headers.get("x-restli-id") ?? `linkedin:${Date.now()}`
      return {
        kind: "ok",
        externalId,
        url: `${appBaseUrl()}`,
      }
    }
    if (res.status === 401 || res.status === 403) {
      return { kind: "needs_reauth", reason: `linkedin auth rejected (${res.status})` }
    }
    if (res.status === 429 || res.status >= 500) {
      return { kind: "retry", reason: `linkedin transient error (${res.status})` }
    }
    const detail = await res.text().catch(() => "")
    return { kind: "bad_body", reason: `linkedin rejected (${res.status}) ${detail.slice(0, 120)}` }
  },
}
