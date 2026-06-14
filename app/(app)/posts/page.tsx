// Posts list reads live from Firestore - never pre-render.
export const dynamic = "force-dynamic"

import { addDays, format, subYears } from "date-fns"
import { getCurrentOrgId } from "@/lib/auth/server-helpers"
import { PageHeader } from "@/components/shared/page-header"
import { PostsTable } from "@/components/list/posts-table"
import {
  fetchCategories,
  fetchPostsInRange,
  fetchUsers,
} from "@/lib/queries/posts.server"

/*
 * Power-user list / table view. Deliberately wide read window (last year +
 * next 90 days) so historical data is searchable; date-range filter narrows
 * client-side.
 */
export default async function PostsPage() {
  const today = new Date()
  const start = format(subYears(today, 1), "yyyy-MM-dd")
  /* +1y forward so agent-drafted posts dated at far-future awareness
   * days still render. Was +90d which hid drafts beyond 3 months out. */
  const end = format(addDays(today, 365), "yyyy-MM-dd")

  const [orgId, posts, categories, users] = await Promise.all([
    getCurrentOrgId(),
    fetchPostsInRange(start, end),
    fetchCategories(),
    fetchUsers(),
  ])

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col px-4 py-6 sm:px-10 lg:py-14">
      <PageHeader
        title="All posts"
        description="Search, filter, and update your content pipeline."
        className="mb-4 md:mb-8"
        size="sm"
      />
      <PostsTable
        orgId={orgId}
        posts={posts}
        categories={categories}
        users={users}
        range={{ start, end }}
      />
    </div>
  )
}
