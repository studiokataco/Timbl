"use client"

import { useDroppable } from "@dnd-kit/core"
import { format, isToday } from "date-fns"
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

  return (
    <div className="rounded-lg border border-border bg-background" data-cal-reveal>
      <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 14rem)" }}>
        {/* Day header - sticky inside the scroll container */}
        <div
          className="grid border-b border-border bg-background sticky top-0 z-10"
          style={{ gridTemplateColumns: "4rem 1fr" }}
        >
          <div className="border-r border-border" />
          <div className="py-3 px-4 text-center">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {format(currentDate, "EEEE")}
            </div>
            <div
              className={cn(
                "mx-auto mt-0.5 flex size-8 items-center justify-center rounded-full text-base tabular-nums",
                today && "bg-foreground text-background font-semibold",
                !today && "text-foreground",
              )}
            >
              {format(currentDate, "d")}
            </div>
          </div>
        </div>

        {/* All-day strip */}
        {hasAllDay && (
          <div
            className="grid border-b border-border bg-secondary/10"
            style={{ gridTemplateColumns: "4rem 1fr" }}
          >
            <div className="border-r border-border px-1 py-1 flex items-start justify-end">
              <span className="text-[10px] text-muted-foreground mt-0.5">all-day</span>
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
          </div>
        )}

        {/* Hourly rows - same container as header, no drift */}
        {HOURS.map((hour) => {
          const slotPosts = timedMap.get(hour) ?? []
          return (
            <div
              key={hour}
              className="grid border-b border-border last:border-b-0"
              style={{ gridTemplateColumns: "4rem 1fr" }}
            >
              <div className="border-r border-border px-2 py-1 text-[10px] text-muted-foreground text-right tabular-nums">
                {hour === 0 ? "" : `${String(hour).padStart(2, "0")}:00`}
              </div>
              <TimeslotCell
                iso={iso}
                hour={hour}
                posts={slotPosts}
                categoryById={categoryById}
                onCellClick={() => onCellClick(currentDate)}
                onPostClick={onPostClick}
              />
            </div>
          )
        })}
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
        "min-h-[36px] px-2 py-1 flex flex-col gap-0.5 cursor-pointer",
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
        "min-h-[52px] px-2 py-0.5 flex flex-col gap-0.5 cursor-pointer",
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
