// Calendar reads from Firestore on every request — never pre-render at build
// time, otherwise the build tries to hit production Firestore.
export const dynamic = "force-dynamic"

import { addDays, format, startOfMonth, subDays } from "date-fns"
import { getCurrentOrgId } from "@/lib/auth/server-helpers"
import { CalendarView } from "@/components/calendar/calendar-view"
import { fetchCampaigns } from "@/lib/queries/campaigns.server"
import { fetchRecentHashtags } from "@/lib/queries/hashtags.server"
import {
  fetchCategories,
  fetchCtas,
  fetchPostsInRange,
  fetchUsers,
} from "@/lib/queries/posts.server"

/*
 * Default app surface. Server-renders a 6-week window so prev/next view
 * switches don't always round-trip; the client refines.
 */
export default async function CalendarPage() {
  const today = new Date()
  const start = format(subDays(startOfMonth(today), 7), "yyyy-MM-dd")
  const end = format(addDays(today, 60), "yyyy-MM-dd")

  const [orgId, posts, categories, ctas, users, campaigns, hashtagSuggestions] =
    await Promise.all([
      getCurrentOrgId(),
      fetchPostsInRange(start, end),
      fetchCategories(),
      fetchCtas(),
      fetchUsers(),
      fetchCampaigns(),
      fetchRecentHashtags(),
    ])

  return (
    <CalendarView
      orgId={orgId}
      initialPosts={posts}
      categories={categories}
      ctas={ctas}
      users={users}
      campaigns={campaigns}
      hashtagSuggestions={hashtagSuggestions}
      range={{ start, end }}
    />
  )
}
