"use client"

import { useDroppable } from "@dnd-kit/core"
import { format, isToday } from "date-fns"
import { Fragment, useMemo } from "react"
import type { WithId } from "@/lib/firebase/serialize"
import type { AwarenessDay, Category, Post } from "@/lib/schemas"
import { groupAwarenessRanges } from "@/lib/calendar/awareness-grouping"
import { categoryPillColors } from "@/components/calendar/color"
import { cn } from "@/lib/utils"
import { EventPill } from "./event-pill"

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const IMPORTANCE_COLOR: Record<string, string> = {
  high: "#fb923c",
  medium: "#a855f7",
  low: "#94a3b8",
}

type Props = {
  currentDate: Date
  posts: WithId<Post>[]
  categories: WithId<Category>[]
  awarenessDays: WithId<AwarenessDay>[]
  visibleCategoryIds: Set<string> | null
  onCellClick: (date: Date) => void
  onPostClick: (post: WithId<Post>) => void
}

export function DayView({
  currentDate,
  posts,
  categories,
  awarenessDays,
  visibleCategoryIds,
  onCellClick,
  onPostClick,
}: Props) {
  const iso = format(currentDate, "yyyy-MM-dd")
  const today = isToday(currentDate)

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  )

  const filteredPosts = useMemo(() => {
    const dayPosts = posts.filter((p) => p.scheduledDate === iso)
    if (!visibleCategoryIds) return dayPosts
    return dayPosts.filter(
      (p) => !p.categoryId || visibleCategoryIds.has(p.categoryId),
    )
  }, [posts, iso, visibleCategoryIds])

  const timedMap = useMemo(() => {
    const m = new Map<number, WithId<Post>[]>()
    for (const p of filteredPosts) {
      if (!p.scheduledTime) continue
      const hour = parseInt(p.scheduledTime.slice(0, 2), 10)
      const arr = m.get(hour) ?? []
      arr.push(p)
      m.set(hour, arr)
    }
    return m
  }, [filteredPosts])

  const allDayPosts = useMemo(
    () => filteredPosts.filter((p) => !p.scheduledTime),
    [filteredPosts],
  )

  const dayAwarenessRanges = useMemo(() => {
    const all = groupAwarenessRanges(awarenessDays)
    return all.filter(
      (r) => r.start <= currentDate && r.end >= currentDate,
    )
  }, [awarenessDays, currentDate])

  const hasAllDay = allDayPosts.length > 0 || dayAwarenessRanges.length > 0

  const gutter = "border-r border-border"

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-background" data-cal-reveal>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid" style={{ gridTemplateColumns: "4rem minmax(0, 1fr)" }}>
          <div className={cn(gutter, "sticky top-0 z-10 border-b border-border bg-background")} />
          <div className="sticky top-0 z-10 border-b border-border bg-background px-4 py-2 text-center">
            <div className="text-caption text-muted-foreground">{format(currentDate, "EEEE")}</div>
            <div
              className={cn(
                "mx-auto mt-1 flex size-8 items-center justify-center rounded-full text-body-sm tabular-nums",
                today && "bg-primary font-medium text-primary-foreground",
                !today && "text-foreground",
              )}
            >
              {format(currentDate, "d")}
            </div>
          </div>
          {hasAllDay ? (
            <>
              <div className={cn(gutter, "flex items-center justify-end bg-secondary/10 px-2 py-2")}>
                <span className="text-caption text-muted-foreground">All day</span>
              </div>
              <AllDayCell
                iso={iso}
                date={currentDate}
                posts={allDayPosts}
                awarenessRanges={dayAwarenessRanges}
                categoryById={categoryById}
                onCellClick={onCellClick}
                onPostClick={onPostClick}
              />
            </>
          ) : null}
          {HOURS.map((hour) => (
            <Fragment key={hour}>
              <div className={cn(gutter, "min-h-16 border-b border-border px-2 py-2 text-right text-caption text-muted-foreground tabular-nums @3xl/iface:min-h-20")}>
                {`${String(hour).padStart(2, "0")}:00`}
              </div>
              <TimeslotCell
                iso={iso}
                hour={hour}
                posts={timedMap.get(hour) ?? []}
                categoryById={categoryById}
                onCellClick={() => onCellClick(currentDate)}
                onPostClick={onPostClick}
              />
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  )
}

function AllDayCell({
  iso,
  date,
  posts,
  awarenessRanges,
  categoryById,
  onCellClick,
  onPostClick,
}: {
  iso: string
  date: Date
  posts: WithId<Post>[]
  awarenessRanges: ReturnType<typeof groupAwarenessRanges>
  categoryById: Map<string, WithId<Category>>
  onCellClick: (date: Date) => void
  onPostClick: (post: WithId<Post>) => void
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `allday:${iso}`,
    data: { type: "allday", iso },
  })

  return (
    <div
      ref={setNodeRef}
      onClick={() => onCellClick(date)}
      className={cn(
        "flex min-h-12 cursor-pointer flex-col gap-1 border-b border-border bg-secondary/10 px-2 py-2",
        "transition-colors hover:bg-secondary/30",
        isOver && "bg-secondary/60",
      )}
    >
      {awarenessRanges.map((r) => {
        const color = IMPORTANCE_COLOR[r.importance] ?? "#94a3b8"
        const pillStyle = categoryPillColors(color)
        return (
          <div
            key={r.id}
            className="h-6 truncate rounded-md px-2 text-caption leading-6"
            style={{ ...pillStyle, borderLeft: `2px solid ${color}` }}
            title={r.name}
          >
            {r.name}
          </div>
        )
      })}
      {posts.map((p) => (
        <EventPill
          key={p.id}
          post={p}
          category={categoryById.get(p.categoryId ?? "") ?? null}
          onClick={(e) => {
            e.stopPropagation()
            onPostClick(p)
          }}
        />
      ))}
    </div>
  )
}

function TimeslotCell({
  iso,
  hour,
  posts,
  categoryById,
  onCellClick,
  onPostClick,
}: {
  iso: string
  hour: number
  posts: WithId<Post>[]
  categoryById: Map<string, WithId<Category>>
  onCellClick: () => void
  onPostClick: (post: WithId<Post>) => void
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `timeslot:${iso}:${hour}`,
    data: { type: "timeslot", iso, hour },
  })

  return (
    <div
      ref={setNodeRef}
      onClick={onCellClick}
      className={cn(
        "flex min-h-16 cursor-pointer flex-col gap-1 border-b border-border px-3 py-2 @3xl/iface:min-h-20",
        "transition-colors hover:bg-secondary/20",
        isOver && "bg-secondary/50",
      )}
    >
      {posts.map((p) => (
        <EventPill
          key={p.id}
          post={p}
          category={categoryById.get(p.categoryId ?? "") ?? null}
          onClick={(e) => {
            e.stopPropagation()
            onPostClick(p)
          }}
        />
      ))}
    </div>
  )
}
