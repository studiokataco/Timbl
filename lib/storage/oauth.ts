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
