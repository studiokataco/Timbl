import "server-only"

import { appBaseUrl } from "@/lib/publishing/oauth"
import type { StorageProvider } from "@/lib/schemas/_shared"

export function storageRedirectUri(provider: StorageProvider): string {
  return `${appBaseUrl()}/api/storage/${provider}/callback`
}

export type StoragePlatformApp = {
  clientId: string
  clientSecret: string
  apiKey?: string
}

/*
 * One platform-owned OAuth app per provider. Credentials come from Secret
 * Manager (apphosting.yaml), never per-tenant - a tenant only OAuths their own
 * account, with no developer-app registration on their side. `apiKey` is the
 * Google Drive picker browser key, from the same Cloud project as the OAuth
 * client (so one platform key serves every tenant).
 */
const ENV: Record<
  StorageProvider,
  { id: string; secret: string; apiKey?: string }
> = {
  gdrive: {
    id: "GOOGLE_DRIVE_CLIENT_ID",
    secret: "GOOGLE_DRIVE_CLIENT_SECRET",
    apiKey: "GOOGLE_DRIVE_PICKER_KEY",
  },
  dropbox: { id: "DROPBOX_APP_KEY", secret: "DROPBOX_APP_SECRET" },
  onedrive: { id: "ONEDRIVE_CLIENT_ID", secret: "ONEDRIVE_CLIENT_SECRET" },
}

export class StorageOauthAppNotConfiguredError extends Error {
  constructor(public readonly provider: StorageProvider) {
    super(`${provider} storage OAuth app is not configured`)
    this.name = "StorageOauthAppNotConfiguredError"
  }
}

export function loadStoragePlatformApp(
  provider: StorageProvider,
): StoragePlatformApp {
  const keys = ENV[provider]
  const clientId = process.env[keys.id]?.trim()
  const clientSecret = process.env[keys.secret]?.trim()
  if (!clientId || !clientSecret) {
    throw new StorageOauthAppNotConfiguredError(provider)
  }
  const apiKey = keys.apiKey ? process.env[keys.apiKey]?.trim() : undefined
  return { clientId, clientSecret, apiKey: apiKey || undefined }
}

export function storageProviderConfigured(provider: StorageProvider): boolean {
  const keys = ENV[provider]
  return Boolean(
    process.env[keys.id]?.trim() && process.env[keys.secret]?.trim(),
  )
}
