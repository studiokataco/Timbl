"use client"

import { differenceInCalendarDays } from "date-fns"
import { cn } from "@/lib/utils"
import type { Category, Post, User } from "@/lib/schemas"

/*
 * Compact post chip shown inside calendar cells. Status indicator uses
 * shape + color so colour-blind users still get the signal:
 *   ● ready / posted
 *   ◐ in progress (designing/researching/review/scheduled)
 *   ○ idea / brief
 *   ⨯ missed
 */

const STATUS_GLYPH: Record<string, string> = {
  idea: "○",
  brief: "○",
  researching: "◐",
  designing: "◐",
  review: "◐",
  scheduled: "●",
  posted: "●",
  missed: "⨯",
  archived: "·",
}

export function PostChip({
  post,
  category,
  assignee,
}: {
  post: Pick<Post, "brief" | "status" | "scheduledDate">
  category: Pick<Category, "name" | "color"> | null
  assignee: Pick<User, "name"> | null
}) {
  const isPast =
    differenceInCalendarDays(new Date(), new Date(post.scheduledDate)) > 7
  const initials = assignee
    ? assignee.name
        .split(" ")
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : null

  const bg = category?.color ?? "var(--color-secondary)"
  const fg = "#181d26"

  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={`${category?.name ?? "Uncategorised"} — ${post.brief ?? "Untitled"} — ${post.status}`}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-tight cursor-pointer truncate w-full",
        isPast && "opacity-50",
      )}
      style={{ backgroundColor: bg, color: fg }}
    >
      <span aria-hidden className="font-bold">
        {STATUS_GLYPH[post.status] ?? "·"}
      </span>
      <span className="truncate flex-1">{post.brief ?? "Untitled"}</span>
      {initials ? (
        <span
          aria-hidden
          className="text-[9px] font-bold opacity-70 shrink-0"
        >
          {initials}
        </span>
      ) : null}
    </span>
  )
}
