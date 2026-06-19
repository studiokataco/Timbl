import type { StorageProvider } from "@/lib/schemas/_shared"

/*
 * Static, public metadata for each connectable storage provider. OAuth
 * endpoints and scopes are public (not secrets), so this is safe to import
 * from client components that render the setup UI. Per-org client_id /
 * client_secret live encrypted in Firestore (see lib/storage/oauth.ts).
 *
 * Endpoints + scopes verified against the providers' OAuth docs:
 *   Google  - accounts.google.com/o/oauth2/v2/auth, drive.file picker scope
 *   Dropbox - dropbox.com/oauth2/authorize, token_access_type=offline
 *   OneDrive- login.microsoftonline.com/common, Microsoft Graph Files.Read
 */
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
  {
    key: "onedrive",
    label: "OneDrive",
    domain: "onedrive.live.com",
    consoleUrl:
      "https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade",
    consoleHint:
      "Register an app in Microsoft Entra ID with delegated Files.Read + offline_access.",
    setupSteps: [
      "Open the Microsoft Entra admin center and register a new application.",
      "Set Supported account types to include personal Microsoft accounts.",
      "Under Authentication add a Web platform and paste the redirect URI above.",
      "Under API permissions add delegated Microsoft Graph permissions Files.Read, User.Read and offline_access.",
      "Under Certificates & secrets create a new client secret.",
      "Copy the Application (client) ID and the secret Value below.",
    ],
    authorizeUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    scopes: ["Files.Read", "User.Read", "offline_access"],
  },
]

export function getStorageProviderDef(
  key: string,
): StorageProviderDef | undefined {
  return STORAGE_PROVIDERS.find((p) => p.key === key)
}
