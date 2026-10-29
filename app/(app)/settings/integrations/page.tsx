export const dynamic = "force-dynamic"

import type { ReactNode } from "react"

import { getCurrentUser, getCurrentOrgId } from "@/lib/auth/server-helpers"
import {
  getChannelRedirectUri,
  listConfiguredChannels,
} from "@/lib/actions/oauth-apps"
import { listSocialAccounts } from "@/lib/actions/social-accounts"
import { listPublicApps, revokePublicApp } from "@/lib/actions/public-apps"
import { getAdminDb } from "@/lib/firebase/admin"
import { orgPublicApiAuditPath } from "@/lib/firebase/paths"
import { getBrandSwitcherData } from "@/lib/queries/brands.server"
import type { ChannelKey } from "@/lib/schemas/_shared"

import { SettingsPage } from "@/components/settings/settings-page"
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

  const [user, apps, orgId, brandData, ...channelData] = await Promise.all([
    getCurrentUser(),
    listPublicApps(),
    getCurrentOrgId(),
    getBrandSwitcherData(),
    ...(channelsLive
      ? [
          listSocialAccounts(),
          listConfiguredChannels(),
          ...PLATFORMS.map((p) => getChannelRedirectUri(p)),
        ]
      : []),
  ])

  const brand = brandData.current
  const allAccounts = channelsLive ? (channelData[0] as Awaited<ReturnType<typeof listSocialAccounts>>) : []
  const accounts = allAccounts.filter((a) => a.brandId === brand.id)
  const otherBrandAccounts = allAccounts.filter(
    (a) => a.brandId !== brand.id && a.status !== "revoked",
  ).length
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
    <SettingsPage
      title="Integrations & API"
      description="Connect the accounts Timbl publishes to, the storage your team attaches files from, and the API for your own tools."
    >
      <div className="space-y-12">
        <Group
          title="Social accounts"
          description={
            channelsLive
              ? `For ${brand.name}. Switch brands from the sidebar. Scheduled posts publish to these accounts automatically.`
              : "Publishing straight to social accounts is coming soon. Everything else keeps working as usual."
          }
          footer={
            channelsLive && otherBrandAccounts > 0
              ? `${otherBrandAccounts} more ${otherBrandAccounts === 1 ? "account is" : "accounts are"} connected to other brands.`
              : null
          }
        >
          {channelsLive ? (
            <ChannelsClient
              accounts={accounts}
              configuredChannels={configured}
              redirectUriByChannel={redirectUriByChannel}
              isAdmin={user.role === "admin"}
              brandId={brand.id}
              brandName={brand.name}
            />
          ) : (
            <SocialChannelsGate />
          )}
        </Group>

        <Group
          title="Storage"
          description={
            storageLive
              ? "Shared across the workspace. Lets your team attach files from Google Drive or Dropbox to posts."
              : "Attaching files from Google Drive or Dropbox is coming soon."
          }
        >
          <StorageClient accounts={storageAccounts} availableProviders={availableProviders} />
        </Group>

        <IntegrationsClient apps={apps} auditRows={auditRows} revokeAction={revokePublicApp} />
      </div>
    </SettingsPage>
  )
}

function Group({
  title,
  description,
  footer,
  children,
}: {
  title: string
  description: string
  footer?: string | null
  children: ReactNode
}) {
  return (
    <section aria-label={title}>
      <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
      <p className="mt-1 max-w-[64ch] text-[13px] leading-relaxed text-muted-foreground">{description}</p>
      <div className="mt-3">{children}</div>
      {footer ? <p className="mt-2 text-[13px] text-muted-foreground">{footer}</p> : null}
    </section>
  )
}
