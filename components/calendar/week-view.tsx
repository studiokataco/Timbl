"use client"

import { useDroppable } from "@dnd-kit/core"
import { addDays, format, isToday, startOfWeek } from "date-fns"
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

export function WeekView({
  currentDate,
  posts,
  categories,
  awarenessDays,
  visibleCategoryIds,
  onCellClick,
  onPostClick,
}: Props) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  )

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  )

  const filteredPosts = useMemo(() => {
    if (!visibleCategoryIds) return posts
    return posts.filter(
      (p) => !p.categoryId || visibleCategoryIds.has(p.categoryId),
    )
  }, [posts, visibleCategoryIds])

  // Map: "yyyy-MM-dd:HH" → Post[]  (timed posts)
  // Map: "yyyy-MM-dd:allday" → Post[]  (untimed posts)
  const { timedMap, allDayMap } = useMemo(() => {
    const timed = new Map<string, WithId<Post>[]>()
    const allDay = new Map<string, WithId<Post>[]>()
    for (const p of filteredPosts) {
      if (p.scheduledTime) {
        const hour = p.scheduledTime.slice(0, 2)
        const key = `${p.scheduledDate}:${hour}`
        const arr = timed.get(key) ?? []
        arr.push(p)
        timed.set(key, arr)
      } else {
        const key = p.scheduledDate
        const arr = allDay.get(key) ?? []
        arr.push(p)
        allDay.set(key, arr)
      }
    }
    return { timedMap: timed, allDayMap: allDay }
  }, [filteredPosts])

  // Awareness ranges that intersect this week
  const weekAwarenessRanges = useMemo(() => {
    const all = groupAwarenessRanges(awarenessDays)
    return all.filter(
      (r) => r.end >= weekStart && r.start <= weekDays[6],
    )
  }, [awarenessDays, weekStart, weekDays])

  const hasAllDay =
    weekAwarenessRanges.length > 0 ||
    weekDays.some((d) => allDayMap.has(format(d, "yyyy-MM-dd")))

  const sticky = "sticky top-0 z-10 border-b border-border bg-background"
  const gutter = "border-r border-border"

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-background" data-cal-reveal>
      <div className="min-h-0 flex-1 overflow-auto">
        <div
          className="grid min-w-0"
          style={{ gridTemplateColumns: "4rem repeat(7, minmax(0, 1fr))" }}
        >
          <div className={cn(sticky, gutter)} />
          {weekDays.map((day) => {
            const today = isToday(day)
            return (
              <div key={day.toISOString()} className={cn(sticky, "border-r border-border px-2 py-2 text-center last:border-r-0")}>
                <div className="text-caption text-muted-foreground">{format(day, "EEE")}</div>
                <div
                  className={cn(
                    "mx-auto mt-1 flex size-8 items-center justify-center rounded-full text-body-sm tabular-nums",
                    today && "bg-primary font-medium text-primary-foreground",
                    !today && "text-foreground",
                  )}
                >
                  {format(day, "d")}
                </div>
              </div>
            )
          })}

          {hasAllDay ? (
            <>
              <div className={cn(gutter, "flex items-center justify-end bg-secondary/10 px-2 py-2")}>
                <span className="text-caption text-muted-foreground">All day</span>
              </div>
              {weekDays.map((day) => {
                const iso = format(day, "yyyy-MM-dd")
                return (
                  <AllDayCell
                    key={iso}
                    iso={iso}
                    date={day}
                    posts={allDayMap.get(iso) ?? []}
                    awarenessRanges={weekAwarenessRanges.filter((range) => range.start <= day && range.end >= day)}
                    categoryById={categoryById}
                    onCellClick={onCellClick}
                    onPostClick={onPostClick}
                  />
                )
              })}
            </>
          ) : null}

          {HOURS.map((hour) => (
            <Fragment key={hour}>
              <div className={cn(gutter, "min-h-16 border-b border-border px-2 py-2 text-right text-caption text-muted-foreground tabular-nums @3xl/iface:min-h-20")}>
                {`${String(hour).padStart(2, "0")}:00`}
              </div>
              {weekDays.map((day) => {
                const iso = format(day, "yyyy-MM-dd")
                const key = `${iso}:${String(hour).padStart(2, "0")}`
                return (
                  <TimeslotCell
                    key={`${iso}-${hour}`}
                    iso={iso}
                    hour={hour}
                    posts={timedMap.get(key) ?? []}
                    categoryById={categoryById}
                    onCellClick={() => onCellClick(day)}
                    onPostClick={onPostClick}
                  />
                )
              })}
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
        "flex min-h-12 cursor-pointer flex-col gap-1 border-r border-b border-border bg-secondary/10 px-2 py-2 last:border-r-0",
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
        "flex min-h-16 cursor-pointer flex-col gap-1 border-r border-b border-border px-2 py-2 last:border-r-0 @3xl/iface:min-h-20",
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
