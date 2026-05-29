import "server-only"

import type { ChannelKey } from "@/lib/schemas/_shared"
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

const GRAPH_VERSION = "v19.0"
const AUTH_URL = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`

const SCOPES: Record<"facebook" | "instagram", string[]> = {
  facebook: ["pages_manage_posts", "pages_read_engagement", "pages_show_list"],
  instagram: ["instagram_basic", "instagram_content_publish", "pages_show_list"],
}

type TokenResponse = { access_token: string; expires_in?: number }

async function exchangeCode(
  code: string,
  channel: ChannelKey,
  app: OauthAppCredentials,
): Promise<TokenResponse> {
  const res = await fetch(
    `${GRAPH}/oauth/access_token?${new URLSearchParams({
      client_id: app.clientId,
      client_secret: app.clientSecret,
      redirect_uri: redirectUri(channel),
      code,
    })}`,
  )
  if (!res.ok) throw new Error(`meta token exchange failed: ${res.status}`)
  return (await res.json()) as TokenResponse
}

function buildMetaPublisher(channel: "facebook" | "instagram"): Publisher {
  const scopes = SCOPES[channel]
  return {
    key: channel,
    rules: CHANNEL_RULES[channel],

    async connect(orgId) {
      const app = await loadOauthApp(orgId, channel)
      const state = signState(orgId)
      const url = `${AUTH_URL}?${new URLSearchParams({
        client_id: app.clientId,
        redirect_uri: redirectUri(channel),
        state,
        response_type: "code",
        scope: scopes.join(","),
      })}`
      return { url, state }
    },

    async callback(orgId, code) {
      const app = await loadOauthApp(orgId, channel)
      const token = await exchangeCode(code, channel, app)
      const me = await fetch(`${GRAPH}/me?fields=id,name&access_token=${token.access_token}`)
      if (!me.ok) throw new Error(`meta /me failed: ${me.status}`)
      const profile = (await me.json()) as { id: string; name?: string }
      const now = new Date().toISOString()
      return {
        id: `${channel}:${profile.id}`,
        organizationId: orgId,
        channel,
        displayName: profile.name ?? (channel === "instagram" ? "Instagram account" : "Facebook page"),
        externalId: profile.id,
        accessTokenEnc: encrypt(token.access_token),
        expiresAt: expiresAtIso(token.expires_in),
        scopes,
        status: "active",
        createdAt: now,
        updatedAt: now,
      }
    },

    async refresh(account) {
      const app = await loadOauthApp(account.organizationId, channel)
      const res = await fetch(
        `${GRAPH}/oauth/access_token?${new URLSearchParams({
          grant_type: "fb_exchange_token",
          client_id: app.clientId,
          client_secret: app.clientSecret,
          fb_exchange_token: decrypt(account.accessTokenEnc),
        })}`,
      )
      if (!res.ok) return account
      const token = (await res.json()) as TokenResponse
      return {
        ...account,
        accessTokenEnc: encrypt(token.access_token),
        expiresAt: expiresAtIso(token.expires_in) ?? account.expiresAt,
        status: "active",
        updatedAt: new Date().toISOString(),
      }
    },

    validate(post) {
      return validatePost(channel, post)
    },

    async publish(_account: SocialAccount, post: Post): Promise<PublishResult> {
      const valid = validatePost(channel, post)
      if (!valid.ok) return { kind: "bad_body", reason: valid.reason }
      /* Page/IG-business-account resolution + media container polling require
       * live App-Review credentials and a page-selection step. The OAuth +
       * vault spine is complete; the publish call is gated until those land. */
      return { kind: "retry", reason: `${channel} publish not yet enabled` }
    },
  }
}

export const facebookPublisher = buildMetaPublisher("facebook")
export const instagramPublisher = buildMetaPublisher("instagram")
