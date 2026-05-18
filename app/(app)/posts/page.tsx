// Posts list reads live from Firestore — never pre-render.
export const dynamic = "force-dynamic"

import { addDays, format, subYears } from "date-fns"
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

  const [posts, categories, users] = await Promise.all([
    fetchPostsInRange(start, end),
    fetchCategories(),
    fetchUsers(),
  ])

  return (
    <>
      <div className="flex-1 px-6 sm:px-10 py-10 lg:py-14">
        <div className="mx-auto w-full max-w-6xl space-y-8">
          <PageHeader
            title="All posts"
            description="Filter, sort, export, bulk-update. Select from the dropdowns or search to find a post."
          />
          <PostsTable posts={posts} categories={categories} users={users} />
        </div>
      </div>
    </>
  )
}
