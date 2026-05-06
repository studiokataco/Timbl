// Posts list reads live from Firestore — never pre-render.
export const dynamic = "force-dynamic"

import { addDays, format, subYears } from "date-fns"
import { TopBar } from "@/components/shared/top-bar"
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
  const end = format(addDays(today, 90), "yyyy-MM-dd")

  const [posts, categories, users] = await Promise.all([
    fetchPostsInRange(start, end),
    fetchCategories(),
    fetchUsers(),
  ])

  return (
    <>
      <TopBar />
      <div className="flex-1 px-6 sm:px-10 py-10 lg:py-14">
        <div className="mx-auto w-full max-w-6xl space-y-8">
          <PageHeader
            title="All posts"
            description="Filter, sort, bulk-update. Filters live in the URL — paste a link to share a saved view."
          />
          <PostsTable posts={posts} categories={categories} users={users} />
        </div>
      </div>
    </>
  )
}
