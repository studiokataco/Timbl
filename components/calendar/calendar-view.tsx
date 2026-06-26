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
import { PanelRightClose, PanelRightOpen, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { PlanCadenceDialog } from "@/components/agents/plan-cadence-dialog"
import { fetchPostsInRangeAction, updatePost } from "@/lib/actions/posts"
import { usePostsRealtime } from "@/lib/realtime/subscribe-posts"
import type { WithId } from "@/lib/firebase/serialize"
import type { AwarenessDay, Category, Post, User } from "@/lib/schemas"
import type { Suggestion } from "@/lib/queries/suggestions.server"
import { useGridReveal } from "@/components/shared/motion-cal"
import { useDialogs } from "@/components/shared/dialogs-provider"
import { CalendarToolbar, type CalendarView as ViewT } from "./calendar-toolbar"
import { CalendarGrid } from "./calendar-grid"
import { CategoryFilter } from "./category-filter"
import { CalendarAwarenessRail } from "./awareness-rail"
import { CampaignTracker, type CampaignRow } from "./campaign-tracker"
import { WeekView } from "./week-view"
import { DayView } from "./day-view"

type Props = {
  orgId: string
  initialPosts: WithId<Post>[]
  categories: WithId<Category>[]
  users: WithId<User>[]
  awarenessDays: WithId<AwarenessDay>[]
  plannedAwarenessIds: string[]
  suggestions: Suggestion[]
  campaigns: CampaignRow[]
  range: { start: string; end: string }
  realtimeEnabled?: boolean
}

export function CalendarView({
  orgId,
  initialPosts,
  categories,
  awarenessDays,
  plannedAwarenessIds,
  suggestions,
  campaigns,
  range,
  realtimeEnabled = false,
}: Props) {
  const queryClient = useQueryClient()
  const { openQuickAdd, openComposerWithPost } = useDialogs()
  const mainRef = useRef<HTMLElement | null>(null)
  useGridReveal(mainRef)

  const [visibleDate, setVisibleDate] = useState<Date>(() => startOfMonth(new Date()))
  const [view, setView] = useState<ViewT>("month")
  const [planOpen, setPlanOpen] = useState(false)
  const [railOpen, setRailOpen] = useState(false)
  const [visibleCategoryIds, setVisibleCategoryIds] = useState<Set<string>>(
    () => new Set(categories.map((c) => c.id)),
  )
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
  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem("calendar:sidebar-collapsed", next ? "1" : "0")
      } catch {}
      return next
    })
  }, [])

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
    queryKey: ["posts", orgId, visibleRange.start, visibleRange.end],
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
      const patchCache = (
        patch: Partial<Pick<Post, "scheduledDate" | "scheduledTime">>,
      ) => {
        queryClient.setQueriesData<WithId<Post>[]>(
          { queryKey: ["posts", orgId] },
          (curr) =>
            curr?.map((p) => (p.id === post.id ? { ...p, ...patch } : p)),
        )
      }

      const finish = async (
        patch: Partial<Pick<Post, "scheduledDate" | "scheduledTime">>,
        successMsg: string,
      ) => {
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
          { scheduledDate: overData.iso, scheduledTime: undefined },
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

  const railContent = (
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

  return (
    <>
      <div className="flex-1 flex min-h-0 overflow-hidden -mb-[var(--ask-ai-clearance)]">
        <main
          ref={mainRef}
          className="flex-1 min-w-0 overflow-y-auto px-6 sm:px-10 pt-8 pb-[var(--ask-ai-clearance)]"
        >
          <DndContext id="calendar-board" sensors={sensors} onDragEnd={onDragEnd}>
            <CalendarToolbar
              visibleDate={visibleDate}
              view={view}
              onPrev={onPrev}
              onNext={onNext}
              onViewChange={onViewChange}
              onOpenFilters={() => setRailOpen(true)}
            />
            <div data-cal-reveal>
              {view === "month" && (
                <CalendarGrid
                  visibleMonth={visibleDate}
                  posts={posts}
                  categories={categories}
                  users={[]}
                  awarenessDays={awarenessDays}
                  visibleCategoryIds={categoryFilter}
                  onCellClick={onCellClick}
                  onPostClick={onPostClick}
                />
              )}
              {view === "week" && (
                <WeekView
                  currentDate={visibleDate}
                  posts={posts}
                  categories={categories}
                  awarenessDays={awarenessDays}
                  visibleCategoryIds={categoryFilter}
                  onCellClick={onCellClick}
                  onPostClick={onPostClick}
                />
              )}
              {view === "day" && (
                <DayView
                  currentDate={visibleDate}
                  posts={posts}
                  categories={categories}
                  awarenessDays={awarenessDays}
                  visibleCategoryIds={categoryFilter}
                  onCellClick={onCellClick}
                  onPostClick={onPostClick}
                />
              )}
              {view === "list" && (
                <ListView
                  posts={posts}
                  categories={categories}
                  visibleCategoryIds={categoryFilter}
                  onPostClick={onPostClick}
                />
              )}
            </div>
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

        <aside
          aria-label="Calendar sidebar"
          className={`hidden lg:flex flex-col shrink-0 border-l border-border bg-secondary/15 overflow-hidden transition-[width] duration-200 ease-out ${
            sidebarCollapsed ? "w-10" : "w-80"
          }`}
        >
          {sidebarCollapsed ? (
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label="Expand sidebar"
              aria-expanded={false}
              aria-controls="calendar-sidebar-content"
              className="size-10 grid place-items-center text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors"
            >
              <PanelRightOpen className="size-4" aria-hidden />
            </button>
          ) : (
            <div
              id="calendar-sidebar-content"
              className="flex flex-col flex-1 min-h-0 overflow-y-auto px-6 pb-[var(--ask-ai-clearance)]"
            >
              <div className="pt-4 pb-2 flex justify-end -mr-2">
                <button
                  type="button"
                  onClick={toggleSidebar}
                  aria-label="Collapse sidebar"
                  aria-expanded={true}
                  aria-controls="calendar-sidebar-content"
                  className="size-8 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
                >
                  <PanelRightClose className="size-4" aria-hidden />
                </button>
              </div>
              {railContent}
            </div>
          )}
        </aside>
      </div>

      <Sheet open={railOpen} onOpenChange={setRailOpen}>
        <SheetContent side="right" className="w-80 max-w-[85vw] lg:hidden p-0">
          <SheetHeader className="border-b border-border">
            <SheetTitle>Filters & insights</SheetTitle>
          </SheetHeader>
          <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
            {railContent}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

function ListView({
  posts,
  categories,
  visibleCategoryIds,
  onPostClick,
}: {
  posts: WithId<Post>[]
  categories: WithId<Category>[]
  visibleCategoryIds: Set<string> | null
  onPostClick: (p: WithId<Post>) => void
}) {
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

  if (filtered.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-background p-12 text-center text-sm text-muted-foreground">
        No posts in this view.
      </div>
    )
  }

  const byDate = new Map<string, WithId<Post>[]>()
  for (const p of filtered) {
    const arr = byDate.get(p.scheduledDate) ?? []
    arr.push(p)
    byDate.set(p.scheduledDate, arr)
  }

  return (
    <div className="rounded-lg border border-border bg-background divide-y divide-border">
      {Array.from(byDate.entries()).map(([date, group]) => (
        <div key={date} className="flex gap-6 px-4 py-3">
          <div className="w-20 shrink-0 text-xs text-muted-foreground tabular-nums">
            {format(parseISO(date), "EEE d MMM")}
          </div>
          <div className="flex-1 flex flex-col gap-1.5 min-w-0">
            {group.map((p) => {
              const cat = categoryById.get(p.categoryId ?? "")
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onPostClick(p)}
                  className="flex items-center gap-2 text-left text-sm hover:text-foreground/80"
                >
                  {cat && (
                    <span
                      aria-hidden
                      className="size-2 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                  )}
                  <span className="truncate">{p.brief ?? "Untitled"}</span>
                  {cat && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      {cat.name}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
