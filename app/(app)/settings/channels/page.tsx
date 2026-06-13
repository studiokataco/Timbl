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
import { ChannelsClient } from "./client"
import { IntegrationsClient } from "../integrations/client"
import type { AuditRow } from "../integrations/page"

const PLATFORMS: ChannelKey[] = ["linkedin", "x", "facebook", "instagram"]

export default async function SettingsConnectionsPage() {
  const [accounts, user, configured, apps, orgId, ...redirectUris] =
    await Promise.all([
      listSocialAccounts(),
      getCurrentUser(),
      listConfiguredChannels(),
      listPublicApps(),
      getCurrentOrgId(),
      ...PLATFORMS.map((p) => getChannelRedirectUri(p)),
    ])

  const redirectUriByChannel = Object.fromEntries(
    PLATFORMS.map((p, i) => [p, redirectUris[i]] as const),
  ) as Record<ChannelKey, string>

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
      <div className="mb-2">
        <h1 className="text-lg font-medium">Connections</h1>
        <p className="text-xs text-muted-foreground">
          Social accounts that publish your posts, and API keys for external
          apps and agents.
        </p>
      </div>

      <div className="max-w-3xl">
        <SettingsSection
          title="Social channels"
          description="Connect accounts so scheduled posts publish automatically at their slot. Reconnect any channel that needs re-auth."
          isFirst
        >
          <ChannelsClient
            accounts={accounts}
            configuredChannels={configured}
            redirectUriByChannel={redirectUriByChannel}
            isAdmin={user.role === "admin"}
          />
        </SettingsSection>

        <SettingsSection
          title="API keys"
          description="Scoped keys that let external apps and agents drive this workspace through the public API."
        >
          <IntegrationsClient
            apps={apps}
            auditRows={auditRows}
            revokeAction={revokePublicApp}
          />
        </SettingsSection>
      </div>
    </div>
  )
}
