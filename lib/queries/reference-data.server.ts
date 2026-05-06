import "server-only"
import type { WithId } from "@/lib/firebase/serialize"
import type { Campaign, Category, Cta, KanbanColumn, User } from "@/lib/schemas"
import { fetchCampaigns } from "./campaigns.server"
import { fetchKanbanColumns } from "./kanban-columns.server"
import { fetchRecentHashtags } from "./hashtags.server"
import { fetchCategories, fetchCtas, fetchUsers } from "./posts.server"

export type ReferenceData = {
  categories: WithId<Category>[]
  ctas: WithId<Cta>[]
  users: WithId<User>[]
  campaigns: WithId<Campaign>[]
  kanbanColumns: WithId<KanbanColumn>[]
  hashtagSuggestions: string[]
}

/*
 * Single round-trip wrapper for the reference data the dialogs provider needs.
 * Mounted once at the (app) layout so every page shares the same hydrated data
 * and Quick add / composer can be opened from anywhere.
 */
export async function fetchReferenceData(): Promise<ReferenceData> {
  const [categories, ctas, users, campaigns, kanbanColumns, hashtagSuggestions] =
    await Promise.all([
      fetchCategories(),
      fetchCtas(),
      fetchUsers(),
      fetchCampaigns(),
      fetchKanbanColumns(),
      fetchRecentHashtags(),
    ])
  return { categories, ctas, users, campaigns, kanbanColumns, hashtagSuggestions }
}
