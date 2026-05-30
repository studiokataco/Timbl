import "server-only"

import type { Post } from "@/lib/schemas/post"
import type { SocialAccount } from "@/lib/schemas/socialAccount"
import { CHANNEL_RULES, validatePost } from "../rules"
import { encrypt, decrypt } from "../crypto"
import { signState } from "../state"
import {
  loadOauthApp,
  redirectUri,
  type OauthAppCredentials,
} from "../oauth"
import type { Publisher, PublishResult } from "../types"

type MetaChannel = "facebook" | "instagram"

const GRAPH_VERSION = "v22.0"
const AUTH_URL = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`

/*
 * Facebook needs Page management; Instagram content publishing additionally
 * needs the IG-basic + content-publish perms and reads the Page→IG link via
 * pages_read_engagement. Both go through Facebook Login.
 */
const SCOPES: Record<MetaChannel, string[]> = {
  facebook: ["pages_show_list", "pages_manage_posts", "pages_read_engagement"],
  instagram: [
    "pages_show_list",
    "pages_read_engagement",
    "instagram_basic",
    "instagram_content_publish",
  ],
}

const VIDEO_RE = /\.(mp4|mov|webm|m4v)(\?|$)/i

type TokenResponse = { access_token: string; expires_in?: number }

type Page = {
  id: string
  name?: string
  access_token: string
  instagram_business_account?: { id: string; username?: string }
}

type GraphErrorBody = {
  error?: { code?: number; error_subcode?: number; message?: string; type?: string }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/* blurb + hashtags, blank-line separated - the platform caption/message. */
function caption(post: Post): string {
  return [post.blurb ?? "", (post.hashtags ?? []).map((h) => `#${h}`).join(" ")]
    .map((s) => s.trim())
    .filter(Boolean)
    .join("\n\n")
}

function splitMedia(urls: string[]): { images: string[]; videos: string[] } {
  const images: string[] = []
  const videos: string[] = []
  for (const url of urls) (VIDEO_RE.test(url) ? videos : images).push(url)
  return { images, videos }
}

