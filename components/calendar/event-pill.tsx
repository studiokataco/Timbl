"use client"

import { useDraggable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { format, parseISO } from "date-fns"
import type { WithId } from "@/lib/firebase/serialize"
import type { Category, Post } from "@/lib/schemas"
import { cn } from "@/lib/utils"
import { lightenForBg } from "./color"

type Props = {
  post: WithId<Post>
  category: Pick<Category, "color" | "name"> | null
  onClick: () => void
}

/*
 * Single-day event pill. Pastel category background + bold time + title,
 * matching the shadcnuikit calendar event row. Draggable via @dnd-kit so
 * the orchestrator can move posts to other cells.
 */
export function EventPill({ post, category, onClick }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: post.id,
      data: { type: "post", post },
    })

  const time = post.scheduledTime
    ? format(parseISO(`${post.scheduledDate}T${post.scheduledTime}`), "h:mma")
        .toLowerCase()
        .replace(":00", "")
    : null

  const bg = lightenForBg(category?.color)
  const fg = "var(--color-foreground)"

  return (
    <button
      type="button"
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      style={{
        backgroundColor: bg,
        color: fg,
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.4 : undefined,
      }}
      className={cn(
        "block w-full text-left rounded-sm px-1.5 py-0.5 text-[11px] leading-tight truncate cursor-pointer hover:brightness-95 transition-[filter]",
      )}
      aria-label={`${category?.name ?? "Untitled"} — ${post.brief ?? "Untitled"}`}
    >
      {time && <span className="font-semibold mr-1">{time}</span>}
      <span className="truncate">{post.brief ?? "Untitled"}</span>
    </button>
  )
}
