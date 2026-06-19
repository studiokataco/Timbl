"use server"

import { storageProvider, type StorageProvider } from "@/lib/schemas/_shared"
import { storageProviderConfigured } from "@/lib/storage/oauth"

/* Providers Timbl has bound a platform OAuth app for - the only ones a tenant
 * can connect. No per-tenant credential entry. */
export async function listAvailableStorageProviders(): Promise<StorageProvider[]> {
  return storageProvider.options.filter((p) => storageProviderConfigured(p))
}
