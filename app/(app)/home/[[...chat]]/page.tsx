import type { Metadata } from "next"
import { HomeView } from "@/components/home/home-view"
import type { ConnectorItem } from "@/components/home/connectors-strip"
import { getAssistantThreadAccess } from "@/lib/actions/assistant-threads"
import { listSocialAccounts } from "@/lib/actions/social-accounts"
import { listStorageAccounts } from "@/lib/actions/storage-accounts"
import { listAvailableStorageProviders } from "@/lib/actions/storage-apps"
import { fetchCurrentUserPreferences } from "@/lib/actions/user"
import { getCurrentBrandId } from "@/lib/brand/brand-session"
import { getCurrentOrgId, getCurrentUser, orDown } from "@/lib/auth/server-helpers"
import { CHANNEL_LABELS } from "@/lib/channels"
import { DEFAULT_BRAND_ID } from "@/lib/constants/timbl"
import { socialChannelsEnabled } from "@/lib/integrations/social-channels"
import { storageProvidersEnabled } from "@/lib/integrations/storage-providers"
import { STORAGE_PROVIDERS } from "@/lib/storage/providers"
import type { ChannelKey } from "@/lib/schemas"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Home" }

const SOCIAL: ChannelKey[] = ["instagram", "facebook", "linkedin", "x"]

export default async function HomePage({ params }: { params: Promise<{ chat?: string[] }> }) {
  const { chat } = await params
  const chatId = chat?.[0] ? decodeURIComponent(chat[0]) : null
  const orgId = await getCurrentOrgId()
  const user = await getCurrentUser()
  const canConnect = user.role === "admin" || user.role === "editor"

  const [brandId, preferences, access, socialAccounts, storageAccounts, storageAvailable] = await Promise.all([
    orDown(getCurrentBrandId(orgId), DEFAULT_BRAND_ID),
    orDown(fetchCurrentUserPreferences(), { onboarded: true, connectorsStripHidden: false }),
    chatId ? orDown(getAssistantThreadAccess(chatId), "missing" as const) : Promise.resolve("missing" as const),
    canConnect && socialChannelsEnabled() ? orDown(listSocialAccounts(), []) : Promise.resolve([]),
    canConnect && storageProvidersEnabled() ? orDown(listStorageAccounts(), []) : Promise.resolve([]),
    canConnect && storageProvidersEnabled() ? orDown(listAvailableStorageProviders(), []) : Promise.resolve([]),
  ])

  const connectedSocial = new Set(
    socialAccounts.filter((account) => account.brandId === brandId && account.status === "active").map((account) => account.channel),
  )
  const connectedStorage = new Set(storageAccounts.filter((account) => account.status === "active").map((account) => account.provider))
  const available = new Set(storageAvailable)
  const connectors: ConnectorItem[] = canConnect
    ? [
        ...(socialChannelsEnabled()
          ? SOCIAL.filter((channel) => !connectedSocial.has(channel)).map(
              (channel): ConnectorItem => ({ key: channel, label: CHANNEL_LABELS[channel], kind: "channel", channel }),
            )
          : []),
        ...(storageProvidersEnabled()
          ? STORAGE_PROVIDERS.filter((provider) => available.has(provider.key) && !connectedStorage.has(provider.key)).map(
              (provider): ConnectorItem =>
                provider.key === "gdrive"
                  ? { key: provider.key, label: provider.label, kind: "gdrive" }
                  : { key: provider.key, label: provider.label, kind: "favicon", domain: provider.domain },
            )
          : []),
      ]
    : []

  return (
    <HomeView
      connectors={connectors}
      connectorsHidden={preferences.connectorsStripHidden}
      privateChatId={access === "private" ? chatId : null}
    />
  )
}
