export const dynamic = "force-dynamic"

import { addDays, format } from "date-fns"
import { TopBar } from "@/components/shared/top-bar"
import { AwarenessList } from "@/components/awareness/awareness-list"
import { fetchAwarenessWithPlannedStatus } from "@/lib/queries/awareness.server"
import { fetchCategories } from "@/lib/queries/posts.server"

export default async function AwarenessPage() {
  const today = new Date()
  const start = format(today, "yyyy-MM-dd")
  const end = format(addDays(today, 90), "yyyy-MM-dd")

  const [{ days, plannedIds }, categories] = await Promise.all([
    fetchAwarenessWithPlannedStatus(start, end),
    fetchCategories(),
  ])

  return (
    <>
      <TopBar />
      <div className="px-4 sm:px-6 py-4 flex-1">
        <div className="mb-4">
          <h1 className="text-lg font-medium">Awareness days</h1>
          <p className="text-xs text-muted-foreground">
            Upcoming observances over the next 90 days. Promote any to a draft
            post in one tap.
          </p>
        </div>
        <AwarenessList
          days={days}
          plannedIds={plannedIds}
          categories={categories}
        />
      </div>
    </>
  )
}
