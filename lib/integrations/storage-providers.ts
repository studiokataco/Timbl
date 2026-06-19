import "server-only"

export function storageProvidersEnabled(): boolean {
  return process.env.STORAGE_PROVIDERS_ENABLED === "1"
}
