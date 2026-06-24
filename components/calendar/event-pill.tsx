"use client"

import { useDraggable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { format, parseISO } from "date-fns"
import { Pencil } from "lucide-react"
import type { WithId } from "@/lib/firebase/serialize"
import type { Category, Post } from "@/lib/schemas"
import { cn } from "@/lib/utils"
import { postStatusLabel } from "@/lib/labels/enums"
import { categoryPillColors } from "./color"
import { statusGlyph } from "./post-chip"

type Props = {
  post: WithId<Post>
  category: Pick<Category, "color" | "name"> | null
  onClick: (e: React.MouseEvent) => void
}

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

  const pillStyle = categoryPillColors(category?.color)

  return (
    <div className="relative group/pill">
      <button
        type="button"
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        onClick={onClick}
        style={{
          ...pillStyle,
          transform: CSS.Translate.toString(transform),
          opacity: isDragging ? 0.4 : undefined,
        }}
        className={cn(
          "block w-full text-left rounded-sm px-1.5 py-0.5 text-[11px] leading-tight truncate",
          "cursor-pointer hover:brightness-95 transition-[filter]",
        )}
        aria-label={`${category?.name ?? "Uncategorised"} - ${post.brief ?? "Untitled"} - ${postStatusLabel(post.status)}`}
      >
        <span aria-hidden className="font-bold mr-1">
          {statusGlyph(post.status)}
        </span>
        {time && <span className="font-semibold mr-1">{time}</span>}
        <span className="truncate">{post.brief ?? "Untitled"}</span>
      </button>

      {post.status === "scheduled" && (
        <button
          type="button"
          onClick={onClick}
          aria-label="Edit post"
          className="absolute top-0 right-0 opacity-0 group-hover/pill:opacity-100 transition-opacity p-0.5"
        >
          <Pencil aria-hidden className="h-4 w-4 text-[#181d26]/70" />
        </button>
      )}

      {/* Hover tooltip */}
      <div
        className={cn(
          "hidden group-hover/pill:block",
          "absolute left-0 top-full z-50 mt-1 w-52",
          "rounded-lg border border-border bg-popover shadow-xl p-2.5 text-xs",
          "pointer-events-none",
        )}
      >
        {category && (
          <div className="flex items-center gap-1.5 mb-1.5">
            <span
              aria-hidden
              className="size-2 rounded-full shrink-0"
              style={{ backgroundColor: category.color }}
            />
            <span className="text-muted-foreground truncate">{category.name}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 mb-0.5">
          {time && (
            <span className="font-semibold text-foreground">{time}</span>
          )}
          <span className="text-[10px] text-muted-foreground">
            {postStatusLabel(post.status)}
          </span>
        </div>
        <div className="text-foreground line-clamp-3 leading-snug">
          {post.brief ?? "Untitled"}
        </div>
      </div>
    </div>
  )
}
