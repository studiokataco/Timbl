export const dynamic = "force-dynamic"

import { getCurrentOrgId } from "@/lib/auth/server-helpers"
import { fetchCampaignWithPostCount } from "@/lib/actions/campaigns"
import { CampaignsBoard } from "@/components/campaigns/campaigns-board"

/*
 * Campaigns - the single campaigns surface: browse grid + create / edit /
 * delete in one place. The old read-only split (this page bounced every
 * action to a near-duplicate /settings/campaigns) is gone.
 */
export default async function CampaignsPage() {
  const orgId = await getCurrentOrgId()
  const campaigns = await fetchCampaignWithPostCount(orgId)

  return (
    <div className="flex-1 px-6 sm:px-10 py-10 lg:py-14">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <CampaignsBoard campaigns={campaigns} />
      </div>
    </div>
  )
}
