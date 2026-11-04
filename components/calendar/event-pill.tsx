"use client"

import { useDraggable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { format, parseISO } from "date-fns"
import { useState } from "react"
import { Clock, Eye, Flag, PencilLine, Sparkles, TriangleAlert } from "lucide-react"
import { EventPeek } from "./event-peek"
import type { PrototypePost } from "@/components/agentic/types"
import type { WithId } from "@/lib/firebase/serialize"
import type { Category, Post } from "@/lib/schemas"
import { cn } from "@/lib/utils"
import { postStatusLabel } from "@/lib/labels/enums"
const PRIORITY_CLASS: Record<string, string> = {
  urgent: "text-destructive",
  high: "text-warning",
  normal: "text-brand-accent",
  low: "text-muted-foreground",
}

function pastelFor(post: Post): string {
  if (post.postType === "reel") return "border-badge-pink/40 bg-badge-pink/15"
  if (post.postType === "carousel") return "border-badge-violet/40 bg-badge-violet/15"
  if (post.postType === "story") return "border-badge-orange/40 bg-badge-orange/15"
  return "border-badge-emerald/40 bg-badge-emerald/15"
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
          data-post-id={post.id}
          {...listeners}
          {...attributes}
          style={{
            transform: CSS.Translate.toString(transform),
            opacity: isDragging ? 0.4 : undefined,
          }}
          className={cn(
            "flex min-h-11 w-full cursor-pointer flex-col justify-center gap-0 overflow-hidden rounded-md border px-1.5 py-1 text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            pastelFor(post),
            needsYou(post) && "ring-1 ring-warning/50",
          )}
          aria-label={`${category?.name ?? "Uncategorised"} - ${post.brief ?? "Untitled"} - ${postStatusLabel(post.status)}${ariaSuffix ? ` - ${ariaSuffix}` : ""}`}
        >
          <span className="flex min-w-0 items-center gap-1">
            {showPriorityFlag && (
              <Flag aria-hidden className={cn("size-2.5 shrink-0", PRIORITY_CLASS[priority])} />
            )}
            <StatusMark post={post} />
            <span className="min-w-0 flex-1 line-clamp-2 text-caption font-medium text-foreground">{post.brief ?? "Untitled"}</span>
            {isAi && <Sparkles aria-hidden className="size-2.5 shrink-0 opacity-70" />}
          </span>
          {time ? <span className="text-caption text-foreground">{time}</span> : null}
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
          data-post-id={post.id}
          className={cn(
            "flex min-h-11 w-full items-center gap-2 rounded-xl border px-3 py-2 text-left",
            pastelFor(post),
            needsYou(post) && "ring-1 ring-warning/50",
          )}
        >
          <StatusMark post={post} />
          <span className="min-w-0 flex-1 line-clamp-2 font-medium text-foreground">{post.brief ?? "Untitled"}</span>
          {category && <span className="shrink-0 text-caption text-muted-foreground">{category.name}</span>}
          <span className="shrink-0 text-caption text-foreground">{postStatusLabel(post.status)}</span>
        </button>
      }
    />
  )
}
