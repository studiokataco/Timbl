// Kanban reads live from Firestore — never pre-render.
export const dynamic = "force-dynamic"

import { addDays, format, subYears } from "date-fns"
import { TopBar } from "@/components/shared/top-bar"
import { PageHeader } from "@/components/shared/page-header"
import { KanbanBoard } from "@/components/kanban/board"
import {
  fetchPostsInRange,
  fetchCategories,
  fetchUsers,
} from "@/lib/queries/posts.server"
import { fetchCampaigns } from "@/lib/queries/campaigns.server"

export default async function KanbanPage() {
  const today = new Date()
  const start = format(subYears(today, 1), "yyyy-MM-dd")
  const end = format(addDays(today, 90), "yyyy-MM-dd")

  const [posts, categories, users, campaigns] = await Promise.all([
    fetchPostsInRange(start, end),
    fetchCategories(),
    fetchUsers(),
    fetchCampaigns(),
  ])

  return (
    <>
      <TopBar />
      <div className="flex-1 flex flex-col min-h-0 px-6 sm:px-10 py-10 lg:py-14">
        <PageHeader
          title="Kanban"
          description="Drag cards between columns to move posts through the workflow."
          className="mb-8"
        />
        <KanbanBoard
          posts={posts}
          categories={categories}
          users={users}
          campaigns={campaigns}
        />
      </div>
    </>
  )
}
