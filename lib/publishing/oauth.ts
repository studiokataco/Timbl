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

export function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`${name} is not configured`)
  return v
}

export function expiresAtIso(expiresInSeconds: number | undefined): string | undefined {
  if (!expiresInSeconds || !Number.isFinite(expiresInSeconds)) return undefined
  return new Date(Date.now() + expiresInSeconds * 1000).toISOString()
}
