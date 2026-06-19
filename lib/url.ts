import type { LinkProvider } from "@/lib/schemas/_shared"

export function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

export function isValidUrl(value: string): boolean {
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}

export function faviconUrl(url: string, size = 32): string {
  return `https://www.google.com/s2/favicons?domain=${hostname(url)}&sz=${size}`
}

export function detectLinkProvider(url: string): LinkProvider {
  const host = hostname(url).toLowerCase()
  if (host === "canva.com" || host.endsWith(".canva.com")) return "canva"
  if (host === "drive.google.com" || host === "docs.google.com") return "gdrive"
  if (host === "dropbox.com" || host.endsWith(".dropbox.com") || host === "db.tt")
    return "dropbox"
  if (
    host === "onedrive.live.com" ||
    host === "1drv.ms" ||
    host.endsWith(".sharepoint.com")
  )
    return "onedrive"
  return "link"
}
