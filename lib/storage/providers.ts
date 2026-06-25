import type { StorageProvider } from "@/lib/schemas/_shared"

export type StorageProviderDef = {
  key: StorageProvider
  label: string
  domain: string
  consoleUrl: string
  consoleHint: string
  setupSteps: string[]
  authorizeUrl: string
  tokenUrl: string
  scopes: string[]
}

export const STORAGE_PROVIDERS: StorageProviderDef[] = [
  {
    key: "gdrive",
    label: "Google Drive",
    domain: "drive.google.com",
    consoleUrl: "https://console.cloud.google.com/apis/credentials",
    consoleHint:
      "Create an OAuth 2.0 Client ID (Web application) and enable the Google Drive + Picker APIs.",
    setupSteps: [
      "Open the Google Cloud console and create or pick a project.",
      "Under APIs & Services, enable the Google Drive API and the Google Picker API.",
      "Configure the OAuth consent screen (External) and add yourself as a test user.",
      "Create an OAuth 2.0 Client ID of type Web application.",
      "Paste the redirect URI above into Authorized redirect URIs.",
      "Copy the Client ID and Client Secret below.",
    ],
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: [
      "https://www.googleapis.com/auth/drive.file",
      "openid",
      "email",
      "profile",
    ],
  },
  {
    key: "dropbox",
    label: "Dropbox",
    domain: "dropbox.com",
    consoleUrl: "https://www.dropbox.com/developers/apps",
    consoleHint: "Create a Scoped app and enable the listed permission scopes.",
    setupSteps: [
      "Open the Dropbox App Console and create a new app with Scoped access.",
      "Choose Full Dropbox access (or App folder if you prefer to scope it).",
      "On the Permissions tab enable account_info.read, files.metadata.read, files.content.read, sharing.read and sharing.write.",
      "On the Settings tab paste the redirect URI above into OAuth 2 Redirect URIs.",
      "Copy the App key (Client ID) and App secret (Client Secret) below.",
    ],
    authorizeUrl: "https://www.dropbox.com/oauth2/authorize",
    tokenUrl: "https://api.dropboxapi.com/oauth2/token",
    scopes: [
      "account_info.read",
      "files.metadata.read",
      "files.content.read",
      "sharing.read",
      "sharing.write",
    ],
  },
]

export function getStorageProviderDef(
  key: string,
): StorageProviderDef | undefined {
  return STORAGE_PROVIDERS.find((p) => p.key === key)
}
