"use client"

import { memo, type KeyboardEvent } from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { differenceInCalendarDays, format, parseISO } from "date-fns"
import { CalendarDays, Flag, Sparkles } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import type { WithId } from "@/lib/firebase/serialize"
import type { Category, ChannelKey, Post, PostStatus, User } from "@/lib/schemas"
import { LEGACY_POST_STATUSES } from "@/lib/schemas"
import { cn } from "@/lib/utils"
import { ApprovalActions } from "@/components/agents/approval-actions"
import { categoryPillColors } from "@/components/calendar/color"
import { ChannelGlyph } from "@/components/shared/channel-glyph"
import { postStatusLabel } from "@/lib/labels/enums"
import { formatPostTypes } from "@/lib/post-types"

type Props = {
  post: WithId<Post>
  category: WithId<Category> | undefined
  assignee: WithId<User> | undefined
  columnIds?: readonly string[]
  columnLabels?: ReadonlyMap<string, string>
  openWork?: boolean
  onClick: () => void
  onStatusChange?: (status: PostStatus) => void
  isDragging?: boolean
  selected?: boolean
  selectionActive?: boolean
  onToggleSelect?: () => void
  dragEnabled?: boolean
}

const CHANNEL_ORDER: ChannelKey[] = ["instagram", "facebook", "linkedin", "x", "fb_groups", "website"]

function dueLabel(iso: string, openWork: boolean) {
  const date = parseISO(iso)
  const days = differenceInCalendarDays(date, new Date())
  const tone: "overdue" | "soon" | "plain" =
    openWork && days < 0 ? "overdue" : openWork && days <= 1 ? "soon" : "plain"
  const text =
    days === 0
      ? "Today"
      : days === 1
        ? "Tomorrow"
        : days === -1
          ? "Yesterday"
          : format(date, Math.abs(days) > 300 ? "d MMM yyyy" : "d MMM")
  return { text, tone, full: format(date, "EEEE d MMMM yyyy") }
}

