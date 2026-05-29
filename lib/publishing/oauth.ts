import "server-only"

import type { ChannelKey } from "@/lib/schemas/_shared"

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

export function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`${name} is not configured`)
  return v
}

export function expiresAtIso(expiresInSeconds: number | undefined): string | undefined {
  if (!expiresInSeconds || !Number.isFinite(expiresInSeconds)) return undefined
  return new Date(Date.now() + expiresInSeconds * 1000).toISOString()
}
