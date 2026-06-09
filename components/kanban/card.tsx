"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { format, parseISO } from "date-fns"
import { Sparkles } from "lucide-react"
import type { WithId } from "@/lib/firebase/serialize"
import type { Category, Post, PostStatus, User } from "@/lib/schemas"
import { LEGACY_POST_STATUSES } from "@/lib/schemas"
import { cn } from "@/lib/utils"
import { ApprovalActions } from "@/components/agents/approval-actions"
import { statusGlyph } from "@/components/calendar/post-chip"
import { categoryPillColors } from "@/components/calendar/color"
import { postStatusLabel } from "@/lib/labels/enums"

type Props = {
  post: WithId<Post>
  category: WithId<Category> | undefined
  assignee: WithId<User> | undefined
  columnIds?: readonly string[]
  onClick: () => void
  onStatusChange?: (status: PostStatus) => void
  isDragging?: boolean
}

export function KanbanCard({
  post,
  category,
  assignee,
  columnIds,
  onClick,
  onStatusChange,
  isDragging,
}: Props) {
  const statuses =
    columnIds && columnIds.length > 0 ? columnIds : LEGACY_POST_STATUSES
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: post.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        /* Category tint - mirrors the chip tint on the calendar so a
         * post reads the same in either view. Falls back to a hairline
         * neutral when no category is set. */
        borderLeftColor: category?.color ?? undefined,
      }}
      {...attributes}
      {...listeners}
      className={cn(
        "bg-background border border-border border-l-4 rounded-lg p-3 md:cursor-grab md:active:cursor-grabbing",
        "hover:shadow-sm transition-shadow select-none",
        isDragging && "opacity-40",
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-1.5 mb-1.5 text-xs">
        {/* Tinted category pill with status glyph - the same chip the calendar
         * renders, so a post reads identically in either view. */}
        <span
          className="inline-flex min-w-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium"
          style={categoryPillColors(category?.color)}
        >
          <span aria-hidden className="font-bold" title={postStatusLabel(post.status)}>
            {statusGlyph(post.status)}
          </span>
          <span className="truncate">{category?.name ?? "Uncategorised"}</span>
        </span>
        <span className="flex-1" />
        {post.agentMeta && (
          <Sparkles
            aria-label="AI-assisted"
            className="size-3 text-muted-foreground/70 shrink-0"
          />
        )}
        <span className="whitespace-nowrap text-muted-foreground">
          {format(parseISO(post.scheduledDate), "d MMM")}
        </span>
      </div>
      <p className="text-sm leading-snug line-clamp-2 mb-2">
        {post.brief ?? <span className="italic text-muted-foreground">No brief</span>}
      </p>
      <div className="flex items-center justify-end gap-1">
        {assignee && (
          <span
            className="inline-flex items-center justify-center size-5 rounded-full bg-secondary text-xs font-medium shrink-0"
            title={assignee.name}
          >
            {assignee.name[0]?.toUpperCase()}
          </span>
        )}
      </div>
      {post.agentMeta?.reviewState === "pending" && (
        <div className="mt-2 pt-2 border-t border-border">
          <p
            className="text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-1.5"
          >
            Needs review
          </p>
          <ApprovalActions
            postId={post.id}
            nextAction={post.agentMeta?.nextAction}
            className="flex gap-1.5 items-center"
          />
        </div>
      )}
      {/*
       * Mobile-only status changer. Drag-and-drop is fiddly on touch so we
       * surface a native <select> that updates status in one tap. Hidden at
       * md+ where DnD works well.
       */}
      {onStatusChange && (
        <div className="md:hidden mt-2 pt-2 border-t border-border">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">
            Move to
          </label>
          <select
            value={post.status}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onStatusChange(e.target.value as PostStatus)}
            className="w-full text-xs rounded border border-border bg-background px-2 py-1"
          >
            {statuses.map((s) => (
              <option key={s} value={s}>
                {postStatusLabel(s)}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}
