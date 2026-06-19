import type { StorageAccount } from "@/lib/schemas/storageAccount"

import { dropboxConnector } from "./dropbox"
import { gdriveConnector } from "./gdrive"
import { onedriveConnector } from "./onedrive"

export type StorageConnector = {
  connect(orgId: string): Promise<{ url: string }>
  callback(orgId: string, code: string, state: string): Promise<StorageAccount>
}

const connectors: Record<string, StorageConnector> = {
  gdrive: gdriveConnector,
  dropbox: dropboxConnector,
  onedrive: onedriveConnector,
}

export function getStorageConnector(provider: string): StorageConnector | undefined {
  return connectors[provider]
}
