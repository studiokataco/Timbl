"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import { addMonths, format, parseISO, startOfMonth, subMonths } from "date-fns"
import { useCallback, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { updatePost } from "@/lib/actions/posts"
import { usePostsRealtime } from "@/lib/realtime/subscribe-posts"
import type { WithId } from "@/lib/firebase/serialize"
import type { AwarenessDay, Category, Post, User } from "@/lib/schemas"
import type { Suggestion } from "@/lib/queries/suggestions.server"
import { TopBar } from "@/components/shared/top-bar"
import { useGridReveal } from "@/components/shared/motion-cal"
import { useDialogs } from "@/components/shared/dialogs-provider"
import { CalendarToolbar, type CalendarView as ViewT } from "./calendar-toolbar"
import { CalendarGrid } from "./calendar-grid"
import { MiniCalendar } from "./mini-calendar"
import { CategoryFilter } from "./category-filter"
import { CalendarAwarenessRail } from "./awareness-rail"

type Props = {
  orgId: string
  initialPosts: WithId<Post>[]
  categories: WithId<Category>[]
  users: WithId<User>[]
  awarenessDays: WithId<AwarenessDay>[]
  plannedAwarenessIds: string[]
  suggestions: Suggestion[]
  range: { start: string; end: string }
}

/*
 * Custom calendar surface (replaces the previous FullCalendar setup).
 * Visual language follows the 21st.dev event-manager + shadcnuikit calendar
 * references — clean grid, pastel pills, today as a dark filled circle.
 *
 * Multi-day awareness events render as continuous bars per week row via
 * lib/calendar/awareness-grouping.ts; single-day posts render as event
 * pills inside their cell. Drag a pill to another cell → updatePost.
 */
export function CalendarView({
  orgId,
  initialPosts,
  categories,
  awarenessDays,
  plannedAwarenessIds,
  suggestions,
  range,
}: Props) {
  const queryClient = useQueryClient()
  const { openQuickAdd, openComposerWithPost } = useDialogs()
  const mainRef = useRef<HTMLElement | null>(null)
  useGridReveal(mainRef)

  const [visibleMonth, setVisibleMonth] = useState<Date>(() => startOfMonth(new Date()))
  const [view, setView] = useState<ViewT>("month")
  const [visibleCategoryIds, setVisibleCategoryIds] = useState<Set<string>>(
    () => new Set(categories.map((c) => c.id)),
  )
  const allCategoriesVisible = visibleCategoryIds.size === categories.length

  const { data: posts = initialPosts } = useQuery({
    queryKey: ["posts", orgId, range.start, range.end],
    queryFn: async () => initialPosts,
    initialData: initialPosts,
    staleTime: 30_000,
  })
  usePostsRealtime({ orgId, ...range, queryClient })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  )

  const onPrev = useCallback(() => setVisibleMonth((d) => subMonths(d, 1)), [])
  const onNext = useCallback(() => setVisibleMonth((d) => addMonths(d, 1)), [])
  const onToday = useCallback(() => setVisibleMonth(startOfMonth(new Date())), [])

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
        | { type: string; iso: string; date: Date }
        | undefined
      if (!activeData || activeData.type !== "post") return
      if (!overData || overData.type !== "cell") return
      const post = activeData.post
      if (post.scheduledDate === overData.iso) return

      const res = await updatePost({
        id: post.id,
        scheduledDate: overData.iso,
      })
      if (!res.ok) {
        toast.error(res.error ?? "Could not move post")
      } else {
        toast.success(`Moved to ${format(overData.date, "EEE d MMM")}`)
        queryClient.invalidateQueries({ queryKey: ["posts"] })
      }
    },
    [queryClient],
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

  return (
    <>
      <TopBar />

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <main
          ref={mainRef}
          className="flex-1 min-w-0 overflow-y-auto px-6 sm:px-10 py-8"
        >
          <DndContext sensors={sensors} onDragEnd={onDragEnd}>
            <CalendarToolbar
              visibleMonth={visibleMonth}
              view={view}
              onPrev={onPrev}
              onNext={onNext}
              onToday={onToday}
              onViewChange={setView}
            />
            <div data-cal-reveal>
              {view === "month" ? (
                <CalendarGrid
                  visibleMonth={visibleMonth}
                  posts={posts}
                  categories={categories}
                  users={[]}
                  awarenessDays={awarenessDays}
                  visibleCategoryIds={
                    allCategoriesVisible ? null : visibleCategoryIds
                  }
                  onCellClick={onCellClick}
                  onPostClick={onPostClick}
                />
              ) : (
                <ListView
                  posts={posts}
                  categories={categories}
                  visibleCategoryIds={
                    allCategoriesVisible ? null : visibleCategoryIds
                  }
                  onPostClick={onPostClick}
                />
              )}
            </div>
          </DndContext>
        </main>

        <aside className="hidden lg:flex flex-col w-72 shrink-0 border-l border-border bg-secondary/15 p-6 gap-6 overflow-y-auto">
          <MiniCalendar
            visibleMonth={visibleMonth}
            selectedDate={null}
            onSelectDate={(d) => setVisibleMonth(startOfMonth(d))}
            onPrev={onPrev}
            onNext={onNext}
          />
          <CategoryFilter
            categories={categories}
            visibleIds={visibleCategoryIds}
            onToggle={toggleCategory}
            onAll={() => setVisibleCategoryIds(allCategoryIds)}
            onNone={() => setVisibleCategoryIds(new Set())}
          />
          <CalendarAwarenessRail
            awarenessDays={awarenessDays}
            plannedAwarenessIds={plannedAwarenessIds}
            suggestions={suggestions}
          />
        </aside>
      </div>
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

  // Group by date
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
