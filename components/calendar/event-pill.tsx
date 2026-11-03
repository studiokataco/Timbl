"use client"

import { useDraggable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { format, parseISO } from "date-fns"
import { useState } from "react"
import { Clock, Eye, Flag, PencilLine, Sparkles, TriangleAlert } from "lucide-react"
import { EventPeek } from "@/components/mockup/agentic/interface/calendar-fragment"
import type { PrototypePost } from "@/components/mockup/agentic/types"
import type { WithId } from "@/lib/firebase/serialize"
import type { Category, Post } from "@/lib/schemas"
import { cn } from "@/lib/utils"
import { postStatusLabel } from "@/lib/labels/enums"
import { categoryPillColors } from "./color"

const PRIORITY_COLOR: Record<string, string> = {
  urgent: "#ef4444",
  high: "#f59e0b",
  normal: "#3b82f6",
  low: "#94a3b8",
}
const PRIORITY_LABEL: Record<string, string> = {
  urgent: "Urgent",
  high: "High",
  normal: "Normal",
  low: "Low",
}

function needsYou(post: Post): boolean {
  return post.agentMeta?.reviewState === "pending" || post.status === "review" || post.status === "needs_approval"
}

function asPrototype(post: WithId<Post>): PrototypePost {
  return {
    ...post,
    tile: { headline: post.brief ?? "Untitled", format: post.postType ?? "post" },
    contentRev: 1,
  }
}

function askAbout(post: WithId<Post>) {
  window.dispatchEvent(
    new CustomEvent("timbl:ask", {
      detail: { id: post.id, title: post.brief || post.blurb || "Untitled post" },
    }),
  )
}

export function StatusMark({ post }: { post: Post }) {
  const icon = "mr-1 inline size-3 shrink-0 align-text-top"
  if (needsYou(post)) return <TriangleAlert aria-hidden className={cn(icon, "text-warning")} />
  if (post.status === "scheduled") return <Clock aria-hidden className={cn(icon, "text-current")} />
  if (post.status === "posted") return <Eye aria-hidden className={cn(icon, "text-current")} />
  return <PencilLine aria-hidden className={cn(icon, "text-current")} />
}

function Peek({
  post,
  onOpen,
  trigger,
}: {
  post: WithId<Post>
  onOpen: () => void
  trigger: React.ReactElement
}) {
  const [open, setOpen] = useState(false)
  return (
    <EventPeek
      open={open}
      onOpenChange={setOpen}
      trigger={trigger}
      postId={post.id}
      post={asPrototype(post)}
      unread={{ count: 0, mentions: 0 }}
      onAskAbout={() => {
        setOpen(false)
        askAbout(post)
      }}
      onOpenNotes={() => {
        setOpen(false)
        onOpen()
      }}
    />
  )
}

type Props = {
  post: WithId<Post>
  category: Pick<Category, "color" | "name"> | null
  onClick: (e: React.MouseEvent) => void
}

export function EventPill({ post, category, onClick }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: post.id,
    data: { type: "post", post },
  })
  const time = post.scheduledTime
    ? format(parseISO(`${post.scheduledDate}T${post.scheduledTime}`), "h:mma").toLowerCase().replace(":00", "")
    : null
  const priority = post.priority
  const showPriorityFlag = priority === "urgent" || priority === "high"
  const isAi = Boolean(post.isAiGenerated || post.agentMeta)
  const ariaSuffix = [priority ? `${PRIORITY_LABEL[priority]} priority` : null, isAi ? "AI-assisted" : null]
    .filter(Boolean)
    .join(" - ")

  return (
    <div onClick={(event) => event.stopPropagation()}>
    <Peek
      post={post}
      onOpen={() => onClick({} as React.MouseEvent)}
      trigger={
        <button
          type="button"
          ref={setNodeRef}
          {...listeners}
          {...attributes}
          style={{
            ...categoryPillColors(category?.color),
            transform: CSS.Translate.toString(transform),
            opacity: isDragging ? 0.4 : undefined,
          }}
          className={cn(
            "block w-full cursor-pointer truncate rounded-sm border border-transparent px-1.5 py-0.5 text-left text-[11px] leading-tight transition-[filter] hover:brightness-95",
            needsYou(post) && "ring-1 ring-warning/50",
          )}
          aria-label={`${category?.name ?? "Uncategorised"} - ${post.brief ?? "Untitled"} - ${postStatusLabel(post.status)}${ariaSuffix ? ` - ${ariaSuffix}` : ""}`}
        >
          {showPriorityFlag && (
            <Flag aria-hidden className="mr-1 inline size-2.5 align-text-top" style={{ color: PRIORITY_COLOR[priority] }} />
          )}
          <StatusMark post={post} />
          {time && <span className="mr-1 font-semibold">{time}</span>}
          <span className="truncate">{post.brief ?? "Untitled"}</span>
          {isAi && <Sparkles aria-hidden className="ml-1 inline size-2.5 align-text-top opacity-70" />}
        </button>
      }
    />
    </div>
  )
}

export function EventListItem({
  post,
  category,
  onOpen,
}: {
  post: WithId<Post>
  category: Pick<Category, "color" | "name"> | null
  onOpen: () => void
}) {
  return (
    <Peek
      post={post}
      onOpen={onOpen}
      trigger={
        <button
          type="button"
          style={categoryPillColors(category?.color)}
          className={cn(
            "flex w-full items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-left text-sm",
            needsYou(post) && "ring-1 ring-warning/50",
          )}
        >
          <StatusMark post={post} />
          <span className="min-w-0 flex-1 truncate font-medium">{post.brief ?? "Untitled"}</span>
          {category && <span className="shrink-0 text-xs opacity-70">{category.name}</span>}
          <span className="shrink-0 text-xs opacity-70">{postStatusLabel(post.status)}</span>
        </button>
      }
    />
  )
}
