/* Mirrors appBaseUrl() in lib/publishing/oauth.ts, which is server-only and
 * pulls in firebase-admin - too heavy for metadata routes. */
export function siteUrl(): string {
  return (
    process.env.APP_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "")
}

export function absoluteUrl(path: string): string {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`
}
