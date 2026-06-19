"use server"

import { storageProvider, type StorageProvider } from "@/lib/schemas/_shared"
import { loadStoragePlatformApp } from "@/lib/storage/oauth"

/* The platform app's client id (Dropbox app key / OneDrive client id) and the
 * Google Drive picker key are public values the vendor SDKs embed client-side.
 * The client secret never leaves the server. */
export async function getStoragePickerConfig(
  provider: StorageProvider,
): Promise<
  | { ok: true; clientId: string; apiKey?: string }
  | { ok: false; error: string }
> {
  const valid = storageProvider.safeParse(provider)
  if (!valid.success) return { ok: false, error: "Invalid provider" }
  try {
    const app = loadStoragePlatformApp(valid.data)
    return { ok: true, clientId: app.clientId, apiKey: app.apiKey }
  } catch {
    return { ok: false, error: "Not configured" }
  }
}
