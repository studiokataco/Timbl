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
    <div className="flex min-h-0 flex-1 flex-col px-4 py-6 sm:px-10 lg:py-14">
      <PageHeader
        title="Kanban"
        description="Move posts through your workflow."
        className="mb-4 md:mb-8"
        size="sm"
      />
      <KanbanBoard
        orgId={orgId}
        initialPosts={posts}
        categories={categories}
        users={users}
        range={{ start, end }}
      />
    </div>
  )
}
