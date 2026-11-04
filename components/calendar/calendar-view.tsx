"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from "date-fns"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useAgenticMotion, usePrototype } from "@/components/agentic/prototype-context"
import { Eye, Sparkles, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { PlanCadenceDialog } from "@/components/agents/plan-cadence-dialog"
import { CalendarOrb } from "@/components/agentic/calendar-orb"
import { asTeamMember } from "@/components/agentic/defaults"
import { AvatarStack, PeerChip } from "@/components/agentic/interface/avatar-stack"
import { useFollowMode } from "@/components/agentic/interface/use-follow-mode"
import { InterfaceTopBar } from "@/components/agentic/interface/interface-top-bar"
import { initials, showCursorsEffective } from "@/components/agentic/lib"
import { weekLabel } from "@/components/agentic/clock"
import { NotificationsMenu } from "@/components/shared/notifications-menu"
import type { CalendarFilter, PresencePrefs, TeamMember, ViewState } from "@/components/agentic/types"
import { matchesCalendarFilter } from "@/components/calendar/status-filter"
import { fetchPostsInRangeAction, updatePost } from "@/lib/actions/posts"
import { usePostsRealtime } from "@/lib/realtime/subscribe-posts"
import type { WithId } from "@/lib/firebase/serialize"
import type { AwarenessDay, Category, Post, PostPatch, User } from "@/lib/schemas"
import type { Suggestion } from "@/lib/queries/suggestions.server"
import { useGridReveal } from "@/components/shared/motion-cal"
import { useDialogs } from "@/components/shared/dialogs-provider"
import { CursorFrame, LivePresence, useLivePresence, type LiveCursor } from "./live-cursors"
import { EventListItem } from "./event-pill"
import { CalendarToolbar, type CalendarView as ViewT } from "./calendar-toolbar"
import { CalendarGrid } from "./calendar-grid"
import { CampaignTracker, type CampaignRow } from "./campaign-tracker"
import { CategoryFilter } from "./category-filter"
import { CalendarAwarenessRail } from "./awareness-rail"
import { WeekView } from "./week-view"
import { DayView } from "./day-view"

type DropPatch = Pick<PostPatch, "scheduledDate" | "scheduledTime">

type Props = {
  orgId: string
  brandId: string
  initialPosts: WithId<Post>[]
  categories: WithId<Category>[]
  users: WithId<User>[]
  awarenessDays: WithId<AwarenessDay>[]
  plannedAwarenessIds: string[]
  suggestions: Suggestion[]
  campaigns: CampaignRow[]
  cadencePerWeek: number
  workspaceName: string
  range: { start: string; end: string }
  realtimeEnabled?: boolean
  assistantName: string
  prefs: PresencePrefs
  viewerId: string
  initialView: ViewState
}

export function CalendarView({
  orgId,
  brandId,
  initialPosts,
  categories,
  awarenessDays,
  plannedAwarenessIds,
  suggestions,
  users,
  campaigns,
  cadencePerWeek,
  workspaceName,
  range,
  realtimeEnabled = false,
  assistantName,
  prefs,
  viewerId,
  initialView,
}: Props) {
  const queryClient = useQueryClient()
  const { openQuickAdd, openComposerWithPost } = useDialogs()
  const mainRef = useRef<HTMLElement | null>(null)
  useGridReveal(mainRef)

  const [visibleDate, setVisibleDate] = useState<Date>(() => (initialView.week ? parseISO(initialView.week) : new Date()))
  const [view, setView] = useState<ViewT>("week")
  const [filter, setFilter] = useState<CalendarFilter>(initialView.filter)
  const [compact, setCompact] = useState(false)
  const weekStart = format(startOfWeek(visibleDate, { weekStartsOn: 1 }), "yyyy-MM-dd")
  const [planOpen, setPlanOpen] = useState(false)
  const [railOpen, setRailOpen] = useState(false)
  const [timblMode, setTimblMode] = useState(false)
  const [visibleCategoryIds, setVisibleCategoryIds] = useState<Set<string>>(
    () => new Set(categories.map((c) => c.id)),
  )
  useEffect(() => {
    const el = mainRef.current
    if (!el || typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width
      if (width) setCompact(width < 768)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const allCategoriesVisible = visibleCategoryIds.size === categories.length

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  useEffect(() => {
    // Mount-only hydration from localStorage; SSR can't read it.
    try {
      const stored = window.localStorage.getItem("calendar:sidebar-collapsed")
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored === "1") setSidebarCollapsed(true)
    } catch {}
  }, [])
  const collapseOverview = useCallback(() => {
    setSidebarCollapsed(true)
    try {
      window.localStorage.setItem("calendar:sidebar-collapsed", "1")
    } catch {}
    setRailOpen(false)
  }, [setRailOpen])

  /* Visible-month range derived from `visibleDate` + `view`. The SSR
   * range covers today±60d; when the user navigates the calendar past
   * that window (e.g. an October post drafted in May), the query needs
   * to refetch against the visible window or the post stays invisible. */
  const visibleRange = useMemo(() => {
    if (view === "day") {
      const d = format(visibleDate, "yyyy-MM-dd")
      return { start: d, end: d }
    }
    if (view === "week") {
      return {
        start: format(startOfWeek(visibleDate, { weekStartsOn: 1 }), "yyyy-MM-dd"),
        end: format(endOfWeek(visibleDate, { weekStartsOn: 1 }), "yyyy-MM-dd"),
      }
    }
    /* month + list: pad by a week on each side so the 6-row grid leading/
     * trailing days are also covered. */
    return {
      start: format(subDays(startOfMonth(visibleDate), 7), "yyyy-MM-dd"),
      end: format(addDays(endOfMonth(visibleDate), 7), "yyyy-MM-dd"),
    }
  }, [visibleDate, view])

  const isSsrRange =
    visibleRange.start === range.start && visibleRange.end === range.end

  const { data: posts = initialPosts } = useQuery({
    queryKey: ["posts", orgId, brandId, visibleRange.start, visibleRange.end],
    queryFn: () => fetchPostsInRangeAction(visibleRange),
    initialData: isSsrRange ? initialPosts : undefined,
    placeholderData: (prev) => prev ?? initialPosts,
    staleTime: 30_000,
  })
  /* Real-time stays subscribed to the SSR window - that's the working
   * range where users see live edits. Navigating far-future months still
   * refetches via the useQuery above, but doesn't get onSnapshot updates
   * (which would be wasteful for far-future static content anyway). */
  usePostsRealtime({ orgId, ...range, queryClient, enabled: realtimeEnabled })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  )

  const onPrev = useCallback(() => {
    setVisibleDate((d) => {
      if (view === "week") return subWeeks(d, 1)
      if (view === "day") return subDays(d, 1)
      return subMonths(d, 1)
    })
  }, [view])

  const onNext = useCallback(() => {
    setVisibleDate((d) => {
      if (view === "week") return addWeeks(d, 1)
      if (view === "day") return addDays(d, 1)
      return addMonths(d, 1)
    })
  }, [view])

  // Day view is the "Today" entry point - it always lands on today; arrows walk from there.
  const onViewChange = useCallback((v: ViewT) => {
    setView(v)
    setVisibleDate((d) => {
      if (v === "month") return startOfMonth(d)
      if (v === "day") return new Date()
      return d
    })
  }, [])

  const onToday = useCallback(() => {
    setVisibleDate(new Date())
  }, [])

  const onCellClick = useCallback(
    (date: Date) => {
      openQuickAdd({ initialDate: date, source: "calendar-cell" })
    },
    [openQuickAdd],
  )

  const onPostClick = useCallback(
    (post: WithId<Post>) => {
      openComposerWithPost(post)
    },
    [openComposerWithPost],
  )

  const onDragEnd = useCallback(
    async ({ active, over }: DragEndEvent) => {
      if (!over) return
      const activeData = active.data.current as
        | { type: string; post: WithId<Post> }
        | undefined
      const overData = over.data.current as
        | { type: string; iso: string; date?: Date; hour?: number }
        | undefined
      if (!activeData || activeData.type !== "post") return
      if (!overData) return

      const post = activeData.post

      /* Optimistically patch every cached posts query so the chip
       * jumps to the new cell immediately. We patch by id across all
       * date-range query keys - cheaper than re-fetching, and avoids
       * the flicker where the chip snaps back to origin while the
       * server roundtrips. */
      const patchCache = (patch: DropPatch) => {
        queryClient.setQueriesData<WithId<Post>[]>(
          { queryKey: ["posts", orgId] },
          (curr) =>
            curr?.map((p) =>
              p.id === post.id
                ? {
                    ...p,
                    scheduledDate: patch.scheduledDate ?? p.scheduledDate,
                    scheduledTime:
                      patch.scheduledTime === undefined
                        ? p.scheduledTime
                        : (patch.scheduledTime ?? undefined),
                  }
                : p,
            ),
        )
      }

      const finish = async (patch: DropPatch, successMsg: string) => {
        patchCache(patch)
        const res = await updatePost({ id: post.id, ...patch })
        if (!res.ok) {
          toast.error(res.error ?? "Could not move post")
          queryClient.invalidateQueries({ queryKey: ["posts"] })
          return
        }
        toast.success(successMsg)
        queryClient.invalidateQueries({ queryKey: ["posts"] })
      }

      if (overData.type === "cell") {
        if (post.scheduledDate === overData.iso) return
        await finish(
          { scheduledDate: overData.iso },
          `Moved to ${format(parseISO(overData.iso), "EEE d MMM")}`,
        )
      } else if (overData.type === "timeslot") {
        const newTime = `${String(overData.hour).padStart(2, "0")}:00`
        if (post.scheduledDate === overData.iso && post.scheduledTime === newTime) return
        await finish(
          { scheduledDate: overData.iso, scheduledTime: newTime },
          `Moved to ${format(parseISO(overData.iso), "EEE d MMM")} at ${newTime}`,
        )
      } else if (overData.type === "allday") {
        if (post.scheduledDate === overData.iso && !post.scheduledTime) return
        await finish(
          { scheduledDate: overData.iso, scheduledTime: null },
          `Moved to ${format(parseISO(overData.iso), "EEE d MMM")}`,
        )
      }
    },
    [queryClient, orgId],
  )

  const toggleCategory = useCallback((id: string) => {
    setVisibleCategoryIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const allCategoryIds = useMemo(
    () => new Set(categories.map((c) => c.id)),
    [categories],
  )

  const categoryFilter = allCategoriesVisible ? null : visibleCategoryIds
  const filteredPosts = useMemo(
    () => posts.filter((post) => matchesCalendarFilter(post, filter)),
    [filter, posts],
  )
  const boardView: ViewT = compact ? "list" : view

  const team = useMemo(
    () => users.map((user, index) => asTeamMember(user, index)),
    [users],
  )
  const awarenessEvents = useMemo(() => awarenessDays.map((day) => ({ name: day.name, date: day.date })), [awarenessDays])
  const hideCursors = prefs.showCursors === false

  const extras = (
    <>
      <div className="pb-6">
        <CategoryFilter
          categories={categories}
          visibleIds={visibleCategoryIds}
          onToggle={toggleCategory}
          onAll={() => setVisibleCategoryIds(allCategoryIds)}
          onNone={() => setVisibleCategoryIds(new Set())}
        />
      </div>
      <CampaignTracker campaigns={campaigns} />
      <CalendarAwarenessRail
        awarenessDays={awarenessDays}
        plannedAwarenessIds={plannedAwarenessIds}
        suggestions={suggestions}
      />
    </>
  )

  const openOverview = useCallback(() => {
    setSidebarCollapsed(false)
    try {
      window.localStorage.setItem("calendar:sidebar-collapsed", "0")
    } catch {}
    setRailOpen(true)
  }, [setRailOpen])

  return (
    <LivePresence hidden={hideCursors} weekStart={weekStart} team={team}>
    <CalendarOrb
      period={view === "week" ? weekLabel(weekStart) : format(visibleDate, "MMMM yyyy")}
      posts={filteredPosts}
      campaignCount={campaigns.filter((campaign) => campaign.status === "active").length}
      cadencePerWeek={cadencePerWeek}
      extras={extras}
      team={team}
      workspaceName={workspaceName}
      onOpenPost={onPostClick}
      overviewCollapsed={sidebarCollapsed}
      onCollapseOverview={collapseOverview}
      sheetOpen={railOpen}
      onSheetOpenChange={setRailOpen}
      onOpenOverview={openOverview}
      onMode={setTimblMode}
      weekStart={weekStart}
      filter={filter}
      assistantName={assistantName}
      prefs={prefs}
      onWeek={(week) => {
        const next = parseISO(week)
        if (Number.isNaN(next.getTime())) return
        setVisibleDate((current) =>
          view !== "month" || format(current, "yyyy-MM") !== format(next, "yyyy-MM") ? next : current,
        )
      }}
      awarenessDays={awarenessEvents}
      viewerId={viewerId}
      initialView={initialView}
    >
        <CalendarChrome
          weekStart={weekStart}
          density={compact ? "touch" : "pointer"}
          overviewOpen={!sidebarCollapsed}
          onOverview={timblMode ? undefined : openOverview}
          onCreate={() => openQuickAdd({ source: "calendar-cell" })}
          team={team}
          regionRef={mainRef}
        />
        <main
          ref={mainRef}
          tabIndex={-1}
          className="h-full min-w-0 overflow-y-auto px-4 @3xl/iface:px-8 pt-4 pb-8"
        >
          <DndContext id="calendar-board" sensors={sensors} onDragEnd={onDragEnd}>
            <CalendarToolbar
              visibleDate={visibleDate}
              view={view}
              filter={filter}
              onPrev={onPrev}
              onNext={onNext}
              onToday={onToday}
              onViewChange={onViewChange}
              onFilterChange={setFilter}
            />
            <CursorFrame
              name={users[0]?.name ?? "Teammate"}
              hidden={hideCursors}
              weekStart={weekStart}
            >
            <div data-cal-reveal>
              {boardView === "month" && (
                <CalendarGrid
                  visibleMonth={visibleDate}
                  posts={filteredPosts}
                  categories={categories}
                  users={[]}
                  awarenessDays={awarenessDays}
                  visibleCategoryIds={categoryFilter}
                  onCellClick={onCellClick}
                  onPostClick={onPostClick}
                />
              )}
              {boardView === "week" && (
                <WeekView
                  currentDate={visibleDate}
                  posts={filteredPosts}
                  categories={categories}
                  awarenessDays={awarenessDays}
                  visibleCategoryIds={categoryFilter}
                  onCellClick={onCellClick}
                  onPostClick={onPostClick}
                />
              )}
              {boardView === "day" && (
                <DayView
                  currentDate={visibleDate}
                  posts={filteredPosts}
                  categories={categories}
                  awarenessDays={awarenessDays}
                  visibleCategoryIds={categoryFilter}
                  onCellClick={onCellClick}
                  onPostClick={onPostClick}
                />
              )}
              {boardView === "list" && (
                <ListView
                  posts={filteredPosts}
                  categories={categories}
                  visibleCategoryIds={categoryFilter}
                  onPostClick={onPostClick}
                  rangeStart={visibleRange.start}
                  rangeEnd={visibleRange.end}
                />
              )}
            </div>
            </CursorFrame>
          </DndContext>

          <section
            aria-label="Plan cadence with an AI agent"
            className="mt-6 rounded-lg bg-secondary px-4 py-3 sm:px-5 sm:py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
          >
            <div className="min-w-0">
              <h2 className="text-body-sm font-medium text-foreground">
                Let an agent plan your next two weeks
              </h2>
              <p className="text-caption text-muted-foreground">
                Read your preferred days and times, avoids conflicts, writes pending drafts.
              </p>
            </div>
            <Button
              onClick={() => setPlanOpen(true)}
              className="gap-1.5 self-stretch sm:self-auto whitespace-nowrap"
              size="sm"
            >
              <Sparkles className="size-4" aria-hidden />
              Plan cadence
            </Button>
          </section>
          <PlanCadenceDialog
            open={planOpen}
            onOpenChange={setPlanOpen}
            startDate={visibleDate}
          />
        </main>
    </CalendarOrb>
    </LivePresence>
  )
}

function memberForCursor(cursor: LiveCursor, team: TeamMember[], index: number): TeamMember | null {
  if (!cursor.userId) return null
  const known = team.find((member) => member.id === cursor.userId)
  if (known) return known
  const name = cursor.name.split(" · ")[0] || cursor.name
  return {
    id: cursor.userId,
    organizationId: team[0]?.organizationId ?? "",
    email: "presence@timbl.dev",
    name,
    role: "editor",
    active: true,
    defaultCategories: [],
    initials: initials(name),
    presenceSlot: cursor.slot ?? (((index % 8) + 1) as TeamMember["presenceSlot"]),
  }
}

function CalendarChrome({
  weekStart,
  density,
  overviewOpen,
  onOverview,
  onCreate,
  team,
  regionRef,
}: {
  weekStart: string
  density: "touch" | "pointer"
  overviewOpen: boolean
  onOverview?: () => void
  onCreate: () => void
  team: TeamMember[]
  regionRef: React.RefObject<HTMLElement | null>
}) {
  const { copy, prefs, setPrefs, viewer } = usePrototype()
  const { reduced } = useAgenticMotion()
  const { peers, elsewhere } = useLivePresence()
  const ordered = [...peers].sort((a, b) => b.at - a.at)
  const activePeers = ordered
    .map((cursor, index) => memberForCursor(cursor, team, index))
    .filter((member): member is TeamMember => !!member && member.id !== viewer.id)
  const unique = activePeers.filter((member, index) => activePeers.findIndex((item) => item.id === member.id) === index)
  const { following, follow, stop } = useFollowMode(unique, regionRef, unique.length > 0)
  const followed = unique.find((member) => member.id === following)
  const cursorsShown = showCursorsEffective(prefs, reduced)

  return (
    <>
      <InterfaceTopBar
        weekStart={weekStart}
        density={density}
        overviewOpen={overviewOpen}
        onOverview={onOverview}
        onOpenTimbl={() => window.dispatchEvent(new Event("timbl:open"))}
        onMenu={() => window.dispatchEvent(new Event("nav:open"))}
        onSearch={() => window.dispatchEvent(new Event("palette:open"))}
        onCreate={onCreate}
        notifications={<NotificationsMenu />}
        presence={
          unique.length === 0 && elsewhere.length === 0 ? null : (
            <div className="flex items-center gap-2">
              {elsewhere.map((peer) => {
                const member = team.find((item) => item.id === peer.userId)
                return member ? <PeerChip key={peer.userId} member={member} where={peer.weekStart} /> : null
              })}
              <AvatarStack
                peers={unique.map((member) => ({
                  member,
                  activity: ordered.find((cursor) => cursor.userId === member.id)?.activity === "editing_caption"
                    ? "editing_caption"
                    : "viewing",
                }))}
                cursorsShown={cursorsShown}
                onFollow={follow}
                onToggleCursors={() => setPrefs({ ...prefs, showCursors: !cursorsShown })}
                density={density}
              />
            </div>
          )
        }
      />
      {followed ? (
        <div className="sticky top-2 z-30 mx-auto mt-2 flex items-center gap-1.5">
          <Badge variant="outline" className="gap-1.5 bg-background px-3 py-1 shadow-sm">
            <Eye className="size-3.5 text-brand-accent" aria-hidden />
            <span>{copy.iface.cursors.following(followed.name)}</span>
            <Button type="button" variant="ghost" size="icon-xs" aria-label={copy.iface.cursors.stop} onClick={stop}>
              <X className="size-3" aria-hidden />
            </Button>
          </Badge>
        </div>
      ) : null}
    </>
  )
}

function ListView({
  posts,
  categories,
  visibleCategoryIds,
  onPostClick,
  rangeStart,
  rangeEnd,
}: {
  posts: WithId<Post>[]
  categories: WithId<Category>[]
  visibleCategoryIds: Set<string> | null
  onPostClick: (p: WithId<Post>) => void
  rangeStart: string
  rangeEnd: string
}) {
  const { copy } = usePrototype()
  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  )
  const filtered = useMemo(() => {
    const list = visibleCategoryIds
      ? posts.filter((p) => !p.categoryId || visibleCategoryIds.has(p.categoryId))
      : posts
    return [...list].sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))
  }, [posts, visibleCategoryIds])

  const byDate = new Map<string, WithId<Post>[]>()
  for (const p of filtered) {
    const arr = byDate.get(p.scheduledDate) ?? []
    arr.push(p)
    byDate.set(p.scheduledDate, arr)
  }
  const days: string[] = []
  for (let cursor = parseISO(rangeStart); cursor <= parseISO(rangeEnd); cursor = addDays(cursor, 1)) {
    days.push(format(cursor, "yyyy-MM-dd"))
  }

  return (
    <div className="rounded-lg border border-border bg-background divide-y divide-border">
      {days.map((date) => {
        const group = byDate.get(date) ?? []
        return (
          <section key={date} className="flex gap-6 px-4 py-3">
            <h3 className="w-20 shrink-0 text-xs text-muted-foreground tabular-nums">
              {format(parseISO(date), "EEE d MMM")}
            </h3>
            <div className="flex-1 flex flex-col gap-1.5 min-w-0">
              {group.length === 0 ? (
                <p className="flex min-h-11 items-center text-caption text-muted-foreground">{copy.iface.calendar.nothingPlanned}</p>
              ) : (
                group.map((p) => (
                  <EventListItem
                    key={p.id}
                    post={p}
                    category={categoryById.get(p.categoryId ?? "") ?? null}
                    onOpen={() => onPostClick(p)}
                  />
                ))
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}