function graphPost(path: string, params: Record<string, string>): Promise<Response> {
  return fetch(`${GRAPH}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  })
}

/*
 * Map a failed Graph response onto the publisher's four-way result so the
 * sweep reacts correctly: invalid/expired token or missing permission →
 * needs_reauth (flag the account, prompt reconnect); rate-limit / transient →
 * retry (leave scheduled); everything else → bad_body (mark failed).
 * Graph error codes: 190 = invalid token, 200-299 = permission denied,
 * 4/17/32/613 = throttling, 1/2 = transient platform error.
 */
async function graphError(prefix: string, res: Response): Promise<PublishResult> {
  const text = await res.text().catch(() => "")
  let body: GraphErrorBody | null = null
  try {
    body = JSON.parse(text) as GraphErrorBody
  } catch {
    /* non-JSON body - fall back to raw text below */
  }
  const code = body?.error?.code
  const message = body?.error?.message ?? text.slice(0, 160) ?? `HTTP ${res.status}`

  if (
    res.status === 401 ||
    res.status === 403 ||
    code === 190 ||
    code === 102 ||
    code === 10 ||
    (code !== undefined && code >= 200 && code <= 299)
  ) {
    return { kind: "needs_reauth", reason: `${prefix} auth/permission: ${message}` }
  }
  if (
    res.status === 429 ||
    res.status >= 500 ||
    code === 1 ||
    code === 2 ||
    code === 4 ||
    code === 17 ||
    code === 32 ||
    code === 613
  ) {
    return { kind: "retry", reason: `${prefix} transient (${code ?? res.status}): ${message}` }
  }
  return { kind: "bad_body", reason: `${prefix} rejected (${res.status}/${code ?? "?"}): ${message}` }
}

async function exchangeCode(
  code: string,
  channel: MetaChannel,
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
  if (!res.ok) {
    throw new Error(`meta token exchange failed: ${res.status} ${await res.text().catch(() => "")}`)
  }
  return (await res.json()) as TokenResponse
}

/* Short-lived user token → ~60-day long-lived user token. Page tokens minted
 * from a long-lived user token do not expire, which is what we store. */
async function exchangeLongLived(
  userToken: string,
  app: OauthAppCredentials,
): Promise<TokenResponse> {
  const res = await fetch(
    `${GRAPH}/oauth/access_token?${new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: app.clientId,
      client_secret: app.clientSecret,
      fb_exchange_token: userToken,
    })}`,
  )
  if (!res.ok) {
    throw new Error(`meta long-lived exchange failed: ${res.status}`)
  }
  return (await res.json()) as TokenResponse
}

async function fetchPages(userToken: string): Promise<Page[]> {
  const res = await fetch(
    `${GRAPH}/me/accounts?${new URLSearchParams({
      fields: "id,name,access_token,instagram_business_account{id,username}",
      access_token: userToken,
      limit: "100",
    })}`,
  )
  if (!res.ok) {
    throw new Error(`meta /me/accounts failed: ${res.status} ${await res.text().catch(() => "")}`)
  }
  const json = (await res.json()) as { data?: Page[] }
  return json.data ?? []
}

/* Wait for an IG media container to finish processing before publishing.
 * Returns "timeout" if still IN_PROGRESS at the cap - the caller turns that
 * into a retry (media_publish is never called, so nothing is double-posted). */
async function waitForContainer(
  containerId: string,
  token: string,
  attempts: number,
  intervalMs: number,
): Promise<"ok" | "error" | "timeout"> {
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(
      `${GRAPH}/${containerId}?${new URLSearchParams({ fields: "status_code", access_token: token })}`,
    )
    if (res.ok) {
      const json = (await res.json()) as { status_code?: string }
      if (json.status_code === "FINISHED") return "ok"
      if (json.status_code === "ERROR" || json.status_code === "EXPIRED") return "error"
    }
    await sleep(intervalMs)
  }
  return "timeout"
}

async function publishFacebook(account: SocialAccount, post: Post): Promise<PublishResult> {
  const valid = validatePost("facebook", post)
  if (!valid.ok) return { kind: "bad_body", reason: valid.reason }

  const token = decrypt(account.accessTokenEnc)
  const page = account.externalId
  const message = caption(post)
  const { images, videos } = splitMedia(post.assetUrls ?? [])

  const ok = (id: string | undefined): PublishResult => ({
    kind: "ok",
    externalId: id ?? `facebook:${page}`,
    url: id ? `https://www.facebook.com/${id}` : undefined,
  })

  /* Video post (FB can't mix a video with photos in one Graph publish, so a
   * video takes precedence - images on the same post are skipped). */
  if (videos.length > 0) {
    const res = await graphPost(`${page}/videos`, {
      file_url: videos[0],
      description: message,
      access_token: token,
    })
    if (!res.ok) return graphError("facebook video", res)
    const json = (await res.json()) as { id?: string }
    return ok(json.id)
  }

  /* Multi-photo: upload each unpublished, then a feed post that attaches them. */
  if (images.length > 1) {
    const params: Record<string, string> = { access_token: token }
    if (message) params.message = message
    for (let i = 0; i < images.length; i++) {
      const res = await graphPost(`${page}/photos`, {
        url: images[i],
        published: "false",
        access_token: token,
      })
      if (!res.ok) return graphError("facebook photo upload", res)
      const json = (await res.json()) as { id?: string }
      if (json.id) params[`attached_media[${i}]`] = JSON.stringify({ media_fbid: json.id })
    }
    const res = await graphPost(`${page}/feed`, params)
    if (!res.ok) return graphError("facebook feed", res)
    const json = (await res.json()) as { id?: string }
    return ok(json.id)
  }

  /* Single photo with caption. */
  if (images.length === 1) {
    const res = await graphPost(`${page}/photos`, {
      url: images[0],
      caption: message,
      access_token: token,
    })
    if (!res.ok) return graphError("facebook photo", res)
    const json = (await res.json()) as { id?: string; post_id?: string }
    return ok(json.post_id ?? json.id)
  }

  /* Text only. */
  const res = await graphPost(`${page}/feed`, { message, access_token: token })
  if (!res.ok) return graphError("facebook feed", res)
  const json = (await res.json()) as { id?: string }
  return ok(json.id)
}

async function createIgContainer(
  ig: string,
  token: string,
  extra: Record<string, string>,
): Promise<{ id: string } | PublishResult> {
  const res = await graphPost(`${ig}/media`, { access_token: token, ...extra })
  if (!res.ok) return graphError("instagram container", res)
  const json = (await res.json()) as { id?: string }
  if (!json.id) return { kind: "bad_body", reason: "instagram container returned no id" }
  return { id: json.id }
}

