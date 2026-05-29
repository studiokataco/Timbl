import "server-only"

import { getAdminDb } from "@/lib/firebase/admin"
import { orgOauthAppsPath } from "@/lib/firebase/paths"
import type { ChannelKey } from "@/lib/schemas/_shared"

import { decrypt } from "./crypto"

/* Public origin of the Next app — OAuth redirect URIs must match the value
 * registered with each provider. Falls back to localhost for dev. */
export function appBaseUrl(): string {
  return (
    process.env.APP_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "")
}

export function redirectUri(channel: ChannelKey): string {
  return `${appBaseUrl()}/api/social/${channel}/callback`
}

/* Build a public-origin URL for in-app redirects. On Cloud Run, NextRequest.url
 * resolves to the internal listener (http://0.0.0.0:8080) — using it as the
 * base for redirects leaks that address to the browser. Always anchor to
 * APP_BASE_URL instead. */
export function settingsRedirect(path: string, params?: Record<string, string>): URL {
  const url = new URL(path, appBaseUrl())
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  return url
}

export function expiresAtIso(expiresInSeconds: number | undefined): string | undefined {
  if (!expiresInSeconds || !Number.isFinite(expiresInSeconds)) return undefined
  return new Date(Date.now() + expiresInSeconds * 1000).toISOString()
}

/*
 * Per-org OAuth app credentials, loaded from Firestore and decrypted with
 * SOCIAL_TOKEN_KEY. Replaces the older env-var path so admins can set
 * platform credentials from the UI without redeploying — see
 * lib/actions/oauth-apps.ts.
 *
 * Cached in-process for 5 minutes per (orgId, channel) so the publish
 * sweep doesn't hit Firestore on every scheduled post.
 */
export type OauthAppCredentials = { clientId: string; clientSecret: string }

const APP_CACHE = new Map<string, { value: OauthAppCredentials; expiresAt: number }>()
const APP_CACHE_TTL_MS = 5 * 60 * 1000

export class OauthAppNotConfiguredError extends Error {
  constructor(public readonly channel: ChannelKey) {
    super(`${channel} OAuth app is not configured`)
    this.name = "OauthAppNotConfiguredError"
  }
}

export async function loadOauthApp(
  orgId: string,
  channel: ChannelKey,
): Promise<OauthAppCredentials> {
  const key = `${orgId}:${channel}`
  const hit = APP_CACHE.get(key)
  if (hit && hit.expiresAt > Date.now()) return hit.value

  const snap = await getAdminDb().doc(`${orgOauthAppsPath(orgId)}/${channel}`).get()
  if (!snap.exists) throw new OauthAppNotConfiguredError(channel)
  const data = snap.data() as { clientIdEnc?: string; clientSecretEnc?: string }
  if (!data.clientIdEnc || !data.clientSecretEnc) {
    throw new OauthAppNotConfiguredError(channel)
  }
  const value: OauthAppCredentials = {
    clientId: decrypt(data.clientIdEnc),
    clientSecret: decrypt(data.clientSecretEnc),
  }
  APP_CACHE.set(key, { value, expiresAt: Date.now() + APP_CACHE_TTL_MS })
  return value
}

export function invalidateOauthAppCache(orgId: string, channel: ChannelKey): void {
  APP_CACHE.delete(`${orgId}:${channel}`)
}
