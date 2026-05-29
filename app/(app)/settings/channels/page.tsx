export const dynamic = "force-dynamic"

import { listSocialAccounts } from "@/lib/actions/social-accounts"
import { ChannelsClient } from "./client"

export default async function SettingsChannelsPage() {
  const accounts = await listSocialAccounts()

  return (
    <div className="px-4 sm:px-6 py-4 flex-1">
      <div className="mb-4">
        <h1 className="text-lg font-medium">Channels</h1>
        <p className="text-xs text-muted-foreground">
          Connect your social accounts so scheduled posts publish automatically
          at their slot. Reconnect any channel that needs re-auth.
        </p>
      </div>
      <ChannelsClient accounts={accounts} />
    </div>
  )
}
