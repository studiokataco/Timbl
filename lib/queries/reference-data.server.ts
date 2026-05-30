import "server-only"
import type { WithId } from "@/lib/firebase/serialize"
import type { Campaign, Category, Cta, KanbanColumn, User, ChannelKey } from "@/lib/schemas"
import { fetchCampaigns } from "./campaigns.server"
import { fetchKanbanColumns } from "./kanban-columns.server"
import { fetchRecentHashtags } from "./hashtags.server"
import { fetchCategories, fetchCtas, fetchUsers } from "./posts.server"
import { getCurrentOrgId, getDb } from "@/lib/auth/server-helpers"
import { orgBrandConfigDocPath, orgPath } from "@/lib/firebase/paths"
import { brandConfigSchema } from "@/lib/schemas/brandConfig"
import { resolveOrgChannels } from "@/lib/channels"

export type ReferenceData = {
  categories: WithId<Category>[]
  ctas: WithId<Cta>[]
  users: WithId<User>[]
  campaigns: WithId<Campaign>[]
  kanbanColumns: WithId<KanbanColumn>[]
  hashtagSuggestions: string[]
  orgChannels: ChannelKey[]
}

export async function fetchOrgChannels(): Promise<ChannelKey[]> {
  const orgId = await getCurrentOrgId()
  const db = getDb()
  const [brandSnap, orgSnap] = await Promise.all([
    db.doc(orgBrandConfigDocPath(orgId)).get(),
    db.doc(orgPath(orgId)).get(),
  ])

  let brandChannels: ChannelKey[] | undefined
  if (brandSnap.exists) {
    const parsed = brandConfigSchema.safeParse({
      ...(brandSnap.data() ?? {}),
      id: "default",
      organizationId: orgId,
    })
    if (parsed.success && parsed.data.channels.length) {
      brandChannels = parsed.data.channels
    }
  }

  const onboardingChannels = orgSnap.data()?.onboarding?.profile?.channels as
    | string[]
    | undefined

  return resolveOrgChannels({ brandChannels, onboardingChannels })
}

export async function fetchReferenceData(): Promise<ReferenceData> {
  const [categories, ctas, users, campaigns, kanbanColumns, hashtagSuggestions, orgChannels] =
    await Promise.all([
      fetchCategories(),
      fetchCtas(),
      fetchUsers(),
      fetchCampaigns(),
      fetchKanbanColumns(),
      fetchRecentHashtags(),
      fetchOrgChannels(),
    ])
  return { categories, ctas, users, campaigns, kanbanColumns, hashtagSuggestions, orgChannels }
}