export const KanbanCard = memo(function KanbanCard({
  post,
  category,
  assignee,
  columnIds,
  columnLabels,
  openWork = true,
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
  /* The board renders columns twice (desktop drag tree + hidden mobile tree).
   * Both mount a card per post, so sharing `post.id` as the draggable id makes
   * the hidden (display:none) mobile node win dnd-kit's id slot and measure as a
   * zero rect - the drag overlay then collapses to a sliver pinned at 0,0. Only
   * the real draggable card claims `post.id`; the inert tree gets a dead id. */
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: sourceDragging } =
    useSortable({
      id: dragEnabled ? post.id : `inactive-${post.id}`,
      disabled: !dragEnabled,
      data: { type: "card", status: post.status },
    })
  const pendingReview = post.agentMeta?.reviewState === "pending"
  const selectable = pendingReview && !!onToggleSelect
  const due = dueLabel(post.scheduledDate, openWork)
  const channels = CHANNEL_ORDER.filter((c) => c in (post.channelStatuses ?? {}))
  const urgent = post.priority === "urgent" || post.priority === "high"

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      onClick()
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={dragEnabled ? { transform: CSS.Translate.toString(transform), transition } : undefined}
      {...(dragEnabled ? { ...attributes, ...listeners } : {})}
      role="button"
      tabIndex={0}
      aria-label={`${post.brief ?? "Untitled post"}, ${due.full}`}
      onKeyDown={onKeyDown}
      onClick={onClick}
      className={cn(
        "group/card relative w-full rounded-lg border border-border bg-card p-3 text-left select-none outline-none",
        "transition-[border-color,box-shadow,transform,opacity] duration-150 ease-out",
        "hover:border-foreground/20 hover:shadow-[0_1px_2px_rgb(0_0_0/0.06),0_2px_6px_rgb(0_0_0/0.04)]",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
        "animate-in fade-in-0 motion-reduce:animate-none",
        dragEnabled && "md:cursor-grab md:active:cursor-grabbing",
        sourceDragging && "opacity-30",
        isDragging && "rotate-[1.5deg] cursor-grabbing border-foreground/25 shadow-[0_8px_20px_-6px_rgb(0_0_0/0.25)] motion-reduce:rotate-0",
        selected && "border-foreground/40 ring-2 ring-foreground/15",
      )}
    >
      <div className="flex min-h-5 items-center gap-1.5">
        {category ? (
          <span
            className="inline-flex min-w-0 max-w-full items-center rounded-full px-2 py-0.5 text-[11px] font-medium leading-4"
            style={categoryPillColors(category.color)}
          >
            <span className="truncate">{category.name}</span>
          </span>
        ) : null}
        {urgent ? (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-0.5 text-[11px] font-medium",
              post.priority === "urgent"
                ? "text-red-600 dark:text-red-400"
                : "text-amber-700 dark:text-amber-400",
            )}
          >
            <Flag aria-hidden className="size-3" />
            {post.priority === "urgent" ? "Urgent" : "High"}
          </span>
        ) : null}
        <span className="flex-1" />
        {post.agentMeta && !selectable ? (
          <Sparkles aria-label="Drafted with AI" className="size-3.5 shrink-0 text-muted-foreground" />
        ) : null}
        {selectable ? (
          <span
            className={cn(
              "-my-1 shrink-0 transition-opacity duration-150",
              selected || selectionActive
                ? "opacity-100"
                : "opacity-100 md:opacity-0 md:group-hover/card:opacity-100 md:group-focus-within/card:opacity-100",
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
      </div>

      <p className="mt-2 line-clamp-3 text-[13px] font-medium leading-[1.4] text-foreground text-pretty">
        {post.brief ?? <span className="text-muted-foreground">No brief yet</span>}
      </p>

      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <span
          title={due.full}
          className={cn(
            "inline-flex shrink-0 items-center gap-1 tabular-nums",
            due.tone === "overdue" && "font-medium text-red-600 dark:text-red-400",
            due.tone === "soon" && "font-medium text-foreground",
          )}
        >
          <CalendarDays aria-hidden className="size-3.5" />
          {due.tone === "overdue" ? `Overdue · ${due.text}` : due.text}
        </span>
        <span aria-hidden className="text-border">/</span>
        <span className="min-w-0 truncate">{formatPostTypes(post)}</span>
        <span className="flex-1" />
        {channels.length > 0 ? (
          <span className="flex shrink-0 items-center gap-1" aria-label={`Channels: ${channels.join(", ")}`}>
            {channels.slice(0, 3).map((c) => (
              <ChannelGlyph key={c} channel={c} className="size-3.5" />
            ))}
            {channels.length > 3 ? (
              <span className="text-[11px] tabular-nums">+{channels.length - 3}</span>
            ) : null}
          </span>
        ) : null}
        {assignee ? (
          <span
            title={`Assigned to ${assignee.name}`}
            className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold text-foreground ring-1 ring-border"
          >
            {assignee.name[0]?.toUpperCase()}
          </span>
        ) : null}
      </div>

      {pendingReview && !isDragging ? (
        <div className="-mx-3 -mb-3 mt-3 rounded-b-lg border-t border-amber-200/70 bg-amber-50/70 px-3 pb-3 pt-2.5 dark:border-amber-400/15 dark:bg-amber-400/[0.06]">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-amber-800 dark:text-amber-300">
            <span aria-hidden className="size-1.5 rounded-full bg-amber-500" />
            Waiting on your review
          </p>
          <ApprovalActions
            postId={post.id}
            nextAction={post.agentMeta?.nextAction}
            className="grid grid-cols-2 gap-1.5"
          />
        </div>
      ) : null}

      {onStatusChange && !isDragging ? (
        <div
          className="mt-3 flex items-center gap-2 border-t border-border pt-3 md:hidden"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <label htmlFor={`move-${post.id}`} className="shrink-0 text-xs text-muted-foreground">
            Move to
          </label>
          <select
            id={`move-${post.id}`}
            value={post.status}
            onChange={(e) => onStatusChange(e.target.value as PostStatus)}
            className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-sm"
          >
            {statuses.map((s) => (
              <option key={s} value={s}>
                {columnLabels?.get(s) ?? postStatusLabel(s)}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </div>
  )
})