async function publishInstagram(account: SocialAccount, post: Post): Promise<PublishResult> {
  const valid = validatePost("instagram", post)
  if (!valid.ok) return { kind: "bad_body", reason: valid.reason }

  const token = decrypt(account.accessTokenEnc)
  const ig = account.externalId
  const text = caption(post)
  const urls = post.assetUrls ?? []
  if (urls.length === 0) {
    return { kind: "bad_body", reason: "instagram requires at least one image or video." }
  }

  let creationId: string

  if (urls.length === 1) {
    const url = urls[0]
    const isVideo = VIDEO_RE.test(url)
    const container = await createIgContainer(
      ig,
      token,
      isVideo
        ? { media_type: "REELS", video_url: url, caption: text }
        : { image_url: url, caption: text },
    )
    if ("kind" in container) return container
    const status = await waitForContainer(container.id, token, isVideo ? 30 : 15, isVideo ? 4000 : 2000)
    if (status === "timeout") return { kind: "retry", reason: "instagram media still processing" }
    if (status === "error") return { kind: "bad_body", reason: "instagram media processing failed" }
    creationId = container.id
  } else {
    /* Carousel: each child is a finished container, then a CAROUSEL parent. */
    const childIds: string[] = []
    for (const url of urls) {
      const isVideo = VIDEO_RE.test(url)
      const child = await createIgContainer(
        ig,
        token,
        isVideo
          ? { media_type: "VIDEO", video_url: url, is_carousel_item: "true" }
          : { image_url: url, is_carousel_item: "true" },
      )
      if ("kind" in child) return child
      const status = await waitForContainer(child.id, token, isVideo ? 30 : 12, isVideo ? 4000 : 2000)
      if (status === "timeout") return { kind: "retry", reason: "instagram carousel item still processing" }
      if (status === "error") return { kind: "bad_body", reason: "instagram carousel item failed" }
      childIds.push(child.id)
    }
    const parent = await createIgContainer(ig, token, {
      media_type: "CAROUSEL",
      caption: text,
      children: childIds.join(","),
    })
    if ("kind" in parent) return parent
    const status = await waitForContainer(parent.id, token, 20, 3000)
    if (status === "timeout") return { kind: "retry", reason: "instagram carousel still processing" }
    if (status === "error") return { kind: "bad_body", reason: "instagram carousel processing failed" }
    creationId = parent.id
  }

  const pub = await graphPost(`${ig}/media_publish`, { creation_id: creationId, access_token: token })
  if (!pub.ok) return graphError("instagram publish", pub)
  const published = (await pub.json()) as { id?: string }

  let url: string | undefined
  if (published.id) {
    const permalinkRes = await fetch(
      `${GRAPH}/${published.id}?${new URLSearchParams({ fields: "permalink", access_token: token })}`,
    ).catch(() => null)
    if (permalinkRes?.ok) {
      const meta = (await permalinkRes.json().catch(() => ({}))) as { permalink?: string }
      url = meta.permalink
    }
  }

  return { kind: "ok", externalId: published.id ?? `instagram:${ig}`, url }
}

function buildMetaPublisher(channel: MetaChannel): Publisher {
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
      const short = await exchangeCode(code, channel, app)
      const longLived = await exchangeLongLived(short.access_token, app)
      const pages = await fetchPages(longLived.access_token)
      const now = new Date().toISOString()

      /* Resolve the publish target. Single-page orgs (the common case) get the
       * one page deterministically; multi-page orgs currently take the first
       * eligible page - page selection UI is the only deferred piece. */
      let externalId: string
      let pageToken: string
      let displayName: string

      if (channel === "facebook") {
        const page = pages[0]
        if (!page) {
          throw new Error("No Facebook Page found - the connecting account must be an admin of a Page.")
        }
        externalId = page.id
        pageToken = page.access_token
        displayName = page.name ?? "Facebook Page"
      } else {
        const page = pages.find((p) => p.instagram_business_account?.id)
        const igAccount = page?.instagram_business_account
        if (!page || !igAccount) {
          throw new Error(
            "No Instagram Business account is linked to your Facebook Page. Connect an IG Business/Creator account to the Page and retry.",
          )
        }
        externalId = igAccount.id
        pageToken = page.access_token
        displayName = igAccount.username ? `@${igAccount.username}` : (page.name ?? "Instagram account")
      }

      return {
        id: `${channel}:${externalId}`,
        organizationId: orgId,
        channel,
        displayName,
        externalId,
        /* Page access token from a long-lived user token does not expire, so
         * no expiresAt and no refresh path are needed. */
        accessTokenEnc: encrypt(pageToken),
        scopes,
        status: "active",
        createdAt: now,
        updatedAt: now,
      }
    },

    /* Page tokens are long-lived; nothing to refresh. If a token is ever
     * rejected at publish time the adapter returns needs_reauth and the user
     * reconnects. */
    async refresh(account) {
      return account
    },

    validate(post) {
      return validatePost(channel, post)
    },

    publish(account: SocialAccount, post: Post): Promise<PublishResult> {
      return channel === "facebook"
        ? publishFacebook(account, post)
        : publishInstagram(account, post)
    },
  }
}

export const facebookPublisher = buildMetaPublisher("facebook")
export const instagramPublisher = buildMetaPublisher("instagram")
