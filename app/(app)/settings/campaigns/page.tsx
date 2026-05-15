export const dynamic = "force-dynamic"

import { getCurrentOrgId } from "@/lib/auth/server-helpers"
import { fetchCampaignWithPostCount } from "@/lib/actions/campaigns"
import { CampaignManager } from "@/components/campaigns/campaign-manager"

export default async function SettingsCampaignsPage() {
  const orgId = await getCurrentOrgId()
  const campaigns = await fetchCampaignWithPostCount(orgId)

  return (
    <div className="px-4 sm:px-6 py-4 flex-1">
      <div className="mb-4">
        <h1 className="text-lg font-medium">Manage campaigns</h1>
        <p className="text-xs text-muted-foreground">
          Create, edit, and archive campaigns. Admin only.
        </p>
      </div>
      <CampaignManager campaigns={campaigns} />
    </div>
  )
}
