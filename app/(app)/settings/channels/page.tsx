export const dynamic = "force-dynamic"

import { getCurrentUser } from "@/lib/auth/server-helpers"
import {
  getChannelRedirectUri,
  listConfiguredChannels,
} from "@/lib/actions/oauth-apps"
import { listSocialAccounts } from "@/lib/actions/social-accounts"
import type { ChannelKey } from "@/lib/schemas/_shared"

import { ChannelsClient } from "./client"

const PLATFORMS: ChannelKey[] = ["linkedin", "x", "facebook", "instagram"]

export default async function SettingsChannelsPage() {
  const [accounts, user, configured, ...redirectUris] = await Promise.all([
    listSocialAccounts(),
    getCurrentUser(),
    listConfiguredChannels(),
    ...PLATFORMS.map((p) => getChannelRedirectUri(p)),
  ])

  const redirectUriByChannel = Object.fromEntries(
    PLATFORMS.map((p, i) => [p, redirectUris[i]] as const),
  ) as Record<ChannelKey, string>

  return (
    <div className="px-4 sm:px-6 py-4 flex-1">
      <div className="mb-4">
        <h1 className="text-lg font-medium">Channels</h1>
        <p className="text-xs text-muted-foreground">
          Connect your social accounts so scheduled posts publish automatically
          at their slot. Reconnect any channel that needs re-auth.
        </p>
      </div>
      <ChannelsClient
        accounts={accounts}
        configuredChannels={configured}
        redirectUriByChannel={redirectUriByChannel}
        isAdmin={user.role === "admin"}
      />
    </div>
  )
}
