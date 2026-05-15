export const dynamic = "force-dynamic"

import { addDays, format } from "date-fns"
import { PageHeader } from "@/components/shared/page-header"
import { AwarenessList } from "@/components/awareness/awareness-list"
import { AwarenessProposalsStrip } from "@/components/awareness/awareness-proposals-strip"
import { FindAwarenessButton } from "@/components/awareness/find-awareness-button"
import { fetchAwarenessWithPlannedStatus } from "@/lib/queries/awareness.server"
import { fetchCategories } from "@/lib/queries/posts.server"
import { listProposals } from "@/lib/actions/awareness-proposals"

export default async function AwarenessPage() {
  const today = new Date()
  const start = format(today, "yyyy-MM-dd")
  const end = format(addDays(today, 90), "yyyy-MM-dd")

  const [{ days, plannedIds }, categories, proposals] = await Promise.all([
    fetchAwarenessWithPlannedStatus(start, end),
    fetchCategories(),
    listProposals({ status: "proposed" }),
  ])

  return (
    <>
      <div className="flex-1 px-6 sm:px-10 py-10 lg:py-14">
        <div className="mx-auto w-full max-w-6xl space-y-8">
          <PageHeader
            title="Awareness days"
            description="Upcoming observances over the next 90 days. Promote any to a draft post in one tap."
            action={<FindAwarenessButton />}
          />
          <AwarenessProposalsStrip proposals={proposals} />
          <AwarenessList
            days={days}
            plannedIds={plannedIds}
            categories={categories}
          />
        </div>
      </div>
    </>
  )
}
