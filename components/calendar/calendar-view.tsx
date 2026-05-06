"use client"

import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import interactionPlugin from "@fullcalendar/interaction"
import listPlugin from "@fullcalendar/list"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { differenceInDays, format, parseISO } from "date-fns"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { renderToStaticMarkup } from "react-dom/server"
import { fetchPostAction, updatePost } from "@/lib/actions/posts"
import { usePostsRealtime } from "@/lib/realtime/subscribe-posts"
import type { WithId } from "@/lib/firebase/serialize"
import type { AwarenessDay, Campaign, Category, Cta, Post, User } from "@/lib/schemas"
import type { Suggestion } from "@/lib/queries/suggestions.server"
import { PostChip } from "./post-chip"
import { CalendarAwarenessRail } from "./awareness-rail"
import { TopBar } from "@/components/shared/top-bar"
import { QuickAddDialog } from "@/components/quick-add/quick-add-dialog"
import { PostComposerSheet } from "@/components/composer/post-composer-sheet"
import "./calendar-styles.css"

type Props = {
  orgId: string
  initialPosts: WithId<Post>[]
  categories: WithId<Category>[]
  ctas: WithId<Cta>[]
  users: WithId<User>[]
  campaigns: WithId<Campaign>[]
  hashtagSuggestions: string[]
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
  ctas,
  users,
  campaigns,
  hashtagSuggestions,
  awarenessDays,
  plannedAwarenessIds,
  suggestions,
  range,
}: Props) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const calendarRef = useRef<FullCalendar | null>(null)
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [quickAddDate, setQuickAddDate] = useState<Date | null>(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const [composerPost, setComposerPost] = useState<WithId<Post> | null>(null)
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

  // For each calendar day, find the closest awareness day within ±3 days.
  // Used to render a hint chip on empty cells. Key = YYYY-MM-DD; value = the
  // single closest awareness day (already filtered to importance >= medium so
  // we don't surface low-importance days as nudges).
  const awarenessHintByDate = useMemo(() => {
    const m = new Map<string, WithId<AwarenessDay>>()
    const significant = awarenessDays.filter((a) => a.importance !== "low")
    for (const a of significant) {
      const center = parseISO(a.date)
      for (let offset = -3; offset <= 3; offset++) {
        const d = new Date(center)
        d.setDate(center.getDate() + offset)
        const key = format(d, "yyyy-MM-dd")
        const prev = m.get(key)
        if (
          !prev ||
          Math.abs(differenceInDays(parseISO(a.date), d)) <
            Math.abs(differenceInDays(parseISO(prev.date), d))
        ) {
          m.set(key, a)
        }
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

  const openComposerById = useCallback(async (id: string) => {
    const post = await fetchPostAction(id)
    if (post) {
      setComposerPost(post)
      setComposerOpen(true)
    }
  }, [])

  // Honour palette deep-links: /calendar?quickAdd=1 opens the dialog;
  // /calendar?postId=... opens the composer for that post. Strip the param
  // after consumption so refreshes don't re-trigger the action.
  useEffect(() => {
    const quickAdd = searchParams.get("quickAdd")
    const postId = searchParams.get("postId")
    if (!quickAdd && !postId) return
    if (quickAdd) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuickAddDate(null)
      setQuickAddOpen(true)
    }
    if (postId) {
      void openComposerById(postId)
    }
    const next = new URLSearchParams(searchParams.toString())
    next.delete("quickAdd")
    next.delete("postId")
    router.replace(`/calendar${next.toString() ? `?${next}` : ""}`, { scroll: false })
  }, [searchParams, router, openComposerById])

  return (
    <>
      <TopBar onQuickAdd={() => {
        setQuickAddDate(null)
        setQuickAddOpen(true)
      }} />

      <div className="flex-1 flex min-h-0">
        <main className="flex-1 min-w-0 px-4 sm:px-6 py-4">
          <div className="mb-3 flex items-center justify-between">
            <h1 className="text-lg font-medium">This month</h1>
            <p className="text-xs text-muted-foreground">
              {posts.length} {posts.length === 1 ? "post" : "posts"} in view
            </p>
          </div>

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
              setComposerPost(post)
              setComposerOpen(true)
            }}
            dateClick={(arg) => {
              setQuickAddDate(arg.date)
              setQuickAddOpen(true)
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
        </main>

        <CalendarAwarenessRail
          awarenessDays={awarenessDays}
          plannedAwarenessIds={plannedAwarenessIds}
          suggestions={suggestions}
        />
      </div>

      <QuickAddDialog
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        initialDate={quickAddDate}
        categories={categories}
        ctas={ctas}
        users={users}
        onCreated={refresh}
        onCreateAndOpenComposer={(id) => {
          void openComposerById(id)
        }}
      />

      <PostComposerSheet
        open={composerOpen}
        onOpenChange={setComposerOpen}
        post={composerPost}
        categories={categories}
        campaigns={campaigns}
        ctas={ctas}
        users={users}
        hashtagSuggestions={hashtagSuggestions}
        onChanged={refresh}
      />
    </>
  )
}
