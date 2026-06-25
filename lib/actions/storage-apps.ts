"use server"

import { storageProvider, type StorageProvider } from "@/lib/schemas/_shared"
import { storageProviderConfigured } from "@/lib/storage/oauth"

export async function listAvailableStorageProviders(): Promise<StorageProvider[]> {
  return storageProvider.options.filter((p) => storageProviderConfigured(p))
}
