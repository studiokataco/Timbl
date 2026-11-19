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
import { categoryPillColors } from "./color"
import { EventPill } from "./event-pill"

const IMPORTANCE_COLOR = { high: "#fb923c", medium: "#a855f7", low: "#94a3b8" } as const

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
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-background">
      <div className="grid shrink-0 grid-cols-7 border-b border-border bg-secondary/30">
        {DAY_NAMES.map((n) => (
          <div
            key={n}
            className="px-2 py-3 text-center text-caption text-muted-foreground"
          >
            {n}
          </div>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-auto">
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

  const covered = (index: number) => barsInWeek.filter((item) => index >= item.startCol && index <= item.endCol)
  const slots = Math.max(0, ...week.cells.map((_, index) => covered(index).length))

  return (
    <div className="grid min-h-36 flex-1 grid-cols-7 border-b border-border last:border-b-0 @3xl/iface:min-h-0">
      {week.cells.map((cell, index) => (
        <UnifiedCell
          key={cell.iso}
          cell={cell}
          posts={postsByDate.get(cell.iso) ?? []}
          categoryById={categoryById}
          slots={slots}
          bars={covered(index).map((item) => ({
            id: item.range.id,
            name: item.range.name,
            importance: item.range.importance,
            start: index === item.startCol,
          }))}
          onCellClick={onCellClick}
          onPostClick={onPostClick}
        />
      ))}
    </div>
  )
}

function UnifiedCell({
  cell,
  posts,
  categoryById,
  slots,
  bars,
  onCellClick,
  onPostClick,
}: {
  cell: CalendarCellT
  posts: WithId<Post>[]
  categoryById: Map<string, WithId<Category>>
  slots: number
  bars: { id: string; name: string; importance: "high" | "medium" | "low"; start: boolean }[]
  onCellClick: (date: Date) => void
  onPostClick: (post: WithId<Post>) => void
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `cell:${cell.iso}`,
    data: { type: "cell", iso: cell.iso, date: cell.date },
  })

  const visible = posts.slice(0, MAX_VISIBLE_PILLS)
  const overflow = posts.length - visible.length

  return (
    <div
      ref={setNodeRef}
      onClick={() => onCellClick(cell.date)}
      className={cn(
        "relative flex h-full min-h-36 cursor-pointer flex-col gap-2 border-r border-border px-2 py-2 transition-colors last:border-r-0 @3xl/iface:min-h-0 @3xl/iface:px-3 @3xl/iface:py-3",
        cell.isCurrentMonth ? "bg-background" : "bg-secondary/20",
        !cell.isCurrentMonth && "opacity-70",
        isOver && "bg-secondary/60 ring-1 ring-inset ring-foreground/20",
      )}
    >
      <span
        className={cn(
          "inline-flex size-8 items-center justify-center self-start text-body-sm tabular-nums",
          cell.isToday && "rounded-full bg-primary text-primary-foreground font-semibold",
          !cell.isCurrentMonth && "text-muted-foreground/60",
          cell.isCurrentMonth && !cell.isToday && "text-foreground",
        )}
      >
        {format(cell.date, "d")}
      </span>
      {slots > 0 ? (
        <div className="flex flex-col gap-1">
          {bars.map((bar) => {
            const color = IMPORTANCE_COLOR[bar.importance]
            return (
              <div
                key={bar.id}
                title={bar.name}
                className="h-6 truncate rounded-md px-2 text-caption leading-6"
                style={categoryPillColors(color)}
              >
                {bar.start ? bar.name : ""}
              </div>
            )
          })}
          {Array.from({ length: slots - bars.length }, (_, index) => (
            <div key={index} className="h-6" />
          ))}
        </div>
      ) : null}
      {visible.map((p) => (
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
      {overflow > 0 && (
        <span className="pl-0.5 text-caption leading-tight text-muted-foreground">
          +{overflow} more
        </span>
      )}
    </div>
  )
}
