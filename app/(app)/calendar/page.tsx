// Calendar reads from Firestore on every request - never pre-render at build
// time, otherwise the build tries to hit production Firestore.
export const dynamic = "force-dynamic"

import { addDays, format, startOfMonth, subDays } from "date-fns"
import { getCurrentOrgId, getCurrentOrganisation } from "@/lib/auth/server-helpers"
import { getCurrentBrandId } from "@/lib/brand/brand-session"
import { getBrandSwitcherData } from "@/lib/queries/brands.server"
import { realtimeEnabledForOrg } from "@/lib/realtime/realtime-enabled"
import { fetchCampaignWithPostCount } from "@/lib/actions/campaigns"
import { CalendarView } from "@/components/calendar/calendar-view"
import { fetchAwarenessWithPlannedStatus } from "@/lib/queries/awareness.server"
import { fetchCategories, fetchPostsInRange, fetchUsers } from "@/lib/queries/posts.server"
import { fetchSuggestions } from "@/lib/queries/suggestions.server"
import { fetchPersona } from "@/lib/actions/persona"

/*
 * Default app surface. Server-renders a 6-week window so prev/next view
 * switches don't always round-trip; the client refines.
 *
 * Reference data (categories / ctas / users / campaigns / kanban columns /
 * hashtag suggestions) for the global Quick add and composer dialogs is
 * fetched once in the (app) layout and shared via DialogsProvider.
 */
export default async function CalendarPage() {
  const today = new Date()
  const start = format(subDays(startOfMonth(today), 7), "yyyy-MM-dd")
  const end = format(addDays(today, 60), "yyyy-MM-dd")

  const orgId = await getCurrentOrgId()
  const brandId = await getCurrentBrandId(orgId)

  const [
    posts,
    categories,
    users,
    { days: awarenessDays, plannedIds },
    suggestions,
    campaigns,
    org,
    brands,
    persona,
  ] = await Promise.all([
    fetchPostsInRange(start, end),
    fetchCategories(),
    fetchUsers(),
    fetchAwarenessWithPlannedStatus(start, end),
    fetchSuggestions(),
    fetchCampaignWithPostCount(orgId),
    getCurrentOrganisation(),
    getBrandSwitcherData(),
    fetchPersona(),
  ])
  const realtimeEnabled = await realtimeEnabledForOrg(orgId)

  return (
    <CalendarView
      orgId={orgId}
      brandId={brandId}
      initialPosts={posts}
      categories={categories}
      users={users}
      awarenessDays={awarenessDays}
      plannedAwarenessIds={Array.from(plannedIds)}
      suggestions={suggestions}
      campaigns={campaigns}
      cadencePerWeek={brands.current.perWeek}
      workspaceName={org.name}
      range={{ start, end }}
      realtimeEnabled={realtimeEnabled}
      assistantName={persona.assistantName}
      prefs={persona.prefs}
    />
  )
}
