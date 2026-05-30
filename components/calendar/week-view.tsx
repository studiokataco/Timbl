"use client"

import { useDroppable } from "@dnd-kit/core"
import { addDays, format, isSameDay, isToday, parseISO, startOfWeek } from "date-fns"
import { useMemo } from "react"
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

  return (
    // Single scroll container - header and rows share the same width so scrollbar
    // doesn't cause column misalignment. No overflow-hidden on the outer so
    // position:sticky on the header row works correctly.
    <div className="rounded-lg border border-border bg-background" data-cal-reveal>
      <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 14rem)" }}>
        {/* Day headers - sticky inside the scroll container */}
        <div
          className="grid border-b border-border bg-background sticky top-0 z-10"
          style={{ gridTemplateColumns: "4rem repeat(7, 1fr)" }}
        >
          <div className="border-r border-border" />
          {weekDays.map((day) => {
            const today = isToday(day)
            return (
              <div
                key={day.toISOString()}
                className="border-r border-border last:border-r-0 py-2 px-1 text-center"
              >
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {format(day, "EEE")}
                </div>
                <div
                  className={cn(
                    "mx-auto mt-0.5 flex size-7 items-center justify-center rounded-full text-sm tabular-nums",
                    today && "bg-foreground text-background font-semibold",
                    !today && "text-foreground",
                  )}
                >
                  {format(day, "d")}
                </div>
              </div>
            )
          })}
        </div>

        {/* Awareness + all-day strip */}
        {hasAllDay && (
          <div
            className="grid border-b border-border bg-secondary/10"
            style={{ gridTemplateColumns: "4rem repeat(7, 1fr)" }}
          >
            <div className="border-r border-border px-1 py-1 flex items-start justify-end">
              <span className="text-[10px] text-muted-foreground mt-0.5">all-day</span>
            </div>
            {weekDays.map((day) => {
              const iso = format(day, "yyyy-MM-dd")
              const dayAllDay = allDayMap.get(iso) ?? []
              const dayRanges = weekAwarenessRanges.filter(
                (r) => r.start <= day && r.end >= day,
              )
              return (
                <AllDayCell
                  key={iso}
                  iso={iso}
                  date={day}
                  posts={dayAllDay}
                  awarenessRanges={dayRanges}
                  categoryById={categoryById}
                  onCellClick={onCellClick}
                  onPostClick={onPostClick}
                />
              )
            })}
          </div>
        )}

        {/* Hourly rows - same container, same width, no alignment drift */}
        {HOURS.map((hour) => (
          <div
            key={hour}
            className="grid border-b border-border last:border-b-0"
            style={{ gridTemplateColumns: "4rem repeat(7, 1fr)" }}
          >
            <div className="border-r border-border px-2 py-1 text-[10px] text-muted-foreground text-right tabular-nums">
              {hour === 0 ? "" : `${String(hour).padStart(2, "0")}:00`}
            </div>
            {weekDays.map((day) => {
              const iso = format(day, "yyyy-MM-dd")
              const key = `${iso}:${String(hour).padStart(2, "0")}`
              const slotPosts = timedMap.get(key) ?? []
              return (
                <TimeslotCell
                  key={`${iso}-${hour}`}
                  iso={iso}
                  hour={hour}
                  posts={slotPosts}
                  categoryById={categoryById}
                  onCellClick={() => onCellClick(day)}
                  onPostClick={onPostClick}
                />
              )
            })}
          </div>
        ))}
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
        "border-r border-border last:border-r-0 min-h-[32px] px-0.5 py-0.5 flex flex-col gap-0.5 cursor-pointer",
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
            className="rounded-sm px-1.5 py-0.5 text-[10px] leading-tight truncate font-medium"
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
        "border-r border-border last:border-r-0 min-h-[48px] px-0.5 py-0.5 flex flex-col gap-0.5 cursor-pointer",
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
