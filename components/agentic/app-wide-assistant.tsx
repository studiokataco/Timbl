"use client"

import { useMemo } from "react"
import { addDays, format, startOfWeek, subDays } from "date-fns"
import { usePathname } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { CalendarOrb } from "@/components/agentic/calendar-orb"
import { DEFAULT_VIEW } from "@/components/agentic/view-state"
import { DEFAULT_APP_ROUTE } from "@/lib/constants/timbl"
import { useDialogs } from "@/components/shared/dialogs-provider"
import { useWorkspaceOrgId } from "@/components/shared/workspace-provider"
import { fetchPostsInRangeAction } from "@/lib/actions/posts"
import type { PresencePrefs, TeamMember } from "@/components/agentic/types"

const noop = () => {}

export function AppWideAssistant({
  team,
  viewerId,
  workspaceName,
  assistantName,
  prefs,
  brandId,
  campaignCount,
  cadencePerWeek,
}: {
  team: TeamMember[]
  viewerId: string
  workspaceName: string
  assistantName: string
  prefs: PresencePrefs
  brandId: string
  campaignCount: number
  cadencePerWeek: number
}) {
  const pathname = usePathname()
  if (pathname === "/calendar" || pathname === DEFAULT_APP_ROUTE || pathname.startsWith(`${DEFAULT_APP_ROUTE}/`)) return null
  return (
    <AssistantRuntime
      pathname={pathname}
      team={team}
      viewerId={viewerId}
      workspaceName={workspaceName}
      assistantName={assistantName}
      prefs={prefs}
      brandId={brandId}
      campaignCount={campaignCount}
      cadencePerWeek={cadencePerWeek}
    />
  )
}

function AssistantRuntime({
  pathname,
  team,
  viewerId,
  workspaceName,
  assistantName,
  prefs,
  brandId,
  campaignCount,
  cadencePerWeek,
}: {
  pathname: string
  team: TeamMember[]
  viewerId: string
  workspaceName: string
  assistantName: string
  prefs: PresencePrefs
  brandId: string
  campaignCount: number
  cadencePerWeek: number
}) {
  const orgId = useWorkspaceOrgId()
  const { openComposerWithPost } = useDialogs()
  const range = useMemo(() => {
    const today = new Date()
    return {
      start: format(subDays(today, 90), "yyyy-MM-dd"),
      end: format(addDays(today, 180), "yyyy-MM-dd"),
    }
  }, [])
  const { data: posts = [] } = useQuery({
    queryKey: ["posts", orgId, brandId, range.start, range.end],
    queryFn: () => fetchPostsInRangeAction(range),
    staleTime: 30_000,
  })
  const now = new Date()
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd")

  return (
    <div className="pointer-events-none fixed inset-0 z-30 flex min-h-0">
      <CalendarOrb
        period={format(now, "MMMM yyyy")}
        posts={posts}
        campaignCount={campaignCount}
        cadencePerWeek={cadencePerWeek}
        team={team}
        workspaceName={workspaceName}
        onOpenPost={openComposerWithPost}
        overviewCollapsed
        onCollapseOverview={noop}
        sheetOpen={false}
        onSheetOpenChange={noop}
        weekStart={weekStart}
        filter="all"
        assistantName={assistantName}
        prefs={prefs}
        viewerId={viewerId}
        initialView={DEFAULT_VIEW}
        surfaceContext={pathname}
      >
        {null}
      </CalendarOrb>
    </div>
  )
}
