// Posts list reads live from Firestore — never pre-render.
export const dynamic = "force-dynamic"

import { addDays, format, subYears } from "date-fns"
import { TopBar } from "@/components/shared/top-bar"
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
      <div className="px-4 sm:px-6 py-4 flex-1">
        <div className="mb-3">
          <h1 className="text-lg font-medium">All posts</h1>
          <p className="text-xs text-muted-foreground">
            Filter, sort, bulk-update. Filters live in the URL — paste a link
            to share a saved view.
          </p>
        </div>
        <PostsTable posts={posts} categories={categories} users={users} />
      </div>
    </>
  )
}
