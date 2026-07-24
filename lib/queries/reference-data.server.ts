import "server-only"
import type { WithId } from "@/lib/firebase/serialize"
import type { Campaign, Category, Cta, KanbanColumn, User, ChannelKey } from "@/lib/schemas"
import { fetchCampaigns } from "./campaigns.server"
import { fetchKanbanColumns } from "./kanban-columns.server"
import { fetchRecentHashtags } from "./hashtags.server"
import { fetchCategories, fetchCtas, fetchUsers } from "./posts.server"
import { getCurrentOrgId, getDb } from "@/lib/auth/server-helpers"
import { orgPath } from "@/lib/firebase/paths"
import { readBrand } from "@/lib/brand/brand-store"
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
  const [brand, orgSnap] = await Promise.all([
    readBrand(orgId, undefined, db),
    db.doc(orgPath(orgId)).get(),
  ])

  const brandChannels =
    brand && brand.channels.length ? brand.channels : undefined

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
