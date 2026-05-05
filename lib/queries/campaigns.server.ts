import "server-only"
import { getCurrentOrgId, getDb } from "@/lib/auth/server-helpers"
import { orgCampaignsPath } from "@/lib/firebase/paths"
import { snapToData, type WithId } from "@/lib/firebase/serialize"
import type { Campaign } from "@/lib/schemas"

export async function fetchCampaigns(): Promise<WithId<Campaign>[]> {
  const orgId = await getCurrentOrgId()
  const snap = await getDb().collection(orgCampaignsPath(orgId)).get()
  return snap.docs.map((d) => snapToData<Campaign>(d))
}
