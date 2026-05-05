// Kanban reads live from Firestore — never pre-render.
export const dynamic = "force-dynamic"

import { addDays, format, subYears } from "date-fns"
import { TopBar } from "@/components/shared/top-bar"
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
      <div className="px-4 sm:px-6 py-4 flex-1 flex flex-col min-h-0">
        <div className="mb-3">
          <h1 className="text-lg font-medium">Kanban</h1>
          <p className="text-xs text-muted-foreground">
            Drag cards between columns to move posts through the workflow.
          </p>
        </div>
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
