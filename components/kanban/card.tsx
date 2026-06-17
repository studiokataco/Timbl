"use client"

import { memo } from "react"
import { useDraggable } from "@dnd-kit/core"
import { format, parseISO } from "date-fns"
import { Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import type { WithId } from "@/lib/firebase/serialize"
import type { Category, Post, PostStatus, User } from "@/lib/schemas"
import { LEGACY_POST_STATUSES } from "@/lib/schemas"
import { cn } from "@/lib/utils"
import { ApprovalActions } from "@/components/agents/approval-actions"
import { statusGlyph } from "@/components/calendar/post-chip"
import { categoryPillColors } from "@/components/calendar/color"
import { postStatusLabel } from "@/lib/labels/enums"
import { formatPostTypes } from "@/lib/post-types"

type Props = {
  post: WithId<Post>
  category: WithId<Category> | undefined
  assignee: WithId<User> | undefined
  columnIds?: readonly string[]
  statusColor?: string
  onClick: () => void
  onStatusChange?: (status: PostStatus) => void
  isDragging?: boolean
  selected?: boolean
  selectionActive?: boolean
  onToggleSelect?: () => void
  dragEnabled?: boolean
}

export const KanbanCard = memo(function KanbanCard({
  post,
  category,
  assignee,
  columnIds,
  statusColor,
  onClick,
  onStatusChange,
  isDragging,
  selected,
  selectionActive,
  onToggleSelect,
  dragEnabled = true,
}: Props) {
  const statuses =
    columnIds && columnIds.length > 0 ? columnIds : LEGACY_POST_STATUSES
  const { attributes, listeners, setNodeRef, isDragging: sourceDragging } =
    useDraggable({
      id: post.id,
      disabled: !dragEnabled,
    })
  const pendingReview = post.agentMeta?.reviewState === "pending"
  const selectable = pendingReview && !!onToggleSelect

  return (
    <div
      ref={setNodeRef}
      style={{
        borderLeftColor: statusColor ?? category?.color ?? undefined,
      }}
      {...(dragEnabled ? { ...attributes, ...listeners } : {})}
      className={cn(
        "group relative rounded-lg border border-border border-l-4 bg-background p-3 transition-shadow select-none",
        dragEnabled && "md:cursor-grab md:active:cursor-grabbing",
        "hover:shadow-sm",
        (isDragging || sourceDragging) && "opacity-40",
        selected && "ring-2 ring-primary/40",
      )}
      onClick={onClick}
    >
      {selectable ? (
        <span
          className={cn(
            "absolute right-3 top-3 shrink-0 transition-opacity",
            selected || selectionActive
              ? "opacity-100"
              : "opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100",
          )}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <Checkbox
            checked={!!selected}
            onCheckedChange={() => onToggleSelect?.()}
            aria-label="Select for bulk approval"
          />
        </span>
      ) : null}
      <div className={cn(selectable && "pr-8")}>
        <p className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
          {post.brief ?? (
            <span className="italic text-muted-foreground">No brief</span>
          )}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
          <span>{format(parseISO(post.scheduledDate), "d MMM yyyy")}</span>
          <span aria-hidden>·</span>
          <Badge variant="secondary" className="h-5 px-1.5 text-[11px] font-normal">
            {postStatusLabel(post.status)}
          </Badge>
          <span aria-hidden>·</span>
          <span className="capitalize">{formatPostTypes(post)}</span>
          {post.agentMeta ? (
            <Sparkles
              aria-label="AI-assisted"
              className="size-3 text-muted-foreground/70"
            />
          ) : null}
        </div>
        {category || assignee ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {category ? (
              <span
                className="inline-flex max-w-full items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium"
                style={categoryPillColors(category.color)}
              >
                <span aria-hidden className="font-bold">
                  {statusGlyph(post.status)}
                </span>
                <span className="truncate">{category.name}</span>
              </span>
            ) : null}
            {assignee ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="inline-flex size-5 items-center justify-center rounded-full bg-secondary text-[10px] font-medium">
                  {assignee.name[0]?.toUpperCase()}
                </span>
                {assignee.name}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      {pendingReview ? (
        <div className="mt-3 border-t border-border pt-3">
          <p className="mb-1.5 text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-400">
            Needs review
          </p>
          <ApprovalActions
            postId={post.id}
            nextAction={post.agentMeta?.nextAction}
            className="flex items-center gap-1.5"
          />
        </div>
      ) : null}
      {onStatusChange ? (
        <div
          className="mt-3 border-t border-border pt-3 md:hidden"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">
            Move to
          </label>
          <select
            value={post.status}
            onChange={(e) => onStatusChange(e.target.value as PostStatus)}
            className="w-full rounded border border-border bg-background px-2 py-2 text-xs"
          >
            {statuses.map((s) => (
              <option key={s} value={s}>
                {postStatusLabel(s)}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </div>
  )
})
