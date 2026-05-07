"use client"

import { useDroppable } from "@dnd-kit/core"
import { differenceInCalendarDays, format } from "date-fns"
import { useMemo } from "react"
import type { WithId } from "@/lib/firebase/serialize"
import type { Category, Post, User } from "@/lib/schemas"
import {
  buildMonthGrid,
  type CalendarCell as CalendarCellT,
  type CalendarWeek,
} from "@/lib/calendar/grid-layout"
import {
  groupAwarenessRanges,
  type AwarenessRange,
} from "@/lib/calendar/awareness-grouping"
import type { AwarenessDay } from "@/lib/schemas"
import { cn } from "@/lib/utils"
import { EventBar } from "./event-bar"
import { EventPill } from "./event-pill"

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const MAX_VISIBLE_PILLS = 3

type Props = {
  visibleMonth: Date
  posts: WithId<Post>[]
  categories: WithId<Category>[]
  users: WithId<User>[]
  awarenessDays: WithId<AwarenessDay>[]
  visibleCategoryIds: Set<string> | null // null = all visible
  onCellClick: (date: Date) => void
  onPostClick: (post: WithId<Post>) => void
}

export function CalendarGrid({
  visibleMonth,
  posts,
  categories,
  awarenessDays,
  visibleCategoryIds,
  onCellClick,
  onPostClick,
}: Props) {
  const weeks = useMemo(() => buildMonthGrid(visibleMonth), [visibleMonth])
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

  const postsByDate = useMemo(() => {
    const m = new Map<string, WithId<Post>[]>()
    for (const p of filteredPosts) {
      const arr = m.get(p.scheduledDate) ?? []
      arr.push(p)
      m.set(p.scheduledDate, arr)
    }
    // stable sort by time, then brief
    for (const arr of m.values()) {
      arr.sort((a, b) =>
        (a.scheduledTime ?? "").localeCompare(b.scheduledTime ?? "") ||
        (a.brief ?? "").localeCompare(b.brief ?? ""),
      )
    }
    return m
  }, [filteredPosts])

  const ranges = useMemo(() => groupAwarenessRanges(awarenessDays), [awarenessDays])

  return (
    <div className="rounded-lg border border-border bg-background overflow-hidden">
      {/* Day name header */}
      <div className="grid grid-cols-7 border-b border-border bg-secondary/30">
        {DAY_NAMES.map((n) => (
          <div
            key={n}
            className="px-2 py-2 text-caption uppercase tracking-wider text-muted-foreground text-center"
          >
            {n}
          </div>
        ))}
      </div>

      <div className="flex flex-col">
        {weeks.map((week) => (
          <WeekRow
            key={week.start.toISOString()}
            week={week}
            ranges={ranges}
            postsByDate={postsByDate}
            categoryById={categoryById}
            onCellClick={onCellClick}
            onPostClick={onPostClick}
          />
        ))}
      </div>
    </div>
  )
}

function WeekRow({
  week,
  ranges,
  postsByDate,
  categoryById,
  onCellClick,
  onPostClick,
}: {
  week: CalendarWeek
  ranges: AwarenessRange[]
  postsByDate: Map<string, WithId<Post>[]>
  categoryById: Map<string, WithId<Category>>
  onCellClick: (date: Date) => void
  onPostClick: (post: WithId<Post>) => void
}) {
  const weekStart = week.cells[0].date
  const weekEnd = week.cells[6].date

  // Compute multi-day bars that fall in this week row.
  const barsInWeek = useMemo(() => {
    const intersecting = ranges.filter(
      (r) => r.end >= weekStart && r.start <= weekEnd,
    )
    return intersecting.map((r) => {
      const segStart = r.start < weekStart ? weekStart : r.start
      const segEnd = r.end > weekEnd ? weekEnd : r.end
      return {
        range: r,
        startCol: differenceInCalendarDays(segStart, weekStart),
        endCol: differenceInCalendarDays(segEnd, weekStart),
        continuesLeft: r.start < weekStart,
        continuesRight: r.end > weekEnd,
      }
    })
  }, [ranges, weekStart, weekEnd])

  return (
    <div className="border-b border-border last:border-b-0">
      {/* Cells with day numbers and droppable surfaces */}
      <div className="grid grid-cols-7">
        {week.cells.map((cell) => (
          <CalendarCell
            key={cell.iso}
            cell={cell}
            onCellClick={onCellClick}
          />
        ))}
      </div>
      {/* Multi-day bars layer */}
      {barsInWeek.length > 0 && (
        <div className="grid grid-cols-7 gap-y-0.5 px-1 pt-0.5">
          {barsInWeek.map((b) => (
            <EventBar
              key={`${b.range.id}-${week.index}`}
              range={b.range}
              startCol={b.startCol}
              endCol={b.endCol}
              continuesLeft={b.continuesLeft}
              continuesRight={b.continuesRight}
            />
          ))}
        </div>
      )}
      {/* Single-day events layer (per cell) */}
      <div className="grid grid-cols-7">
        {week.cells.map((cell) => (
          <CellEvents
            key={`${cell.iso}-events`}
            cell={cell}
            posts={postsByDate.get(cell.iso) ?? []}
            categoryById={categoryById}
            onPostClick={onPostClick}
          />
        ))}
      </div>
    </div>
  )
}

function CalendarCell({
  cell,
  onCellClick,
}: {
  cell: CalendarCellT
  onCellClick: (date: Date) => void
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `cell:${cell.iso}`,
    data: { type: "cell", iso: cell.iso, date: cell.date },
  })

  return (
    <div
      ref={setNodeRef}
      onClick={() => onCellClick(cell.date)}
      className={cn(
        "relative min-h-[110px] border-r border-border last:border-r-0 px-1.5 pt-1.5 pb-1 cursor-pointer transition-colors",
        cell.isCurrentMonth ? "bg-background" : "bg-secondary/20",
        isOver && "bg-secondary/60 ring-1 ring-inset ring-foreground/20",
      )}
    >
      <span
        className={cn(
          "inline-flex items-center justify-center size-6 text-xs tabular-nums",
          cell.isToday && "rounded-full bg-foreground text-background font-semibold",
          !cell.isCurrentMonth && "text-muted-foreground/60",
          cell.isCurrentMonth && !cell.isToday && "text-foreground",
        )}
      >
        {format(cell.date, "d")}
      </span>
    </div>
  )
}

function CellEvents({
  cell,
  posts,
  categoryById,
  onPostClick,
}: {
  cell: CalendarCellT
  posts: WithId<Post>[]
  categoryById: Map<string, WithId<Category>>
  onPostClick: (post: WithId<Post>) => void
}) {
  const visible = posts.slice(0, MAX_VISIBLE_PILLS)
  const overflow = posts.length - visible.length
  return (
    <div
      className={cn(
        "border-r border-border last:border-r-0 px-1 pb-1 flex flex-col gap-0.5 min-h-0",
        !cell.isCurrentMonth && "opacity-60",
      )}
    >
      {visible.map((p) => (
        <EventPill
          key={p.id}
          post={p}
          category={categoryById.get(p.categoryId ?? "") ?? null}
          onClick={() => onPostClick(p)}
        />
      ))}
      {overflow > 0 && (
        <span className="text-[11px] text-muted-foreground pl-1.5 leading-tight">
          + {overflow} more
        </span>
      )}
    </div>
  )
}
