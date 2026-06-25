export const dynamic = "force-dynamic"

import { getCurrentUser, getCurrentOrgId } from "@/lib/auth/server-helpers"
import {
  getChannelRedirectUri,
  listConfiguredChannels,
} from "@/lib/actions/oauth-apps"
import { listSocialAccounts } from "@/lib/actions/social-accounts"
import { listPublicApps, revokePublicApp } from "@/lib/actions/public-apps"
import { getAdminDb } from "@/lib/firebase/admin"
import { orgPublicApiAuditPath } from "@/lib/firebase/paths"
import type { ChannelKey } from "@/lib/schemas/_shared"

import { SettingsSection } from "@/components/settings/settings-section"
import { SocialChannelsGate } from "@/components/settings/social-channels-gate"
import { socialChannelsEnabled } from "@/lib/integrations/social-channels"
import { storageProvidersEnabled } from "@/lib/integrations/storage-providers"
import { listStorageAccounts } from "@/lib/actions/storage-accounts"
import { listAvailableStorageProviders } from "@/lib/actions/storage-apps"
import { ChannelsClient } from "./channels-client"
import { StorageClient } from "./storage-client"
import { IntegrationsClient } from "./client"

export interface AuditRow {
  id: string
  kind: string
  appId: string
  success: boolean
  latencyMs: number
  errorCode: string | null
  createdAt: string
}

const PLATFORMS: ChannelKey[] = ["linkedin", "x", "facebook", "instagram"]

export default async function SettingsIntegrationsPage() {
  const channelsLive = socialChannelsEnabled()

  const [user, apps, orgId, ...channelData] = await Promise.all([
    getCurrentUser(),
    listPublicApps(),
    getCurrentOrgId(),
    ...(channelsLive
      ? [
          listSocialAccounts(),
          listConfiguredChannels(),
          ...PLATFORMS.map((p) => getChannelRedirectUri(p)),
        ]
      : []),
  ])

  const accounts = channelsLive ? (channelData[0] as Awaited<ReturnType<typeof listSocialAccounts>>) : []
  const configured = channelsLive ? (channelData[1] as Awaited<ReturnType<typeof listConfiguredChannels>>) : []
  const redirectUris = channelsLive ? channelData.slice(2) : []
  const redirectUriByChannel = Object.fromEntries(
    PLATFORMS.map((p, i) => [p, redirectUris[i] ?? ""] as const),
  ) as Record<ChannelKey, string>

  const storageLive = storageProvidersEnabled()
  const storageAccounts = storageLive ? await listStorageAccounts() : []
  const availableProviders = storageLive
    ? await listAvailableStorageProviders()
    : []

  const auditSnap = await getAdminDb()
    .collection(orgPublicApiAuditPath(orgId))
    .orderBy("createdAt", "desc")
    .limit(20)
    .get()

  const auditRows: AuditRow[] = auditSnap.docs.map((d) => {
    const data = d.data()
    return {
      id: d.id,
      kind: data.kind ?? "",
      appId: data.appId ?? "",
      success: data.success ?? false,
      latencyMs: data.latencyMs ?? 0,
      errorCode: data.errorCode ?? null,
      createdAt: data.createdAt ?? "",
    }
  })

  return (
    <div className="px-4 sm:px-6 py-4 flex-1">
      <SettingsSection
        title="Social channels"
        description={
          channelsLive
            ? "Connect accounts so scheduled posts publish automatically at their slot. Reconnect any channel that needs re-auth."
            : "Connecting social accounts is coming soon."
        }
        isFirst
      >
        {channelsLive ? (
          <ChannelsClient
            accounts={accounts}
            configuredChannels={configured}
            redirectUriByChannel={redirectUriByChannel}
            isAdmin={user.role === "admin"}
          />
        ) : (
          <SocialChannelsGate />
        )}
      </SettingsSection>

      <SettingsSection
        title="Storage"
        description="Connect Google Drive or Dropbox so your team can attach files from their own storage to posts."
      >
        {storageLive ? (
          <StorageClient
            accounts={storageAccounts}
            availableProviders={availableProviders}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Connecting storage apps is coming soon.
          </p>
        )}
      </SettingsSection>

      <SettingsSection
        title="API keys & MCP"
        description="Scoped keys that let external apps, agents, and MCP clients like Cursor and Claude drive this workspace."
      >
        <IntegrationsClient
          apps={apps}
          auditRows={auditRows}
          revokeAction={revokePublicApp}
        />
      </SettingsSection>
    </div>
  )
}
