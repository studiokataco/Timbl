// Kanban reads live from Firestore - never pre-render.
export const dynamic = "force-dynamic"

import { addDays, format, subYears } from "date-fns"
import { getCurrentOrgId } from "@/lib/auth/server-helpers"
import { PageHeader } from "@/components/shared/page-header"
import { KanbanBoard } from "@/components/kanban/board"
import {
  fetchPostsInRange,
  fetchCategories,
  fetchUsers,
} from "@/lib/queries/posts.server"

export default async function KanbanPage() {
  const today = new Date()
  const start = format(subYears(today, 1), "yyyy-MM-dd")
  /* +1y forward so agent-drafted posts dated at far-future awareness
   * days (eg. World Mental Health Day in October when drafted in May)
   * still render. Was +90d which silently hid those drafts. */
  const end = format(addDays(today, 365), "yyyy-MM-dd")

  const [orgId, posts, categories, users] = await Promise.all([
    getCurrentOrgId(),
    fetchPostsInRange(start, end),
    fetchCategories(),
    fetchUsers(),
  ])

  return (
    <>
      <div className="flex-1 flex flex-col min-h-0 px-6 sm:px-10 py-10 lg:py-14">
        <PageHeader
          title="Kanban"
          description="Drag cards between columns to move posts through the workflow."
          className="mb-8"
        />
        <KanbanBoard
          orgId={orgId}
          initialPosts={posts}
          categories={categories}
          users={users}
          range={{ start, end }}
        />
      </div>
    </>
  )
}
