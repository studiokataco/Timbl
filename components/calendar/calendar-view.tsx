"use client"

import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import interactionPlugin from "@fullcalendar/interaction"
import listPlugin from "@fullcalendar/list"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { format, parseISO } from "date-fns"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { renderToStaticMarkup } from "react-dom/server"
import { updatePost } from "@/lib/actions/posts"
import { usePostsRealtime } from "@/lib/realtime/subscribe-posts"
import type { WithId } from "@/lib/firebase/serialize"
import type { AwarenessDay, Category, Post, User } from "@/lib/schemas"
import type { Suggestion } from "@/lib/queries/suggestions.server"
import { PostChip } from "./post-chip"
import { CalendarAwarenessRail } from "./awareness-rail"
import { TopBar } from "@/components/shared/top-bar"
import { PageHeader } from "@/components/shared/page-header"
import { useGridReveal } from "@/components/shared/motion-cal"
import { useDialogs } from "@/components/shared/dialogs-provider"
import "./calendar-styles.css"

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
 * Default landing surface.
 *  - dayGridWeek (4 weeks visible) on desktop; listWeek on <640px.
 *  - eventClick → composer side-sheet.
 *  - dateClick on an empty cell → quick-add seeded with that date.
 *  - eventDrop → optimistic updatePost server action.
 *
 * Server hands us initialPosts hydrated from Firestore Admin; TanStack Query
 * + Firestore onSnapshot keep the view fresh after that.
 */
export function CalendarView({
  orgId,
  initialPosts,
  categories,
  users,
  awarenessDays,
  plannedAwarenessIds,
  suggestions,
  range,
}: Props) {
  const queryClient = useQueryClient()
  const { openQuickAdd, openComposerWithPost } = useDialogs()
  const calendarRef = useRef<FullCalendar | null>(null)
  const mainRef = useRef<HTMLElement | null>(null)
  useGridReveal(mainRef)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const match = window.matchMedia("(max-width: 640px)")
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMobile(match.matches)
    const onChange = () => setIsMobile(match.matches)
    match.addEventListener("change", onChange)
    return () => match.removeEventListener("change", onChange)
  }, [])

  const { data: posts = initialPosts } = useQuery({
    queryKey: ["posts", orgId, range.start, range.end],
    queryFn: async () => initialPosts, // refresh path: invalidation triggers router refresh
    initialData: initialPosts,
    staleTime: 30_000,
  })

  usePostsRealtime({ orgId, ...range, queryClient })

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  )
  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users])

  const events = useMemo(
    () =>
      posts.map((p) => ({
        id: p.id,
        start: p.scheduledDate,
        allDay: true,
        extendedProps: { post: p },
      })),
    [posts],
  )

  const postsByDate = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of posts) {
      m.set(p.scheduledDate, (m.get(p.scheduledDate) ?? 0) + 1)
    }
    return m
  }, [posts])

  // Hint chip map keyed by the awareness day's exact date only (not ±3 spread).
  // When two awareness days share the same date, keep the higher-importance one.
  const awarenessHintByDate = useMemo(() => {
    const m = new Map<string, WithId<AwarenessDay>>()
    const significant = awarenessDays.filter((a) => a.importance !== "low")
    const rank: Record<string, number> = { high: 2, medium: 1, low: 0 }
    for (const a of significant) {
      const existing = m.get(a.date)
      if (!existing || rank[a.importance] > rank[existing.importance]) {
        m.set(a.date, a)
      }
    }
    return m
  }, [awarenessDays])

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["posts"] })
    // Server data invalidation — page-level revalidatePath('/calendar') does
    // most of the work; this ensures any client-only caches stay fresh too.
    if (typeof window !== "undefined") window.dispatchEvent(new Event("posts:changed"))
  }, [queryClient])

  useEffect(() => {
    const handler = () => {
      // Trigger a router refresh by reloading the current route's data.
      // Next handles this automatically when revalidatePath() runs server-side.
    }
    window.addEventListener("posts:changed", handler)
    return () => window.removeEventListener("posts:changed", handler)
  }, [])

  return (
    <>
      <TopBar />

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <main ref={mainRef} className="flex-1 min-w-0 overflow-y-auto px-6 sm:px-10 py-10 lg:py-14">
          <PageHeader
            title="This month"
            description={`${posts.length} ${posts.length === 1 ? "post" : "posts"} in view`}
            className="mb-8"
          />

          <div data-cal-reveal>
          <FullCalendar
            ref={(el) => {
              calendarRef.current = el
            }}
            plugins={[dayGridPlugin, interactionPlugin, listPlugin]}
            initialView={isMobile ? "listWeek" : "dayGridMonth"}
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: isMobile ? "" : "dayGridMonth,dayGridWeek,listWeek",
            }}
            firstDay={1}
            height="auto"
            events={events}
            editable
            dayMaxEvents={4}
            eventContent={(arg) => {
              const post = arg.event.extendedProps.post as WithId<Post>
              const html = renderToStaticMarkup(
                <PostChip
                  post={post}
                  category={categoryById.get(post.categoryId ?? "") ?? null}
                  assignee={
                    post.assigneeId
                      ? userById.get(post.assigneeId) ?? null
                      : null
                  }
                />,
              )
              return { html }
            }}
            dayCellContent={(arg) => {
              const key = format(arg.date, "yyyy-MM-dd")
              const hasPost = postsByDate.has(key)
              const hint = awarenessHintByDate.get(key)
              const dayNumber = arg.dayNumberText
              if (hasPost || !hint) {
                return { html: `<span class="fc-daygrid-day-number">${dayNumber}</span>` }
              }
              const html = renderToStaticMarkup(
                <>
                  <span className="fc-daygrid-day-number">{dayNumber}</span>
                  <span
                    className="awareness-hint"
                    title={`${hint.name} — ${format(parseISO(hint.date), "d MMM")}`}
                  >
                    💡 {hint.name}
                  </span>
                </>,
              )
              return { html }
            }}
            eventClick={(arg) => {
              const post = arg.event.extendedProps.post as WithId<Post>
              openComposerWithPost(post)
            }}
            dateClick={(arg) => {
              openQuickAdd({ initialDate: arg.date, source: "calendar-cell" })
            }}
            eventDrop={async (arg) => {
              const post = arg.event.extendedProps.post as WithId<Post>
              const newDate = arg.event.start
              if (!newDate) return
              const formatted = format(newDate, "yyyy-MM-dd")
              const res = await updatePost({ id: post.id, scheduledDate: formatted })
              if (!res.ok) {
                arg.revert()
                toast.error(res.error ?? "Could not move post")
              } else {
                toast.success(`Moved to ${format(newDate, "EEE d MMM")}`)
                refresh()
              }
            }}
          />
          </div>
        </main>

        <CalendarAwarenessRail
          awarenessDays={awarenessDays}
          plannedAwarenessIds={plannedAwarenessIds}
          suggestions={suggestions}
        />
      </div>
    </>
  )
}
