export const dynamic = "force-dynamic"

import { getUsageOverview } from "@/lib/actions/usage"
import { UsageOverview } from "@/components/settings/usage-overview"

export default async function SettingsUsagePage() {
  const initial = await getUsageOverview()

  return (
    <div className="px-4 sm:px-6 py-4 flex-1">
      <div className="mb-4">
        <h1 className="text-lg font-medium">Usage</h1>
        <p className="text-xs text-muted-foreground">
          What this workspace has used this month, against your plan limits.
        </p>
      </div>
      <UsageOverview initial={initial} />
    </div>
  )
}
